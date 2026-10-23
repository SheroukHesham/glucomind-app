const express = require("express");
const mongoose = require("mongoose");
const { DateTime } = require("luxon");
const { HISTORY_RETENTION_DAYS } = require("../config");
const { startCgmArchiveJob } = require("./jobs/archiveCgm");
const { AppError } = require("./errors");
require("dotenv").config();

const app = express();
app.use(express.json());

const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error("❌ MONGO_URI is not defined");
  process.exit(1);
}

mongoose
  .connect(mongoURI)
  .catch((err) => console.error("MongoDB connection error:", err));

mongoose.connection.on("connected", () => {
  startCgmArchiveJob();
});

const readingSchema = new mongoose.Schema({
  glucoseLevel: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

/**
 * Holds Only current day's readings (12:00 am start)
 */
const cgmSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  readings: [readingSchema],
  sensorId: String,
});

/** @typedef {import("mongoose").InferSchemaType<typeof readingSchema>} Reading */
/** @typedef {import("mongoose").InferSchemaType<typeof cgmSchema>} CgmDoc */
const Cgm = mongoose.model("Cgm", cgmSchema);

/**
 * one document per user per day, auto-deleted after 90d
 */
const cgmHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: { type: Date, required: true }, // start (12:00 AM local) of the day
  readings: [readingSchema],
  sensorId: String,
});

cgmHistorySchema.index({ userId: 1, date: 1 }, { unique: true });
cgmHistorySchema.index(
  { date: 1 },
  { expireAfterSeconds: HISTORY_RETENTION_DAYS * 24 * 60 * 60 },
);

/** @typedef {import("mongoose").InferSchemaType<typeof readingSchema>} ReadingHistory */
/** @typedef {import("mongoose").InferSchemaType<typeof cgmHistorySchema>} CgmHistoryDoc */
const CgmHistory = mongoose.model("CgmHistory", cgmHistorySchema);

/**
 *
 * @param {string} sensorId
 * @param {string} userId
 * @returns
 */
async function configureSensor(sensorId, userId) {
  try {
    const result = await Cgm.updateOne(
      { userId: userId },
      { $set: { sensorId: sensorId, userId: userId } },
      { upsert: true },
    );
    return result;
  } catch (error) {
    throw new Error(error + "");
  }
}

/**
 *
 * @param {string} userId
 * @returns {Promise<mongoose.UpdateWriteOpResult>}
 */
async function disconnectSensor(userId) {
  try {
    const result = await Cgm.updateMany(
      { userId: userId },
      { $unset: { sensorId: "" } },
    );
    return result;
  } catch (error) {
    throw new Error(error + "");
  }
}

/**
 *
 * @param {string} userId
 * @param {number} glucoseLevel
 */
const saveCgmData = async (userId, glucoseLevel) => {
  try {
    await Cgm.findOneAndUpdate(
      { userId },
      {
        $push: {
          readings: {
            glucoseLevel: glucoseLevel,
            timestamp: new Date(),
          },
        },
      },
      {
        upsert: true,
        new: true,
      },
    );
  } catch (error) {
    console.error("Error saving CGM data:", error);
  }
};

/**
 *
 * @param {string} sensorId
 * @returns
 */
async function getUserIdFromSensor(sensorId) {
  try {
    const user = await Cgm.findOne({ sensorId: sensorId }).exec();
    if (!user) {
      throw new Error(`User not found for sensorId: ${sensorId}`);
    }
    return user.userId;
  } catch (error) {
    console.error("Error fetching user by sensorId:", error);
    throw error;
  }
}

/**
 *
 * @param {string} userId
 * @returns
 */
async function getLastReadingByUser(userId) {
  try {
    const user = await Cgm.findOne({ userId }).exec();
    const latestReading = user.readings[user.readings.length - 1];

    return latestReading;
  } catch (error) {
    console.error("Error fetching latest CGM reading:", error);
    throw error;
  }
}

/**
 * @param {string} userId
 * @returns {Promise<Reading[]>}
 */
async function getCgmDataToday(userId) {
  try {
    const cgm = await Cgm.findOne({ userId }).lean().exec();
    if (!cgm) {
      throw new Error(`User not found for userId: ${userId}`);
    }
    return cgm.readings;
  } catch (error) {
    console.error("Error fetching CGM data for today:", error);
    throw error;
  }
}

/**
 *
 * @param {string} userId
 * @param {*} from
 * @param {*} to
 * @returns
 */
async function getReadingsRange(userId, from, to) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError("Invalid user id", "INVALID_USER");
  }
  const uid = new mongoose.Types.ObjectId(userId);
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();

  const [history, today] = await Promise.all([
    CgmHistory.find({
      userId: uid,
      date: {
        $gte: new Date(fromMs - 24 * 60 * 60 * 1000),
        $lt: new Date(toMs),
      },
    }).lean(),
    Cgm.find({ userId: uid }).lean(),
  ]);

  const byTimestamp = new Map();
  for (const doc of [...history, ...today]) {
    for (const r of doc.readings || []) {
      const t = new Date(r.timestamp).getTime();
      if (t >= fromMs && t < toMs && Number.isFinite(r.glucoseLevel)) {
        byTimestamp.set(t, {
          glucoseLevel: r.glucoseLevel,
          timestamp: new Date(t),
        });
      }
    }
  }
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
}

module.exports = {
  saveCgmData,
  getLastReadingByUser,
  Cgm,
  CgmHistory,
  DateTime,
  getCgmDataToday,
  getUserIdFromSensor,
  getReadingsRange,
  configureSensor,
  disconnectSensor,
};
