const jwt = require("jsonwebtoken");

// Must be the SAME value user-service signs with (set in the root .env, passed to both services).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Define it in the root .env file (see .env.example).",
  );
}

/**
 * Verifies an access token issued by user-service.
 * @param {unknown} token
 * @returns {{ userId: string, expiresAtMs: number } | null} null when the token is missing, invalid or expired
 */
function verifyAccessToken(token) {
  if (typeof token !== "string" || token === "") return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (typeof payload === "string" || typeof payload.sub !== "string") {
      console.warn("[WS AUTH] Invalid JWT payload");
      return null;
    }

    const expiresAtMs =
      typeof payload.exp === "number"
        ? payload.exp * 1000
        : Number.MAX_SAFE_INTEGER;

    return {
      userId: payload.sub,
      expiresAtMs,
    };
  } catch (error) {
    const decoded = jwt.decode(token);

    console.error("[WS AUTH] JWT verification failed:", {
      name: error.name,
      message: error.message,
      serverTime: new Date().toISOString(),
      expiredAt:
        error.expiredAt instanceof Date ? error.expiredAt.toISOString() : null,
      tokenIssuedAt: decoded?.iat
        ? new Date(decoded.iat * 1000).toISOString()
        : null,
      tokenExpiresAt: decoded?.exp
        ? new Date(decoded.exp * 1000).toISOString()
        : null,
    });

    return null;
  }
}

module.exports = { verifyAccessToken };
