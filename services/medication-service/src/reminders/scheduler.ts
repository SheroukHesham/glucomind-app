import { JobsOptions, Queue } from "bullmq";
import { connection } from "../queue/connection";
import { DEFAULT_TIMEZONE } from "../config";
import { Medication } from "../models/medication";
import { UserSettings } from "../models/userSettings";
import { isValidTimezone } from "../kafka/contracts/user-settings";
import {
  isReminderSchedulerId,
  localNow,
  reminderSchedulerId,
  reminderWindow,
  toCronPatterns,
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
  slot: string,
  pattern: string,
  tz: string,
): Promise<void> {
  // same id => the existing scheduler is updated in place, never duplicated
  await reminderQueue.upsertJobScheduler(
    reminderSchedulerId(medicationId, slot),
    { pattern, tz },
    {
      name: JOB_SEND_REMINDER,
      data: { medicationId, slot },
      opts: REMINDER_JOB_OPTIONS,
    },
  );
}

/**
 * Creates or updates the recurring reminders of one medication (one scheduler per intake slot).
 * Slots that disappeared (pass them in `previousSlots`) are removed, and so is everything once the
 * course has ended. Throws if the rule is invalid, before touching Redis.
 */
export async function upsertReminder(
  medication: ReminderRule & { id: string },
  timezone: string,
  previousSlots: string[] = [],
): Promise<void> {
  const tz = safeTimezone(timezone);
  const patterns = toCronPatterns(medication);
  const expired = reminderWindow(medication, localNow(tz)) === "expired";
  const wanted = expired ? [] : patterns;

  for (const { slot, pattern } of wanted) {
    await upsertScheduler(medication.id, slot, pattern, tz);
  }

  const keep = new Set(wanted.map((p) => p.slot));
  const stale = new Set(
    [...previousSlots, ...patterns.map((p) => p.slot)].filter(
      (s) => !keep.has(s),
    ),
  );
  for (const slot of stale) await removeReminderSlot(medication.id, slot);
}

export async function removeReminderSlot(
  medicationId: string,
  slot: string,
): Promise<void> {
  await reminderQueue.removeJobScheduler(
    reminderSchedulerId(medicationId, slot),
  );
}

export async function removeReminder(
  medicationId: string,
  slots: string[],
): Promise<void> {
  for (const slot of slots) await removeReminderSlot(medicationId, slot);
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
 * removes orphans (deleted medications, removed slots, finished courses, invalid rules and the
 * single-slot `med_<id>` schedulers of the previous version). Runs at startup (covers a wiped Redis)
 * and nightly (covers missed updates).
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
    // Anything we `continue` past without deleting from `existing` is removed as an orphan below.
    let patterns: { slot: string; pattern: string }[];
    try {
      patterns = toCronPatterns(medication);
    } catch (err) {
      stats.invalid++;
      console.error(
        `[reminders] invalid medication ${medication.id}:`,
        (err as Error).message,
      );
      continue; // invalid rule: do not keep firing it
    }

    const tz = safeTimezone(timezones.get(medication.userId));
    const now = localNow(tz);
    // time is passed so an already-fired one-time dose is not resurrected for next year
    if (reminderWindow(medication, now) === "expired") continue;

    for (const { slot, pattern } of patterns) {
      const key = reminderSchedulerId(medication.id, slot);
      const current = existing.get(key);
      existing.delete(key); // seen: whatever remains in the map afterwards is an orphan

      if (current && current.pattern === pattern && current.tz === tz) continue;

      await upsertScheduler(medication.id, slot, pattern, tz);
      if (current) stats.updated++;
      else stats.created++;
    }
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
