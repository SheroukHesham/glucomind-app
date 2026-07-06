const express = require("express");
require("dotenv").config({ path: "./.env.example" });

const app = express();
app.use(express.json());

const mongoose = require("mongoose");

const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error("❌ MONGO_URI is not defined");
  process.exit(1);
}

console.log("🔗 Connecting to MongoDB at", mongoURI);

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

mongoose.connection.on("connected", () => {
  console.log("✅ Connected to MongoDB at", mongoose.connection.host);
});

// TODO: Update schema to only contain
//  User profile and account information and token
//  all other information is sent to other microservices

// define user schema
const userSchema = new mongoose.Schema({
  // TODO: add user authentication and authorization
  //   firebaseUid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Store hashed password
  name: String,
  fcmTokens: [String],
  age: String,
  gender: String,
  emergencyContacts: [
    {
      name: String,
      phone: String,
      email: String,
      fcmTokens: [String], // optional, if contact has app and FCM tokens
    },
  ],
  dietaryRestrictions: [String],
  dailyCalories: Number,
  medications: [{ name: String, time: String }],
  likedRecipes: [String],
  dislikedRecipes: [String],
  medicalConditions: [String],
});

// create User collection
const User = mongoose.model("User", userSchema);

// Function to Save a New User
async function saveUser(userData) {
  // TODO: only save needed user information and the rest is sent to other microservices
  try {
    const user = new User(userData); // Create a new User instance
    const savedUser = await user.save(); // Save it to the DB
    console.log("✅ User saved:", savedUser);
    return savedUser; // Return the saved user if needed
  } catch (error) {
    console.error("Error saving user:", error);
  }
}
//saveUser(user1); // Test saving user data
// Function to Update a User
async function updateUser(userId, updatedData) {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId, // Find the user by ID
      updatedData, // Update with new data
      { new: true, runValidators: true }, // Return the updated user and run validators
    );
    if (updatedUser) {
      console.log("✅ User updated:", updatedUser);
      return updatedUser; // Return the updated user if needed
    } else {
      console.log(" update User not found.");
    }
  } catch (error) {
    console.error("Error updating user:", error);
  }
}

// Test getting user data
async function getUserById(userUid) {
  try {
    const user = await User.findById(userUid); // Find the user by ID
    if (user) {
      console.log("✅ User found:", user);
      return user; // Return the user if found
    } else {
      console.log(" get User not found.");
      return null; // Return null if the user doesn't exist
    }
  } catch (error) {
    console.error("Error retrieving user:", error);
  }
}

// TODO: Test
async function deleteUserById(userId) {
  try {
    const deletedUser = await User.findByIdAndDelete(userId); // Find and delete the user by ID
    if (deletedUser) {
      console.log("✅ User deleted:", deletedUser);
      return deletedUser; // Return the deleted user if needed
    } else {
      console.log(" delete User not found.");
    }
  } catch (error) {
    console.error("Error deleting user:", error);
  }
}

async function verifyUserCredentials(email, password) {
  try {
    const user = await User.findOne({ email, password });
    return user || null;
  } catch (error) {
    console.error("Error verifying user credentials:", error);
    return null;
  }
}

//updateUser("680624b796fcdf571b449c01", { name: "assar" }); // Test updating user data

module.exports = {
  saveUser,
  updateUser,
  getUserById,
  User,
  deleteUserById,
  verifyUserCredentials,
};

// // close connection
// mongoose.connection.close();
