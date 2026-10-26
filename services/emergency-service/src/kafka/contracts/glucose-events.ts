import { TOPICS } from "./topics";

export const GLUCOSE_EVENTS_TOPIC = TOPICS.GLUCOSE_EVENTS;

export type TGlucoseCriticality = "slightly_abnormal" | "high_low" | "critical";
export type TGlucoseTrend = "rising" | "falling" | "steady";

/** Key = userId. Produced by cgm-service, consumed by emergency-service. */
export interface GlucoseEvent {
  userId: string;
  glucoseLevel: number;
  trend?: TGlucoseTrend;
  criticality?: TGlucoseCriticality;
}
