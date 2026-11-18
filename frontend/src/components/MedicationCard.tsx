import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Dot, Timer } from "lucide-react-native";

import { Text } from "./ui/text";
import { IMedication } from "@/interfaces";
import { daysMap, formatMedicationTime } from "../functions";
import { Badge } from "./ui/badge";
import { useColorScheme } from "nativewind";

interface IProps {
  medication: IMedication;
}

const MedicationCard = ({ medication }: IProps) => {
  const router = useRouter();

  const { _id, frequency, name, times, dayOfMonth, dayOfWeek, dosage, notes } =
    medication;

  const { colorScheme } = useColorScheme();

  const renderTimes = Array.isArray(times)
    ? times.map((time, idx) => {
        const { formattedTime } = formatMedicationTime(time);

        return (
          <Badge
            variant="outline"
            key={`${_id}-${idx}`}
            className="font-semibold px-3 border-background bg-card"
          >
            <Timer color={colorScheme === "dark" ? "#F4F7F4" : "#171C18"} />
            <Text>{formattedTime}</Text>
          </Badge>
        );
      })
    : null;

  const handlePress = () => {
    router.push({
      pathname: "/(tabs)/medication-details",
      params: {
        userId: medication.userId,
        medicationId: medication._id,
      },
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      className="w-full rounded-lg py-2 px-5 bg-secondary border border-border flex-col active:opacity-70"
    >
      <View className="flex-col flex-1">
        <Text className="text-xl capitalize mb-1">{name}</Text>

        <View className="flex-row items-center">
          {dosage && <Text className="font-semibold">{dosage}</Text>}

          <Dot color={colorScheme === "dark" ? "#F4F7F4" : "#171C18"} />

          <Text className="capitalize font-semibold">
            {frequency === "times_per_day"
              ? `${times?.length ?? 0} Times a day`
              : frequency}
            {frequency === "weekly" &&
              dayOfWeek !== undefined &&
              ` on ${daysMap[dayOfWeek]}`}
            {frequency === "monthly" && dayOfMonth && ` on the ${dayOfMonth}`}
          </Text>
        </View>

        {notes && (
          <Text variant="muted" className="font-semibold">
            {notes}
          </Text>
        )}
      </View>

      <View className="flex-row mt-2 gap-x-1 gap-y-1 flex-wrap">
        {renderTimes}
      </View>
    </Pressable>
  );
};

export default MedicationCard;
