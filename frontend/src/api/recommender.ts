import { API } from "@/config/api";
import { ApiError, apiFetch } from "./client";
import { MealPlan } from "@/interfaces";

export async function getUserMealPlan(
  userId: string,
): Promise<MealPlan | null> {
  try {
    const response = await apiFetch<MealPlan>(
      `${API.recommender}/recommendations/${encodeURIComponent(userId)}`,
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
