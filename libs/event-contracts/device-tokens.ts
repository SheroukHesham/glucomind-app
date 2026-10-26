// overwritten by scripts/sync-contracts.sh.
import { TOPICS } from "./topics";

export const DEVICE_TOKEN_TOPIC = TOPICS.DEVICE_TOKENS;

export const DEVICE_PLATFORMS = ["android", "ios", "web"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export function isDevicePlatform(value: unknown): value is DevicePlatform {
  return DEVICE_PLATFORMS.some((p) => p === value);
}

/**
 * Value of a message on DEVICE_TOKEN_TOPIC.
 * Key   = the FCM token.
 * Value = this object, or null (a "tombstone") when the token was removed.
 */
export interface DeviceTokenValue {
  userId: string;
  platform?: DevicePlatform;
  deviceId?: string;
  updatedAt: string; // ISO 8601
}
