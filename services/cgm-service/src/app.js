const express = require("express");
const axios = require("axios");
const CgmService = require("./service.js");
const cgmService = new CgmService();
const { spawn } = require("child_process");
const path = require("path");

const app = express();
app.use(express.json());
const PORT = 3000;

// Websocket connection
const WebSocket = require("ws");
const { generateAgpReport } = require("./agp/report.js");
const wss = new WebSocket.Server({ port: 4000 });

//TODO: make the sensor and data unique for each user
// Start the dummy CGM data sender script
const senderScript = path.join(__dirname, "sensor-script.js");
spawn("node", [senderScript], {
  stdio: "inherit",
});

wss.on("connection", (ws) => {
  ws.on("message", async (message) => {
    try {
      // Expecting message as JSON: { sensorId, glucoseLevel }
      const { sensorId, glucoseLevel } = JSON.parse(message.toString());

      if (!sensorId || !glucoseLevel) {
        ws.send(
          JSON.stringify({ error: "User ID and glucose level are required" }),
        );
        return;
      }
      const trend = cgmService.handleCgmReading(sensorId, glucoseLevel);
      //TODO: send the glucose level and trend to Frontend
    } catch (error) {
      ws.send(JSON.stringify({ error: "Invalid data or server error" }));
    }
  });

  ws.send(JSON.stringify({ message: "WebSocket connection established" }));
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

app.post("/cgm/add-sensor/:userId", async (req, res) => {
  const { userId } = req.params;
  const { sensorId } = req.body;

  if (!userId || !sensorId) {
    return res.status(400).json({ error: "userId and sensorId are required" });
  }
  try {
    const result = await cgmService.connectSensor(userId, sensorId);
    res.json({
      message: "User Connected Successfully",
      result,
    });
  } catch (error) {
    console.error("Error connecting sensor:", error);
    res.status(500).json({ error: "Failed to Connect Sensor" });
  }
});

app.delete("/cgm/remove-sensor/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }
  try {
    cgmService.disconnectSensor(userId);
    res.json({
      message: "Sensor Disconnected",
    });
  } catch (error) {
    console.error("Error disconnecting sensor for user:", error);
    res.status(500).json({ error: "Failed to disconnect sensor" });
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

app.listen(PORT, "0.0.0.0", () => {
  console.log("CGM Service on port", PORT);
});
