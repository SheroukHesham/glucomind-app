import { Schema, model } from "mongoose";
import {
  REGISTRATION_STEPS,
  RegistrationStep,
  SagaStatus,
  StepPayloads,
  StepStatus,
} from "../Kafka/contracts/registration";

/**
 * One document per registration attempt. It is the memory of the saga: if the service crashes or
 * is restarted, everything it needs to continue (or to roll back) is read from here.
 */
export interface SagaDoc {
  _id: string; // registrationId: the client's Idempotency-Key
  userId: string; // id of the user being created (also used by every participant)
  email: string;
  status: SagaStatus;
  /** true once the pending user exists, i.e. once there is something to compensate locally. */
  userCreated: boolean;
  steps: Record<RegistrationStep, StepStatus>;
  /** The slices sent to the participants. Kept only while the saga is running (health data). */
  payloads?: StepPayloads;
  error?: string;
  errorCode?: string;
  /** When commands were last sent: the sweeper resends only when this is old enough. */
  lastSentAt?: Date;
  attempts: number;
  /** Whether the "registration completed" event reached Kafka. */
  completedPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const STEP_STATUSES: StepStatus[] = [
  "PENDING",
  "DONE",
  "FAILED",
  "COMPENSATED",
];
const stepField = { type: String, enum: STEP_STATUSES, default: "PENDING" };
// built from REGISTRATION_STEPS: adding a participant needs no change here
const steps = Object.fromEntries(
  REGISTRATION_STEPS.map((step) => [step, stepField]),
);

const sagaSchema = new Schema<SagaDoc>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    email: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "COMPENSATING", "COMPLETED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    userCreated: { type: Boolean, default: false },
    steps,
    payloads: Schema.Types.Mixed,
    error: String,
    errorCode: String,
    lastSentAt: Date,
    attempts: { type: Number, default: 0 },
    completedPublished: { type: Boolean, default: false },
  },
  { timestamps: true, minimize: false },
);

// Finished sagas are kept 30 days: that is how long an Idempotency-Key is remembered.
sagaSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 3600,
    partialFilterExpression: { status: { $in: ["COMPLETED", "FAILED"] } },
  },
);

export const Saga = model<SagaDoc>("RegistrationSaga", sagaSchema);
