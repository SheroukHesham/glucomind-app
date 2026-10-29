import express from "express";
import cors from "cors";
import { createAuthRouter } from "./routes/auth.routes";
import { UserService } from "./service";
const userService = new UserService();
const { createSettingsRouter } = require("./routes/settings.routes");

const app = express();
app.use(express.json());
app.use(cors());
app.use(createAuthRouter(userService));
app.use(createSettingsRouter(userService));
const PORT = 3001;

const GENDERS = ["Male", "Female"];

const isNonEmptyString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;

app.post("/register", async (req, res) => {
  const userData = req.body;

  if (
    !userData ||
    !isNonEmptyString(userData.name) ||
    !isNonEmptyString(userData.email) ||
    !isNonEmptyString(userData.password) ||
    !userData.number ||
    !GENDERS.includes(userData.gender)
  ) {
    return res
      .status(400)
      .json({ error: "Incomplete or invalid user information." });
  }

  try {
    const savedUser = await userService.registerUser(userData);
    res.status(201).json(savedUser);
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ error: "Email already registered" });
    }
    return res.status(500).json({ error: "Failed to register user" });
  }
});

app.post("/logout", async (req, res) => {
  const { fcmToken } = req.body || {};
  if (isNonEmptyString(fcmToken))
    await userService.unregisterDevice(fcmToken).catch(console.error);
  res.status(204).end();
});

app.get("/user/:id", async (req, res) => {
  const userId = req.params.id;
  if (!userId || !isNonEmptyString(userId)) {
    return res.status(400).json({ error: "User ID is required." });
  }
  try {
    const user = await userService.getUser(userId);
    if (!user) return res.status(404).send("User not found");
    res.status(200).json(user);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

app.put("/user/:id", async (req, res) => {
  const userId = req.params.id;
  const userData = req.body;
  if (
    !userData ||
    !isNonEmptyString(userData.name) ||
    !isNonEmptyString(userData.email) ||
    !isNonEmptyString(userData.password) ||
    !userData.number ||
    !GENDERS.includes(userData.gender)
  ) {
    return res
      .status(400)
      .json({ error: "Incomplete or invalid user information." });
  }

  try {
    const user = await userService.updateUser({ userId, userData });
    if (!user) return res.status(404).send("Error Updating Information");
    else res.status(200).json(user);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

app.delete("/user/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    await userService.deleteUser(userId);
    res.status(200).send("User deleted successfully");
  } catch (error) {
    res.status(500).send("Internal Server Error:" + error);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`User Management Service on port ${PORT}`);
});
