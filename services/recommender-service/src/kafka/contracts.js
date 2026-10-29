// Mirror of libs/event-contracts/user-settings.ts (this service is plain JavaScript).
const USER_SETTINGS_TOPIC = "user-settings";

/**
 * True for a valid IANA timezone such as "Africa/Cairo" or "UTC".
 * @param {unknown} value
 * @returns {value is string}
 */
function isValidTimezone(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

module.exports = { USER_SETTINGS_TOPIC, isValidTimezone };
