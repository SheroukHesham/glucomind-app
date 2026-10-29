import { getMessaging } from "firebase-admin/messaging";
import "../firebase"; // side effect: initializes the default Firebase app (your firebase.js)
import { DeviceToken } from "../models/deviceToken";

const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);
const FCM_MULTICAST_LIMIT = 500;

/** Sends a push to every device of the user using this service's own token copy. Returns the number delivered. */
export async function notifyUser(
  userId: string,
  notification: { title: string; body: string },
  data: Record<string, string> = {},
): Promise<number> {
  const tokens: string[] = await DeviceToken.find({ userId }).distinct("token");
  if (tokens.length === 0) return 0;

  const dead: string[] = [];
  let delivered = 0;

  for (let i = 0; i < tokens.length; i += FCM_MULTICAST_LIMIT) {
    const batch = tokens.slice(i, i + FCM_MULTICAST_LIMIT);
    const result = await getMessaging().sendEachForMulticast({
      tokens: batch,
      notification,
      data,
      android: { priority: "high" },
      apns: { headers: { "apns-priority": "10" } },
    });
    delivered += result.successCount;
    result.responses.forEach((response, index) => {
      const code = response.error?.code;
      if (code && DEAD_TOKEN_CODES.has(code)) dead.push(batch[index]);
      else if (code)
        console.error(`[notify] FCM error for user ${userId}: ${code}`);
    });
  }

  if (dead.length > 0) await DeviceToken.deleteMany({ token: { $in: dead } });
  return delivered;
}
