import { randomUUID } from "crypto";
import { FREQUENCIES, Medication } from "./models/medication";
import { SagaTombstone } from "./models/sagaTombstone";
import { UserSettings } from "./models/userSettings";
import { removeReminder, upsertReminder } from "./reminders/scheduler";
import { toCronPattern } from "./reminders/pattern";
import { isValidTimezone } from "./kafka/contracts/user-settings";
import {
  MedicationSlice,
  StepCommand,
  StepResult,
} from "./kafka/contracts/registration";

/** The data is not acceptable (a business rule). The message is shown to the end user. */
export class StepRejected extends Error {}

/** Checks everything BEFORE anything is written, so a bad slice fails cleanly. */
export function validateSlice(payload: unknown): MedicationSlice {
  if (typeof payload !== "object" || payload === null)
    throw new StepRejected("The medication data is missing");
  const slice = payload as Partial<MedicationSlice>;

  if (!isValidTimezone(slice.timezone))
    throw new StepRejected("The timezone is not valid");
  if (!Array.isArray(slice.medications))
    throw new StepRejected("The medication list is missing");

  slice.medications.forEach((med, index) => {
    const label = `Medication ${index + 1}${med && typeof med.name === "string" ? ` (${med.name})` : ""}`;
    if (!med || typeof med.name !== "string" || med.name.trim() === "") {
      throw new StepRejected(`${label}: the name is required`);
    }
    if (med.frequency !== undefined && !FREQUENCIES.includes(med.frequency)) {
      throw new StepRejected(
        `${label}: the frequency must be daily, weekly or monthly`,
      );
    }
    try {
      toCronPattern(med); // the same rule the reminder scheduler applies
    } catch (error) {
      throw new StepRejected(`${label}: ${(error as Error).message}`);
    }
  });
  return slice as MedicationSlice;
}

/**
 * CREATE: saves the user's timezone and medications and schedules the reminders.
 * Idempotent: running it twice leaves exactly the same data (upserts keyed by registrationId + position).
 */
export async function createForRegistration(
  command: StepCommand<"medication">,
): Promise<void> {
  if (await SagaTombstone.exists({ _id: command.registrationId })) {
    throw new StepRejected("This registration was cancelled");
  }
  const slice = validateSlice(command.payload);
  const { registrationId, userId } = command;

  await UserSettings.updateOne(
    { userId },
    { $set: { timezone: slice.timezone, updatedAt: new Date() } },
    { upsert: true },
  );

  for (const [seq, med] of slice.medications.entries()) {
    await Medication.updateOne(
      { registrationId, seq },
      {
        // $setOnInsert keeps the id of the first attempt when the command is processed again
        $setOnInsert: {
          id: randomUUID(),
          userId,
          registrationId,
          seq,
          name: med.name.trim(),
          time: med.time,
          frequency: med.frequency ?? "daily",
          dayOfWeek: med.dayOfWeek,
          dayOfMonth: med.dayOfMonth,
        },
      },
      { upsert: true },
    );
  }

  // Redis side effect. If it fails the step fails, and the saga's rollback removes everything above.
  const saved = await Medication.find({ registrationId }).lean();
  for (const med of saved) await upsertReminder(med, slice.timezone);
}

/**
 * ROLLBACK (the compensation): removes everything CREATE may have written.
 * Idempotent, and safe even if CREATE never ran or has not arrived yet.
 */
export async function rollbackRegistration(
  command: StepCommand<"medication">,
): Promise<void> {
  const { registrationId, userId } = command;

  // 1. FIRST the tombstone: from now on a late CREATE of this registration is refused
  await SagaTombstone.updateOne(
    { _id: registrationId },
    { $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );

  // 2. reminders (Redis) before the documents, because the ids are needed to find them.
  //    If Redis is down this throws: the rollback is reported as failed and the saga retries it.
  const saved = await Medication.find({ registrationId }).lean();
  for (const med of saved) await removeReminder(med.id);

  // 3. the data
  await Medication.deleteMany({ registrationId });
  await UserSettings.deleteOne({ userId });
}

/** Runs one command and turns the outcome into the answer for the saga. Never throws. */
export async function handleCommand(
  command: StepCommand<"medication">,
): Promise<StepResult> {
  const base = {
    registrationId: command.registrationId,
    step: command.step,
    action: command.type,
  } as const;
  try {
    if (command.type === "CREATE") await createForRegistration(command);
    else await rollbackRegistration(command);
    return { ...base, ok: true };
  } catch (error) {
    if (error instanceof StepRejected)
      return { ...base, ok: false, error: error.message };
    console.error(
      `[registration] medication ${command.type} failed for ${command.registrationId}:`,
      error,
    );
    return {
      ...base,
      ok: false,
      error: "The medication service could not save the medications",
    };
  }
}
