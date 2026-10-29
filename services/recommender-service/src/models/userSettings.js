const mongoose = require("mongoose");

/** This service's own copy of per-user settings, synced from the "user-settings" topic. */
const userSettingsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  timezone: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

const UserSettings = mongoose.model("UserSettings", userSettingsSchema);

module.exports = { UserSettings };
