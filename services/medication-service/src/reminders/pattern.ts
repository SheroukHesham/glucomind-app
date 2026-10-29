import type { Frequency } from "../models/medication";

export interface ReminderRule {
  time: string; // "HH:mm" in the user's local time
  frequency?: Frequency | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SCHEDULER_PREFIX = "med_";

/**
 * Converts a stored medication rule into a cron pattern (evaluated in the user's timezone).
 *   daily   "08:30"            -> "30 8 * * *"
 *   weekly  "08:30", Monday=1  -> "30 8 * * 1"
 *   monthly "08:30", day 15    -> "30 8 15 * *"   (day 29-31 -> "L" = last day of the month)
 * Throws on invalid input so bad data is rejected instead of silently never firing.
 */
export function toCronPattern(rule: ReminderRule): string {
  const match = TIME_PATTERN.exec(rule.time ?? "");
  if (!match) throw new Error(`Invalid time "${rule.time}" (expected HH:mm)`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);

  switch (rule.frequency ?? "daily") {
    case "daily":
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

export const reminderSchedulerId = (medicationId: string): string =>
  `${SCHEDULER_PREFIX}${medicationId}`;

export const isReminderSchedulerId = (id: string): boolean =>
  id.startsWith(SCHEDULER_PREFIX);

export function reminderText(
  name: string,
  frequency?: Frequency | null,
): {
  title: string;
  body: string;
} {
  switch (frequency) {
    case "weekly":
      return {
        title: "Weekly Medication Reminder",
        body: `Take ${name} today`,
      };
    case "monthly":
      return {
        title: "Monthly Medication Reminder",
        body: `Take ${name} today`,
      };
    default:
      return { title: "Medication Reminder", body: `Time to take ${name}` };
  }
}
