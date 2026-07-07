require("dotenv").config();
const express = require("express");
const { Kafka } = require("kafkajs");
const admin = require("firebase-admin");
const app = express();

app.use(express.json());

// Initialize Kafka consumer
const kafka = new Kafka({
  clientId: "emergency-service",
  brokers: ["kafka:9092"],
});
const consumer = kafka.consumer({ groupId: "emergency-group" });

const run = async () => {
  await consumer.connect();
  await consumer.subscribe({
    topic: "glucose-events",
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const payload = JSON.parse(message.value.toString());
      const { userId, glucoseLevel, fcmToken, trend, criticality } = payload;

      if (!userId || !glucoseLevel || !fcmToken) {
        console.error("Missing required fields in message");
        return;
      }

      // Example: Use criticality to customize notification
      let notificationTitle = "🚨 Blood Glucose Alert";
      let notificationBody = `Your blood glucose level is ${glucoseLevel} mg/dL. Please take action!`;

      if (criticality === "slightly_abnormal") {
        notificationTitle = "⚠️ Glucose Slightly Abnormal";
        notificationBody = `Your glucose is ${glucoseLevel} mg/dL (${trend}). Monitor closely.`;
      } else if (criticality === "high_low") {
        notificationTitle = "❗ Glucose High/Low";
        notificationBody = `Your glucose is ${glucoseLevel} mg/dL (${trend}). Take action if needed.`;
      } else if (criticality === "critical") {
        notificationTitle = "🚨 Critical Glucose Alert";
        notificationBody = `CRITICAL: ${glucoseLevel} mg/dL (${trend}). Seek help immediately!`;
      }

      const fcmMessage = {
        token: fcmToken,
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        android: {
          priority: "high",
          notification: {
            sound: "emergency_alarm",
            channelId: "emergency-channel",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "emergency_alarm.wav",
              contentAvailable: true,
              alert: {
                title: notificationTitle,
                body: notificationBody,
              },
            },
          },
        },
      };

      try {
        await admin.messaging().send(fcmMessage);
      } catch (err) {
        console.error("❌ FCM Error:", err);
      }
    },
  });
};

run().catch(console.error);

app.listen(3003, () => console.log("Emergency Service Running on Port 3003"));
