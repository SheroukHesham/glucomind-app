const WebSocket = require("ws");

const SENSOR_ID = "sensor123"; // Dummy sensor ID
const WS_URL = "ws://cgm-service:4000";

// Generate a realistic glucose level with occasional anomalies
function generateGlucoseLevel() {
  // 70-180 is typical, <70 or >180 are anomalies
  const rand = Math.random();
  if (rand < 0.1) return Math.floor(Math.random() * 30) + 40; // Severe hypo (40-70)
  if (rand < 0.2) return Math.floor(Math.random() * 70) + 181; // Severe hyper (181-250)
  if (rand < 0.3) return Math.floor(Math.random() * 10) + 71; // Mild hypo (71-80)
  if (rand < 0.4) return Math.floor(Math.random() * 40) + 141; // Mild hyper (141-180)
  return Math.floor(Math.random() * 60) + 81; // Normal (81-140)
}

function sendGlucose(ws) {
  const glucoseLevel = generateGlucoseLevel();
  const data = {
    sensorId: SENSOR_ID,
    glucoseLevel: glucoseLevel,
  };
  ws.send(JSON.stringify(data));
}

function startSending() {
  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    sendGlucose(ws);
    // every 5 minutes
    setInterval(() => sendGlucose(ws), 10 * 60 * 1000);
  });

  ws.on("message", (msg) => {});

  ws.on("close", () => {
    setTimeout(startSending, 10000);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
    ws.close();
  });
}

startSending();
