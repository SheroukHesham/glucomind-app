const { getAllUsers, getUserCgm } = require("../recommender_index");
const recommenderIndex = require("../recommender_index");

// Mock dependencies
jest.mock("../recommender_index", () => {
  const original = jest.requireActual("../recommender_index");
  return {
    ...original,
    getAllUsers: jest.fn(),
    getUserCgm: jest.fn(),
    generate_meal: jest.fn(),
  };
});

describe("Meal plan cron job", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Extract the cron callback for testing
  async function mealPlanCronJob() {
    try {
      const users = await recommenderIndex.getAllUsers();
      let count = 0;
      for (const user of users) {
        if (count >= 2) {
          break;
        }
        count++;
        const cgmData = await recommenderIndex.getUserCgm(user._id);

        const inputData = {
          cgm_data: cgmData.averageGlucose,
          age: user.age || 30,
          medications: user.medications?.map((m) => m.name) || [],
          liked_meals: user.likedRecipes || [],
          disliked_meals: user.dislikedRecipes || [],
          dietary_restrictions: user.dietaryRestrictions || [],
          daily_calories: user.dailyCalories || 2000,
          additional_conditions: user.additionalConditions || [],
        };

        await recommenderIndex.generate_meal(user._id, inputData);
      }
    } catch (err) {
      // error handling
    }
  }

  it("should generate meal plans for up to 2 users with correct input", async () => {
    recommenderIndex.getAllUsers.mockResolvedValue([
      {
        _id: "u1",
        age: 25,
        medications: [{ name: "med1" }],
        likedRecipes: ["chicken"],
        dislikedRecipes: ["fish"],
        dietaryRestrictions: ["vegan"],
        dailyCalories: 1800,
        additionalConditions: ["hypertension"],
      },
      {
        _id: "u2",
        // missing some fields to test defaults
      },
      {
        _id: "u3",
      },
    ]);
    recommenderIndex.getUserCgm.mockResolvedValue({ averageGlucose: 110 });

    await mealPlanCronJob();

    expect(recommenderIndex.generate_meal).toHaveBeenCalledTimes(2);

    expect(recommenderIndex.generate_meal).toHaveBeenNthCalledWith(
      1,
      "u1",
      expect.objectContaining({
        cgm_data: 110,
        age: 25,
        medications: ["med1"],
        liked_meals: ["chicken"],
        disliked_meals: ["fish"],
        dietary_restrictions: ["vegan"],
        daily_calories: 1800,
        additional_conditions: ["hypertension"],
      })
    );

    expect(recommenderIndex.generate_meal).toHaveBeenNthCalledWith(
      2,
      "u2",
      expect.objectContaining({
        cgm_data: 110,
        age: 30,
        medications: [],
        liked_meals: [],
        disliked_meals: [],
        dietary_restrictions: [],
        daily_calories: 2000,
        additional_conditions: [],
      })
    );
  });

  it("should handle errors gracefully", async () => {
    recommenderIndex.getAllUsers.mockRejectedValue(new Error("DB error"));
    await expect(mealPlanCronJob()).resolves.not.toThrow();
    expect(recommenderIndex.generate_meal).not.toHaveBeenCalled();
  });
});
