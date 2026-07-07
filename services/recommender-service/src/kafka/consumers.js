const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "Recommender-Service",
  brokers: ["kafka:9092"],
});

// kafka consumer to create meal plan on user creation
const consumer = kafka.consumer({ groupId: "recommender-group" });
const consume = async () => {
  await consumer.connect();
  await consumer.subscribe({
    topic: "user-creation-events",
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value.toString();
      if (!value || value === "{}") {
        // Skip empty messages
        return;
      }

      const payload = JSON.parse(value);
      const user = payload.user;

      const inputData = {
        cgm_data: "unknown",
        trend: "unknown",
        age: user.age || 30,
        medications: user.medications?.map((m) => m.name) || [],
        liked_meals: user.likedRecipes || [],
        disliked_meals: user.dislikedRecipes || [],
        dietary_restrictions: user.dietaryRestrictions || [],
        daily_calories: user.dailyCalories || 2000,
        additional_conditions: user.additionalConditions || [],
      };

      await generate_meal(user._id, inputData);
    },
  });
};
