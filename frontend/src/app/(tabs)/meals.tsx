import { getUserMealPlan } from "@/api/recommender";
import MealCards from "@/components/MealCards";
import { recommenderKeys } from "@/lib/queries/keys";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const Meals = () => {
  const userId = "6a51438c0d07989baea70cd5";

  const { data, error, isFetching, isFetched } = useQuery({
    queryKey: recommenderKeys.getUserMealPlan(userId),
    queryFn: () => getUserMealPlan(userId),
  });
  const renderMealPlan = Object.entries(data?.day_plan ?? {}).map(
    ([mealType, meal], idx) => {
      return (
        <MealCards
          key={meal._id}
          meal={mealType}
          name={meal.title}
          calories={meal.total_calories}
          cuisine="American"
          cookingTime={meal.estimated_cooking_time}
        />
      );
    },
  );
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerClassName="grow gap-y-5 px-4 py-6"
      >
        {renderMealPlan}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Meals;
