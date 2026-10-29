import { Router } from "express";
import { FREQUENCIES, Frequency, Medication } from "../models/medication";
import {
  removeReminder,
  resolveTimezone,
  upsertReminder,
} from "../reminders/scheduler";
import { toCronPattern } from "../reminders/pattern";

interface MedicationInput {
  id?: string;
  name: string;
  time: string;
  frequency: Frequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

/** Returns the validated input, or an error message string. */
function parseMedicationInput(body: unknown): MedicationInput | string {
  const b = (body ?? {}) as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim() === "") {
    return "name is required";
  }
  if (typeof b.time !== "string") return "time is required (HH:mm)";

  const frequency = (b.frequency ?? "daily") as Frequency;
  if (!FREQUENCIES.includes(frequency)) {
    return `frequency must be one of: ${FREQUENCIES.join(", ")}`;
  }

  const dayOfWeek =
    b.dayOfWeek === undefined || b.dayOfWeek === null
      ? undefined
      : Number(b.dayOfWeek);
  const dayOfMonth =
    b.dayOfMonth === undefined || b.dayOfMonth === null
      ? undefined
      : Number(b.dayOfMonth);

  const value: MedicationInput = {
    id: typeof b.id === "string" && b.id !== "" ? b.id : undefined,
    name: b.name.trim(),
    time: b.time,
    frequency,
    dayOfWeek,
    dayOfMonth,
  };

  try {
    toCronPattern(value); // the same validation the scheduler applies
  } catch (err) {
    return (err as Error).message;
  }
  return value;
}

export function createMedicationRouter(): Router {
  const router = Router();

  // GET /medications/:userId
  router.get("/medications/:userId", async (req, res): Promise<void> => {
    try {
      res
        .status(200)
        .json(await Medication.find({ userId: req.params.userId }).lean());
    } catch (error) {
      console.error("Error fetching medications:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /add_medications/:userId  { id?, name, time: "HH:mm", frequency?, dayOfWeek?, dayOfMonth? }
  // Creates a medication, or updates it when `id` already exists. The reminder schedule follows.
  router.post("/add_medications/:userId", async (req, res): Promise<void> => {
    const { userId } = req.params;
    const parsed = parseMedicationInput(req.body);
    if (typeof parsed === "string") {
      res.status(400).json({ error: parsed });
      return;
    }
    const { id, ...fields } = parsed;

    try {
      const medication = id
        ? await Medication.findOneAndUpdate(
            { id, userId },
            { $set: fields, $setOnInsert: { id, userId } },
            { upsert: true, new: true },
          ).lean()
        : (await Medication.create({ ...fields, userId })).toObject();

      if (!medication) throw new Error("Medication was not saved");

      // The data is saved first. If Redis is down, the nightly/startup reconcile repairs the schedule.
      let reminderScheduled = true;
      try {
        await upsertReminder(medication, await resolveTimezone(userId));
      } catch (err) {
        reminderScheduled = false;
        console.error(
          `[reminders] could not schedule medication ${medication.id}:`,
          err,
        );
      }

      res.status(id ? 200 : 201).json({ ...medication, reminderScheduled });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        res
          .status(409)
          .json({ error: "This medication id belongs to another user" });
        return;
      }
      console.error("Error saving medication:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /medications/:userId/:medicationId
  router.delete(
    "/medications/:userId/:medicationId",
    async (req, res): Promise<void> => {
      const { userId, medicationId } = req.params;
      try {
        const result = await Medication.deleteOne({ id: medicationId, userId });
        if (result.deletedCount === 0) {
          res.status(404).json({ error: "Medication not found" });
          return;
        }
        await removeReminder(medicationId).catch((err) =>
          console.error(
            `[reminders] could not remove schedule of ${medicationId}:`,
            err,
          ),
        ); // a leftover schedule removes itself the next time it fires
        res.status(200).json({ message: "Medication deleted successfully" });
      } catch (error) {
        console.error("Error deleting medication:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  return router;
}
