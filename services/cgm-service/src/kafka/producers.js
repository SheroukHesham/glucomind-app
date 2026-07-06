const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "CGM-Service",
  brokers: ["kafka:9092"],
});

const producer = kafka.producer();

// Produces message to glucose-events topic
// Consumed by emergency-service to send alerts
const produce = async (message) => {
  try {
    await producer.connect();
    await producer.send({
      topic: "glucose-events",
      messages: [{ key: "glucose", value: JSON.stringify(message) }],
    });
    console.log("Produced:", message);
    await producer.disconnect();
  } catch (error) {
    console.error("Error producing message:", error);
  }
};

module.exports = { produce };
