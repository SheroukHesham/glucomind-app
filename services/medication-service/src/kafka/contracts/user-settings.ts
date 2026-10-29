import { TOPICS } from "./topics";

export const USER_SETTINGS_TOPIC = TOPICS.USER_SETTINGS;

/** True for a valid IANA timezone such as "Africa/Cairo" or "UTC". */
export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Value of a message on USER_SETTINGS_TOPIC (compacted).
 * Key = userId. Published by user-service; each service that needs the
 * user's timezone (medication-service, recommender-service) keeps its own copy.
 */
export interface UserSettingsValue {
  timezone: string; // IANA name
  updatedAt: string; // ISO 8601
}
