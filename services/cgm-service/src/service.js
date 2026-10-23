const { produce } = require("./kafka/producers.js");
const {
  saveCgmData,
  getLastReadingByUser,
  Cgm,
  getCgmDataToday,
  getUserIdFromSensor,
  disconnectSensor,
  configureSensor,
} = require("./db.js");

class CgmService {
  /**
   *
   * @param {string} userId
   * @returns
   */
  async getCurrentReading(userId) {
    try {
      const latestReading = await getLastReadingByUser(userId);
      if (!latestReading) {
        return undefined;
      }
      return latestReading;
    } catch (error) {
      throw new Error("Error getting current reading" + error);
    }
  }

  /**
   *
   * @param {string} userId
   * @param {string} sensorId
   * @returns
   */
  async connectSensor(userId, sensorId) {
    try {
      const result = await configureSensor(sensorId, userId);
      return result;
    } catch (error) {
      throw new Error(error + "");
    }
  }

  /**
   *
   * @param {string} userId
   * @returns
   */
  async disconnectSensor(userId) {
    try {
      const result = await disconnectSensor(userId);
      return result;
    } catch (error) {
      throw new Error(error + "");
    }
  }

  /**
   *
   * @param {string} userId
   * @param {number} glucoseLevel
   * @returns {Promise<"steady" | "rising" | "falling">}
   */
  async analyzeGlucoseData(userId, glucoseLevel) {
    try {
      const lastReading = await getLastReadingByUser(userId);
      /**
       * @type ("steady" | "rising" | "falling")
       */
      let trend;
      if (lastReading) {
        const prevValue = lastReading.glucoseLevel;
        if (glucoseLevel > prevValue + 5) trend = "rising";
        else if (glucoseLevel < prevValue - 5) trend = "falling";
        else trend = "steady";
      } else {
        return "steady";
      }

      // Normal
      if (glucoseLevel >= 80 && glucoseLevel <= 140) {
        return trend;
      }

      const baseMessage = {
        userId: userId,
        glucoseLevel: glucoseLevel,
        trend: trend,
        timestamp: new Date().toISOString(),
      };

      if (
        (glucoseLevel >= 70 && glucoseLevel < 80) ||
        (glucoseLevel > 140 && glucoseLevel <= 180)
      ) {
        const message = {
          ...baseMessage,
          criticality: "slightly_abnormal",
        };
        await produce(message);
      } else if (
        (glucoseLevel >= 55 && glucoseLevel < 70) ||
        (glucoseLevel > 180 && glucoseLevel <= 250)
      ) {
        const message = {
          ...baseMessage,
          criticality: "high_low",
        };

        await produce(message);
      } else if (glucoseLevel < 55 || glucoseLevel > 250) {
        const message = {
          ...baseMessage,
          criticality: "critical",
        };
        await produce(message);
      }
      return trend;
    } catch (error) {
      console.error("Error in handleGlucoseData:", error);
    }
  }

  //TODO: change after separating sensors and data
  /**
   *
   * @param {string} sensorId
   * @param {number} glucoseLevel
   * @returns
   */
  async handleCgmReading(sensorId, glucoseLevel) {
    try {
      // get all userIds from sensorId
      const userId = await getUserIdFromSensor(sensorId);
      if (!userId) {
        console.error(
          `No users found for sensorId: ${sensorId}. Please connect the sensor first.`,
        );
        return;
      }
      // Analyze and save the glucose data for all users

      let trend;

      try {
        trend = await this.analyzeGlucoseData(userId.toString(), glucoseLevel);
      } catch (err) {
        console.error("handleGlucoseData failed:", err);
      }

      await saveCgmData(userId.toString(), glucoseLevel);
      return trend;
    } catch (error) {
      throw new Error("" + error);
    }
  }

  /**
   *
   * @param {string} userId
   * @returns
   */
  async getDayReadings(userId) {
    try {
      const user = await Cgm.findOne({ userId }).lean();
      if (!user) return [];

      const readings = [...user.readings].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
      return readings;
    } catch (error) {}
  }

  /**
   *
   * @param {string} userId
   * @returns {Promise<{averageGlucose:number | null, highestReading:number, lowestReading:number, message?:string}> }
   */
  async getCgmStatsLast24h(userId) {
    const readings = await getCgmDataToday(userId);
    const glucoseLevels = readings.map((reading) => reading.glucoseLevel);

    if (glucoseLevels.length === 0) {
      return {
        averageGlucose: null,
        highestReading: null,
        lowestReading: null,
        message: "No readings found in the last 24 hours",
      };
    }

    // Calculate average glucose level
    const totalGlucose = glucoseLevels.reduce((sum, level) => sum + level, 0);
    const averageGlucose = totalGlucose / glucoseLevels.length;

    const highestReading = Math.max(...glucoseLevels);
    const lowestReading = Math.min(...glucoseLevels);

    return {
      averageGlucose: Math.round(averageGlucose * 100) / 100,
      highestReading,
      lowestReading,
    };
  }
}

module.exports = CgmService;
