const mongoose = require("mongoose");
const { DateTime } = require("luxon");
const { TIMEZONE } = require("./config");
const { Cgm, CgmHistory } = require("./db"); // adjust if CgmHistory lives elsewhere
const { GlucoseGenerator } = require("./sensor-simulator");

const STEP_MINUTES = 5;

/**
 * DEV ONLY: fills CgmHistory with `days` previous days (5-min readings) and
 * today's readings so far, so an AGP report can be generated immediately.
 * Overwrites existing data for those days.
 * @param {string} userId
 * @param {string} sensorId
 * @param {number} [days]
 */
async function seedMockHistory(userId, sensorId, days = 14) {
  const uid = new mongoose.Types.ObjectId(userId);
  const generator = new GlucoseGenerator(sensorId);
  const now = DateTime.now().setZone(TIMEZONE);
  const today = now.startOf("day");

  const ops = [];
  for (let d = days; d >= 1; d--) {
    const dayStart = today.minus({ days: d });
    const readings = [];
    for (let m = 0; m < 1440; m += STEP_MINUTES) {
      const at = dayStart.plus({ minutes: m });
      readings.push({
        glucoseLevel: generator.next(at.toJSDate()),
        timestamp: at.toJSDate(),
      });
    }
    ops.push({
      updateOne: {
        filter: { userId: uid, date: dayStart.toJSDate() },
        update: { $set: { readings, sensorId } },
        upsert: true,
      },
    });
  }
  //@ts-ignore
  await CgmHistory.bulkWrite(ops);

  const todayReadings = [];
  for (let at = today; at <= now; at = at.plus({ minutes: STEP_MINUTES })) {
    todayReadings.push({
      glucoseLevel: generator.next(at.toJSDate()),
      timestamp: at.toJSDate(),
    });
  }
  await Cgm.updateOne(
    { userId: uid },
    { $set: { readings: todayReadings, sensorId } },
    { upsert: true },
  );

  return { days, todayReadings: todayReadings.length };
}

module.exports = { seedMockHistory };
