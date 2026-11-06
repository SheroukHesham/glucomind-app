import CgmIndicator from "@/components/CgmIndicator";
import { Text } from "@/components/ui/text";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  return (
    <SafeAreaView className="flex-1">
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerClassName="grow gap-y-10 px-4 py-6"
      >
        <View className="flex-col gap-y-3 ">
          <Text className="text-xl font-semibold tracking-tight ">
            Live Reading
          </Text>
          <CgmIndicator value={74} />
          {/* <View className="bg-card rounded-md py-3 shadow-md">
          </View> */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
