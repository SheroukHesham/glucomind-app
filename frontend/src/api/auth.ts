import { API } from "../config/api";
import { apiFetch } from "./client";

export interface LoginResult {
  accessToken: string;
  user: { id: string; name: string; email: string };
}

export type DevicePlatform = "android" | "ios" | "web";

export function login(email: string, password: string): Promise<LoginResult> {
  return apiFetch<LoginResult>(`${API.user}/login`, {
    method: "POST",
    body: { email, password },
  });
}

/**
 * Call right after login AND on every app start / FCM token refresh. Both calls are idempotent.
 *  - timezone: reminders and the 3:00 AM meal plan are scheduled in the user's local time
 *  - fcmToken: the emergency and medication services keep their own copy to send push notifications
 */
export async function syncDeviceAfterLogin(
  token: string,
  device: {
    fcmToken: string | null;
    platform: DevicePlatform;
    deviceId?: string;
  },
): Promise<void> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await apiFetch(`${API.user}/users/me/settings`, {
    method: "PUT",
    token,
    body: { timezone },
  });

  if (device.fcmToken) {
    await apiFetch(`${API.user}/devices/token`, {
      method: "PUT",
      token,
      body: {
        fcmToken: device.fcmToken,
        platform: device.platform,
        deviceId: device.deviceId,
      },
    });
  }
}

/** Call on logout, before discarding the access token. */
export function unregisterDevice(
  token: string,
  fcmToken: string,
): Promise<void> {
  return apiFetch(`${API.user}/logout`, {
    method: "POST",
    token,
    body: { fcmToken },
  });
}
