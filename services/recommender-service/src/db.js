const express = require("express");
require("dotenv").config();

const app = express();
app.use(express.json());

const mongoose = require("mongoose");

const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error("❌ MONGO_URI is not defined");
  process.exit(1);
}

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .catch((err) => console.error("MongoDB connection error:", err));

mongoose.connection.on("connected", () => {});

const itemSchema = new mongoose.Schema({
  item: String,
  calories: Number,
});

const mealSchema = new mongoose.Schema({
  title: String,
  estimated_cooking_time: String,
  items: [itemSchema],
  instructions: String,
  total_calories: Number,
  estimated_total_calories: Number,
  calorie_percentage: Number,
  beverages: [String],
  glucose_impact: String,
  nutritional_facts: String,
});

const mealPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  day_plan: {
    breakfast: mealSchema,
    morning_snack: mealSchema,
    lunch: mealSchema,
    afternoon_snack: mealSchema,
    dinner: mealSchema,
  },
  summary: {
    total_day_calories: Number,
    calorie_goal: Number,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const MealPlan = mongoose.model("MealPlan", mealPlanSchema);

// OldMealPlan schema (same as mealPlanSchema)
const oldMealPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  day_plan: {
    breakfast: mealSchema,
    morning_snack: mealSchema,
    lunch: mealSchema,
    afternoon_snack: mealSchema,
    dinner: mealSchema,
  },
  summary: {
    total_day_calories: Number,
    calorie_goal: Number,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const OldMealPlan = mongoose.model("OldMealPlan", oldMealPlanSchema);

const saveMealPlan = async (userId, mealPlanData) => {
  try {
    const newMealPlan = new MealPlan({
      userId: userId,
      day_plan: mealPlanData.day_plan,
      summary: mealPlanData.summary,
    });

    const saved = await newMealPlan.save();

    return saved;
  } catch (err) {
    console.error("Error saving meal plan:", err);
    throw err;
  }
};

// Move the user's latest meal plan to OldMealPlan and remove it from MealPlan
const archiveUserMealPlan = async (userId) => {
  try {
    const latestMealPlan = await MealPlan.findOne({ userId }).sort({
      createdAt: -1,
    });
    if (latestMealPlan) {
      // Copy to OldMealPlan
      const oldPlan = new OldMealPlan({
        userId: latestMealPlan.userId,
        day_plan: latestMealPlan.day_plan,
        summary: latestMealPlan.summary,
        createdAt: latestMealPlan.createdAt,
      });
      await oldPlan.save();
      // Remove from MealPlan
      await MealPlan.deleteOne({ _id: latestMealPlan._id });
    }
  } catch (err) {
    console.error("Error archiving meal plan:", err);
    throw err;
  }
};

module.exports = {
  MealPlan,
  saveMealPlan,
  OldMealPlan,
  archiveUserMealPlan,
};
