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

export async function getMedicationDetails(
  userId: string,
  medicationId: string,
): Promise<IMedication | null> {
  try {
    const response = await apiFetch<IMedication>(
      `${API.medication}/medication_details/${encodeURIComponent(userId)}/${encodeURIComponent(medicationId)}`,
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

export async function addUpdateMedication(
  userId: string,
  payload: IMedication,
): Promise<IMedication | null> {
  console.log("Payload", payload);

  try {
    const response = await fetch(
      `${API.medication}/add_medications/${encodeURIComponent(userId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Update medication failed:", {
        status: response.status,
        response: responseData,
      });

      throw new Error(responseData.error || "Failed to update medication");
    }

    return responseData;
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 500)
    ) {
      return null;
    }

    throw error;
  }
}
export async function deleteMedication(
  userId: string,
  medicationId: string,
): Promise<void> {
  try {
    const response = await fetch(
      `${API.medication}/medications/${encodeURIComponent(userId)}/${encodeURIComponent(medicationId)}`,
      {
        method: "DELETE",
        // headers: {
        //   "Content-Type": "application/json",
        //   Accept: "application/json",
        // },
      },
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Delete medication failed:", {
        status: response.status,
        response: responseData,
      });

      throw new Error(responseData.error || "Failed to delete medication");
    }

    return responseData;
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 500)
    ) {
    }

    throw error;
  }
}
