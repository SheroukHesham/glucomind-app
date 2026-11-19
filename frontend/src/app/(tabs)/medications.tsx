import { Text } from "@/components/ui/text";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MedicationCard from "@/components/MedicationCard";
import { useMedications } from "@/lib/queries/medications";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { THEME } from "@/lib/theme";
import { router } from "expo-router";

const Medications = () => {
  const userId = "6a51438c0d07989baea70cd5";

  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme === "dark" ? "dark" : "light"];

  const {
    data: medications,
    error,
    isFetching,
    isLoading,
  } = useMedications(userId);

  //todo:change to skeleton
  if (isFetching || isLoading) return <Text>Loading</Text>;

  const renderMedications = medications?.map((medication) => {
    return <MedicationCard key={medication._id} medication={medication} />;
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerClassName="grow gap-y-5 px-4 py-6 pt-0"
      >
        <View className="flex-row w-full justify-between items-center">
          <Text variant={"h3"}>Medications</Text>
          <Button
            variant={"secondary"}
            onPress={() => {
              router.push({
                pathname: "/(tabs)/medication-form",
                params: { formType: "create", paramUserId: userId },
              });
            }}
          >
            <Plus color={colors.foreground} size={20} />
          </Button>
        </View>
        <View className="flex-col gap-y-3 w-full ">{renderMedications}</View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Medications;
