/**
 * Standalone virtual sensor (e.g. its own container):
 *   SENSOR_AUTH_KEY=... CGM_WS_URL=ws://cgm-service:4000 node sensor-script.js SENS-1A2B3C4D5E [token]
 */
const { SensorSimulator } = require("./sensor-simulator");

const sensorId = process.argv[2] || process.env.SENSOR_ID;
const token = process.argv[3] || process.env.SENSOR_TOKEN;

if (!sensorId) {
  console.error("Usage: node sensor-script.js <sensorId> [token]");
  process.exit(1);
}

new SensorSimulator().start(sensorId, token);
