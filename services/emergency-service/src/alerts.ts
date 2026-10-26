import { getMessaging, type MulticastMessage } from "firebase-admin/messaging";
import "./firebase"; // side effect: initializes the default Firebase app (your firebase.js)
import { DeviceToken } from "./models/deviceToken";
import { GlucoseEvent } from "./kafka/contracts/glucose-events";

const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);
const FCM_MULTICAST_LIMIT = 500;

export function buildNotification(event: GlucoseEvent): {
  title: string;
  body: string;
} {
  const { glucoseLevel, criticality } = event;
  const trend = event.trend ?? "unknown";

  switch (criticality) {
    case "slightly_abnormal":
      return {
        title: "⚠️ Glucose Slightly Abnormal",
        body: `Your glucose is ${glucoseLevel} mg/dL (${trend}). Monitor closely.`,
      };
    case "high_low":
      return {
        title: "❗ Glucose High/Low",
        body: `Your glucose is ${glucoseLevel} mg/dL (${trend}). Take action if needed.`,
      };
    case "critical":
      return {
        title: "🚨 Critical Glucose Alert",
        body: `CRITICAL: ${glucoseLevel} mg/dL (${trend}). Seek help immediately!`,
      };
    default:
      return {
        title: "🚨 Blood Glucose Alert",
        body: `Your blood glucose level is ${glucoseLevel} mg/dL. Please take action!`,
      };
  }
}

/** Sends the alert to every device of the user, using ONLY this service's own database. */
export async function sendGlucoseAlert(event: GlucoseEvent): Promise<void> {
  const tokens: string[] = await DeviceToken.find({
    userId: event.userId,
  }).distinct("token");
  if (tokens.length === 0) {
    console.warn(
      `[alerts] no device tokens for user ${event.userId}; alert not delivered`,
    );
    return;
  }

  const { title, body } = buildNotification(event);
  const dead: string[] = [];

  for (let i = 0; i < tokens.length; i += FCM_MULTICAST_LIMIT) {
    const batch = tokens.slice(i, i + FCM_MULTICAST_LIMIT);
    const message: MulticastMessage = {
      tokens: batch,
      notification: { title, body },
      android: {
        priority: "high",
        notification: {
          sound: "emergency_alarm",
          channelId: "emergency-channel",
        },
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: {
          aps: {
            sound: "emergency_alarm.wav",
            contentAvailable: true,
            alert: { title, body },
          },
        },
      },
    };

    const result = await getMessaging().sendEachForMulticast(message);
    result.responses.forEach((response, index) => {
      const code = response.error?.code;
      if (code && DEAD_TOKEN_CODES.has(code)) dead.push(batch[index]);
      else if (code)
        console.error(`❌ FCM error for user ${event.userId}: ${code}`);
    });
  }

  // prune locally; no other service needs to be told
  if (dead.length > 0) await DeviceToken.deleteMany({ token: { $in: dead } });
}
