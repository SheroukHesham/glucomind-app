const { generateAgpReport } = require("./agp/report.js");
const { AppError } = require("./errors");
const { SensorSimulator } = require("./sensor-simulator");
const { createSensorRouter } = require("./sensor-routes");
const { listActiveSensorIds } = require("./sensors");
const { LiveHub } = require("./live/hub");
const { attachClientStream } = require("./live/clientSocket");
const WebSocket = require("ws");
const express = require("express");
const CgmService = require("./service.js");
const cgmService = new CgmService();

const app = express();
app.use(express.json());
const PORT = 3000;

// Live readings pushed to the mobile / web app (client WebSocket at /stream)
const liveHub = new LiveHub();

// Websocket connection
const wss = new WebSocket.Server({ port: 4000 });
const simulator = new SensorSimulator();
app.use("/cgm/sensors", createSensorRouter({ simulator }));

if (process.env.SIMULATE_SENSORS !== "false") {
  listActiveSensorIds()
    .then((ids) => simulator.restore(ids))
    .catch((err) => console.error("Failed to restore sensors:", err));
}

/** @param {WebSocket} ws @param {object} payload */
const reply = (ws, payload) => ws.send(JSON.stringify(payload));

wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return reply(ws, {
        ok: false,
        code: "INVALID_JSON",
        error: "Message must be valid JSON",
      });
    }

    // Expected: { sensorId: string, token: string, glucoseLevel: number }
    const { sensorId, token, glucoseLevel } = msg || {};
    if (
      typeof sensorId !== "string" ||
      typeof token !== "string" ||
      typeof glucoseLevel !== "number"
    ) {
      return reply(ws, {
        ok: false,
        code: "INVALID_PAYLOAD",
        error: "sensorId, token and glucoseLevel are required",
      });
    }

    try {
      const reading = await cgmService.handleCgmReading(
        sensorId,
        token,
        glucoseLevel,
      );
      reply(ws, { ok: true, trend: reading.trend ?? null });
      console.log(reading);
      // push the reading to every open app session of this user
      liveHub.publish(reading.userId, {
        type: "reading",
        glucoseLevel: reading.glucoseLevel,
        trend: reading.trend ?? null,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof AppError) {
        return reply(ws, { ok: false, code: err.code, error: err.message });
      }
      console.error("Failed to process reading:", err);
      reply(ws, { ok: false, code: "SERVER_ERROR", error: "Server error" });
    }
  });

  reply(ws, { message: "WebSocket connection established" });
});

/**
 * @returns {{glucoseLevel: number,timestamp:DateTime,trend: "steady"|"rising"|"falling",_id: string}}
 */
app.get("/cgm/current/:userId", async (req, res) => {
  try {
    const reading = await cgmService.getCurrentReading(req.params.userId);
    if (!reading)
      return res.status(404).json({ error: "No CGM data found for user" });
    res.json(reading);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/cgm/agp-report/:userId", async (req, res) => {
  try {
    const { buffer, filename } = await generateAgpReport(req.params.userId, {
      days: req.query.days,
      endDate: req.query.endDate,
      profile: req.query.profile,
      patientName: req.query.patientName,
    });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    if (err.code === "INSUFFICIENT_DATA") {
      return res.status(422).json({ error: err.message, ...err.details });
    }
    if (err.code === "INVALID_USER" || err.code === "INVALID_PROFILE") {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to generate AGP report" });
  }
});

// Function returns the cgm data for past 24 hours
app.get("/cgm/last24h/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const readings = await cgmService.getDayReadings(userId);
    res.json({
      readings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch readings" });
  }
});

app.get("/cgm/stats/last24h/:userId", async (req, res) => {
  try {
    const stats = await cgmService.getCgmStatsLast24h(req.params.userId);
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to compute CGM stats" });
  }
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("CGM Service on port", PORT);
});
attachClientStream(server, liveHub);
