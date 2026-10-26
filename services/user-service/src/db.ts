import express from "express";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

import mongoose from "mongoose";
import { IAuthData, IUserData } from "./interfaces";

const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error("❌ MONGO_URI is not defined");
  process.exit(1);
}

mongoose
  .connect(mongoURI, {})
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

mongoose.connection.on("connected", () => {});

// TODO: Update schema to only contain
//  User profile and account information
//  all other information is sent to other microservices

const userSchema = new mongoose.Schema({
  // TODO: add user authentication and authorization
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  age: { type: String, required: true },
  gender: {
    type: String,
    required: true,
    enum: ["Male", "Female"],
  },
  // emergencyContacts: [
  //   {
  //     name: String,
  //     phone: String,
  //     email: String,
  //     fcmTokens: { type: [String], default: [] }, // optional, if contact has app and FCM tokens
  //   },
  // ],
  // dietaryRestrictions: [String],
  // dailyCalories: Number,
  // medications: [{ name: String, time: String }],
  // likedRecipes: [String],
  // dislikedRecipes: [String],
  // medicalConditions: [String],
});

const User = mongoose.model("User", userSchema);

export async function saveUser(userData: IAuthData) {
  // TODO: only save needed user information and the rest is sent to other microservices
  try {
    const user = new User(userData);
    const savedUser = await user.save();

    return savedUser;
  } catch (error) {
    console.error("Error saving user:", error);
  }
}

export async function updateUser(userId: string, updatedData: IUserData) {
  try {
    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
      new: true,
      runValidators: true,
    });
    if (updatedUser) {
      return updatedUser;
    }
  } catch (error) {
    console.error("Error updating user:", error);
  }
}

export async function getUserById(userId: string) {
  try {
    const user = await User.findById(userId);
    if (user) {
      return user;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error retrieving user:", error);
  }
}

export async function deleteUserById(userId: string) {
  try {
    const deletedUser = await User.findByIdAndDelete(userId);
    if (deletedUser) {
      return deletedUser;
    }
  } catch (error) {
    console.error("Error deleting user:", error);
  }
}

export async function verifyUserCredentials({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  try {
    const user = await User.findOne({ email, password });
    return user || null;
  } catch (error) {
    console.error("Error verifying user credentials:", error);
    return null;
  }
}
