import { randomUUID } from "crypto";
import { InferSchemaType, Schema, model } from "mongoose";

export const FREQUENCIES = [
  "once", // one-and-done: taken on startDate at times[0]
  "daily",
  "weekly",
  "monthly",
  "times_per_day", // x times a day: one entry in `times` per intake (2..MAX_DOSES_PER_DAY)
] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const MAX_DOSES_PER_DAY = 12;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const medicationSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: () => randomUUID(),
    },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },

    dosage: { type: String, trim: true, maxlength: 100 }, // free text: "500 mg", "2 tablets", "10 units"
    notes: { type: String, trim: true, maxlength: 500 }, // free text: "after meal"

    frequency: { type: String, enum: FREQUENCIES, required: true },

    // Intake slots, "HH:mm" in the user's local time. Exactly 1 for every frequency except "times_per_day".
    times: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.every((t) => TIME_RE.test(t)),
        message: "times must be HH:mm",
      },
    },
    /** @deprecated single-slot field of the old schema. Read as a fallback, never written. */
    time: { type: String, match: TIME_RE },

    // Calendar days in the user's local timezone, "YYYY-MM-DD", both inclusive.
    // "once": startDate is the day. Others: optional course window (no endDate = open-ended).
    startDate: { type: String, match: DATE_RE },
    endDate: { type: String, match: DATE_RE },

    dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Sunday (weekly)
    dayOfMonth: { type: Number, min: 1, max: 31 }, // monthly; 29-31 mean "last day of the month"
  },
  { timestamps: true },
);

export type MedicationDoc = InferSchemaType<typeof medicationSchema>;
export const Medication = model("Medication", medicationSchema);
