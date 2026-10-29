import { JobsOptions, Queue } from "bullmq";
import { connection } from "../queue/connection";
import { DEFAULT_TIMEZONE } from "../config";
import { Medication } from "../models/medication";
import { UserSettings } from "../models/userSettings";
import { isValidTimezone } from "../kafka/contracts/user-settings";
import {
  isReminderSchedulerId,
  reminderSchedulerId,
  toCronPattern,
  ReminderRule,
} from "./pattern";

export const REMINDER_QUEUE = "medication-reminders";
export const JOB_SEND_REMINDER = "send-reminder";
export const JOB_RECONCILE = "reconcile";
const MAINTENANCE_ID = "maintenance_reconcile";

export const reminderQueue = new Queue(REMINDER_QUEUE, { connection });

const REMINDER_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "fixed", delay: 10_000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

const safeTimezone = (tz: string | undefined | null): string =>
  isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;

export async function resolveTimezone(userId: string): Promise<string> {
  const settings = await UserSettings.findOne({ userId }).lean();
  return safeTimezone(settings?.timezone);
}

async function upsertScheduler(
  medicationId: string,
  pattern: string,
  tz: string,
): Promise<void> {
  // same id => the existing scheduler is updated in place, never duplicated
  await reminderQueue.upsertJobScheduler(
    reminderSchedulerId(medicationId),
    { pattern, tz },
    {
      name: JOB_SEND_REMINDER,
      data: { medicationId },
      opts: REMINDER_JOB_OPTIONS,
    },
  );
}

/** Creates or updates the recurring reminder of one medication. Throws if the rule is invalid. */
export async function upsertReminder(
  medication: ReminderRule & { id: string },
  timezone: string,
): Promise<void> {
  await upsertScheduler(
    medication.id,
    toCronPattern(medication),
    safeTimezone(timezone),
  );
}

export async function removeReminder(medicationId: string): Promise<void> {
  await reminderQueue.removeJobScheduler(reminderSchedulerId(medicationId));
}

/** Re-schedules every medication of a user (their timezone changed). */
export async function rescheduleUser(
  userId: string,
  timezone: string,
): Promise<number> {
  const medications = await Medication.find({ userId }).lean();
  let count = 0;
  for (const medication of medications) {
    try {
      await upsertReminder(medication, timezone);
      count++;
    } catch (err) {
      console.error(
        `[reminders] cannot schedule medication ${medication.id}:`,
        err,
      );
    }
  }
  return count;
}

/**
 * Makes Redis match MongoDB (the source of truth): creates missing schedulers, fixes changed ones,
 * removes orphans. Runs at startup (covers a wiped Redis) and nightly (covers missed updates).
 */
export async function reconcileReminders(): Promise<{
  created: number;
  updated: number;
  removed: number;
  invalid: number;
}> {
  const existing = new Map<string, { pattern?: string; tz?: string }>();
  for (const scheduler of await reminderQueue.getJobSchedulers(0, -1)) {
    if (isReminderSchedulerId(scheduler.key))
      existing.set(scheduler.key, scheduler);
  }

  const timezones = new Map<string, string>();
  for await (const settings of UserSettings.find().lean().cursor()) {
    timezones.set(settings.userId, settings.timezone);
  }

  const stats = { created: 0, updated: 0, removed: 0, invalid: 0 };

  for await (const medication of Medication.find().lean().cursor()) {
    const key = reminderSchedulerId(medication.id);
    const current = existing.get(key);
    existing.delete(key); // seen: whatever remains in the map afterwards is an orphan

    let pattern: string;
    try {
      pattern = toCronPattern(medication);
    } catch (err) {
      stats.invalid++;
      console.error(
        `[reminders] invalid medication ${medication.id}:`,
        (err as Error).message,
      );
      if (current) existing.set(key, current); // invalid rule: do not keep firing it
      continue;
    }

    const tz = safeTimezone(timezones.get(medication.userId));
    if (current && current.pattern === pattern && current.tz === tz) continue;

    await upsertScheduler(medication.id, pattern, tz);
    if (current) stats.updated++;
    else stats.created++;
  }

  for (const key of existing.keys()) {
    await reminderQueue.removeJobScheduler(key);
    stats.removed++;
  }
  return stats;
}

/** Nightly self-healing job, executed by the same worker. */
export async function scheduleMaintenance(): Promise<void> {
  await reminderQueue.upsertJobScheduler(
    MAINTENANCE_ID,
    { pattern: "30 3 * * *", tz: "UTC" },
    {
      name: JOB_RECONCILE,
      opts: { removeOnComplete: { count: 7 }, removeOnFail: { count: 7 } },
    },
  );
}
