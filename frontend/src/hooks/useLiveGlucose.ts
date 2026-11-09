import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { CGM_STREAM_URL, fetchCurrentReading } from "@/api/cgm";
import {
  CgmStreamClient,
  CloseInfo,
  GlucoseReading,
  StreamStatus,
  newest,
} from "@/api/cgmStream";

const log = (...args: unknown[]) => {
  if (__DEV__) console.log("[live]", ...args);
};

/**
 * Live glucose for the logged-in user.
 *   1. REST snapshot  -> the screen shows the last stored value immediately
 *   2. WebSocket      -> a new { glucoseLevel, trend } arrives the moment a sensor reading is saved
 * After every (re)connect the snapshot is fetched again, so nothing is lost while offline.
 * The stream is closed while the app is in the background (push notifications cover that case).
 *
 * status:     idle | connecting | live | reconnecting | unauthorized
 *             "unauthorized" = the access token was rejected or expired: send the user back to login.
 * lastClose:  why the last connection closed. 1006 = the connection could not be established
 *             (gateway / server problem), 4401 = token rejected, 4429 = too many open sessions.
 *
 * In development the hook prints "[live] ..." lines that show exactly where it stops.
 */
export function useLiveGlucose(userId: string | null, token: string | null) {
  const [reading, setReading] = useState<GlucoseReading | null>(null);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [lastClose, setLastClose] = useState<CloseInfo | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  // if (token) {
  //   try {
  //     const payload = JSON.parse(
  //       atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
  //     );

  //     log("WebSocket token claims:", {
  //       sub: payload.sub,
  //       iat: new Date(payload.iat * 1000).toISOString(),
  //       exp: new Date(payload.exp * 1000).toISOString(),
  //       currentTime: new Date().toISOString(),
  //     });
  //   } catch {
  //     log("Could not decode WebSocket token claims");
  //   }
  // }
  useEffect(() => {
    if (!userId || !token) {
      log(
        "waiting: userId =",
        userId ? "ok" : "MISSING",
        "| token =",
        token ? "ok" : "MISSING",
      );
      return;
    }
    // log("starting for user", userId, "->", CGM_STREAM_URL);
    let cancelled = false;

    const loadSnapshot = async () => {
      try {
        const snapshot = await fetchCurrentReading(userId, token);
        // log(
        //   "snapshot:",
        //   snapshot ?? "none stored yet (404/500 from the server)",
        // );
        if (!cancelled && snapshot)
          setReading((current) => newest(current, snapshot));
      } catch (error) {
        log("snapshot request failed:", error);
      }
    };
    const client = new CgmStreamClient({
      url: CGM_STREAM_URL,
      getToken: () => tokenRef.current,
      onReading: (next) => {
        // log("reading received:", next);
        setReading((current) => newest(current, next));
      },
      onStatus: (next) => {
        log("status ->", next);
        setStatus(next);
      },
      onConnected: loadSnapshot,
      onClose: (info) => {
        log("connection closed: code", info.code, info.reason || "(no reason)");
        setLastClose(info);
      },
    });

    void loadSnapshot();
    // only "background" pauses the stream; iOS reports "inactive"/"unknown" during normal transitions
    if (AppState.currentState !== "background") client.start();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") client.start();
      else if (state === "background") client.stop();
    });

    return () => {
      cancelled = true;
      subscription.remove();
      client.stop();
    };
  }, [userId, token]);

  return { reading, status, lastClose };
}
