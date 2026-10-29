import { createKafka, consumerGroup } from "./client";
import {
  USER_SETTINGS_TOPIC,
  isValidTimezone,
} from "./contracts/user-settings";
import { UserSettings } from "../models/userSettings";
import { rescheduleUser } from "../reminders/scheduler";
import { DEFAULT_TIMEZONE } from "../config";

export type UserSettingsAction =
  | { type: "delete"; userId: string }
  | { type: "upsert"; userId: string; timezone: string };

/** Returns null for malformed messages (skipped, not retried). */
export function parseUserSettingsMessage(
  key: Buffer | null,
  value: Buffer | null,
): UserSettingsAction | null {
  const userId = key?.toString();
  if (!userId) return null;
  if (value === null) return { type: "delete", userId };

  try {
    const parsed: unknown = JSON.parse(value.toString());
    if (typeof parsed !== "object" || parsed === null) return null;
    const timezone = (parsed as Record<string, unknown>).timezone;
    return isValidTimezone(timezone)
      ? { type: "upsert", userId, timezone }
      : null;
  } catch {
    return null;
  }
}

/** Idempotent: unchanged settings cause no work. Reschedules BEFORE saving so a failed retry is not skipped. */
export async function applyUserSettings(
  userId: string,
  timezone: string | null,
): Promise<void> {
  const current = await UserSettings.findOne({ userId }).lean();

  if (timezone === null) {
    if (!current) return;
    await rescheduleUser(userId, DEFAULT_TIMEZONE);
    await UserSettings.deleteOne({ userId });
    return;
  }

  if (current?.timezone === timezone) return;
  await rescheduleUser(userId, timezone);
  await UserSettings.updateOne(
    { userId },
    { $set: { timezone, updatedAt: new Date() } },
    { upsert: true },
  );
}

const consumer = createKafka("consumer").consumer({
  groupId: consumerGroup(USER_SETTINGS_TOPIC),
});

export async function startUserSettingsSync(): Promise<void> {
  await consumer.connect();
  // fromBeginning: a fresh database rebuilds every user's timezone from the compacted topic
  await consumer.subscribe({ topic: USER_SETTINGS_TOPIC, fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const action = parseUserSettingsMessage(message.key, message.value);
      if (!action) {
        console.warn(
          "[user-settings] skipped malformed message at offset",
          message.offset,
        );
        return;
      }
      await applyUserSettings(
        action.userId,
        action.type === "delete" ? null : action.timezone,
      );
    },
  });
}

export async function stopUserSettingsSync(): Promise<void> {
  await consumer.disconnect();
}
