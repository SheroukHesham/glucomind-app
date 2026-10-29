const axios = require("axios");
const path = require("path");
const { spawn } = require("child_process");
const { archiveUserMealPlan, saveMealPlan } = require("../db");

const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://user-service:3001";
const CGM_SERVICE_URL =
  process.env.CGM_SERVICE_URL || "http://cgm-service:3000";
const GENERATION_TIMEOUT_MS = Number(
  process.env.MEAL_GENERATION_TIMEOUT_MS || 5 * 60_000,
);

/**
 * Request handlers use this one: null on any failure.
 * @param {string} userId
 */
async function getUserById(userId) {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user:", error.message);
    return null;
  }
}

/**
 * Worker uses this one: null only when the user does not exist (404); network errors throw so BullMQ retries.
 * @param {string} userId
 */
async function fetchUser(userId) {
  try {
    const response = await axios.get(`${USER_SERVICE_URL}/user/${userId}`);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) return null;
    throw error;
  }
}

/**
 * Average CGM data of the last 24 hours. Falls back to "unknown" so a CGM outage does not block meal plans.
 * @param {string} userId
 */
async function getUserCgm(userId) {
  try {
    const response = await axios.get(
      `${CGM_SERVICE_URL}/cgm/stats/last24h/${userId}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching CGM data:", error.message);
    return { averageGlucose: "unknown", trend: "unknown" };
  }
}

/**
 * @param {any} user
 * @param {{ averageGlucose?: any, trend?: any }} cgm
 */
function buildInputData(user, cgm) {
  return {
    cgm_data: cgm.averageGlucose,
    trend: cgm.trend,
    age: user.age || 30,
    gender: user.gender,
    medications: user.medications?.map((m) => m.name) || [],
    liked_meals: user.likedRecipes || [],
    disliked_meals: user.dislikedRecipes || [],
    dietary_restrictions: user.dietaryRestrictions || [],
    daily_calories: user.dailyCalories || 2000,
    additional_conditions: user.additionalConditions || [],
  };
}

/**
 * Runs ml/ollama-interface.py and resolves with its JSON result. Rejects on crash, bad output or timeout.
 * @param {object} inputData
 * @returns {Promise<{ status: string, parsed_plan?: any, message?: string }>}
 */
function runOllamaScript(inputData) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, "..", "ml", "ollama-interface.py");
    const python = spawn("python", [script], { env: process.env });

    let output = "";
    let errors = "";
    const timer = setTimeout(() => {
      python.kill("SIGKILL");
      reject(
        new Error(
          `Meal generation timed out after ${GENERATION_TIMEOUT_MS} ms`,
        ),
      );
    }, GENERATION_TIMEOUT_MS);

    python.stdout.on("data", (chunk) => (output += chunk.toString()));
    python.stderr.on("data", (chunk) => (errors += chunk.toString()));
    python.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    python.on("close", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(output));
      } catch {
        reject(
          new Error(
            `Unparseable generator output. stderr: ${errors.slice(0, 500)}`,
          ),
        );
      }
    });

    python.stdin.write(JSON.stringify(inputData));
    python.stdin.end();
  });
}

/**
 * Generates and stores a new meal plan. Resolves with a short status string; throws (=> retry) on failures.
 * The previous plan is archived only AFTER the new one was generated, so a failure never leaves the user without a plan.
 * @param {string} userId
 * @returns {Promise<string>}
 */
async function generateMealPlan(userId) {
  const user = await fetchUser(userId);
  if (!user) return "skipped: user not found";

  const cgm = await getUserCgm(userId);
  const result = await runOllamaScript(buildInputData(user, cgm));
  if (result.status !== "ok") {
    throw new Error(`Generator reported: ${result.message || "unknown error"}`);
  }

  await archiveUserMealPlan(userId);
  await saveMealPlan(userId, result.parsed_plan);
  return "generated";
}

module.exports = {
  getUserById,
  getUserCgm,
  buildInputData,
  runOllamaScript,
  generateMealPlan,
};
