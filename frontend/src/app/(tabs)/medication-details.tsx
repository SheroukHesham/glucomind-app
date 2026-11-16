import { useLocalSearchParams, Stack, router } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Edit3 } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { IMedication } from "@/interfaces";
import { daysMap, formatMedicationTime } from "../../functions";
import { useState } from "react";

const MedicationDetails = () => {
  const { medication } = useLocalSearchParams<{
    medication: string;
  }>();

  const [editing, setIsEditing] = useState(false);

  let medicationData: IMedication | null = null;

  try {
    medicationData = medication ? JSON.parse(medication) : null;
  } catch (error) {
    console.error("Failed to parse medication:", error);
  }

  if (!medicationData) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-4">
        <Text>Medication details could not be loaded.</Text>

        <Button onPress={() => router.back()} className="mt-4">
          <Text>Go Back</Text>
        </Button>
      </SafeAreaView>
    );
  }

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
  } = medicationData;

  console.log(editing);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="px-4 py-6 gap-y-5"
      >
        {!editing ? (
          <View className="rounded-lg bg-secondary border border-border p-5 gap-y-3">
            <Text className="text-2xl capitalize font-bold">{name}</Text>

            {dosage && (
              <View>
                <Text variant="muted">Dosage</Text>
                <Text className="font-semibold">{dosage}</Text>
              </View>
            )}

            <View>
              <Text variant="muted">Frequency</Text>
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
              <Text variant="muted">Scheduled Times</Text>

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
              <Text variant="muted">Start Date</Text>
              <Text className="font-semibold">
                {startDate
                  ? new Date(startDate).toLocaleDateString()
                  : "Not specified"}
              </Text>
            </View>

            <View>
              <Text variant="muted">End Date</Text>
              <Text className="font-semibold">
                {endDate
                  ? new Date(endDate).toLocaleDateString()
                  : "No end date"}
              </Text>
            </View>

            {notes && (
              <View>
                <Text variant="muted">Notes</Text>
                <Text>{notes}</Text>
              </View>
            )}
          </View>
        ) : (
          <View className="rounded-lg bg-destructive border border-border p-5 gap-y-3">
            <Text className="text-2xl capitalize font-bold">{name}</Text>

            {dosage && (
              <View>
                <Text variant="muted">Dosage</Text>
                <Text className="font-semibold">{dosage}</Text>
              </View>
            )}

            <View>
              <Text variant="muted">Frequency</Text>
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
              <Text variant="muted">Scheduled Times</Text>

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
              <Text variant="muted">Start Date</Text>
              <Text className="font-semibold">
                {startDate
                  ? new Date(startDate).toLocaleDateString()
                  : "Not specified"}
              </Text>
            </View>

            <View>
              <Text variant="muted">End Date</Text>
              <Text className="font-semibold">
                {endDate
                  ? new Date(endDate).toLocaleDateString()
                  : "No end date"}
              </Text>
            </View>

            {notes && (
              <View>
                <Text variant="muted">Notes</Text>
                <Text>{notes}</Text>
              </View>
            )}
          </View>
        )}
        <Button onClick={() => setIsEditing(true)}>
          <Text>Edit Medication</Text>
        </Button>
        <Button variant={"outline_destructive"}>
          <Text className="">Delete Medication</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MedicationDetails;
