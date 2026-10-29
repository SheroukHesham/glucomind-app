const express = require("express");
const mongoose = require("mongoose");

const { MealPlan } = require("./db");
const { getUserById } = require("./meal/generator");
const {
  mealQueue,
  enqueueMealNow,
  scheduleMaintenance,
  reconcileMealSchedules,
} = require("./meal/queue");
const { startMealWorker } = require("./meal/worker");
const {
  startUserSettingsSync,
  stopUserSettingsSync,
} = require("./kafka/userSettingsConsumer");

const app = express();
app.use(express.json());
const PORT = 3004;

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

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

// endpoint to generate meal plans on request: queued, so the LLM is never overloaded
app.post("/recommend/:id", async (req, res) => {
  const userId = req.params.id;
  const user = await getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  try {
    await enqueueMealNow(userId);
    res.json({ success: true, message: "Meal plan generation started" });
  } catch (err) {
    console.error("Failed to queue meal plan generation:", err);
    res
      .status(503)
      .json({ error: "Could not queue meal plan generation, retry" });
  }
});

//TODO: move to recommender service
// get liked meals
app.get("/liked-meals/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("likedMeals");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ likedMeals: user.likedMeals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// add a liked meal
app.post("/liked-meals/:id/add", async (req, res) => {
  const { mealName } = req.body;
  if (!mealName)
    return res.status(400).json({ message: "mealName is required" });

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.likedRecipes.includes(mealName)) {
      user.likedRecipes.push(mealName);
      await user.save();
    }
    res.json({ likedMeals: user.likedRecipes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// remove a liked meal
app.post("/liked-meals/:id/remove", async (req, res) => {
  const { mealName } = req.body;
  if (!mealName)
    return res.status(400).json({ message: "mealName is required" });

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.likedRecipes = user.likedRecipes.filter((name) => name !== mealName);
    await user.save();

    res.json({ likedMeals: user.likedRecipes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
//  add a disliked meal
app.post("/disliked-meals/:id/add", async (req, res) => {
  const { mealName } = req.body;
  if (!mealName)
    return res.status(400).json({ message: "mealName is required" });

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.dislikedRecipes.includes(mealName)) {
      user.dislikedRecipes.push(mealName);
      await user.save();
    }
    res.json({ likedMeals: user.dislikedRecipes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// remove a disliked meal
app.post("/disliked-meals/:id/remove", async (req, res) => {
  const { mealName } = req.body;
  if (!mealName)
    return res.status(400).json({ message: "mealName is required" });

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.dislikedRecipes = user.dislikedRecipes.filter(
      (name) => name !== mealName,
    );
    await user.save();

    res.json({ likedMeals: user.dislikedRecipes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// TODO: recommendations can be meal plans or can be done for specific meals
// user can choose whether they want breakfast, lunch, dinner or snack recommendations
// the previously consumed meals and their calories of the day are sent to recommender to be taken into account
// the total calories of the user are sent with the dietary restrictions, the liked and disliked meals
// the current blood glucose level and the trend are sent to the recommender service

async function main() {
  // Redis side: the worker generates plans (one at a time), the nightly job keeps Redis in sync with MongoDB
  await scheduleMaintenance();
  const worker = startMealWorker();
  reconcileMealSchedules()
    .then((stats) => console.log("[meal] startup reconcile:", stats))
    .catch((err) => console.error("[meal] startup reconcile failed:", err));

  // Kafka side: gives each user's timezone, so plans are generated at 3:00 AM local time
  startUserSettingsSync().catch((err) =>
    console.error("[kafka] user-settings sync failed to start:", err),
  );

  const server = app.listen(PORT, () =>
    console.log("Recommender Service Running on Port " + PORT),
  );

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close();
    await Promise.allSettled([
      worker.close(), // waits for the running generation to finish
      mealQueue.close(),
      stopUserSettingsSync(),
      mongoose.disconnect(),
    ]);
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Recommender service failed to start:", err);
  process.exit(1);
});

// const express = require("express");
// const axios = require("axios");
// const cron = require("node-cron");
// const { spawn } = require("child_process");
// const path = require("path");

// const { MealPlan, saveMealPlan, archiveUserMealPlan } = require("./db");

// const app = express();
// app.use(express.json());
// const PORT = 3004;

// // consume().catch(console.error);

// // Calls the user service to get user data by ID
// async function getUserById(userId) {
//   try {
//     // TODO: Check the URL
//     const response = await axios.get(`http://user-service:3001/user/${userId}`);
//     return response.data;
//   } catch (error) {
//     console.error("Error fetching user:", error.message);
//     return null;
//   }
// }

// // Get all the users from the user service
// async function getAllUsers() {
//   try {
//     const response = await axios.get(`http://user-service:3001/users`);
//     return response.data;
//   } catch (error) {
//     console.error("Error fetching all users:", error.message);
//     return [];
//   }
// }

// // Function that returns the average CGM data of the user over the last 24 hours
// async function getUserCgm(userId) {
//   try {
//     const response = await axios.get(
//       `http://cgm-service:3000/cgm/stats/last24h/${userId}`,
//     );
//     return response.data;
//   } catch (error) {
//     console.error("Error fetching CGM data:", error.message);
//     return [];
//   }
// }

// // Get the meal plan request from frontend
// app.get("/recommendations/:id", async (req, res) => {
//   const userId = req.params.id;
//   // Get the user data through ID from the user service
//   const user = await getUserById(userId);
//   if (!user) {
//     return res.status(404).json({ error: "User not found" });
//   }

//   // get the user's meal plan for today (last generated meal plan) from database
//   try {
//     const latestMealPlan = await MealPlan.findOne({ userId })
//       .sort({ createdAt: -1 })
//       .exec();

//     if (!latestMealPlan) {
//       return res.json({ day_plan: {} });
//     }

//     res.json(latestMealPlan);
//   } catch (err) {
//     console.error("Error fetching latest meal plan:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// // Save the meal plan to the database
// const saveGeneratedMeal = async (userId, mealPlanData) => {
//   try {
//     await saveMealPlan(userId, mealPlanData);
//   } catch (err) {
//     console.error("Error saving meal plan:", err);
//     throw err;
//   }
// };

// // Move old meal plan before generating a new one
// const generate_meal = async (userId, inputData) => {
//   // Archive the user's current meal plan before generating a new one
//   await archiveUserMealPlan(userId);

//   const pythonScriptPath = path.join(__dirname, "ml", "ollama-interface.py");

//   const python = spawn("python", [pythonScriptPath], {
//     env: {
//       ...process.env,
//       OLLAMA_URL: process.env.OLLAMA_URL,
//       OLLAMA_MODEL: process.env.OLLAMA_MODEL,
//     },
//   });
//   python.stdin.write(JSON.stringify(inputData));
//   python.stdin.end();

//   let output = "";
//   python.stdout.on("data", (data) => {
//     output += data.toString();
//   });

//   python.stderr.on("data", (data) => {
//     console.error(`Python error for user :`, data.toString());
//   });

//   python.on("close", async (code) => {
//     try {
//       const result = JSON.parse(output);
//       if (result.status === "ok") {
//         // Save the user meal plan to the recommender database
//         await saveGeneratedMeal(userId, result.parsed_plan);
//       } else {
//         console.warn(`Skipped for user :`, result.message);
//       }
//     } catch (e) {
//       console.error(`Error parsing response for user :`, e.message);
//     }
//   });
// };

// // TODO: Remove this after testing
// // const inputData = {
// //   cgm_data: 250, // Placeholder for CGM data
// //   age: 45,
// //   gender: "Female", // Default to 30 if not set
// //   medications: [
// //     "Metformin 500mg (morning)",
// //     "Insulin Glargine 10 units (evening)",
// //   ],
// //   liked_meals: [
// //     "Grilled chicken salad",
// //     "Oatmeal with berries",
// //     "Stir-fried tofu and vegetables",
// //   ],
// //   disliked_meals: ["White bread", "Sugary cereals"],
// //   dietary_restrictions: ["No red meat", "Low sodium"],
// //   daily_calories: 1800,
// //   additional_conditions: ["Hypertension"],
// // };

// // Schedule meal plan generation at 4 am every day
// cron.schedule("0 4 * * *", async () => {
//   try {
//     // TODO: make it sorted by the newest users first
//     const users = await getAllUsers();
//     // Count to limit the number of users processed to 2
//     let count = 0;
//     for (const user of users) {
//       if (count >= 10) {
//         console.log("Reached limit of 10 users for meal plan generation.");
//         break;
//       }
//       count++;
//       // get average cgm data of user over the last 24 hours
//       const cgmData = await getUserCgm(user._id);

//       const inputData = {
//         cgm_data: cgmData.averageGlucose,
//         trend: cgmData.trend,
//         age: user.age || 30,
//         gender: user.gender, // Default to 30 if not set
//         medications: user.medications?.map((m) => m.name) || [],
//         liked_meals: user.likedRecipes || [],
//         disliked_meals: user.dislikedRecipes || [],
//         dietary_restrictions: user.dietaryRestrictions || [],
//         daily_calories: user.dailyCalories || 2000, // Default to 2000 if not set
//         additional_conditions: user.additionalConditions || [],
//       };

//       await generate_meal(user._id, inputData);
//     }
//   } catch (err) {
//     console.error("Error fetching users:", err);
//   }
// });

// // endpoint to generate meal plans on request
// app.post("/recommend/:id", async (req, res) => {
//   const userId = req.params.id;
//   const user = await getUserById(userId);
//   if (!user) {
//     return res.status(404).json({ error: "User not found" });
//   }
//   const cgmData = await getUserCgm(user._id);
//   // create the input data for the meal generation
//   const inputData = {
//     cgm_data: cgmData.averageGlucose,
//     trend: cgmData.trend,
//     age: user.age || 30, // Default to 30 if not set
//     medications: user.medications || [],
//     liked_meals: user.likedMeals || [],
//     disliked_meals: user.dislikedMeals || [],
//     dietary_restrictions: user.dietaryRestrictions || [],
//     daily_calories: user.dailyCalories || 2000, // Default to 2000 if not set
//     additional_conditions: user.additionalConditions || [],
//   };
//   // call meal plan generation to create and save the meal
//   await generate_meal(user._id, inputData);
//   res.json({ success: true, message: "Meal plan generation started" });
// });

// //TODO: move to recommender service
// // get liked meals
// app.get("/liked-meals/:id", async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id).select("likedMeals");
//     if (!user) return res.status(404).json({ message: "User not found" });
//     res.json({ likedMeals: user.likedMeals });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });
// // add a liked meal
// app.post("/liked-meals/:id/add", async (req, res) => {
//   const { mealName } = req.body;
//   if (!mealName)
//     return res.status(400).json({ message: "mealName is required" });

//   try {
//     const user = await User.findById(req.params.id);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     if (!user.likedRecipes.includes(mealName)) {
//       user.likedRecipes.push(mealName);
//       await user.save();
//     }
//     res.json({ likedMeals: user.likedRecipes });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });
// // remove a liked meal
// app.post("/liked-meals/:id/remove", async (req, res) => {
//   const { mealName } = req.body;
//   if (!mealName)
//     return res.status(400).json({ message: "mealName is required" });

//   try {
//     const user = await User.findById(req.params.id);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     user.likedRecipes = user.likedRecipes.filter((name) => name !== mealName);
//     await user.save();

//     res.json({ likedMeals: user.likedRecipes });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });
// //  add a disliked meal
// app.post("/disliked-meals/:id/add", async (req, res) => {
//   const { mealName } = req.body;
//   if (!mealName)
//     return res.status(400).json({ message: "mealName is required" });

//   try {
//     const user = await User.findById(req.params.id);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     if (!user.dislikedRecipes.includes(mealName)) {
//       user.dislikedRecipes.push(mealName);
//       await user.save();
//     }
//     res.json({ likedMeals: user.dislikedRecipes });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });
// // remove a disliked meal
// app.post("/disliked-meals/:id/remove", async (req, res) => {
//   const { mealName } = req.body;
//   if (!mealName)
//     return res.status(400).json({ message: "mealName is required" });

//   try {
//     const user = await User.findById(req.params.id);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     user.dislikedRecipes = user.dislikedRecipes.filter(
//       (name) => name !== mealName,
//     );
//     await user.save();

//     res.json({ likedMeals: user.dislikedRecipes });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// // TODO: recommendations can be meal plans or can be done for specific meals
// // user can choose whether they want breakfast, lunch, dinner or snack recommendations
// // the previously consumed meals and their calories of the day are sent to recommender to be taken into account
// // the total calories of the user are sent with the dietary restrictions, the liked and disliked meals
// // the current blood glucose level and the trend are sent to the recommender service

// app.listen(PORT, () =>
//   console.log("Recommender Service Running on Port " + PORT),
// );

// module.exports = {
//   getAllUsers,
//   getUserCgm,
// };
