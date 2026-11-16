import { randomBytes } from "crypto";
import {
  REGISTRATION_STEPS,
  RegistrationStep,
  RegistrationView,
  StepCommand,
  StepPayloads,
  StepResult,
} from "./Kafka/contracts/registration";
import {
  activateUser,
  createPendingUser,
  deletePendingUser,
  isDuplicateKeyError,
} from "./db";
import { hashPassword } from "../auth/password";
import {
  publishRegistrationCommand,
  publishRegistrationCompleted,
} from "./Kafka/producers";
import { Saga, SagaDoc } from "./saga.model";
import { RegistrationRequest } from "./validation";

const STEPS = [...REGISTRATION_STEPS];

export interface SagaOptions {
  /** A saga that is still PENDING after this long is rolled back. */
  timeoutMs?: number;
  /** Commands are resent only when the last send is at least this old. */
  resendAfterMs?: number;
  /** After this long a rollback that is still not acknowledged is reported as an error. */
  compensationAlertMs?: number;
}

const FINAL = new Set(["COMPLETED", "FAILED"]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message: string, ...rest: unknown[]) =>
  console.log(`[registration] ${message}`, ...rest);

/** What the client is allowed to see. COMPENSATING is still "PENDING": the rollback has not finished. */
export function toView(saga: SagaDoc): RegistrationView {
  if (saga.status === "COMPLETED") {
    return {
      registrationId: saga._id,
      status: "COMPLETED",
      userId: saga.userId,
    };
  }
  if (saga.status === "FAILED") {
    return {
      registrationId: saga._id,
      status: "FAILED",
      error: saga.error,
      code: saga.errorCode,
    };
  }
  return { registrationId: saga._id, status: "PENDING" };
}

/**
 * Orchestrates the registration across user-service, medication-service and recommender-service.
 *
 *   start()  -> saves the saga, creates the PENDING user, sends CREATE to every participant
 *   handleResult()
 *       all steps DONE        -> activate the user, status COMPLETED, publish "registration completed"
 *       any step failed       -> status COMPENSATING, delete the pending user, send ROLLBACK to EVERY
 *                                participant; once all acknowledged -> status FAILED
 *   sweep()  -> runs periodically and repairs everything that can go wrong in between:
 *               lost messages, a crash, a participant that never answers.
 *
 * Every step is idempotent and every state change is a conditional update ("only if the status is
 * still X"), so duplicate or late messages and several instances of this service cannot corrupt it.
 */
export class RegistrationSaga {
  private readonly timeoutMs: number;
  private readonly resendAfterMs: number;
  private readonly compensationAlertMs: number;

  constructor(options: SagaOptions = {}) {
    this.timeoutMs =
      options.timeoutMs ??
      Number(process.env.REGISTRATION_TIMEOUT_MS ?? 60_000);
    this.resendAfterMs =
      options.resendAfterMs ??
      Number(process.env.REGISTRATION_RESEND_AFTER_MS ?? 10_000);
    this.compensationAlertMs = options.compensationAlertMs ?? 10 * 60_000;
  }

  /* ----------------------------------------------------------------------------------------- */
  /* Starting                                                                                    */
  /* ----------------------------------------------------------------------------------------- */
  async start(
    registrationId: string,
    request: RegistrationRequest,
  ): Promise<RegistrationView> {
    // The same Idempotency-Key always returns the same saga: retries and double taps are harmless.
    const existing = await Saga.findById(registrationId).lean();
    if (existing) return toView(existing);

    const userId = randomBytes(12).toString("hex"); // a valid MongoDB ObjectId, created before anything else
    const passwordHash = await hashPassword(request.password);
    const payloads: StepPayloads = {
      medication: {
        timezone: request.timezone,
        medications: request.medications,
      },
      diet: {
        timezone: request.timezone,
        age: request.age,
        gender: request.gender,
        ...request.diet,
      },
    };

    // 1. Record the intent FIRST. If anything below crashes, the sweeper finds this document.
    try {
      await Saga.create({
        _id: registrationId,
        userId,
        email: request.email,
        payloads,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        // two identical requests raced: the other one won
        const winner = await Saga.findById(registrationId).lean();
        if (winner) return toView(winner);
      }
      throw error;
    }

    // 2. This service's own local transaction: the user, as PENDING (cannot log in yet)
    try {
      await createPendingUser({
        id: userId,
        registrationId,
        username: request.username,
        email: request.email,
        passwordHash,
        age: request.age,
        gender: request.gender,
      });
      await Saga.updateOne(
        { _id: registrationId },
        { $set: { userCreated: true } },
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        // Nothing was sent to any participant yet, so there is nothing to compensate.
        await this.failBeforeSteps(
          registrationId,
          "EMAIL_TAKEN",
          "Email already registered",
        );
        return toView((await Saga.findById(registrationId).lean())!);
      }
      await this.failBeforeSteps(
        registrationId,
        "INTERRUPTED",
        "The account could not be created",
      );
      throw error;
    }

    // 3. Ask the participants to save their slice. If Kafka is down the sweeper sends it later.
    await this.sendCreates({ _id: registrationId, userId }, payloads, STEPS);
    return toView((await Saga.findById(registrationId).lean())!);
  }

  async getView(registrationId: string): Promise<RegistrationView | null> {
    const saga = await Saga.findById(registrationId).lean();
    return saga ? toView(saga) : null;
  }

  /** Waits (polling the database) until the saga is COMPLETED or FAILED, or the time is up. */
  async waitForOutcome(
    registrationId: string,
    timeoutMs: number,
  ): Promise<RegistrationView | null> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const saga = await Saga.findById(registrationId).lean();
      if (!saga) return null;
      if (FINAL.has(saga.status) || Date.now() >= deadline) return toView(saga);
      await sleep(100);
    }
  }

  /* ----------------------------------------------------------------------------------------- */
  /* Results coming back from the participants                                                   */
  /* ----------------------------------------------------------------------------------------- */
  async handleResult(result: StepResult): Promise<void> {
    const { registrationId, step } = result;

    if (result.action === "ROLLBACK") {
      if (!result.ok) {
        log(
          `rollback of "${step}" failed for ${registrationId}: ${result.error}. It will be retried.`,
        );
        return;
      }
      await Saga.updateOne(
        { _id: registrationId },
        { $set: { [`steps.${step}`]: "COMPENSATED" } },
      );
      await this.finalizeCompensation(registrationId);
      return;
    }

    if (!result.ok) {
      await Saga.updateOne(
        { _id: registrationId, [`steps.${step}`]: "PENDING" },
        { $set: { [`steps.${step}`]: "FAILED" } },
      );
      await this.fail(
        registrationId,
        `${result.error ?? "the step failed"}`,
        "STEP_FAILED",
      );
      return;
    }

    // Only a PENDING saga with a PENDING step accepts a DONE. A duplicate, or a late answer from a
    // saga that is already rolling back, changes nothing (the rollback reaches every participant).
    const saga = await Saga.findOneAndUpdate(
      { _id: registrationId, status: "PENDING", [`steps.${step}`]: "PENDING" },
      { $set: { [`steps.${step}`]: "DONE" } },
      { new: true },
    ).lean();

    if (saga && STEPS.every((s) => saga.steps[s] === "DONE"))
      await this.complete(saga);
  }

  /* ----------------------------------------------------------------------------------------- */
  /* Success                                                                                     */
  /* ----------------------------------------------------------------------------------------- */
  private async complete(saga: Pick<SagaDoc, "_id" | "userId">): Promise<void> {
    await activateUser(saga.userId); // idempotent: safe to repeat if we crash right after
    const done = await Saga.findOneAndUpdate(
      { _id: saga._id, status: "PENDING" },
      { $set: { status: "COMPLETED" }, $unset: { payloads: "" } },
    ).lean();
    if (!done) return; // somebody else completed or failed it first
    log(`completed ${saga._id}`);
    await this.publishCompleted(saga._id, saga.userId);
  }

  /** Follow-up work that must happen only for registrations that really succeeded (first meal plan...). */
  private async publishCompleted(
    registrationId: string,
    userId: string,
  ): Promise<void> {
    try {
      await publishRegistrationCompleted({ registrationId, userId });
      await Saga.updateOne(
        { _id: registrationId },
        { $set: { completedPublished: true } },
      );
    } catch (error) {
      log(
        `could not publish "completed" for ${registrationId}; the sweeper will retry`,
        error,
      );
    }
  }

  /* ----------------------------------------------------------------------------------------- */
  /* Failure and compensation                                                                    */
  /* ----------------------------------------------------------------------------------------- */
  /** Before any command was sent: nothing to compensate, the saga simply ends. */
  private async failBeforeSteps(
    registrationId: string,
    code: string,
    message: string,
  ): Promise<void> {
    await Saga.updateOne(
      { _id: registrationId, status: "PENDING" },
      {
        $set: { status: "FAILED", error: message, errorCode: code },
        $unset: { payloads: "" },
      },
    );
  }

  /** Only the FIRST failure wins; later ones find the saga already COMPENSATING and do nothing. */
  private async fail(
    registrationId: string,
    message: string,
    code: string,
  ): Promise<void> {
    const saga = await Saga.findOneAndUpdate(
      { _id: registrationId, status: "PENDING" },
      {
        $set: {
          status: "COMPENSATING",
          error: message,
          errorCode: code,
          lastSentAt: new Date(),
        },
        $unset: { payloads: "" },
      },
    ).lean();
    if (!saga) return;
    log(`rolling back ${registrationId}: ${message}`);

    try {
      await deletePendingUser(saga.userId); // this service's own compensation
    } catch (error) {
      log(
        `could not delete the pending user of ${registrationId}; the sweeper will retry`,
        error,
      );
    }
    // ROLLBACK goes to EVERY participant, also to the one that failed and to those that never
    // answered: they may have saved something, or may still receive the CREATE later.
    await this.sendRollbacks(registrationId, saga.userId, STEPS);
  }

  /** The saga ends as FAILED only when every participant confirmed that it undid its work. */
  private async finalizeCompensation(registrationId: string): Promise<void> {
    const filter: Record<string, unknown> = {
      _id: registrationId,
      status: "COMPENSATING",
    };
    for (const step of STEPS) filter[`steps.${step}`] = "COMPENSATED";
    const done = await Saga.findOneAndUpdate(filter, {
      $set: { status: "FAILED" },
    }).lean();
    if (done) log(`rollback of ${registrationId} finished`);
  }

  /* ----------------------------------------------------------------------------------------- */
  /* Sending                                                                                     */
  /* ----------------------------------------------------------------------------------------- */
  private async sendCreates(
    saga: Pick<SagaDoc, "_id" | "userId">,
    payloads: StepPayloads,
    steps: RegistrationStep[],
  ): Promise<void> {
    await Saga.updateOne(
      { _id: saga._id },
      { $set: { lastSentAt: new Date() }, $inc: { attempts: 1 } },
    );
    for (const step of steps) {
      const command: StepCommand = {
        type: "CREATE",
        registrationId: saga._id,
        userId: saga.userId,
        step,
        payload: payloads[step],
      };
      try {
        await publishRegistrationCommand(command);
      } catch (error) {
        log(
          `could not send CREATE "${step}" for ${saga._id}; the sweeper will retry`,
          error,
        );
      }
    }
  }

  private async sendRollbacks(
    registrationId: string,
    userId: string,
    steps: RegistrationStep[],
  ): Promise<void> {
    await Saga.updateOne(
      { _id: registrationId },
      { $set: { lastSentAt: new Date() }, $inc: { attempts: 1 } },
    );
    for (const step of steps) {
      const command: StepCommand = {
        type: "ROLLBACK",
        registrationId,
        userId,
        step,
      };
      try {
        await publishRegistrationCommand(command);
      } catch (error) {
        log(
          `could not send ROLLBACK "${step}" for ${registrationId}; the sweeper will retry`,
          error,
        );
      }
    }
  }

  /* ----------------------------------------------------------------------------------------- */
  /* Repair loop                                                                                 */
  /* ----------------------------------------------------------------------------------------- */
  /**
   * Call every few seconds. Safe to run on several instances at once.
   *  - PENDING, user never created   -> the request died half way: end it
   *  - PENDING, all steps DONE       -> we crashed before completing: complete it
   *  - PENDING, too old              -> a participant is silent: roll back
   *  - PENDING, commands not acknowledged -> resend them (participants are idempotent)
   *  - COMPENSATING                  -> delete the pending user again, resend ROLLBACK to those not yet confirmed
   *  - COMPLETED, event not published -> publish it
   */
  async sweep(): Promise<void> {
    const now = Date.now();
    const due = (saga: SagaDoc) =>
      !saga.lastSentAt ||
      now - new Date(saga.lastSentAt).getTime() >= this.resendAfterMs;

    for (const saga of await Saga.find({ status: "PENDING" }).lean()) {
      const age = now - new Date(saga.createdAt).getTime();

      if (!saga.userCreated) {
        if (age > this.timeoutMs) {
          await this.failBeforeSteps(
            saga._id,
            "INTERRUPTED",
            "The registration was interrupted, please try again",
          );
        }
        continue;
      }
      if (STEPS.every((s) => saga.steps[s] === "DONE")) {
        await this.complete(saga);
        continue;
      }
      if (age > this.timeoutMs) {
        const waiting = STEPS.filter((s) => saga.steps[s] !== "DONE");
        await this.fail(
          saga._id,
          "Registration took too long, please try again",
          "TIMEOUT",
        );
        log(`${saga._id} timed out waiting for: ${waiting.join(", ")}`);
        continue;
      }
      if (due(saga) && saga.payloads) {
        const waiting = STEPS.filter((s) => saga.steps[s] === "PENDING");
        await this.sendCreates(saga, saga.payloads, waiting);
      }
    }

    for (const saga of await Saga.find({ status: "COMPENSATING" }).lean()) {
      try {
        await deletePendingUser(saga.userId);
      } catch (error) {
        log(`could not delete the pending user of ${saga._id}`, error);
      }
      const remaining = STEPS.filter((s) => saga.steps[s] !== "COMPENSATED");
      if (remaining.length === 0) {
        await this.finalizeCompensation(saga._id);
        continue;
      }
      if (due(saga)) await this.sendRollbacks(saga._id, saga.userId, remaining);
      if (now - new Date(saga.createdAt).getTime() > this.compensationAlertMs) {
        console.error(
          `[registration] ALERT: rollback of ${saga._id} is stuck waiting for: ${remaining.join(", ")}`,
        );
      }
    }

    for (const saga of await Saga.find({
      status: "COMPLETED",
      completedPublished: false,
    }).lean()) {
      if (due(saga)) await this.publishCompleted(saga._id, saga.userId);
    }
  }
}
