import { createKafka, consumerGroup } from "./client";
import {
  GLUCOSE_EVENTS_TOPIC,
  GlucoseEvent,
  TGlucoseCriticality,
  TGlucoseTrend,
} from "./contracts/glucose-events";
import { sendGlucoseAlert } from "../alerts";

const CRITICALITIES: readonly string[] = [
  "slightly_abnormal",
  "high_low",
  "critical",
] satisfies TGlucoseCriticality[];
const TRENDS: readonly string[] = [
  "falling",
  "rising",
  "steady",
] satisfies TGlucoseTrend[];

/** Returns null for malformed messages (skipped, not retried). */
export function parseGlucoseEvent(raw: Buffer | null): GlucoseEvent | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw.toString());
    if (typeof parsed !== "object" || parsed === null) return null;
    const v = parsed as Record<string, unknown>;

    if (typeof v.userId !== "string" || v.userId === "") return null;
    if (typeof v.glucoseLevel !== "number" || !Number.isFinite(v.glucoseLevel))
      return null;

    return {
      userId: v.userId,
      glucoseLevel: v.glucoseLevel,
      trend:
        typeof v.trend === "string" && TRENDS.includes(v.trend)
          ? (v.trend as TGlucoseTrend)
          : undefined,
      criticality:
        typeof v.criticality === "string" &&
        CRITICALITIES.includes(v.criticality)
          ? (v.criticality as TGlucoseCriticality)
          : undefined,
    };
  } catch {
    return null;
  }
}

const consumer = createKafka("consumer").consumer({
  groupId: consumerGroup(GLUCOSE_EVENTS_TOPIC),
});

export async function startGlucoseEventConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({
    topic: GLUCOSE_EVENTS_TOPIC,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = parseGlucoseEvent(message.value);
      if (!event) {
        console.error(
          "[glucose-events] skipped malformed message at offset",
          message.offset,
        );
        return;
      }
      try {
        await sendGlucoseAlert(event);
      } catch (err) {
        // log and move on: one failing alert must not block the alerts behind it
        console.error("[glucose-events] failed to send alert:", err);
      }
    },
  });
}

export async function stopGlucoseEventConsumer(): Promise<void> {
  await consumer.disconnect();
}
