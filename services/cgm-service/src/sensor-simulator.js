//@ts-nocheck
const WebSocket = require("ws");
const { DateTime } = require("luxon");
const { TIMEZONE } = require("./config");
const { deriveSensorToken } = require("./sensor-auth");

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Stateful, realistic glucose generator. Every sensor id gets its own
 * "personality" (baseline, meal response, noise), so users get different data.
 */
class GlucoseGenerator {
  /** @param {string} sensorId */
  constructor(sensorId) {
    const h = hashString(sensorId);
    const r = (shift) => ((h >>> shift) & 0xff) / 255;
    this.baseline = 100 + r(0) * 40; // 100-140
    this.mealFactor = 0.6 + r(8) * 0.9; // 0.6-1.5
    this.noise = 2 + r(16) * 4; // 2-6 mg/dL per step
    this.value = this.baseline;
    this.hypoStepsLeft = 0;
  }

  /**
   * @param {Date} [date]
   * @returns {number} glucose level in mg/dL
   */
  next(date = new Date()) {
    const dt = DateTime.fromJSDate(date, { zone: TIMEZONE });
    const hour = dt.hour + dt.minute / 60;

    const meals = [7.5, 13, 19.5].reduce(
      (sum, t) =>
        sum + 70 * this.mealFactor * Math.exp(-((hour - (t + 1)) ** 2) / 1.8),
      0,
    );
    let target =
      this.baseline + 10 * Math.sin(((hour - 6) / 24) * 2 * Math.PI) + meals;

    if (this.hypoStepsLeft > 0) {
      this.hypoStepsLeft--;
      target = 52 + Math.random() * 10;
    } else if (Math.random() < 0.004) {
      this.hypoStepsLeft = 6 + Math.floor(Math.random() * 6);
    }

    this.value +=
      (target - this.value) * 0.25 + (Math.random() - 0.5) * 2 * this.noise;
    this.value = Math.min(400, Math.max(40, this.value));
    return Math.round(this.value);
  }
}

/** One simulated physical sensor: its own socket, id, token and data stream. */
class VirtualSensor {
  /**
   * @param {{ sensorId: string, token: string, wsUrl: string, intervalMs: number }} opts
   */
  constructor({ sensorId, token, wsUrl, intervalMs }) {
    this.sensorId = sensorId;
    this.token = token;
    this.wsUrl = wsUrl;
    this.intervalMs = intervalMs;
    this.generator = new GlucoseGenerator(sensorId);
    this.stopped = false;
    /** @type {WebSocket | null} */
    this.ws = null;
    /** @type {NodeJS.Timeout | null} */
    this.timer = null;
    /** @type {NodeJS.Timeout | null} */
    this.reconnectTimer = null;
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  connect() {
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;

    ws.on("open", () => {
      this.sendReading();
      this.timer = setInterval(() => this.sendReading(), this.intervalMs);
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.ok === false) {
          console.error(`[sensor ${this.sensorId}] rejected: ${msg.error}`);
          // revoked / unknown sensor: stop instead of reconnecting forever
          if (msg.code === "SENSOR_UNAUTHORIZED") this.stop();
        }
      } catch {
        /* ignore non-JSON */
      }
    });

    ws.on("close", () => {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (!this.stopped) {
        this.reconnectTimer = setTimeout(() => this.connect(), 10000);
      }
    });

    ws.on("error", (err) => {
      console.error(`[sensor ${this.sensorId}] socket error: ${err.message}`);
    });
  }

  sendReading() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        sensorId: this.sensorId,
        token: this.token,
        glucoseLevel: this.generator.next(),
      }),
    );
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.timer = null;
    this.reconnectTimer = null;
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) this.ws.close();
      else this.ws.terminate();
    }
  }
}

/** Manages one VirtualSensor per paired sensor id. */
class SensorSimulator {
  /**
   * @param {{ wsUrl?: string, intervalMs?: number }} [opts]
   */
  constructor(opts = {}) {
    this.wsUrl = opts.wsUrl || process.env.CGM_WS_URL || "ws://localhost:4000";
    this.intervalMs =
      opts.intervalMs || Number(process.env.SIM_INTERVAL_SECONDS || 300) * 1000;
    /** @type {Map<string, VirtualSensor>} */
    this.sensors = new Map();
  }

  /**
   * @param {string} sensorId
   * @param {string} [token] defaults to the derived token
   */
  start(sensorId, token = deriveSensorToken(sensorId)) {
    if (this.sensors.has(sensorId)) return;
    const sensor = new VirtualSensor({
      sensorId,
      token,
      wsUrl: this.wsUrl,
      intervalMs: this.intervalMs,
    });
    this.sensors.set(sensorId, sensor);
    sensor.start();
  }

  /** @param {string} sensorId */
  stop(sensorId) {
    const sensor = this.sensors.get(sensorId);
    if (!sensor) return;
    sensor.stop();
    this.sensors.delete(sensorId);
  }

  /** @param {string[]} sensorIds */
  restore(sensorIds) {
    sensorIds.forEach((id) => this.start(id));
    if (sensorIds.length)
      console.log(`[sensor-sim] restored ${sensorIds.length} sensor(s)`);
  }

  stopAll() {
    [...this.sensors.keys()].forEach((id) => this.stop(id));
  }
}

module.exports = { GlucoseGenerator, VirtualSensor, SensorSimulator };
