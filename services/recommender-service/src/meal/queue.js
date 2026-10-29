const { Queue } = require("bullmq");
const { connection } = require("../queue/connection");
const { UserSettings } = require("../models/userSettings");
const { isValidTimezone } = require("../kafka/contracts");

const MEAL_QUEUE = "meal-generation";
const JOB_GENERATE = "generate-meal";
const JOB_RECONCILE = "reconcile";
const SCHEDULER_PREFIX = "meal_";
const MAINTENANCE_ID = "maintenance_reconcile";

/** Local time of day when each user's plan is generated (cron, evaluated in the user's timezone). */
const MEAL_GENERATION_CRON = process.env.MEAL_GENERATION_CRON || "0 3 * * *";
const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || "UTC";

const mealQueue = new Queue(MEAL_QUEUE, { connection });

const JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: Number(process.env.MEAL_RETRY_DELAY_MS || 60_000),
  },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

/** @param {string} userId */
const schedulerId = (userId) => `${SCHEDULER_PREFIX}${userId}`;

/** @param {string | undefined | null} tz */
const safeTimezone = (tz) => (isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE);

/**
 * Creates or updates the daily generation of one user. Same id => updated in place.
 * @param {string} userId
 * @param {string} timezone
 */
async function upsertMealSchedule(userId, timezone) {
  await mealQueue.upsertJobScheduler(
    schedulerId(userId),
    { pattern: MEAL_GENERATION_CRON, tz: safeTimezone(timezone) },
    { name: JOB_GENERATE, data: { userId }, opts: JOB_OPTIONS },
  );
}

/** @param {string} userId */
async function removeMealSchedule(userId) {
  await mealQueue.removeJobScheduler(schedulerId(userId));
}

/**
 * On-demand generation. Ignored while a request for the same user is already pending or running,
 * so repeated taps cannot flood the LLM.
 * @param {string} userId
 */
async function enqueueMealNow(userId) {
  await mealQueue.add(
    JOB_GENERATE,
    { userId },
    { ...JOB_OPTIONS, deduplication: { id: `now_${userId}` } },
  );
}

/**
 * Makes Redis match MongoDB: creates missing schedules, fixes changed ones, removes orphans.
 * @returns {Promise<{ created: number, updated: number, removed: number }>}
 */
async function reconcileMealSchedules() {
  /** @type {Map<string, { pattern?: string, tz?: string }>} */
  const existing = new Map();
  for (const s of await mealQueue.getJobSchedulers(0, -1)) {
    if (s.key.startsWith(SCHEDULER_PREFIX)) existing.set(s.key, s);
  }

  const stats = { created: 0, updated: 0, removed: 0 };

  for await (const settings of UserSettings.find().lean().cursor()) {
    const key = schedulerId(settings.userId);
    const current = existing.get(key);
    existing.delete(key);

    const tz = safeTimezone(settings.timezone);
    if (
      current &&
      current.pattern === MEAL_GENERATION_CRON &&
      current.tz === tz
    )
      continue;

    await upsertMealSchedule(settings.userId, tz);
    if (current) stats.updated++;
    else stats.created++;
  }

  for (const key of existing.keys()) {
    await mealQueue.removeJobScheduler(key);
    stats.removed++;
  }
  return stats;
}

/** Nightly self-healing job, executed by the same worker. */
async function scheduleMaintenance() {
  await mealQueue.upsertJobScheduler(
    MAINTENANCE_ID,
    { pattern: "30 2 * * *", tz: "UTC" },
    {
      name: JOB_RECONCILE,
      opts: { removeOnComplete: { count: 7 }, removeOnFail: { count: 7 } },
    },
  );
}

module.exports = {
  MEAL_QUEUE,
  JOB_GENERATE,
  JOB_RECONCILE,
  mealQueue,
  upsertMealSchedule,
  removeMealSchedule,
  enqueueMealNow,
  reconcileMealSchedules,
  scheduleMaintenance,
};
