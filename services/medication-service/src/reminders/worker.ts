import { Job, Worker } from "bullmq";
import { connection } from "../queue/connection";
import {
  REMINDER_MAX_LATENESS_MS,
  REMINDER_WORKER_CONCURRENCY,
} from "../config";
import { Medication } from "../models/medication";
import { notifyUser } from "./notify";
import { localNow, reminderText, reminderWindow, slotsOf } from "./pattern";
import {
  JOB_RECONCILE,
  JOB_SEND_REMINDER,
  REMINDER_QUEUE,
  reconcileReminders,
  removeReminderSlot,
  resolveTimezone,
} from "./scheduler";

type ReminderJobData = { medicationId: string; slot?: string };

async function handleReminder(job: Job<ReminderJobData>): Promise<string> {
  const { medicationId, slot } = job.data;

  // Scheduler created by the previous (single-slot) version. The startup reconcile replaces it.
  if (!slot) return "skipped: legacy scheduler";

  // The job was due at (creation time + delay). Drop it if an outage made it hopelessly late.
  const dueAt = job.timestamp + (job.delay ?? 0);
  const lateByMs = Date.now() - dueAt;
  if (lateByMs > REMINDER_MAX_LATENESS_MS) {
    return `skipped: ${Math.round(lateByMs / 60_000)} min late`;
  }

  // Read the medication NOW, so edits made after scheduling are respected.
  const medication = await Medication.findOne({ id: medicationId }).lean();
  if (!medication) {
    await removeReminderSlot(medicationId, slot); // stale scheduler of a deleted medication
    return "skipped: medication deleted";
  }
  if (!slotsOf(medication).includes(slot)) {
    await removeReminderSlot(medicationId, slot); // this intake time was edited away
    return "skipped: intake time no longer scheduled";
  }

  // Enforce the course window in the user's local calendar.
  const tz = await resolveTimezone(medication.userId);
  const window = reminderWindow(medication, localNow(tz));
  if (window === "expired") {
    await removeReminderSlot(medicationId, slot); // course finished (or one-time dose is not today)
    return "skipped: outside the medication's date range, scheduler removed";
  }
  if (window === "upcoming") return "skipped: course has not started yet";

  const { title, body } = reminderText(medication.name, medication.frequency, {
    dosage: medication.dosage,
    notes: medication.notes,
  });
  const delivered = await notifyUser(
    medication.userId,
    { title, body },
    { type: "medication-reminder", medicationId: medication.id, slot },
  );

  // A one-time dose is done: don't let its yearly cron fire again.
  if (medication.frequency === "once") {
    await removeReminderSlot(medicationId, slot);
  }

  return delivered > 0
    ? `sent to ${delivered} device(s)`
    : "skipped: user has no devices";
}

export async function processJob(job: Job): Promise<string> {
  switch (job.name) {
    case JOB_SEND_REMINDER:
      return handleReminder(job as Job<ReminderJobData>);
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
