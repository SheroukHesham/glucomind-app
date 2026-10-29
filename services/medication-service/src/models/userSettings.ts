import { InferSchemaType, Schema, model } from "mongoose";

/** This service's own copy of per-user settings, synced from the "user-settings" topic. */
const userSettingsSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  timezone: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export type UserSettingsDoc = InferSchemaType<typeof userSettingsSchema>;
export const UserSettings = model("UserSettings", userSettingsSchema);
