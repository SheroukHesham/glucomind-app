import express from "express";
import mongoose from "mongoose";
import { createMedicationRouter } from "./routes/medication.routes";
import { startReminderWorker } from "./reminders/worker";
import {
  reminderQueue,
  scheduleMaintenance,
  reconcileReminders,
} from "./reminders/scheduler";
import {
  startDeviceTokenSync,
  stopDeviceTokenSync,
} from "./kafka/deviceTokenConsumer";
import {
  startUserSettingsSync,
  stopUserSettingsSync,
} from "./kafka/userSettingsConsumer";

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
