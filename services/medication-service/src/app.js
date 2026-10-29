const express = require("express");
const mongoose = require("mongoose");
const { createMedicationRouter } = require("./routes/medication.routes");
const { startReminderWorker } = require("./reminders/worker");
const {
  reminderQueue,
  scheduleMaintenance,
  reconcileReminders,
} = require("./reminders/scheduler");
const {
  startDeviceTokenSync,
  stopDeviceTokenSync,
} = require("./kafka/deviceTokenConsumer");
const {
  startUserSettingsSync,
  stopUserSettingsSync,
} = require("./kafka/userSettingsConsumer");

const PORT = 3002;

const app = express();
app.use(express.json());
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.use(createMedicationRouter());

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not defined");
  await mongoose.connect(process.env.MONGO_URI);

  // Redis side: the worker fires reminders, the nightly job keeps Redis in sync with MongoDB
  await scheduleMaintenance();
  const worker = startReminderWorker();
  reconcileReminders()
    .then((stats) => console.log("[reminders] startup reconcile:", stats))
    .catch((err) =>
      console.error("[reminders] startup reconcile failed:", err),
    );

  // Kafka side: best effort, reminders keep firing with the data already stored
  startDeviceTokenSync().catch((err) =>
    console.error("[kafka] device-token sync failed to start:", err),
  );
  startUserSettingsSync().catch((err) =>
    console.error("[kafka] user-settings sync failed to start:", err),
  );

  const server = app.listen(PORT, "0.0.0.0", () =>
    console.log(`Medication Service on port ${PORT}`),
  );

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close();
    await Promise.allSettled([
      worker.close(), // waits for running jobs to finish
      reminderQueue.close(),
      stopDeviceTokenSync(),
      stopUserSettingsSync(),
      mongoose.disconnect(),
    ]);
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Medication service failed to start:", err);
  process.exit(1);
});

// const express = require("express");
// const cron = require("node-cron");
// const admin = require("./firebase");
// const axios = require("axios");
// const {
//   startDeviceTokenSync,
//   stopDeviceTokenSync,
// } = require("./kafka/deviceTokenConsumer");
// const { connectDatabase } = require("./models/deviceToken");
// const app = express();
// const PORT = 3002;
// app.use(express.json());

// const db = {
//   async getAllUsersWithMedications() {
//     try {
//       const response = await axios.get(
//         `http://user-service:3001/users-with-medications`,
//       );
//       return response.data;
//     } catch (error) {
//       console.error("Error fetching users:", error.message);
//       return null;
//     }
//   },
// };

// // get all medications by userId
// app.get("/medications/:userId", async (req, res) => {
//   const { userId } = req.params;
//   try {
//     const medications = await Medication.find({ userId });
//     res.status(200).json(medications);
//   } catch (error) {
//     console.error("Error fetching medications:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// // add or update medication
// app.post("/add_medications/:userId", async (req, res) => {
//   const { userId } = req.params;
//   const { name, time, frequency, id } = req.body;

//   if (!userId || !name || !time) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   try {
//     const medicationData = { userId, name, time, frequency };
//     // if present, update existing medication by id, otherwise create new
//     if (id) {
//       medicationData.id = id;
//       await Medication.findOneAndUpdate({ id }, medicationData, { new: true });
//     } else {
//       const newMedication = new Medication(medicationData);
//       await newMedication.save();
//     }
//     res.status(200).json({ message: "Medication saved successfully" });
//   } catch (error) {
//     console.error("Error saving medication:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// // delete medication from the list of a user
// app.delete("/medications/:id", async (req, res) => {
//   const { userId } = req.params;
//   const medicationId = req.body.id;
//   if (!medicationId) {
//     return res.status(400).json({ error: "Medication ID is required" });
//   } else if (!userId) {
//     return res.status(400).json({ error: "User ID is required" });
//   }
//   try {
//     const result = await Medication.deleteOne({ id: medicationId, userId });
//     if (result.deletedCount === 0) {
//       return res.status(404).json({ error: "Medication not found" });
//     }
//     res.status(200).json({ message: "Medication deleted successfully" });
//   } catch (error) {
//     console.error("Error deleting medication:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// // Function to send FCM notification

// function sendFCM(token, title, body) {
//   const message = {
//     token,
//     notification: {
//       title,
//       body,
//     },
//   };

//   admin
//     .messaging()
//     .send(message)
//     .catch((err) => console.error("FCM Error:", err));
// }

// function isTimeMatch(medTime, currentTime) {
//   return medTime === currentTime; // Both in "HH:mm"
// }

// // check every minute of a medication time has come
// cron.schedule("* * * * *", async () => {
//   const now = new Date();
//   const currentTime = now.toTimeString().slice(0, 5); // "HH:mm"
//   const currentDay = now.getDay(); // 0 = Sunday

//   const users = await db.getAllUsersWithMedications();
//   if (!users) return;

//   // For testing only
//   //const users = await getAllUsers();

//   for (const user of users) {
//     for (const med of user.medications) {
//       const timeMatch = isTimeMatch(med.time, currentTime);

//       if (!timeMatch) continue;

//       if (med.frequency === "daily") {
//         sendFCM(
//           user.fcmToken,
//           "Medication Reminder",
//           `Time to take ${med.name}`,
//         );
//       } else if (med.frequency === "weekly" && med.dayOfWeek === currentDay) {
//         sendFCM(
//           user.fcmToken,
//           "Weekly Medication Reminder",
//           `Take ${med.name} today`,
//         );
//       } else if (med.frequency === "monthly") {
//         const dayOfMonth = med.dayOfMonth || 1;
//         if (now.getDate() === dayOfMonth) {
//           sendFCM(
//             user.fcmToken,
//             "Monthly Medication Reminder",
//             `Take ${med.name} today`,
//           );
//         }
//       }
//     }
//   }
// });

// // TODO: move to medication service
// // // on update: send medication list of user to medication service via kafka to be updated
// // const medications = user.medications || [];
// // await sendMedicationEvents(userId, medications);
// // update medication list of user
// app.put("/user/:id/medications", async (req, res) => {
//   const userId = req.params.id;
//   const medications = req.body.medications;

//   if (!medications || !Array.isArray(medications)) {
//     return res.status(400).send("Invalid medications data");
//   }

//   try {
//     const user = await getUserById(userId);
//     if (!user) return res.status(404).send("User not found");

//     user.medications = medications;
//     await user.save();

//     // send medication list of user to medication service via kafka
//     // await sendMedicationEvents(userId, medications);

//     res.status(200).json(user);
//   } catch (error) {
//     console.error("Error updating medications:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });
// // get all users who have medications
// app.get("/users-with-medications", async (req, res) => {
//   try {
//     // Find users where medications array exists and is not empty
//     const users = await User.find({
//       medications: { $exists: true, $not: { $size: 0 } },
//     }).select("_id medications fcmTokens name email");

//     // Format response as needed for medication service
//     const result = users.map((user) => ({
//       userId: user._id,
//       name: user.name,
//       email: user.email,
//       fcmTokens: user.fcmTokens,
//       medications: user.medications,
//     }));

//     res.status(200).json(result);
//   } catch (error) {
//     console.error("Error fetching users with medications:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// let server;

// async function startMedicationService() {
//   try {
//     await connectDatabase();
//     await startDeviceTokenSync();

//     server = app.listen(PORT, "0.0.0.0", () => {
//       console.log(`Medication Service on port ${PORT}`);
//       console.log("[device-tokens] Kafka consumer started");
//     });
//   } catch (error) {
//     console.error("[medication-service] Failed to start:", error);

//     process.exitCode = 1;
//   }
// }

// async function shutdown(signal) {
//   console.log(`[medication-service] Received ${signal}; shutting down`);

//   if (server) {
//     await new Promise((resolve) => server.close(resolve));
//   }

//   try {
//     await stopDeviceTokenSync();
//   } catch (error) {
//     console.error("[device-tokens] Error disconnecting consumer:", error);
//   }

//   process.exit(0);
// }

// process.once("SIGINT", () => shutdown("SIGINT"));
// process.once("SIGTERM", () => shutdown("SIGTERM"));

// startMedicationService();
