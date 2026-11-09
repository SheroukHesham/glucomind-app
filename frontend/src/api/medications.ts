import { API } from "@/config/api";
import { ApiError, apiFetch } from "./client";
import { IMedication } from "@/interfaces";

export async function getUserMedications(
  userId: string,
): Promise<IMedication[] | null> {
  try {
    const response = await apiFetch<IMedication[]>(
      `${API.medication}/medications/${encodeURIComponent(userId)}`,
    );
    return response;
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 500)
    )
      return null;
    throw error;
  }
}
