import { Kafka, logLevel } from "kafkajs";
import type { Topic } from "./contracts/topics";

export const SERVICE_NAME = "emergency-service";

export type KafkaRole = "producer" | "consumer" | "admin";

export function createKafka(role: KafkaRole): Kafka {
  return new Kafka({
    clientId: `${SERVICE_NAME}-${role}`,
    brokers: (process.env.KAFKA_BROKER ?? "kafka:9092")
      .split(",")
      .map((broker) => broker.trim())
      .filter(Boolean),
    logLevel: logLevel.WARN,
    retry: { retries: 8 },
  });
}

export function consumerGroup(topic: Topic, suffix?: string): string {
  return suffix
    ? `${SERVICE_NAME}-${topic}-${suffix}`
    : `${SERVICE_NAME}-${topic}`;
}
