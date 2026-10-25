const crypto = require("crypto");
const mongoose = require("mongoose");
const { AppError } = require("./errors");
const { deriveSensorToken, isValidSensorToken } = require("./sensor-auth");

const SENSOR_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

const sensorSchema = new mongoose.Schema({
  sensorId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["active", "revoked"], default: "active" },
  pairedAt: { type: Date, default: Date.now },
  revokedAt: Date,
  lastSeenAt: Date,
});

// a user can have only ONE active sensor (revoked ones are kept as history)
sensorSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);

/** @typedef {import("mongoose").InferSchemaType<typeof sensorSchema>} SensorDoc */
const Sensor = mongoose.model("Sensor", sensorSchema);

/**
 * Pairs a sensor with a user. Generates a sensor id when none is supplied
 * (pass the real serial number for a physical device).
 * @param {string} userId
 * @param {string} [requestedSensorId]
 * @returns {Promise<{ sensorId: string, token: string }>}
 */
async function pairSensor(userId, requestedSensorId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError("Invalid user id", "INVALID_USER");
  }
  const sensorId =
    requestedSensorId ||
    `SENS-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  if (!SENSOR_ID_PATTERN.test(sensorId)) {
    throw new AppError(
      "Sensor id must be 4-64 characters: letters, digits, '-' or '_'",
      "INVALID_SENSOR_ID",
    );
  }

  try {
    await Sensor.create({ sensorId, userId });
  } catch (err) {
    if (err && err.code === 11000) {
      if (err.keyPattern && err.keyPattern.sensorId) {
        throw new AppError(
          "Sensor is already registered",
          "SENSOR_ALREADY_REGISTERED",
        );
      }
      const existing = await Sensor.findOne({ userId, status: "active" })
        .lean()
        .exec();
      throw new AppError(
        "User already has an active sensor",
        "USER_ALREADY_PAIRED",
        {
          sensorId: existing && existing.sensorId,
        },
      );
    }
    throw err;
  }
  return { sensorId, token: deriveSensorToken(sensorId) };
}

/**
 * @param {string} sensorId
 * @returns {Promise<SensorDoc>}
 */
async function revokeSensor(sensorId) {
  const sensor = await Sensor.findOneAndUpdate(
    { sensorId, status: "active" },
    { $set: { status: "revoked", revokedAt: new Date() } },
  )
    .lean()
    .exec();
  if (!sensor)
    throw new AppError("No active sensor with this id", "SENSOR_NOT_FOUND");
  return sensor;
}

/**
 * Authenticates a reading: valid token AND sensor still active.
 * @param {string} sensorId
 * @param {string} token
 * @returns {Promise<import("mongoose").Types.ObjectId | null>} owner's userId
 */
async function verifySensor(sensorId, token) {
  if (!isValidSensorToken(sensorId, token)) return null;
  const sensor = await Sensor.findOneAndUpdate(
    { sensorId, status: "active" },
    { $set: { lastSeenAt: new Date() } },
    { projection: { userId: 1 } },
  )
    .lean()
    .exec();
  return sensor ? sensor.userId : null;
}

/**
 * @param {string} sensorId
 */
async function getUserIdFromSensor(sensorId) {
  const sensor = await Sensor.findOne({ sensorId, status: "active" })
    .select("userId")
    .lean()
    .exec();
  return sensor ? sensor.userId : null;
}

/**
 * @param {string} userId
 */
async function getActiveSensorForUser(userId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError("Invalid user id", "INVALID_USER");
  }
  return Sensor.findOne({ userId, status: "active" }).lean().exec();
}

/** @returns {Promise<string[]>} */
async function listActiveSensorIds() {
  const sensors = await Sensor.find({ status: "active" })
    .select("sensorId")
    .lean()
    .exec();
  return sensors.map((s) => s.sensorId);
}

module.exports = {
  Sensor,
  pairSensor,
  revokeSensor,
  verifySensor,
  getUserIdFromSensor,
  getActiveSensorForUser,
  listActiveSensorIds,
};
