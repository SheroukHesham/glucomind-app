// CANONICAL COPY: edit only in libs/event-contracts/.
// Copies in services/*/src/kafka/contracts/ are overwritten by scripts/sync-contracts.sh.
//
// Registration saga: user-service (orchestrator) asks each participant to save its slice of the
// registration (CREATE) and, if any step fails, asks all of them to undo it (ROLLBACK).
import { TOPICS, Topic } from "./topics";

/**
 * The services that take part in the saga. To add a participant (for example the emergency service):
 * add its name here, add its command topic below and its slice type further down. Nothing else in the
 * orchestrator has to change.
 */
export const REGISTRATION_STEPS = ["medication", "diet"] as const;
export type RegistrationStep = (typeof REGISTRATION_STEPS)[number];

/** Topic that carries the commands of each step (key = registrationId). */
export const COMMAND_TOPIC: Record<RegistrationStep, Topic> = {
  medication: TOPICS.REGISTRATION_MEDICATION_COMMAND,
  diet: TOPICS.REGISTRATION_DIET_COMMAND,
};
/** Participants answer here (key = registrationId). */
export const REGISTRATION_RESULT_TOPIC = TOPICS.REGISTRATION_RESULT;
/** Published once, after the whole saga succeeded (key = userId). Used for follow-up work. */
export const REGISTRATION_COMPLETED_TOPIC = TOPICS.REGISTRATION_COMPLETED;

/* ---------------------------------------------------------------------------------------------
 * The slice of the registration form each service receives.
 * ------------------------------------------------------------------------------------------- */
export type MedicationFrequency = "daily" | "weekly" | "monthly";

export interface MedicationInput {
  name: string;
  time: string; // "HH:mm", in the user's timezone
  frequency?: MedicationFrequency;
  dayOfWeek?: number; // 0 = Sunday (weekly)
  dayOfMonth?: number; // monthly
}

export interface MedicationSlice {
  timezone: string; // IANA name
  medications: MedicationInput[]; // may be empty
}

export interface DietSlice {
  timezone: string;
  age: number;
  gender: "Male" | "Female";
  dailyCalories: number;
  dietaryRestrictions: string[];
  medicalConditions: string[];
  likedMeals: string[];
  dislikedMeals: string[];
}

export interface StepPayloads {
  medication: MedicationSlice;
  diet: DietSlice;
}

/* ---------------------------------------------------------------------------------------------
 * Messages
 * ------------------------------------------------------------------------------------------- */
export interface StepCommand<S extends RegistrationStep = RegistrationStep> {
  type: "CREATE" | "ROLLBACK";
  registrationId: string;
  userId: string;
  step: S;
  /** Only on CREATE. */
  payload?: StepPayloads[S];
}

export interface StepResult {
  registrationId: string;
  step: RegistrationStep;
  action: "CREATE" | "ROLLBACK";
  ok: boolean;
  /** Safe to show to the end user. */
  error?: string;
}

export interface RegistrationCompleted {
  registrationId: string;
  userId: string;
}

/* ---------------------------------------------------------------------------------------------
 * States
 * ------------------------------------------------------------------------------------------- */
export type SagaStatus = "PENDING" | "COMPENSATING" | "COMPLETED" | "FAILED";
export type StepStatus = "PENDING" | "DONE" | "FAILED" | "COMPENSATED";

/** What the client sees. COMPENSATING is reported as PENDING: the rollback is not finished yet. */
export type RegistrationOutcome = "PENDING" | "COMPLETED" | "FAILED";

export interface RegistrationView {
  registrationId: string;
  status: RegistrationOutcome;
  userId?: string; // only when COMPLETED
  error?: string; // only when FAILED
  code?: string; // only when FAILED: EMAIL_TAKEN | STEP_FAILED | TIMEOUT | INTERRUPTED
}

/* ---------------------------------------------------------------------------------------------
 * Runtime guards (messages come from Kafka: never trust their shape)
 * ------------------------------------------------------------------------------------------- */
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const isStep = (v: unknown): v is RegistrationStep =>
  typeof v === "string" &&
  (REGISTRATION_STEPS as readonly string[]).includes(v);

export function isStepCommand(v: unknown): v is StepCommand {
  return (
    isObject(v) &&
    (v.type === "CREATE" || v.type === "ROLLBACK") &&
    typeof v.registrationId === "string" &&
    v.registrationId !== "" &&
    typeof v.userId === "string" &&
    v.userId !== "" &&
    isStep(v.step)
  );
}

export function isStepResult(v: unknown): v is StepResult {
  return (
    isObject(v) &&
    typeof v.registrationId === "string" &&
    isStep(v.step) &&
    (v.action === "CREATE" || v.action === "ROLLBACK") &&
    typeof v.ok === "boolean"
  );
}

export function isRegistrationCompleted(
  v: unknown,
): v is RegistrationCompleted {
  return (
    isObject(v) &&
    typeof v.registrationId === "string" &&
    typeof v.userId === "string" &&
    v.userId !== ""
  );
}
