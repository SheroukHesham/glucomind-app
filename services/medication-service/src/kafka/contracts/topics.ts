// overwritten by scripts/sync-contracts.sh.

/** Every Kafka topic in the system. Must match infra/kafka/create-topics.sh. */
export const TOPICS = {
  GLUCOSE_EVENTS: "glucose-events",
  MEDICATION_CREATION_EVENTS: "medication-creation-events",
  USER_CREATION_EVENTS: "user-creation-events",
  DEVICE_TOKENS: "device-tokens",
  USER_SETTINGS: "user-settings",
  REGISTRATION: "registration",
  REGISTRATION_MEDICATION_COMMAND: "registration.medication.command",
  REGISTRATION_DIET_COMMAND: "registration.diet.command",
  REGISTRATION_RESULT: "registration.result",
  REGISTRATION_COMPLETED: "registration.completed",
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];
