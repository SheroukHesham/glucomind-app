import {
  startGlucoseEventConsumer,
  stopGlucoseEventConsumer,
} from "./consumers";
import {
  startDeviceTokenSync,
  stopDeviceTokenSync,
} from "./deviceTokenConsumer";

/**
 * - Alerts are critical: if that consumer cannot start, this rejects so the process exits
 *   and Docker restarts it.
 * - Token sync is best-effort: alerts keep working with the tokens already stored.
 */
export async function startKafkaConsumers(): Promise<void> {
  startDeviceTokenSync().catch((err: unknown) =>
    console.error("[kafka] device-token sync failed to start:", err),
  );
  await startGlucoseEventConsumer();
}

export async function stopKafkaConsumers(): Promise<void> {
  await Promise.allSettled([stopGlucoseEventConsumer(), stopDeviceTokenSync()]);
}
