import { Text } from "@/components/ui/text";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MedicationCard from "@/components/MedicationCard";
import { useMedications } from "@/lib/queries/medications";

const Medications = () => {
  const userId = "6a51438c0d07989baea70cd5";

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
        contentContainerClassName="grow gap-y-5 px-4 py-6"
      >
        <View className="flex-col gap-y-3 w-full ">
          <Text variant={"h3"}>Medications</Text>
          {renderMedications}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Medications;
