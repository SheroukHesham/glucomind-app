import { Router } from "express";
import { UserService } from "../service";
import { requireAuth } from "../middleware/requireAuth";
import { AppError } from "../errors";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

export function createAuthRouter(userService: UserService): Router {
  const router = Router();

  // POST /login  { email, password }  ->  { accessToken, user }
  router.post("/login", async (req, res): Promise<void> => {
    const { email, password } = (req.body ?? {}) as Record<string, unknown>;
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    try {
      res.status(200).json(await userService.login({ email, password }));
    } catch (error) {
      if (error instanceof AppError && error.code === "INVALID_CREDENTIALS") {
        res.status(401).json({ error: error.message });
        return;
      }
      console.error("Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // PUT /devices/token  { fcmToken, platform?, deviceId? }   (requires Bearer token)
  // Idempotent: the app calls it after login, on every start and on FCM token refresh.
  router.put("/devices/token", requireAuth, async (req, res): Promise<void> => {
    const { fcmToken, platform, deviceId } = (req.body ?? {}) as Record<
      string,
      unknown
    >;
    if (!isNonEmptyString(fcmToken)) {
      res.status(400).json({ error: "fcmToken is required" });
      return;
    }

    try {
      await userService.registerDevice(res.locals.userId, {
        fcmToken,
        platform: optionalString(platform),
        deviceId: optionalString(deviceId),
      });
      res.status(204).end();
    } catch (error) {
      console.error("Device registration failed:", error);
      res.status(503).json({ error: "Could not register device, retry" });
    }
  });

  // POST /logout  { fcmToken }   (requires Bearer token)
  router.post("/logout", requireAuth, async (req, res): Promise<void> => {
    const { fcmToken } = (req.body ?? {}) as Record<string, unknown>;
    if (isNonEmptyString(fcmToken)) {
      try {
        await userService.unregisterDevice(fcmToken);
      } catch (error) {
        console.error("Device unregistration failed:", error);
        res.status(503).json({ error: "Could not unregister device, retry" });
        return;
      }
    }
    res.status(204).end();
  });

  return router;
}
