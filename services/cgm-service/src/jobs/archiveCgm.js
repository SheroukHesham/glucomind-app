const cron = require("node-cron");
const { DateTime } = require("luxon");
const { TIMEZONE } = require("../config");

let running = false;

/**
 * Moves every reading older than today's 12:00 AM (in TIMEZONE) from `Cgm`
 * into `CgmHistory` (one document per user per day). Idempotent: readings
 * keep their _id and are merged with $addToSet, so re-running never duplicates.
 */
async function archivePreviousDaysData() {
  const { Cgm, CgmHistory } = require("../db");
  if (running) return 0;
  running = true;
  let moved = 0;

  try {
    const cutoff = DateTime.now().setZone(TIMEZONE).startOf("day").toJSDate();

    const cursor = Cgm.find({ "readings.timestamp": { $lt: cutoff } })
      .lean()
      .cursor();

    for await (const doc of cursor) {
      const old = (doc.readings || []).filter(
        (r) => new Date(r.timestamp) < cutoff,
      );
      if (!old.length) continue;

      const byDay = new Map();
      for (const r of old) {
        const dayStart = DateTime.fromJSDate(new Date(r.timestamp), {
          zone: TIMEZONE,
        })
          .startOf("day")
          .toMillis();
        if (!byDay.has(dayStart)) byDay.set(dayStart, []);
        byDay.get(dayStart).push(r);
      }

      const ops = [...byDay.entries()].map(([dayStartMs, readings]) => {
        const update = {
          $addToSet: { readings: { $each: readings } },
          ...(doc.sensorId ? { $set: { sensorId: doc.sensorId } } : {}),
        };
        return {
          updateOne: {
            filter: { userId: doc.userId, date: new Date(dayStartMs) },
            update,
            upsert: true,
          },
        };
      });

      await CgmHistory.bulkWrite(ops, { ordered: true });

      await Cgm.updateOne(
        { _id: doc._id },
        { $pull: { readings: { _id: { $in: old.map((r) => r._id) } } } },
      );

      moved += old.length;
    }
  } finally {
    running = false;
  }

  return moved;
}

function startCgmArchiveJob() {
  // catch-up run on boot in case the service was down at midnight
  archivePreviousDaysData()
    .then((n) => n && console.log(`[cgm-archive] catch-up moved ${n} readings`))
    .catch((err) => console.error("[cgm-archive] catch-up failed:", err));

  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        const n = await archivePreviousDaysData();
        console.log(`[cgm-archive] moved ${n} readings to history`);
      } catch (err) {
        console.error("[cgm-archive] failed:", err);
      }
    },
    { timezone: TIMEZONE },
  );
}

module.exports = { archivePreviousDaysData, startCgmArchiveJob };
