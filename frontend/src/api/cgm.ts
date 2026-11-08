import { API } from "../config/api";
import { ApiError, apiFetch } from "./client";
import { GlucoseReading, toReading } from "./cgmStream";

/** ws:// (or wss:// when the API uses https) address of the live stream, through the gateway. */
export const CGM_STREAM_URL = `${API.cgm}/stream`.replace(/^http/, "ws");

/**
 * Latest stored reading of the user, or null when there is none yet.
 * cgm-service answers 404 when the user has no readings, and may answer 500 for a user whose
 * first reading has not arrived yet; both simply mean "no data to show".
 */
export async function fetchCurrentReading(
  userId: string,
  token: string,
): Promise<GlucoseReading | null> {
  try {
    const raw = await apiFetch<unknown>(
      `${API.cgm}/cgm/current/${encodeURIComponent(userId)}`,
      { token },
    );
    return toReading(raw);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 500)
    )
      return null;
    throw error;
  }
}
