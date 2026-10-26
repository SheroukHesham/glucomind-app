import { TOPICS } from "./topics";

export const MEDICATION_CREATION_EVENTS_TOPIC =
  TOPICS.MEDICATION_CREATION_EVENTS;

/** Key = userId. Produced by user-service. */
export interface MedicationCreationEvent {
  userId: string;
  medication: unknown; //todo: tighten to your medication type when it is shared
}
