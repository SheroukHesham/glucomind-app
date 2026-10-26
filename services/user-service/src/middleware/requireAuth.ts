import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";

/** Verifies "Authorization: Bearer <jwt>" and exposes the user id as res.locals.userId. */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const [scheme, token] = (req.header("Authorization") ?? "").split(" ");
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw new Error("Unexpected token payload");
    }
    res.locals.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
