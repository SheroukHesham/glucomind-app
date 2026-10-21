const express = require("express");
const axios = require("axios");
const {
  saveCgmData,
  getLastReadingByUser,
  Cgm,
  getCgmDataToday,
  getCgmDataPastWeek,
  getUserIdFromSensor,
  getUserIdsFromSensor,
} = require("./db.js");

class CgmService {
  async getCurrentReading(userId) {
    try {
      const latestReading = await getLastReadingByUser(userId);
      if (!latestReading) {
        return undefined;
      }
      return latestReading;
    } catch (error) {
      return error;
    }
  }
}
module.exports = new CgmService();
