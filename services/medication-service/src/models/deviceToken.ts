import { InferSchemaType, Schema, model } from "mongoose";
import { DEVICE_PLATFORMS } from "../kafka/contracts/device-tokens";

/**
 * This service's OWN copy of the device tokens, kept in sync from the
 * "device-tokens" Kafka topic. Alerts never need another service to be up.
 */
const deviceTokenSchema = new Schema({
  token: { type: String, required: true, unique: true }, // a token belongs to exactly one user
  userId: { type: String, required: true, index: true },
  platform: { type: String, enum: DEVICE_PLATFORMS },
  deviceId: String,
  updatedAt: { type: Date, default: Date.now },
});

export type DeviceTokenDoc = InferSchemaType<typeof deviceTokenSchema>;
export const DeviceToken = model("DeviceToken", deviceTokenSchema);
