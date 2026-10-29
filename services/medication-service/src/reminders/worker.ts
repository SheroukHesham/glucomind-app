import { Job, Worker } from "bullmq";
import { connection } from "../queue/connection";
import {
  REMINDER_MAX_LATENESS_MS,
  REMINDER_WORKER_CONCURRENCY,
} from "../config";
import { Medication } from "../models/medication";
import { notifyUser } from "./notify";
import { reminderText } from "./pattern";
import {
  JOB_RECONCILE,
  JOB_SEND_REMINDER,
  REMINDER_QUEUE,
  reconcileReminders,
  removeReminder,
} from "./scheduler";

async function handleReminder(
  job: Job<{ medicationId: string }>,
): Promise<string> {
  // The job was due at (creation time + delay). Drop it if an outage made it hopelessly late.
  const dueAt = job.timestamp + (job.delay ?? 0);
  const lateByMs = Date.now() - dueAt;
  if (lateByMs > REMINDER_MAX_LATENESS_MS) {
    return `skipped: ${Math.round(lateByMs / 60_000)} min late`;
  }

  // Read the medication NOW, so edits made after scheduling are respected.
  const medication = await Medication.findOne({
    id: job.data.medicationId,
  }).lean();
  if (!medication) {
    await removeReminder(job.data.medicationId); // stale scheduler of a deleted medication
    return "skipped: medication deleted";
  }

  const { title, body } = reminderText(medication.name, medication.frequency);
  const delivered = await notifyUser(
    medication.userId,
    { title, body },
    {
      type: "medication-reminder",
      medicationId: medication.id,
    },
  );
  return delivered > 0
    ? `sent to ${delivered} device(s)`
    : "skipped: user has no devices";
}

export async function processJob(job: Job): Promise<string> {
  switch (job.name) {
    case JOB_SEND_REMINDER:
      return handleReminder(job as Job<{ medicationId: string }>);
    case JOB_RECONCILE:
      return JSON.stringify(await reconcileReminders());
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

export function startReminderWorker(): Worker {
  const worker = new Worker(REMINDER_QUEUE, processJob, {
    connection,
    concurrency: REMINDER_WORKER_CONCURRENCY,
  });
  worker.on("failed", (job, err) =>
    console.error(
      `[reminders] job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
      err.message,
    ),
  );
  worker.on("error", (err) => console.error("[reminders] worker error:", err));
  return worker;
}
