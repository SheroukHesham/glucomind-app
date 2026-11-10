import CgmIndicator from "@/components/CgmIndicator";
import { Text } from "@/components/ui/text";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLiveGlucose } from "@/hooks/useLiveGlucose";
import { trendArrow } from "@/api/cgmStream";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import MealCards from "@/components/MealCards";
import { useQuery } from "@tanstack/react-query";
import { getUserMealPlan } from "@/api/recommender";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react-native";
import { router } from "expo-router";
import { medicationKeys, recommenderKeys } from "@/lib/queries/keys";
import { Checkbox } from "@/components/ui/checkbox";
import MedicationTracker from "@/components/MedicationTracker";
import { getUserMedications } from "@/api/medications";
import { formatMedicationTime } from "../../../functions";

//todo: trend arrow
export default function Index() {
  const userId = "6a51438c0d07989baea70cd5";
  const { reading, status } = useLiveGlucose(
    userId,
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YTUxNDM4YzBkMDc5ODliYWVhNzBjZDUiLCJpYXQiOjE3OTQzMDQzNTksImV4cCI6MTc5NDMwNzk1OX0.9wsZPw82AHEN6IKHxqnc7Un7Tgx1uWasGbB5XkHBI7w",
  );

  const { data, error, isFetching, isFetched } = useQuery({
    queryKey: recommenderKeys.getUserMealPlan(userId),
    queryFn: () => getUserMealPlan(userId),
  });
  const { data: medications } = useQuery({
    queryKey: medicationKeys.getUserMedications(userId),
    queryFn: () => getUserMedications(userId),
  });

  //todo:change to display meal depending on time of day
  const renderMealPlan = Object.entries(data?.day_plan ?? {}).map(
    ([mealType, meal], idx) => {
      return (
        idx == 0 && (
          <MealCards
            key={meal._id}
            meal={mealType}
            name={meal.title}
            calories={meal.total_calories}
            cuisine="American"
            cookingTime={meal.estimated_cooking_time}
          />
        )
      );
    },
  );

  const renderMedications = medications?.map((medication) => {
    const { formattedTime, active } = formatMedicationTime(medication.time);

    return (
      <MedicationTracker
        key={medication._id}
        name={medication.name}
        time={formattedTime}
        active={active}
      />
    );
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerClassName="grow gap-y-5 px-4 py-6"
      >
        <View className="flex-col gap-y-3 min-h-60  ">
          <Text variant={"h3"}>Live Reading</Text>
          <CgmIndicator value={reading?.glucoseLevel || 0} />
        </View>

        <View className="flex-col gap-y-3 w-full ">
          <Text variant={"h3"}>Next Meal</Text>
          <View className="gap-y-2">{renderMealPlan}</View>
          <Button
            variant={"link"}
            className="no-underline items-end flex self-end w-fit"
            onPress={() => {
              router.push("/(tabs)/meals");
            }}
          >
            <Text className="text-center justify-self-center">Go to Meals</Text>
            <ArrowRight />
          </Button>
        </View>

        <View className="flex-col gap-y-3 w-full ">
          <Text variant={"h3"}>Today's Medications</Text>
          <View className="flex-col gap-6">
            {renderMedications}
            {renderMedications}
            {renderMedications}
          </View>
          <Button
            variant={"link"}
            className="no-underline items-end flex self-end w-fit"
            onPress={() => {
              router.push("/(tabs)/medications");
            }}
          >
            <Text className="text-center justify-self-center">
              Go to Medications
            </Text>
            <ArrowRight />
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
