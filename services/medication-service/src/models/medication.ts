import { randomUUID } from "crypto";
import { InferSchemaType, Schema, model } from "mongoose";

export const FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

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
    time: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }, // "HH:mm", user's local time
    frequency: { type: String, enum: FREQUENCIES, default: "daily" },
    dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Sunday (weekly)
    dayOfMonth: { type: Number, min: 1, max: 31 }, // monthly; 29-31 mean "last day of the month"
  },
  { timestamps: true },
);

export type MedicationDoc = InferSchemaType<typeof medicationSchema>;
export const Medication = model("Medication", medicationSchema);
