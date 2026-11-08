/**
 * Live glucose stream client. Plain TypeScript: no React, no React Native imports,
 * so it works the same in the app, in the browser and in tests.
 *
 * Protocol (see services/cgm-service/src/live/clientSocket.js):
 *   open  -> we send  { type: "auth", token }
 *   then  -> server sends "ready", "reading" and "heartbeat" messages
 *   close code 4401 = token rejected / expired: we stop instead of reconnecting forever
 *   close code 1006 = the connection could not be established (handshake failed)
 */

export type Trend = "steady" | "rising" | "falling";

export interface GlucoseReading {
  glucoseLevel: number; // mg/dL
  trend: Trend;
  timestamp: string; // ISO 8601
}

export type StreamStatus =
  "idle" | "connecting" | "live" | "reconnecting" | "unauthorized";

const TRENDS: readonly string[] = ["steady", "rising", "falling"];
const CLOSE_UNAUTHORIZED = 4401;

/** Validates a reading from the REST API or the stream. Returns null if it is not usable. */
export function toReading(raw: unknown): GlucoseReading | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.glucoseLevel !== "number" || !Number.isFinite(r.glucoseLevel))
    return null;

  return {
    glucoseLevel: r.glucoseLevel,
    // a missing or unknown trend (e.g. the very first reading) counts as steady
    trend:
      typeof r.trend === "string" && TRENDS.includes(r.trend)
        ? (r.trend as Trend)
        : "steady",
    timestamp:
      typeof r.timestamp === "string" ? r.timestamp : new Date().toISOString(),
  };
}

/** The newer of two readings, so a late REST snapshot never overwrites a fresher live value. */
export function newest(
  current: GlucoseReading | null,
  next: GlucoseReading,
): GlucoseReading {
  if (!current) return next;
  return Date.parse(next.timestamp) >= Date.parse(current.timestamp)
    ? next
    : current;
}

export function trendArrow(trend: Trend): string {
  switch (trend) {
    case "rising":
      return "↑";
    case "falling":
      return "↓";
    case "steady":
      return "→";
  }
}

export interface CloseInfo {
  /** 1006 = handshake failed / network drop, 4401 = token rejected or expired, 4429 = too many sessions. */
  code: number;
  reason: string;
}

export interface CgmStreamOptions {
  /** ws:// or wss:// address of the stream endpoint. */
  url: string;
  /** Called on every (re)connect, so an expired token can be replaced. */
  getToken: () => string | null;
  onReading: (reading: GlucoseReading) => void;
  onStatus?: (status: StreamStatus) => void;
  /** Called each time the stream is ready: fetch a REST snapshot here to cover any gap. */
  onConnected?: () => void;
  /** Called whenever a connection closes, with the close code (useful to tell the failure causes apart). */
  onClose?: (info: CloseInfo) => void;
  /** Reconnect after this long without ANY message (the server sends a heartbeat every 25 s). */
  silenceTimeoutMs?: number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  /** Override for tests; defaults to the global WebSocket (React Native, browsers, Node 22). */
  WebSocketImpl?: typeof WebSocket;
}

export class CgmStreamClient {
  private readonly options: Required<
    Omit<
      CgmStreamOptions,
      "onStatus" | "onConnected" | "onClose" | "WebSocketImpl"
    >
  > &
    Pick<
      CgmStreamOptions,
      "onStatus" | "onConnected" | "onClose" | "WebSocketImpl"
    >;
  private ws: WebSocket | null = null;
  private running = false;
  private attempt = 0;
  private connectionId = 0;
  private status: StreamStatus = "idle";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: CgmStreamOptions) {
    this.options = {
      silenceTimeoutMs: 60_000,
      reconnectBaseMs: 1_000,
      reconnectMaxMs: 30_000,
      ...options,
    };
  }

  /** Starts (or resumes) the stream. Safe to call repeatedly. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.attempt = 0;
    this.connect();
  }

  /** Closes the connection and stops reconnecting (app in background, logout). */
  stop(): void {
    this.running = false;
    this.teardown();
    this.setStatus("idle");
  }

  private setStatus(status: StreamStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.options.onStatus?.(status);
  }

  private teardown(): void {
    this.connectionId++; // events of the old socket are ignored from now on
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.reconnectTimer = this.silenceTimer = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    }
  }

  private connect(): void {
    const token = this.options.getToken();
    // console.log("connection token: " + token);
    if (!token) {
      this.setStatus("unauthorized");
      this.running = false;
      console.log("!token", token);
      return;
    }

    this.setStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    const WS = this.options.WebSocketImpl ?? WebSocket;
    const id = ++this.connectionId;
    const ws = new WS(this.options.url);
    this.ws = ws;

    ws.onopen = () => {
      if (id !== this.connectionId) {
        console.log("onopen");
        return;
      }
      ws.send(JSON.stringify({ type: "auth", token }));
      this.armSilenceTimer(id);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (id !== this.connectionId) return;
      this.armSilenceTimer(id); // any message proves the connection is alive

      let message: { type?: string } & Record<string, unknown>;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (message.type === "ready") {
        this.attempt = 0;
        this.setStatus("live");
        this.options.onConnected?.();
      } else if (message.type === "reading") {
        const reading = toReading(message);
        if (reading) this.options.onReading(reading);
      }
      // "heartbeat" needs no handling: arming the silence timer above is its whole purpose
    };

    ws.onclose = (event: CloseEvent) => {
      if (id !== this.connectionId) return;
      this.ws = null;
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      this.options.onClose?.({ code: event.code, reason: event.reason });
      if (event.code === CLOSE_UNAUTHORIZED) {
        this.running = false;
        this.setStatus("unauthorized"); // token expired or rejected: the app must log in again
        return;
      }
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      /* a close event always follows; reconnect is handled there */
    };
  }

  /** No message for too long (dropped Wi-Fi, sleeping phone): the socket may be dead without telling us. */
  private armSilenceTimer(id: number): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (id !== this.connectionId || !this.running) return;
      this.teardown();
      this.scheduleReconnect();
    }, this.options.silenceTimeoutMs);
  }

  private scheduleReconnect(): void {
    if (!this.running) return;
    this.setStatus("reconnecting");
    const exponential = Math.min(
      this.options.reconnectMaxMs,
      this.options.reconnectBaseMs * 2 ** this.attempt,
    );
    const delay = exponential / 2 + Math.random() * (exponential / 2); // jitter: avoid a thundering herd
    this.attempt++;
    this.reconnectTimer = setTimeout(() => {
      if (this.running) this.connect();
    }, delay);
  }
}
