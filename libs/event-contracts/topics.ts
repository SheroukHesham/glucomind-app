// overwritten by scripts/sync-contracts.sh.

/** Every Kafka topic in the system. Must match infra/kafka/create-topics.sh. */
export const TOPICS = {
  GLUCOSE_EVENTS: "glucose-events",
  MEDICATION_CREATION_EVENTS: "medication-creation-events",
  USER_CREATION_EVENTS: "user-creation-events",
  DEVICE_TOKENS: "device-tokens",
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];
