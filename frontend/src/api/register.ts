import { API } from "../config/api";
import { ApiError, apiFetch } from "./client";

/** The registration form: the same values the wizard collects. */
export interface RegistrationFormInput {
  username: string;
  email: string;
  password: string;
  age: number;
  gender: string;
  dailyCalories: number;
  medicalConditions?: string[];
  dietaryRestrictions?: string[];
  likedMeals?: string[];
  dislikedMeals?: string[];
  emergencyContacts?: { name: string; email: string }[];
  /** The wizard has no medications step yet; the backend already accepts them. */
  medications?: {
    name: string;
    time: string; // "HH:mm"
    frequency?: "daily" | "weekly" | "monthly";
    dayOfWeek?: number;
    dayOfMonth?: number;
  }[];
}

type RegistrationStatus = "PENDING" | "COMPLETED" | "FAILED";

interface RegistrationView {
  registrationId: string;
  status: RegistrationStatus;
  userId?: string;
  error?: string;
  code?: string;
}

/**
 * The registration was refused and everything was rolled back (nothing is saved anywhere).
 * The saga is finished: the NEXT attempt needs a NEW registration id.
 */
export class RegistrationFailedError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "RegistrationFailedError";
  }
}

/**
 * Still being processed after waiting. The outcome is unknown: try again with the SAME registration
 * id, which returns the same registration instead of creating a second one.
 */
export class RegistrationPendingError extends Error {
  constructor() {
    super(
      "Your registration is still being processed. Please check again in a moment.",
    );
    this.name = "RegistrationPendingError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The server answers a failed registration with 409 / 422 and the view in the body. */
function failedViewOf(error: unknown): RegistrationView | null {
  if (
    !(error instanceof ApiError) ||
    (error.status !== 409 && error.status !== 422)
  )
    return null;
  const body = error.body as Partial<RegistrationView> | undefined;
  return body && body.status === "FAILED" ? (body as RegistrationView) : null;
}

/**
 * Registers the user in ONE request. The backend saves the data in user-service,
 * medication-service and recommender-service as a saga: either everything is saved or nothing is.
 *
 * @param registrationId a UUID created when the form opens (expo-crypto: Crypto.randomUUID()).
 *   It is the idempotency key: sending the same one again can never create a second account.
 * @returns the id of the new user
 * @throws RegistrationFailedError  refused and rolled back (for example the email is taken)
 * @throws RegistrationPendingError still processing after maxWaitMs
 * @throws ApiError                 invalid input (400) or no connection (status 0)
 */
export async function registerAccount(
  values: RegistrationFormInput,
  registrationId: string,
  options: { pollIntervalMs?: number; maxWaitMs?: number } = {},
): Promise<{ userId: string }> {
  const { pollIntervalMs = 1000, maxWaitMs = 90_000 } = options;
  const deadline = Date.now() + maxWaitMs;

  let view: RegistrationView;
  try {
    view = await apiFetch<RegistrationView>(`${API.user}/register`, {
      method: "POST",
      headers: { "Idempotency-Key": registrationId },
      timeoutMs: 30_000,
      body: {
        username: values.username,
        email: values.email,
        password: values.password,
        age: values.age,
        gender: values.gender,
        dailyCalories: values.dailyCalories,
        medicalConditions: values.medicalConditions ?? [],
        dietaryRestrictions: values.dietaryRestrictions ?? [],
        likedMeals: values.likedMeals ?? [],
        dislikedMeals: values.dislikedMeals ?? [],
        emergencyContacts: values.emergencyContacts ?? [],
        medications: values.medications ?? [],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
  } catch (error) {
    const failed = failedViewOf(error);
    if (failed)
      throw new RegistrationFailedError(
        failed.error ?? "Registration failed",
        failed.code,
      );
    throw error;
  }

  // 202: the backend is still working. Ask for the outcome until it is final.
  while (view.status === "PENDING") {
    if (Date.now() >= deadline) throw new RegistrationPendingError();
    await sleep(pollIntervalMs);
    try {
      view = await apiFetch<RegistrationView>(
        `${API.user}/register/${registrationId}`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) continue; // a dropped connection: keep asking
      throw error;
    }
  }

  if (view.status === "FAILED") {
    throw new RegistrationFailedError(
      view.error ?? "Registration failed",
      view.code,
    );
  }
  return { userId: view.userId as string };
}
