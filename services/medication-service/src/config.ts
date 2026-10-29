export const REDIS_URL = process.env.REDIS_URL ?? "redis://redis:6379";

/** Used until the user's own timezone arrives from user-service. */
export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE ?? "UTC";

/** A reminder that would be delivered later than this (outage, backlog) is dropped, not sent. */
export const REMINDER_MAX_LATENESS_MS =
  Number(process.env.REMINDER_MAX_LATENESS_MINUTES ?? 15) * 60_000;

export const REMINDER_WORKER_CONCURRENCY = Number(
  process.env.REMINDER_WORKER_CONCURRENCY ?? 20,
);
