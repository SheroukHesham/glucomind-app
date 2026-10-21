const express = require("express");
require("dotenv").config();

const app = express();
app.use(express.json());

const mongoose = require("mongoose");

const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error("❌ MONGO_URI is not defined");
  process.exit(1);
}

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .catch((err) => console.error("MongoDB connection error:", err));

mongoose.connection.on("connected", () => {});

// CGM schema
const cgmSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  readings: [
    {
      glucoseLevel: {
        type: Number,
        required: true,
      },

      timestamp: {
        type: Date,
        default: Date.now,
      },

      trend: {
        type: String,
        enum: ["steady", "rising", "falling", "unknown"],
      },
    },
  ],

  sensorId: String,
});

// CGM model
const Cgm = mongoose.model("Cgm", cgmSchema);

// configure sensor
async function configureSensor(sensorId, userId) {
  try {
    const existingSensor = await Cgm.findOne({ sensorId }).exec();
    if (existingSensor) {
      return existingSensor.userId;
    }
    const newSensor = new Cgm({ sensorId: sensorId, userId: userId });
    await newSensor.save();

    return userId;
  } catch (error) {
    console.error("Error configuring sensor:", error);
    throw error;
  }
}

// Save CGM data
const saveCgmData = async (userId, glucoseData, trend) => {
  try {
    console.log(userId, glucoseData, trend);
    const cgmData = await Cgm.findOneAndUpdate(
      { userId },
      {
        $push: {
          readings: {
            glucoseLevel: glucoseData,
            trend,
            timestamp: new Date(),
          },
        },
      },
      {
        upsert: true,
        new: true,
      },
    );
    console.log(cgmData);
  } catch (error) {
    console.error("Error saving CGM data:", error);
  }
};

// get userId from sensorId
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

// get all userIds from sensorId
async function getUsersIdFromSensor(sensorId) {
  try {
    const users = await Cgm.find({ sensorId: sensorId }).exec();
    if (!users || users.length === 0) {
      throw new Error(`No users found for sensorId: ${sensorId}`);
    }
    return users.map((user) => user.userId);
  } catch (error) {
    console.error("Error fetching users by sensorId:", error);
    throw error;
  }
}

// Get last CGM reading of user
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

// Get CGM data of user today
async function getCgmDataToday(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of the day

  try {
    const user = await Cgm.findOne({ userId }).exec();
    if (!user) {
      throw new Error(`User not found for userId: ${userId}`);
    }
    const cgmData = user.readings.filter(
      (reading) => reading.timestamp >= today,
    );

    return cgmData;
  } catch (error) {
    console.error("Error fetching CGM data for today:", error);
    throw error;
  }
}

// Get CGM data of user in past week
async function getCgmDataPastWeek(userId) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7); // Set to 7 days ago

  try {
    const user = await Cgm.findOne({ userId }).exec();
    if (!user) {
      throw new Error(`User not found for userId: ${userId}`);
    }

    const cgmData = user.readings.filter(
      (reading) => reading.timestamp >= weekAgo,
    );

    return cgmData;
  } catch (error) {
    console.error("Error fetching CGM data for past week:", error);
    throw error;
  }
}

module.exports = {
  saveCgmData,
  getLastReadingByUser,
  Cgm,
  getCgmDataToday,
  getCgmDataPastWeek,
  getUserIdFromSensor,
};
