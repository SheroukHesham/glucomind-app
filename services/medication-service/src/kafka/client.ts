import { Kafka, logLevel } from "kafkajs";
import type { Topic } from "./contracts/topics";

/**
 * The ONLY line that differs between services.
 * Must equal the docker-compose service name and the "name" in package.json.
 */
export const SERVICE_NAME = "medication-service";

export type KafkaRole = "producer" | "consumer" | "admin";

/**
 * clientId = <service>-<role>, e.g. "cgm-service-producer".
 * Brokers come from KAFKA_BROKER (comma-separated), never hard-coded.
 */
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

/**
 * groupId = <service>-<topic>, e.g. "emergency-service-glucose-events".
 * One group per (service, topic). Add a suffix only if the same service needs
 * two independent handlers on one topic.
 */
export function consumerGroup(topic: Topic, suffix?: string): string {
  return suffix
    ? `${SERVICE_NAME}-${topic}-${suffix}`
    : `${SERVICE_NAME}-${topic}`;
}
