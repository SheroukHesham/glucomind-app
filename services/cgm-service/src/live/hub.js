const WebSocket = require("ws");

/** A client that cannot keep up is skipped instead of growing memory without bound. */
const MAX_BUFFERED_BYTES = 64 * 1024;

/**
 * In-memory registry of the live connections of each user (one user can have several devices).
 * With ONE cgm-service instance this is enough. With several instances, publish through Redis
 * pub/sub so the instance that holds the user's socket receives the reading too.
 */
class LiveHub {
  constructor() {
    /** @type {Map<string, Set<WebSocket>>} */
    this.sockets = new Map();
  }

  /**
   * @param {string} userId
   * @param {WebSocket} ws
   */
  subscribe(userId, ws) {
    let set = this.sockets.get(userId);
    if (!set) {
      set = new Set();
      this.sockets.set(userId, set);
    }
    set.add(ws);
  }

  /**
   * @param {string} userId
   * @param {WebSocket} ws
   */
  unsubscribe(userId, ws) {
    const set = this.sockets.get(userId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) this.sockets.delete(userId);
  }

  /** @param {string} userId */
  countFor(userId) {
    return this.sockets.get(userId)?.size ?? 0;
  }

  /**
   * Sends a message to every open connection of ONE user. Returns how many received it.
   * @param {string} userId
   * @param {object} payload
   */
  publish(userId, payload) {
    const set = this.sockets.get(userId);
    if (!set) return 0;

    const message = JSON.stringify(payload);
    let delivered = 0;
    for (const ws of set) {
      if (
        ws.readyState !== WebSocket.OPEN ||
        ws.bufferedAmount > MAX_BUFFERED_BYTES
      )
        continue;
      ws.send(message);
      delivered++;
    }
    return delivered;
  }
}

module.exports = { LiveHub };
