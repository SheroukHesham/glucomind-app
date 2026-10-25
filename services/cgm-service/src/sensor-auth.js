const crypto = require("crypto");

function authKey() {
  const key = process.env.SENSOR_AUTH_KEY;
  if (key) return key;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SENSOR_AUTH_KEY must be set in production");
  }
  return "dev-only-sensor-key";
}

/**
 * A sensor's token is an HMAC of its id, so nothing secret is stored in the DB
 * and a simulated sensor can re-derive its own token after a restart.
 * @param {string} sensorId
 * @returns {string}
 */
function deriveSensorToken(sensorId) {
  return crypto.createHmac("sha256", authKey()).update(sensorId).digest("hex");
}

/**
 * @param {string} sensorId
 * @param {string} token
 * @returns {boolean}
 */
function isValidSensorToken(sensorId, token) {
  const expected = Buffer.from(deriveSensorToken(sensorId));
  const given = Buffer.from(String(token));
  return (
    expected.length === given.length && crypto.timingSafeEqual(expected, given)
  );
}

module.exports = { deriveSensorToken, isValidSensorToken };
