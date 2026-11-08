const WebSocket = require("ws");
const { verifyAccessToken } = require("./auth");

const CLOSE_UNAUTHORIZED = 4401; // bad / expired token: the client must NOT blindly reconnect
const CLOSE_AUTH_TIMEOUT = 4408;
const CLOSE_TOO_MANY = 4429;

/**
 * WebSocket endpoint for the MOBILE / WEB APP (path /stream), attached to the existing HTTP server.
 * It is separate from the sensor socket on port 4000: different clients, different trust.
 *
 * Protocol (JSON):
 *   client -> { "type": "auth", "token": "<JWT from POST /login>" }      (must be the first message)
 *   server -> { "type": "ready" }
 *   server -> { "type": "reading", "glucoseLevel": 112, "trend": "steady", "timestamp": "..." }
 *   server -> { "type": "heartbeat" }                                      (so the app can detect dead connections)
 *   server -> { "type": "error", "code": "UNAUTHORIZED" }  then the socket closes with code 4401
 * The token is sent as a message, not in the URL, so it never ends up in access logs.
 *
 * @param {import("http").Server} server
 * @param {import("./hub").LiveHub} hub
 * @param {{ authTimeoutMs?: number, heartbeatMs?: number, maxConnectionsPerUser?: number }} [options]
 */
function attachClientStream(server, hub, options = {}) {
  const authTimeoutMs = options.authTimeoutMs ?? 5_000;
  const heartbeatMs = options.heartbeatMs ?? 25_000;
  const maxConnectionsPerUser = options.maxConnectionsPerUser ?? 5;

  const wss = new WebSocket.Server({ noServer: true, maxPayload: 4096 });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url || "/", "http://localhost");
    if (pathname !== "/stream") {
      socket.destroy(); // only /stream is a WebSocket endpoint
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });

  wss.on("connection", (ws) => {
    /** @type {string | null} */
    let userId = null;
    let expiryTimer = null;
    ws.isAlive = true;
    ws.isAuthenticated = false;

    const authTimer = setTimeout(
      () => ws.close(CLOSE_AUTH_TIMEOUT, "auth timeout"),
      authTimeoutMs,
    );

    const reject = () => {
      ws.send(JSON.stringify({ type: "error", code: "UNAUTHORIZED" }));
      ws.close(CLOSE_UNAUTHORIZED, "unauthorized");
    };

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (raw) => {
      if (ws.isAuthenticated) return; // after auth the client has nothing to say

      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return reject();
      }
      if (!msg || msg.type !== "auth") return reject();

      const identity = verifyAccessToken(msg.token);
      if (!identity) return reject();

      if (hub.countFor(identity.userId) >= maxConnectionsPerUser) {
        ws.close(CLOSE_TOO_MANY, "too many connections");
        return;
      }

      clearTimeout(authTimer);
      userId = identity.userId;
      ws.isAuthenticated = true;
      hub.subscribe(userId, ws);

      // a connection must not outlive its token: the app reconnects with a fresh one
      const msUntilExpiry = identity.expiresAtMs - Date.now();
      if (msUntilExpiry < 2 ** 31 - 1) {
        expiryTimer = setTimeout(
          () => ws.close(CLOSE_UNAUTHORIZED, "token expired"),
          Math.max(0, msUntilExpiry),
        );
      }

      ws.send(JSON.stringify({ type: "ready" }));
    });

    ws.on("close", () => {
      clearTimeout(authTimer);
      if (expiryTimer) clearTimeout(expiryTimer);
      if (userId) hub.unsubscribe(userId, ws);
    });

    ws.on("error", () => ws.terminate());
  });

  // Every interval: drop connections that never answered the last ping, ping the rest,
  // and give authenticated apps an application-level heartbeat they can observe.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
      if (ws.isAuthenticated && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "heartbeat" }));
      }
    }
  }, heartbeatMs);
  heartbeat.unref();

  return {
    wss,
    close() {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}

module.exports = {
  attachClientStream,
  CLOSE_UNAUTHORIZED,
  CLOSE_AUTH_TIMEOUT,
  CLOSE_TOO_MANY,
};
