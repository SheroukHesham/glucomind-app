const jwt = require("jsonwebtoken");
const admin = require("../firebase");

// Only needed for the legacy fallback. Remove together with verifyLegacyJwt.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Define it in the root .env file (see .env.example).",
  );
}

function verifyLegacyJwt(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.sub !== "string")
      return null;
    return {
      userId: payload.sub,
      expiresAtMs:
        typeof payload.exp === "number"
          ? payload.exp * 1000
          : Number.MAX_SAFE_INTEGER,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies a Firebase ID token (or, during the transition, a legacy user-service JWT).
 * @param {unknown} token
 * @returns {Promise<{ userId: string, expiresAtMs: number } | null>}
 */
async function verifyAccessToken(token) {
  if (typeof token !== "string" || token === "") return null;

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { userId: decoded.uid, expiresAtMs: decoded.exp * 1000 };
  } catch (error) {
    // const legacy = verifyLegacyJwt(token);
    // if (legacy) return legacy;

    console.error("[WS AUTH] token rejected:", {
      code: error.code ?? error.name, // e.g. auth/id-token-expired, auth/argument-error
      message: error.message,
      serverTime: new Date().toISOString(),
    });
    return null;
  }
}

module.exports = { verifyAccessToken };
