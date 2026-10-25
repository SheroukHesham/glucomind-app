//@ts-nocheck
const express = require("express");
const { AppError } = require("./errors");
const {
  Sensor,
  pairSensor,
  revokeSensor,
  getActiveSensorForUser,
} = require("./sensors");
const { seedMockHistory } = require("./seed-history");

const STATUS_BY_CODE = {
  INVALID_USER: 400,
  INVALID_SENSOR_ID: 400,
  USER_ALREADY_PAIRED: 409,
  SENSOR_ALREADY_REGISTERED: 409,
  SENSOR_NOT_FOUND: 404,
};

/**
 * @param {import("express").Response} res
 * @param {unknown} err
 */
function sendError(res, err) {
  if (err instanceof AppError) {
    return res
      .status(STATUS_BY_CODE[err.code] || 400)
      .json({ error: err.message, code: err.code, ...(err.details || {}) });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

/**
 * @param {{ simulator: import("./sensor-simulator").SensorSimulator }} deps
 */
function createSensorRouter({ simulator }) {
  const router = express.Router();
  const simulationEnabled = process.env.SIMULATE_SENSORS !== "false";

  // POST /cgm/sensors/pair   { userId, sensorId? }  ->  { sensorId, token }
  router.post("/pair", async (req, res) => {
    try {
      const { userId, sensorId } = req.body || {};
      const paired = await pairSensor(userId, sensorId);
      if (simulationEnabled) simulator.start(paired.sensorId, paired.token);
      res.status(201).json(paired);
    } catch (err) {
      sendError(res, err);
    }
  });

  // DELETE /cgm/sensors/:sensorId
  router.delete("/:sensorId", async (req, res) => {
    try {
      await revokeSensor(req.params.sensorId);
      simulator.stop(req.params.sensorId);
      res.json({ message: "Sensor unpaired" });
    } catch (err) {
      sendError(res, err);
    }
  });

  // GET /cgm/sensors/user/:userId
  router.get("/user/:userId", async (req, res) => {
    try {
      const sensor = await getActiveSensorForUser(req.params.userId);
      if (!sensor)
        return res
          .status(404)
          .json({ error: "No active sensor for this user" });
      res.json({
        sensorId: sensor.sensorId,
        pairedAt: sensor.pairedAt,
        lastSeenAt: sensor.lastSeenAt,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  // POST /cgm/sensors/:sensorId/seed-history?days=14   (development only)
  if (process.env.NODE_ENV !== "production") {
    router.post("/:sensorId/seed-history", async (req, res) => {
      try {
        const sensor = await Sensor.findOne({
          sensorId: req.params.sensorId,
          status: "active",
        })
          .lean()
          .exec();
        if (!sensor)
          throw new AppError(
            "No active sensor with this id",
            "SENSOR_NOT_FOUND",
          );
        const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
        res.json(
          await seedMockHistory(
            sensor.userId.toString(),
            sensor.sensorId,
            days,
          ),
        );
      } catch (err) {
        sendError(res, err);
      }
    });
  }

  return router;
}

module.exports = { createSensorRouter };
