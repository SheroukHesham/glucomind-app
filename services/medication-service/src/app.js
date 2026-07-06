const express = require("express");
//const { Medication } = require("./medication_database");
//const { getAllUsers } = require("./mockDatabase");
const cron = require("node-cron");
const admin = require("./firebase");
const axios = require("axios");
const app = express();
const PORT = 3002;
app.use(express.json());

const db = {
  async getAllUsersWithMedications() {
    try {
      const response = await axios.get(
        `http://user-service:3001/users-with-medications`,
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching users:", error.message);
      return null;
    }
  },
};

// get all medications by userId
app.get("/medications/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const medications = await Medication.find({ userId });
    res.status(200).json(medications);
  } catch (error) {
    console.error("Error fetching medications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// add or update medication
app.post("/add_medications/:userId", async (req, res) => {
  const { userId } = req.params;
  const { name, time, frequency, id } = req.body;

  if (!userId || !name || !time) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const medicationData = { userId, name, time, frequency };
    // if present, update existing medication by id, otherwise create new
    if (id) {
      medicationData.id = id;
      await Medication.findOneAndUpdate({ id }, medicationData, { new: true });
    } else {
      const newMedication = new Medication(medicationData);
      await newMedication.save();
    }
    res.status(200).json({ message: "Medication saved successfully" });
  } catch (error) {
    console.error("Error saving medication:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// delete medication from the list of a user
app.delete("/medications/:id", async (req, res) => {
  const { userId } = req.params;
  const medicationId = req.body.id;
  if (!medicationId) {
    return res.status(400).json({ error: "Medication ID is required" });
  } else if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }
  try {
    const result = await Medication.deleteOne({ id: medicationId, userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Medication not found" });
    }
    res.status(200).json({ message: "Medication deleted successfully" });
  } catch (error) {
    console.error("Error deleting medication:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Function to send FCM notification

function sendFCM(token, title, body) {
  const message = {
    token,
    notification: {
      title,
      body,
    },
  };

  admin
    .messaging()
    .send(message)
    .then((res) => console.log("Notification sent:", res))
    .catch((err) => console.error("FCM Error:", err));
}

function isTimeMatch(medTime, currentTime) {
  return medTime === currentTime; // Both in "HH:mm"
}

// check every minute of a medication time has come
cron.schedule("* * * * *", async () => {
  console.log("Checking for medication reminders...");
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // "HH:mm"
  const currentDay = now.getDay(); // 0 = Sunday
  console.log(`Current time: ${currentTime}, Current day: ${currentDay}`);
  // TODO: remove comment
  const users = await db.getAllUsersWithMedications();

  // For testing only
  //const users = await getAllUsers();

  for (const user of users) {
    for (const med of user.medications) {
      const timeMatch = isTimeMatch(med.time, currentTime);

      if (!timeMatch) continue;

      if (med.frequency === "daily") {
        sendFCM(
          user.fcmToken,
          "Medication Reminder",
          `Time to take ${med.name}`,
        );
        console.log(
          `Sent daily reminder for ${med.name} to user ${user.userId}`,
        );
      } else if (med.frequency === "weekly" && med.dayOfWeek === currentDay) {
        sendFCM(
          user.fcmToken,
          "Weekly Medication Reminder",
          `Take ${med.name} today`,
        );
        console.log(
          `Sent weekly reminder for ${med.name} to user ${user.userId}`,
        );
      } else if (med.frequency === "monthly") {
        const dayOfMonth = med.dayOfMonth || 1;
        if (now.getDate() === dayOfMonth) {
          sendFCM(
            user.fcmToken,
            "Monthly Medication Reminder",
            `Take ${med.name} today`,
          );
          console.log(
            `Sent monthly reminder for ${med.name} to user ${user.userId}`,
          );
        }
      }
    }
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Medication Service on port 3002");
});
