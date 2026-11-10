import { Router } from "express";
import { FREQUENCIES, Frequency, Medication } from "../models/medication";
import {
  removeReminder,
  resolveTimezone,
  upsertReminder,
} from "../reminders/scheduler";
import {
  localNow,
  reminderWindow,
  slotsOf,
  validateRule,
} from "../reminders/pattern";

interface MedicationInput {
  id?: string;
  name: string;
  frequency: Frequency;
  times: string[];
  dosage?: string;
  notes?: string;
  startDate?: string;
  endDate?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const OPTIONAL_FIELDS = [
  "dosage",
  "notes",
  "startDate",
  "endDate",
  "dayOfWeek",
  "dayOfMonth",
] as const;

const isBlank = (v: unknown) => v === undefined || v === null || v === "";

function optionalString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined | { error: string } {
  if (isBlank(value)) return undefined;
  if (typeof value !== "string") return { error: `${field} must be a string` };
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return { error: `${field} must be at most ${maxLength} characters` };
  }
  return trimmed === "" ? undefined : trimmed;
}

/** Returns the validated input, or an error message string. */
function parseMedicationInput(body: unknown): MedicationInput | string {
  const b = (body ?? {}) as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim() === "") {
    return "name is required";
  }

  const frequency = (b.frequency ?? "daily") as Frequency;
  if (!FREQUENCIES.includes(frequency)) {
    return `frequency must be one of: ${FREQUENCIES.join(", ")}`;
  }

  // `times: ["08:00", "14:30"]`, or the legacy single `time: "08:00"`.
  let times: string[];
  if (Array.isArray(b.times)) {
    if (!b.times.every((t) => typeof t === "string")) {
      return "times must be an array of HH:mm strings";
    }
    times = b.times as string[];
  } else if (typeof b.time === "string") {
    times = [b.time];
  } else {
    return "times is required (array of HH:mm)";
  }

  // Optional sanity check for clients that send "x times a day" as a number.
  if (!isBlank(b.timesPerDay) && frequency === "times_per_day") {
    if (Number(b.timesPerDay) !== times.length) {
      return "timesPerDay does not match the number of intake times";
    }
  }

  if (!isBlank(b.id) && (typeof b.id !== "string" || !ID_PATTERN.test(b.id))) {
    return "id may only contain letters, digits, '-' and '_' (max 64)";
  }

  const dosage = optionalString(b.dosage, "dosage", 100);
  if (typeof dosage === "object") return dosage.error;
  const notes = optionalString(b.notes, "notes", 500);
  if (typeof notes === "object") return notes.error;
  const startDate = optionalString(b.startDate, "startDate", 10);
  if (typeof startDate === "object") return startDate.error;
  const endDateInput = optionalString(b.endDate, "endDate", 10);
  if (typeof endDateInput === "object") return endDateInput.error;

  const dayOfWeek = isBlank(b.dayOfWeek) ? undefined : Number(b.dayOfWeek);
  const dayOfMonth = isBlank(b.dayOfMonth) ? undefined : Number(b.dayOfMonth);

  // Normalise fields that do not apply to the chosen frequency, so they are cleared on update.
  const endDate = frequency === "once" ? undefined : endDateInput;

  const value: MedicationInput = {
    id: typeof b.id === "string" && b.id !== "" ? b.id : undefined,
    name: b.name.trim(),
    frequency,
    times,
    dosage,
    notes,
    startDate,
    endDate,
    dayOfWeek: frequency === "weekly" ? dayOfWeek : undefined,
    dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
  };

  try {
    validateRule(value); // times, dates, slot count per frequency, once needs startDate
    if (
      frequency === "weekly" &&
      (value.dayOfWeek === undefined ||
        !(value.dayOfWeek >= 0 && value.dayOfWeek <= 6) ||
        !Number.isInteger(value.dayOfWeek))
    ) {
      return "Weekly medications need dayOfWeek 0-6 (0 = Sunday)";
    }
    if (
      frequency === "monthly" &&
      value.dayOfMonth !== undefined &&
      (!Number.isInteger(value.dayOfMonth) ||
        value.dayOfMonth < 1 ||
        value.dayOfMonth > 31)
    ) {
      return "Monthly medications need dayOfMonth 1-31";
    }
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

  // POST /add_medications/:userId
  //   { id?, name, frequency?, times: ["HH:mm", ...], dosage?, notes?, startDate?, endDate?,
  //     dayOfWeek?, dayOfMonth? }
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
      const timezone = await resolveTimezone(userId);
      const previous = id
        ? await Medication.findOne({ id, userId }).lean()
        : null;

      // A brand-new medication whose course is already over (or whose one-time dose time has
      // passed) would never remind anyone: tell the user instead of silently saving it.
      if (
        !previous &&
        reminderWindow(fields, localNow(timezone)) === "expired"
      ) {
        res.status(400).json({
          error:
            fields.frequency === "once"
              ? "The one-time dose is already in the past"
              : "endDate is already in the past",
        });
        return;
      }

      // Build the write: cleared optional fields are $unset, the legacy `time` is retired.
      const set: Record<string, unknown> = {
        name: fields.name,
        frequency: fields.frequency,
        times: fields.times,
      };
      const unset: Record<string, 1> = { time: 1 };
      for (const key of OPTIONAL_FIELDS) {
        if (fields[key] === undefined) unset[key] = 1;
        else set[key] = fields[key];
      }

      const medication = id
        ? await Medication.findOneAndUpdate(
            { id, userId },
            { $set: set, $unset: unset, $setOnInsert: { id, userId } },
            { upsert: true, new: true },
          ).lean()
        : (await Medication.create({ ...set, userId })).toObject();

      if (!medication) throw new Error("Medication was not saved");

      // The data is saved first. If Redis is down, the nightly/startup reconcile repairs the schedule.
      let reminderScheduled = true;
      try {
        await upsertReminder(
          medication,
          timezone,
          previous ? slotsOf(previous) : [],
        );
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
        const deleted = await Medication.findOneAndDelete({
          _id: medicationId,
          userId,
        }).lean();
        if (!deleted) {
          res.status(404).json({ error: "Medication not found" });
          return;
        }
        await removeReminder(medicationId, slotsOf(deleted)).catch((err) =>
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
