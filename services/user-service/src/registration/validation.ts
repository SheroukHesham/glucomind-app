import { DietSlice, MedicationInput } from "../Kafka/contracts/registration";
import { isValidTimezone } from "../Kafka/contracts/user-settings";
import { MAX_PASSWORD_BYTES, normalizeEmail } from "../auth/password";

/** The registration form as the app sends it (one request for every service). */
export interface RegistrationRequest {
  username: string;
  email: string;
  password: string;
  age: number;
  gender: "Male" | "Female";
  timezone: string;
  medications: MedicationInput[];
  diet: Omit<DietSlice, "timezone" | "age" | "gender">;
}

export const MIN_PASSWORD_LENGTH = 8;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function stringList(value: unknown, field: string): string[] | string {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 200)
    return `${field} must be a list of at most 200 texts`;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "" || item.length > 100) {
      return `${field} must only contain non-empty texts of at most 100 characters`;
    }
    out.push(item.trim());
  }
  return out;
}

/**
 * Checks the shape of the request. Returns the typed request, or a message for the client.
 * Domain rules (is "08:30" a valid reminder time?) are checked by the service that owns them:
 * if it rejects the data, the saga rolls everything back.
 */
export function parseRegistrationRequest(
  body: unknown,
): RegistrationRequest | string {
  if (!isObject(body)) return "A JSON body is required";

  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  if (username.length < 2 || username.length > 60)
    return "username must have 2 to 60 characters";

  const email =
    typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "A valid email is required";

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD_LENGTH)
    return `password must have at least ${MIN_PASSWORD_LENGTH} characters`;
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES)
    return `password must be at most ${MAX_PASSWORD_BYTES} bytes`;

  const age = Number(body.age);
  if (!Number.isInteger(age) || age < 12 || age > 120)
    return "age must be a whole number between 12 and 120";

  if (body.gender !== "Male" && body.gender !== "Female")
    return 'gender must be "Male" or "Female"';

  const dailyCalories = Number(body.dailyCalories);
  if (
    !Number.isFinite(dailyCalories) ||
    dailyCalories < 800 ||
    dailyCalories > 10000
  ) {
    return "dailyCalories must be between 800 and 10000";
  }

  if (!isValidTimezone(body.timezone))
    return "timezone must be a valid IANA timezone, for example Africa/Cairo";

  const dietaryRestrictions = stringList(
    body.dietaryRestrictions,
    "dietaryRestrictions",
  );
  if (typeof dietaryRestrictions === "string") return dietaryRestrictions;
  const medicalConditions = stringList(
    body.medicalConditions,
    "medicalConditions",
  );
  if (typeof medicalConditions === "string") return medicalConditions;
  const likedMeals = stringList(body.likedMeals, "likedMeals");
  if (typeof likedMeals === "string") return likedMeals;
  const dislikedMeals = stringList(body.dislikedMeals, "dislikedMeals");
  if (typeof dislikedMeals === "string") return dislikedMeals;

  const rawMedications = body.medications ?? [];
  if (!Array.isArray(rawMedications) || rawMedications.length > 50)
    return "medications must be a list of at most 50 items";
  const medications: MedicationInput[] = [];
  for (const item of rawMedications) {
    if (
      !isObject(item) ||
      typeof item.name !== "string" ||
      typeof item.time !== "string"
    ) {
      return "every medication needs a name and a time";
    }
    medications.push({
      name: item.name,
      time: item.time,
      frequency: item.frequency as MedicationInput["frequency"],
      dayOfWeek:
        item.dayOfWeek === undefined || item.dayOfWeek === null
          ? undefined
          : Number(item.dayOfWeek),
      dayOfMonth:
        item.dayOfMonth === undefined || item.dayOfMonth === null
          ? undefined
          : Number(item.dayOfMonth),
    });
  }

  // body.emergencyContacts is accepted and ignored: there is no emergency step in the saga yet.
  return {
    username,
    email,
    password,
    age,
    gender: body.gender,
    timezone: body.timezone,
    medications,
    diet: {
      dailyCalories,
      dietaryRestrictions,
      medicalConditions,
      likedMeals,
      dislikedMeals,
    },
  };
}
