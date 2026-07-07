const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "glucose-producer",
  brokers: ["kafka:9092"],
});

const producer = kafka.producer();

(async () => {
  await producer.connect();
})();

// On user medication creation
const sendMedicationEvents = async (userId, medication) => {
  const message = {
    userId: userId,
    medication: medication,
  };
  try {
    await producer.send({
      topic: "medication-creation-events",
      messages: [{ key: "medication", value: JSON.stringify(message) }],
    });

    res.status(201).send("Medications produced successfully");
  } catch (error) {
    console.error("Error producing message:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  sendMedicationEvents,
};
