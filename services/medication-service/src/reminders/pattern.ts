import { Frequency, MAX_DOSES_PER_DAY } from "../models/medication";

export interface ReminderRule {
  frequency?: Frequency | null;
  times?: string[] | null; // "HH:mm" slots in the user's local time
  time?: string | null; // legacy single slot (documents saved before `times` existed)
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  startDate?: string | null; // "YYYY-MM-DD", user's local calendar
  endDate?: string | null; // inclusive
}

export type ReminderWindow = "upcoming" | "active" | "expired";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SCHEDULER_PREFIX = "med_";

export function isValidDate(value: string): boolean {
  const m = DATE_PATTERN.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

/** The intake slots of a medication, sorted, falling back to the legacy `time` field. */
export function slotsOf(rule: ReminderRule): string[] {
  const raw = rule.times?.length ? rule.times : rule.time ? [rule.time] : [];
  return [...raw].sort(); // "HH:mm" sorts chronologically as a string
}

/** Throws a user-presentable message if the rule can never produce a sensible schedule. */
export function validateRule(rule: ReminderRule): void {
  const frequency = rule.frequency ?? "daily";
  const slots = slotsOf(rule);

  if (slots.length === 0)
    throw new Error("At least one intake time is required (HH:mm)");
  for (const slot of slots) {
    if (!TIME_PATTERN.test(slot)) {
      throw new Error(`Invalid time "${slot}" (expected HH:mm)`);
    }
  }
  if (new Set(slots).size !== slots.length) {
    throw new Error("Intake times must be unique");
  }

  if (frequency === "times_per_day") {
    if (slots.length < 2 || slots.length > MAX_DOSES_PER_DAY) {
      throw new Error(
        `"times_per_day" needs between 2 and ${MAX_DOSES_PER_DAY} intake times`,
      );
    }
  } else if (slots.length !== 1) {
    throw new Error(
      `"${frequency}" medications take exactly one time; use "times_per_day" for several intakes a day`,
    );
  }

  if (rule.startDate && !isValidDate(rule.startDate)) {
    throw new Error(
      `Invalid startDate "${rule.startDate}" (expected YYYY-MM-DD)`,
    );
  }
  if (rule.endDate && !isValidDate(rule.endDate)) {
    throw new Error(`Invalid endDate "${rule.endDate}" (expected YYYY-MM-DD)`);
  }
  if (rule.startDate && rule.endDate && rule.endDate < rule.startDate) {
    throw new Error("endDate cannot be before startDate");
  }
  if (frequency === "once" && !rule.startDate) {
    throw new Error(
      "One-time medications need a startDate (the day to take it)",
    );
  }
}

function cronFor(rule: ReminderRule, slot: string): string {
  const match = TIME_PATTERN.exec(slot)!;
  const hour = Number(match[1]);
  const minute = Number(match[2]);

  switch (rule.frequency ?? "daily") {
    case "once": {
      const [, , month, day] = DATE_PATTERN.exec(rule.startDate!)!.map(Number);
      return `${minute} ${hour} ${day} ${month} *`;
    }
    case "daily":
    case "times_per_day":
      return `${minute} ${hour} * * *`;
    case "weekly": {
      const day = rule.dayOfWeek;
      if (
        typeof day !== "number" ||
        !Number.isInteger(day) ||
        day < 0 ||
        day > 6
      ) {
        throw new Error("Weekly medications need dayOfWeek 0-6 (0 = Sunday)");
      }
      return `${minute} ${hour} * * ${day}`;
    }
    case "monthly": {
      const day = rule.dayOfMonth ?? 1;
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        throw new Error("Monthly medications need dayOfMonth 1-31");
      }
      return `${minute} ${hour} ${day > 28 ? "L" : day} * *`;
    }
    default:
      throw new Error(`Unknown frequency "${String(rule.frequency)}"`);
  }
}

/**
 * One cron pattern per intake slot (evaluated in the user's timezone). Throws on invalid input.
 *   once          2026-11-15 08:30       -> "30 8 15 11 *"
 *   daily         08:30                  -> "30 8 * * *"
 *   times_per_day 08:00, 14:30, 21:00    -> "0 8 * * *", "30 14 * * *", "0 21 * * *"
 *   weekly        08:30, Monday=1        -> "30 8 * * 1"
 *   monthly       08:30, day 15          -> "30 8 15 * *"   (day 29-31 -> "L" = last day of the month)
 * startDate/endDate are NOT part of the cron: they are enforced by reminderWindow() because
 * cron cannot express a date range in a user's local calendar.
 */
export function toCronPatterns(
  rule: ReminderRule,
): { slot: string; pattern: string }[] {
  validateRule(rule);
  return slotsOf(rule).map((slot) => ({ slot, pattern: cronFor(rule, slot) }));
}

/** Current calendar date and clock time in a timezone. */
export function localNow(
  tz: string,
  now: Date = new Date(),
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * Where "now" sits relative to the medication's course.
 * Pass `time` to also treat a one-time dose whose time has already passed today as expired
 * (used when scheduling; the worker omits it so a job firing right on its minute still sends).
 */
export function reminderWindow(
  rule: ReminderRule,
  now: { date: string; time?: string },
): ReminderWindow {
  if ((rule.frequency ?? "daily") === "once") {
    if (!rule.startDate) return "expired";
    if (now.date < rule.startDate) return "upcoming";
    if (now.date > rule.startDate) return "expired";
    if (now.time && (slotsOf(rule)[0] ?? "") <= now.time) return "expired";
    return "active";
  }
  if (rule.startDate && now.date < rule.startDate) return "upcoming";
  if (rule.endDate && now.date > rule.endDate) return "expired";
  return "active";
}

/** One scheduler per intake slot: "med_<medicationId>:<HHmm>". */
export const reminderSchedulerId = (
  medicationId: string,
  slot: string,
): string => `${SCHEDULER_PREFIX}${medicationId}:${slot.replace(":", "")}`;

export const isReminderSchedulerId = (id: string): boolean =>
  id.startsWith(SCHEDULER_PREFIX);

export function reminderText(
  name: string,
  frequency?: Frequency | null,
  details: { dosage?: string | null; notes?: string | null } = {},
): { title: string; body: string } {
  const detail = [details.dosage, details.notes].filter(Boolean).join(" · ");
  const suffix = detail ? ` (${detail})` : "";

  switch (frequency) {
    case "weekly":
      return {
        title: "Weekly Medication Reminder",
        body: `Take ${name} today${suffix}`,
      };
    case "monthly":
      return {
        title: "Monthly Medication Reminder",
        body: `Take ${name} today${suffix}`,
      };
    default:
      return {
        title: "Medication Reminder",
        body: `Time to take ${name}${suffix}`,
      };
  }
}
