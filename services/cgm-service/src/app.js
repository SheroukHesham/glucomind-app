const express = require("express");
const axios = require("axios");
const {
  saveCgmData,
  getLastReadingByUser,
  Cgm,
  getCgmDataToday,
  getCgmDataPastWeek,
  getUserIdFromSensor,
  getUserIdsFromSensor,
} = require("./db.js");
const { produce } = require("./kafka/producers.js");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
app.use(express.json());
const PORT = 3000;

// Start the dummy CGM data sender script
const senderScript = path.join(__dirname, "sensor-script.js");
const sender = spawn("node", [senderScript], {
  stdio: "inherit",
});

// endpoint to get the current CGM reading (glucose level and trend)
app.get("/cgm/current/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const latestReading = await getLastReadingByUser(userId);
    if (!latestReading) {
      return res.status(404).json({ error: "No CGM data found for user" });
    }
    res.json(latestReading);
  } catch (error) {
    console.error("Error fetching current CGM reading:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to add or update sensorId for a user (connect sensor)
app.post("/cgm/add-sensor/:userId", async (req, res) => {
  const { userId } = req.params;
  const { sensorId } = req.body;

  if (!userId || !sensorId) {
    return res.status(400).json({ error: "userId and sensorId are required" });
  }
  try {
    // Use upsert to create if not exists
    const result = await Cgm.updateOne(
      { userId: userId },
      { $set: { sensorId: sensorId, userId: userId } },
      { upsert: true },
    );
    res.json({
      message: result.upserted
        ? `Created new user and added sensorId for user ${userId}`
        : `Added/updated sensorId for user ${userId}`,
      result,
    });
  } catch (error) {
    console.error("Error adding sensorId for user:", error);
    res.status(500).json({ error: "Failed to add sensorId" });
  }
});

// Endpoint to remove sensorId for a user (disconnect sensor)
app.delete("/cgm/remove-sensor/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }
  try {
    const result = await Cgm.updateMany(
      { userId: userId },
      { $unset: { sensorId: "" } },
    );
    res.json({
      message: `Removed sensorId from ${result.modifiedCount || result.nModified} records for user ${userId}`,
      result,
    });
  } catch (error) {
    console.error("Error removing sensorId for user:", error);
    res.status(500).json({ error: "Failed to remove sensorId" });
  }
});

// *** functions called with each received sensor data

async function getFcmTokenForUser(userId) {
  try {
    const response = await axios.get(
      `http://user-service:3001/user/${userId}/fcm-token`,
    );
    return response.data.fcmToken;
  } catch (error) {
    console.error(
      "Error fetching FCM token:",
      error.response?.data || error.message,
    );
    return null;
  }
}

//**TODO:  */
//function to determine if the glucose level is critical and glucose trend
// creates the message to be sent to emergency service
const handleGlucoseData = async (userId, glucoseValue) => {
  try {
    // Fetch the last reading from DB
    const lastReading = await getLastReadingByUser(userId);
    let trend = "unknown";
    if (lastReading) {
      const prevValue = lastReading.glucoseLevels;
      if (glucoseValue > prevValue + 5) trend = "rising";
      else if (glucoseValue < prevValue - 5) trend = "falling";
      else trend = "steady";
    } else {
      return "steady";
    }

    // get the FCM token for the user from user-service
    const fcmToken = await getFcmTokenForUser(userId);
    if (!fcmToken) {
      console.error(
        `No FCM token found for user ${userId}. Please connect the sensor first.`,
      );
      return trend; // No action if no FCM token
    }

    // Normal
    if (glucoseValue >= 80 && glucoseValue <= 140) {
      return trend;
    }

    // Slightly Abnormal
    if (
      (glucoseValue >= 70 && glucoseValue < 80) ||
      (glucoseValue > 140 && glucoseValue <= 180)
    ) {
      const message = {
        userId: userId,
        fcmToken: fcmToken,
        glucoseLevel: glucoseValue,
        trend: trend,
        timestamp: new Date().toISOString(),
        criticality: "slightly_abnormal",
      };
      await produce(message);
    }

    // High/Low
    else if (
      (glucoseValue >= 55 && glucoseValue < 70) ||
      (glucoseValue > 180 && glucoseValue <= 250)
    ) {
      const message = {
        userId: userId,
        fcmToken: fcmToken,
        glucoseLevel: glucoseValue,
        trend: trend,
        timestamp: new Date().toISOString(),
        criticality: "high_low",
      };
      await produce(message);
    }

    // Critical
    else if (glucoseValue < 55 || glucoseValue > 250) {
      const message = {
        userId: userId,
        fcmToken: fcmToken,
        glucoseLevel: glucoseValue,
        trend: trend,
        timestamp: new Date().toISOString(),
        criticality: "critical",
      };
      await produce(message);
    }
  } catch (error) {
    console.error("Error in handleGlucoseData:", error);
  }

  return trend;
};

// Websocket connection
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 4000 });

wss.on("connection", (ws) => {
  ws.on("message", async (message) => {
    try {
      // Expecting message as JSON: { sensorId, glucoseLevel }
      const { sensorId, glucoseLevel } = JSON.parse(message);

      if (!sensorId || !glucoseLevel) {
        ws.send(
          JSON.stringify({ error: "User ID and glucose level are required" }),
        );
        return;
      }
      // get all userIds from sensorId
      const userId = await getUserIdFromSensor(sensorId);
      if (!userId || userId.length === 0) {
        console.error(
          `No users found for sensorId: ${sensorId}. Please connect the sensor first.`,
        );
        return;
      }
      // Analyze and save the glucose data for all users

      let trend;

      try {
        trend = await handleGlucoseData(userId, glucoseLevel);
      } catch (err) {
        console.error("handleGlucoseData failed:", err);
      }

      await saveCgmData(userId, glucoseLevel, trend);
    } catch (error) {
      ws.send(JSON.stringify({ error: "Invalid data or server error" }));
    }
  });

  ws.send(JSON.stringify({ message: "WebSocket connection established" }));
});
// TODO: Remove after testing
app.post("/glucose-reading", async (req, res) => {
  const { userId, glucoseLevel } = req.body;

  if (!userId || !glucoseLevel) {
    return res
      .status(400)
      .json({ error: "User ID and glucose level are required" });
  }

  // Analyze the glucose level
  const trend = await handleGlucoseData(userId, glucoseLevel);

  // Save the glucose data to database
  const saveStatus = await saveCgmData(userId, glucoseLevel, trend);
  if (saveStatus !== 201) {
    return res
      .status(saveStatus)
      .json({ error: "Failed to save glucose data" });
  }

  res.status(200).json(trend);
});

// Function returns the cgm data for past 24 hours
app.get("/cgm/last24h/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago

  try {
    const readings = await Cgm.find({
      userId,
      timestamp: { $gte: since },
    }).sort({ timestamp: 1 });

    res.json({
      readings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch readings" });
  }
});

// function that gets the average blood glucose level in
// the past 24 hours and the dominant trend
const getCgmStatsLast24h = async (userId) => {
  if (!userId) {
    throw new Error("userId is required");
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const readings = await Cgm.find({
    userId,
    timestamp: { $gte: since },
  });

  if (readings.length === 0) {
    return {
      averageGlucose: null,
      dominantTrend: null,
      message: "No readings found in the last 24 hours",
    };
  }

  // Calculate average glucose level
  const totalGlucose = readings.reduce((sum, r) => sum + r.glucoseLevels, 0);
  const averageGlucose = totalGlucose / readings.length;

  // Calculate dominant trend
  const trendCounts = readings.reduce((counts, r) => {
    counts[r.trend] = (counts[r.trend] || 0) + 1;
    return counts;
  }, {});

  const dominantTrend = Object.entries(trendCounts).reduce((a, b) =>
    b[1] > a[1] ? b : a,
  )[0];

  return {
    averageGlucose: Math.round(averageGlucose * 100) / 100,
    dominantTrend,
  };
};

// Endpoint to get the average glucose level and dominant trend for the past 24 hours
app.get("/cgm/stats/last24h/:userId", async (req, res) => {
  try {
    const stats = await getCgmStatsLast24h(req.params.userId);
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to compute CGM stats" });
  }
});

// function returns the CGM readings over the past week
app.get("/cgm/last7d/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const readings = await Cgm.find({
      userId,
      timestamp: { $gte: since },
    }).sort({ timestamp: 1 });

    res.json({
      readings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch readings" });
  }
});

// endpoint to get the average, highest and lowest glucose levels in the past 24 hours
app.get("/cgm/high-low/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago

  try {
    const readings = await Cgm.find({
      userId,
      timestamp: { $gte: since },
    });

    if (readings.length === 0) {
      return res
        .status(404)
        .json({ error: "No readings found in the last 24 hours" });
    }

    const glucoseLevels = readings.map((r) => r.glucoseLevels);
    const highest = Math.max(...glucoseLevels);
    const lowest = Math.min(...glucoseLevels);

    const stats = await getCgmStatsLast24h(userId);

    res.json({
      highest,
      lowest,
      averageGlucose: stats.averageGlucose,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch readings" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("CGM Service on port", PORT);
});

module.exports = {
  handleGlucoseData,
};
