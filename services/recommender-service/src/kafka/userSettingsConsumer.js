const { Kafka, logLevel } = require("kafkajs");
const { USER_SETTINGS_TOPIC, isValidTimezone } = require("./contracts");
const { UserSettings } = require("../models/userSettings");
const { upsertMealSchedule, removeMealSchedule } = require("../meal/queue");

const SERVICE_NAME = "recommender-service"; // clientId = <service>-<role>, groupId = <service>-<topic>

const kafka = new Kafka({
  clientId: `${SERVICE_NAME}-consumer`,
  brokers: (process.env.KAFKA_BROKER || "kafka:9092")
    .split(",")
    .map((b) => b.trim()),
  logLevel: logLevel.WARN,
  retry: { retries: 8 },
});
const consumer = kafka.consumer({
  groupId: `${SERVICE_NAME}-${USER_SETTINGS_TOPIC}`,
});

/**
 * Returns null for malformed messages (skipped, not retried).
 * @param {Buffer | null} key
 * @param {Buffer | null} value
 * @returns {{ type: "delete", userId: string } | { type: "upsert", userId: string, timezone: string } | null}
 */
function parseUserSettingsMessage(key, value) {
  const userId = key ? key.toString() : "";
  if (!userId) return null;
  if (value === null) return { type: "delete", userId };
  try {
    const parsed = JSON.parse(value.toString());
    return parsed && isValidTimezone(parsed.timezone)
      ? { type: "upsert", userId, timezone: parsed.timezone }
      : null;
  } catch {
    return null;
  }
}

/**
 * Idempotent. Schedules BEFORE saving so a failed attempt is retried instead of skipped.
 * @param {string} userId
 * @param {string | null} timezone null = the user's settings were removed
 */
async function applyUserSettings(userId, timezone) {
  if (timezone === null) {
    await removeMealSchedule(userId);
    await UserSettings.deleteOne({ userId });
    return;
  }
  const current = await UserSettings.findOne({ userId }).lean();
  if (current && current.timezone === timezone) return;

  await upsertMealSchedule(userId, timezone);
  await UserSettings.updateOne(
    { userId },
    { $set: { timezone, updatedAt: new Date() } },
    { upsert: true },
  );
}

async function startUserSettingsSync() {
  await consumer.connect();
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

async function stopUserSettingsSync() {
  await consumer.disconnect();
}

module.exports = {
  startUserSettingsSync,
  stopUserSettingsSync,
  parseUserSettingsMessage,
  applyUserSettings,
};
