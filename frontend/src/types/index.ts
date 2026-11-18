export const MEDICATION_FREQUENCIES = [
  "once",
  "daily",
  "weekly",
  "monthly",
  "times_per_day",
] as const;
export type TMedicationFrequency = (typeof MEDICATION_FREQUENCIES)[number];
