const express = require("express");
const {
  saveUser,
  updateUser,
  getUserById,
  User,
  deleteUserById,
  verifyUserCredentials,
} = require("./db");
const { sendMedicationEvents } = require("./Kafka/producers");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3001;
console.log("In user");
// TODO: see firebase for user authentication and authorization
// TODO: Add try catch for kafka producer and consumer

// TODO: call the send medication events function
// on user profile creation
app.post("/register", async (req, res) => {
  const user = new User(req.body);
  // save user to MongoDB
  const savedUser = await saveUser(user);
  res.status(201).json(savedUser);
});

// update medication list of user
app.put("/user/:id/medications", async (req, res) => {
  const userId = req.params.id;
  const medications = req.body.medications;

  if (!medications || !Array.isArray(medications)) {
    return res.status(400).send("Invalid medications data");
  }

  try {
    const user = await getUserById(userId);
    if (!user) return res.status(404).send("User not found");

    user.medications = medications;
    await user.save();

    // send medication list of user to medication service via kafka
    // await sendMedicationEvents(userId, medications);

    res.status(200).json(user);
  } catch (error) {
    console.error("Error updating medications:", error);
    res.status(500).send("Internal Server Error");
  }
});

// DONE
// get the user data
app.get("/user/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await getUserById(userId);
    if (!user) return res.status(404).send("get User not found");
    res.status(200).json(user);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

// DONE
// update user data
app.put("/user/:id", async (req, res) => {
  const userId = req.params.id;
  const user = await updateUser(userId, req.body);
  if (!user) return res.status(404).send("update User not found");
  else res.status(200).json(user);

  // send medication list of user to medication service via kafka to be updated
  const medications = user.medications || [];
  await sendMedicationEvents(userId, medications);
});

// DONE
// delete user
app.delete("/user/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await getUserById(userId);
    if (!user) return res.status(404).send("User not found");
    await deleteUserById(userId);
    res.status(200).send("User deleted successfully");
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Get all users in the database
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Internal Server Error");
  }
});

// get the fcm token for user
app.get("/user/:id/fcm-token", async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId).select("fcmTokens");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ fcmToken: user.fcmTokens[0] });
  } catch (error) {
    console.error("Error fetching FCM token:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// save or update the fcm token for user
app.post("/user/:id/fcm-token", async (req, res) => {
  const userId = req.params.id;
  const { fcmToken } = req.body;

  if (!fcmToken) {
    return res.status(400).json({ message: "fcmToken is required" });
  }

  try {
    // Find user and update or set the fcmToken in one step
    const user = await User.findByIdAndUpdate(
      userId,
      { fcmTokens: [fcmToken] },
      { new: true },
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "FCM token saved/updated successfully" });
  } catch (error) {
    console.error("Error saving FCM token:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// function to update FCM token of user given email
async function updateUserFcmToken(email, fcmToken) {
  try {
    // Add the token only if it doesn't already exist in the array
    const user = await User.findOneAndUpdate(
      { email },
      { fcmTokens: [fcmToken] },
      { new: true },
    );
    if (!user) {
      return null;
    }
    return user;
  } catch (error) {
    console.error("Error updating FCM token:", error);
    return null;
  }
}

app.post("/login", async (req, res) => {
  const { email, password, fcmToken } = req.body;

  // make sure the email and password exist for a user in the Database
  const user = await verifyUserCredentials(email, password);
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  // Update FCM token in the database if provided
  if (fcmToken) {
    await updateUserFcmToken(email, fcmToken); // implement this function to update the user's FCM token(s)
  }

  res.status(200).json(user);
});

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

// get all users who have medications
app.get("/users-with-medications", async (req, res) => {
  try {
    // Find users where medications array exists and is not empty
    const users = await User.find({
      medications: { $exists: true, $not: { $size: 0 } },
    }).select("_id medications fcmTokens name email");

    // Format response as needed for medication service
    const result = users.map((user) => ({
      userId: user._id,
      name: user.name,
      email: user.email,
      fcmTokens: user.fcmTokens,
      medications: user.medications,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching users with medications:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.listen(3001, "0.0.0.0", () => {
  console.log("User Management Service on port 3001");
});
