import CgmIndicator from "@/components/CgmIndicator";
import { Text } from "@/components/ui/text";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLiveGlucose } from "@/hooks/useLiveGlucose";
import { trendArrow } from "@/api/cgmStream";
import { useEffect } from "react";

export default function Index() {
  const { reading, status } = useLiveGlucose(
    "6a51438c0d07989baea70cd5",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YTUxNDM4YzBkMDc5ODliYWVhNzBjZDUiLCJpYXQiOjE3OTQxNDc5MjgsImV4cCI6MTc5NDE1MTUyOH0.FOJbMm-J8F0oeby5mDntFA1MX-JAkBPv368qvJbA-qU",
  );
  console.log("Hi", reading, status);
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerClassName="grow gap-y-10 px-4 py-6"
      >
        <View className="flex-col gap-y-3 ">
          <Text className="text-xl font-semibold tracking-tight text-foreground">
            Live
          </Text>
          <CgmIndicator value={reading?.glucoseLevel || 0} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
