import { useLocalSearchParams, router } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { IMedication } from "@/interfaces";
import { daysMap, formatMedicationTime } from "../../functions";
import MedicationForm from "@/components/EditMedicationForm";
import {
  useDeleteMedication,
  useGetMedicationDetails,
} from "@/lib/queries/medications";
import Alert from "@/components/Alert";
import Toast from "react-native-toast-message";
import { DialogClose } from "@/components/ui/dialog";

const MedicationDetails = () => {
  const { userId, medicationId } = useLocalSearchParams<{
    userId: string;
    medicationId: string;
  }>();

  const {
    data: medication,
    isError,
    isFetching,
  } = useGetMedicationDetails(userId, medicationId);

  const [editing, setIsEditing] = useState(false);

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-4">
        <Text>Medication details could not be loaded.</Text>

        <Button onPress={() => router.back()} className="mt-4">
          <Text>Go Back</Text>
        </Button>
      </SafeAreaView>
    );
  }
  useEffect(() => {}, [medication]);

  const deleteMedication = useDeleteMedication(userId, medicationId);
  const onDeleteMedication = async () => {
    try {
      await deleteMedication.mutate();
      router.back();
    } catch (error) {
      Toast.show({ type: "error", text1: error.response.error });
    }
  };
  if (isFetching) return <Text>Loading</Text>;
  if (!medication) return <Text>no medication</Text>;

  const {
    name,
    dosage,
    frequency,
    times,
    dayOfWeek,
    dayOfMonth,
    startDate,
    endDate,
    notes,
  } = medication;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 20,
          gap: 20,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {editing ? (
          <MedicationForm
            medication={medication}
            setIsEditing={setIsEditing}
            formType="edit"
          />
        ) : (
          <View className="rounded-lg bg-secondary border border-border p-5  gap-y-3 ">
            <Text className="text-2xl capitalize font-bold">{name}</Text>

            {dosage && (
              <View>
                <Text variant="mutedLarge">Dosage</Text>
                <Text className="font-semibold">{dosage}</Text>
              </View>
            )}

            <View>
              <Text variant="mutedLarge">Frequency</Text>
              <Text className="font-semibold capitalize">
                {frequency === "times_per_day"
                  ? `${times?.length ?? 0} times a day`
                  : frequency}

                {frequency === "weekly" &&
                  dayOfWeek !== undefined &&
                  ` on ${daysMap[dayOfWeek]}`}

                {frequency === "monthly" &&
                  dayOfMonth &&
                  ` on the ${dayOfMonth}`}
              </Text>
            </View>

            <View>
              <Text variant="mutedLarge">Scheduled Times</Text>

              {times?.length ? (
                times.map((time, index) => (
                  <Text key={`${time}-${index}`} className="font-semibold">
                    {formatMedicationTime(time).formattedTime}
                  </Text>
                ))
              ) : (
                <Text>No scheduled times</Text>
              )}
            </View>

            <View>
              <Text variant="mutedLarge">Start Date</Text>
              <Text className="font-semibold">
                {startDate
                  ? new Date(startDate).toLocaleDateString()
                  : "Not specified"}
              </Text>
            </View>

            <View>
              <Text variant="mutedLarge">End Date</Text>
              <Text className="font-semibold">
                {endDate
                  ? new Date(endDate).toLocaleDateString()
                  : "No end date"}
              </Text>
            </View>

            {notes && (
              <View>
                <Text variant="mutedLarge">Notes</Text>
                <Text>{notes}</Text>
              </View>
            )}
          </View>
        )}

        {!editing && (
          <>
            <Button onPress={() => setIsEditing(true)}>
              <Text>Edit Medication</Text>
            </Button>

            <Alert
              title="Are You Sure You Want to Delete this Medication?"
              triggerComponent={<Text>Delete Medication</Text>}
            >
              <View className="flex-row w-full justify-between">
                <DialogClose>
                  <Text>Cancel</Text>
                </DialogClose>
                <Button
                  variant={"destructive"}
                  onPress={() => onDeleteMedication()}
                >
                  <Text> Yes, Delete</Text>
                </Button>
              </View>
            </Alert>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default MedicationDetails;
