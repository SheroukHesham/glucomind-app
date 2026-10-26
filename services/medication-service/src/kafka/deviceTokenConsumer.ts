import { createKafka, consumerGroup } from "./client";
import {
  DEVICE_TOKEN_TOPIC,
  DeviceTokenValue,
  isDevicePlatform,
} from "./contracts/device-tokens";
import { DeviceToken } from "../models/deviceToken";

export type DeviceTokenAction =
  | { type: "delete"; token: string }
  | { type: "upsert"; token: string; value: DeviceTokenValue };

/** Turns a raw Kafka message into an action. Returns null for malformed messages (skipped, not retried). */
export function parseDeviceTokenMessage(
  key: Buffer | null,
  value: Buffer | null,
): DeviceTokenAction | null {
  const token = key?.toString();
  if (!token) return null;
  if (value === null) return { type: "delete", token };

  try {
    const parsed: unknown = JSON.parse(value.toString());
    if (typeof parsed !== "object" || parsed === null) return null;
    const v = parsed as Record<string, unknown>;
    if (typeof v.userId !== "string" || v.userId === "") return null;

    return {
      type: "upsert",
      token,
      value: {
        userId: v.userId,
        platform: isDevicePlatform(v.platform) ? v.platform : undefined,
        deviceId: typeof v.deviceId === "string" ? v.deviceId : undefined,
        updatedAt:
          typeof v.updatedAt === "string"
            ? v.updatedAt
            : new Date().toISOString(),
      },
    };
  } catch {
    return null;
  }
}

const consumer = createKafka("consumer").consumer({
  groupId: consumerGroup(DEVICE_TOKEN_TOPIC),
});

export async function startDeviceTokenSync(): Promise<void> {
  await consumer.connect();
  // fromBeginning: a fresh/empty database rebuilds its tokens from the compacted topic
  await consumer.subscribe({ topic: DEVICE_TOKEN_TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const action = parseDeviceTokenMessage(message.key, message.value);
      if (!action) {
        console.warn(
          "[device-tokens] skipped malformed message at offset",
          message.offset,
        );
        return;
      }

      if (action.type === "delete") {
        await DeviceToken.deleteOne({ token: action.token });
        return;
      }

      const { value } = action;
      await DeviceToken.updateOne(
        { token: action.token },
        {
          $set: {
            userId: value.userId,
            platform: value.platform,
            deviceId: value.deviceId,
            updatedAt: new Date(value.updatedAt),
          },
        },
        { upsert: true }, // idempotent: redelivery is harmless
      );
    },
  });
}

export async function stopDeviceTokenSync(): Promise<void> {
  await consumer.disconnect();
}
