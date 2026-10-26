import { createKafka } from "./client";
import { GLUCOSE_EVENTS_TOPIC, GlucoseEvent } from "./contracts/glucose-events";

const producer = createKafka("producer").producer();
let connecting: Promise<void> | null = null;

function ensureConnected(): Promise<void> {
  connecting ??= producer.connect().catch((err: unknown) => {
    connecting = null;
    throw err;
  });
  return connecting;
}

/**
 * Publishes an abnormal-glucose event. Consumed by emergency-service.
 * Keyed by userId so one user's events stay in order within a partition.
 * Throws if publishing fails: the caller decides how to react.
 */
export async function produceGlucoseEvent(event: GlucoseEvent): Promise<void> {
  await ensureConnected();
  await producer.send({
    topic: GLUCOSE_EVENTS_TOPIC,
    messages: [{ key: event.userId, value: JSON.stringify(event) }],
  });
}

export async function disconnectProducer(): Promise<void> {
  connecting = null;
  await producer.disconnect();
}
