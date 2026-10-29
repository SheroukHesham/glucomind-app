import { Router } from "express";
import { AppError } from "../errors";
import { UserService } from "../service";
import { requireAuth } from "../middleware/requireAuth";

export function createSettingsRouter(userService: UserService): Router {
  const router = Router();

  //TODO: Frontend: after login and on every app start, call PUT /users/me/settings with { "timezone": Intl.DateTimeFormat().resolvedOptions().timeZone } and the Bearer token. It is safe to repeat, and services skip unchanged values.
  // PUT /users/me/settings  { timezone: "Africa/Cairo" }   (requires Bearer token)
  // The app sends Intl.DateTimeFormat().resolvedOptions().timeZone after login, on start, and when it changes.
  router.put(
    "/users/me/settings",
    requireAuth,
    async (req, res): Promise<void> => {
      const { timezone } = (req.body ?? {}) as Record<string, unknown>;
      if (typeof timezone !== "string") {
        res.status(400).json({ error: "timezone is required" });
        return;
      }

      try {
        await userService.updateSettings(res.locals.userId, { timezone });
        res.status(204).end();
      } catch (error) {
        if (error instanceof AppError && error.code === "INVALID_TIMEZONE") {
          res.status(400).json({ error: error.message });
          return;
        }
        console.error("Settings update failed:", error);
        res.status(503).json({ error: "Could not update settings, retry" });
      }
    },
  );

  return router;
}
