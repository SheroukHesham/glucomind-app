import { createKafka } from "./client";
import { TOPICS, Topic } from "./contracts/topics";
import {
  DEVICE_TOKEN_TOPIC,
  DeviceTokenValue,
} from "./contracts/device-tokens";
import { MedicationCreationEvent } from "./contracts/medication-creation-events";

const producer = createKafka("producer").producer();
let connecting: Promise<void> | null = null;

function ensureConnected(): Promise<void> {
  connecting ??= producer.connect().catch((err: unknown) => {
    connecting = null;
    throw err;
  });
  return connecting;
}

/** value === null publishes a tombstone (deletes the key from a compacted topic). */
async function send(topic: Topic, key: string, value: unknown): Promise<void> {
  await ensureConnected();
  await producer.send({
    topic,
    messages: [{ key, value: value === null ? null : JSON.stringify(value) }],
  });
}

/** Consumed by medication-service when a user's medications are created. Throws on failure. */
export async function sendMedicationEvents(
  userId: string,
  medication: unknown,
): Promise<void> {
  const event: MedicationCreationEvent = { userId, medication };
  await send(TOPICS.MEDICATION_CREATION_EVENTS, userId, event);
}

/**
 * Registers/updates a device token (value) or removes it (null).
 * Consumed by emergency-service and medication-service, which keep their own copies.
 */
export async function publishDeviceToken(
  token: string,
  value: DeviceTokenValue | null,
): Promise<void> {
  await send(DEVICE_TOKEN_TOPIC, token, value);
}

export async function disconnectProducer(): Promise<void> {
  connecting = null;
  await producer.disconnect();
}
