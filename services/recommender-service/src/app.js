const express = require("express");
const axios = require("axios");
const cron = require("node-cron");
const { spawn } = require("child_process");
const path = require("path");

const {
  MealPlan,
  saveMealPlan,
  archiveUserMealPlan,
} = require("./recommender_Database");

const app = express();
app.use(express.json());
const PORT = 3004;

// consume().catch(console.error);

// Calls the user service to get user data by ID
async function getUserById(userId) {
  try {
    // TODO: Check the URL
    const response = await axios.get(`http://user-service:3001/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user:", error.message);
    return null;
  }
}

// Get all the users from the user service
async function getAllUsers() {
  try {
    const response = await axios.get(`http://user-service:3001/users`);
    return response.data;
  } catch (error) {
    console.error("Error fetching all users:", error.message);
    return [];
  }
}

// Function that returns the average CGM data of the user over the last 24 hours
async function getUserCgm(userId) {
  try {
    const response = await axios.get(
      `http://cgm-service:3000/cgm/stats/last24h/${userId}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching CGM data:", error.message);
    return [];
  }
}

// Get the meal plan request from frontend
app.get("/recommendations/:id", async (req, res) => {
  const userId = req.params.id;
  // Get the user data through ID from the user service
  const user = await getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // get the user's meal plan for today (last generated meal plan) from database
  try {
    const latestMealPlan = await MealPlan.findOne({ userId })
      .sort({ createdAt: -1 })
      .exec();

    if (!latestMealPlan) {
      return res.json({ day_plan: {} });
    }

    res.json(latestMealPlan);
  } catch (err) {
    console.error("Error fetching latest meal plan:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Save the meal plan to the database
const saveGeneratedMeal = async (userId, mealPlanData) => {
  try {
    console.log("Saving meal plan for user:", userId);
    await saveMealPlan(userId, mealPlanData);
  } catch (err) {
    console.error("Error saving meal plan:", err);
    throw err;
  }
};

// Move old meal plan before generating a new one
const generate_meal = async (userId, inputData) => {
  // Archive the user's current meal plan before generating a new one
  await archiveUserMealPlan(userId);

  // Use path.join or forward slashes to avoid issues
  const pythonScriptPath = path.join(__dirname, "HuggingInterface.py");

  const python = spawn("python", [pythonScriptPath]);
  python.stdin.write(JSON.stringify(inputData));
  python.stdin.end();

  let output = "";
  python.stdout.on("data", (data) => {
    output += data.toString();
  });

  python.stderr.on("data", (data) => {
    console.error(`Python error for user :`, data.toString());
  });

  python.on("close", async (code) => {
    try {
      const result = JSON.parse(output);
      if (result.status === "ok") {
        console.log(`Meal plan generated for user `);
        console.log("Meal plan:", result.parsed_plan);

        // Save the user meal plan to the recommender database
        await saveGeneratedMeal(userId, result.parsed_plan);
      } else {
        console.warn(`Skipped for user :`, result.message);
      }
    } catch (e) {
      console.error(`Error parsing response for user :`, e.message);
    }
  });
};

// TODO: Remove this after testing
// const inputData = {
//   cgm_data: 250, // Placeholder for CGM data
//   age: 45,
//   gender: "Female", // Default to 30 if not set
//   medications: [
//     "Metformin 500mg (morning)",
//     "Insulin Glargine 10 units (evening)",
//   ],
//   liked_meals: [
//     "Grilled chicken salad",
//     "Oatmeal with berries",
//     "Stir-fried tofu and vegetables",
//   ],
//   disliked_meals: ["White bread", "Sugary cereals"],
//   dietary_restrictions: ["No red meat", "Low sodium"],
//   daily_calories: 1800,
//   additional_conditions: ["Hypertension"],
// };

// Schedule meal plan generation at 4 am every day
cron.schedule("0 4 * * *", async () => {
  console.log("Generating meal plans for all users at 4:00 AM...");
  try {
    // TODO: make it sorted by the newest users first
    const users = await getAllUsers();
    // Count to limit the number of users processed to 2
    // Due to the quota limitation of the HuggingFace API
    const count = 0;
    for (const user of users) {
      if (count >= 2) {
        console.log("Reached limit of 2 users for meal plan generation.");
        break;
      }
      count++;
      // get average cgm data of user over the last 24 hours
      const cgmData = await getUserCgm(user._id);

      const inputData = {
        cgm_data: cgmData.averageGlucose,
        trend: cgmData.trend,
        age: user.age || 30,
        gender: user.gender, // Default to 30 if not set
        medications: user.medications?.map((m) => m.name) || [],
        liked_meals: user.likedRecipes || [],
        disliked_meals: user.dislikedRecipes || [],
        dietary_restrictions: user.dietaryRestrictions || [],
        daily_calories: user.dailyCalories || 2000, // Default to 2000 if not set
        additional_conditions: user.additionalConditions || [],
      };

      await generate_meal(user._id, inputData);
    }
  } catch (err) {
    console.error("Error fetching users:", err);
  }
});

// endpoint to generate meal plans on request
app.post("/recommend/:id", async (req, res) => {
  const userId = req.params.id;
  const user = await getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  const cgmData = await getUserCgm(user._id);
  // create the input data for the meal generation
  const inputData = {
    cgm_data: cgmData.averageGlucose,
    trend: cgmData.trend,
    age: user.age || 30, // Default to 30 if not set
    medications: user.medications || [],
    liked_meals: user.likedMeals || [],
    disliked_meals: user.dislikedMeals || [],
    dietary_restrictions: user.dietaryRestrictions || [],
    daily_calories: user.dailyCalories || 2000, // Default to 2000 if not set
    additional_conditions: user.additionalConditions || [],
  };
  // call meal plan generation to create and save the meal
  await generate_meal(user._id, inputData);
  res.json({ success: true, message: "Meal plan generation started" });
});

// TODO: recommendations can be meal plans or can be done for specific meals
// user can choose whether they want breakfast, lunch, dinner or snack recommendations
// the previously consumed meals and their calories of the day are sent to recommender to be taken into account
// the total calories of the user are sent with the dietary restrictions, the liked and disliked meals
// the current blood glucose level and the trend are sent to the recommender service

app.listen(PORT, () =>
  console.log("Recommender Service Running on Port " + PORT),
);

module.exports = {
  getAllUsers,
  getUserCgm,
};
