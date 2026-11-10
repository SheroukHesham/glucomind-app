import { useState } from "react";
import { Text } from "./ui/text";
import { View } from "react-native";
import { Button } from "./ui/button";
import { Check, Dot, Timer } from "lucide-react-native";
import { IMedication } from "@/interfaces";
import { daysMap, formatMedicationTime } from "../../functions";
import { Badge } from "./ui/badge";

interface IProps {
  medication: IMedication;
}

const MedicationCard = ({ medication }: IProps) => {
  const {
    _id,
    frequency,
    name,
    times,
    userId,
    dayOfMonth,
    dayOfWeek,
    dosage,
    endDate,
    notes,
    startDate,
  } = medication;

  const renderTimes = times.map((time, idx) => {
    const { formattedTime, active } = formatMedicationTime(time);
    return (
      <Badge
        variant={"outline"}
        key={idx}
        className="font-semibold px-3 border-background bg-card"
      >
        <Timer className="text-foreground" />
        <Text>{formattedTime}</Text>
      </Badge>
    );
  });
  return (
    <View
      className={` w-full rounded-lg py-2 px-5  bg-secondary border  border-border  flex-col `}
    >
      <View className="flex-col flex-1  ">
        <Text className=" text-xl capitalize mb-1">{name}</Text>
        <View className="flex-row">
          {dosage && <Text className="font-semibold">{dosage}</Text>}
          <Dot className="text-foreground" />
          <Text className="capitalize font-semibold">
            {frequency === "times_per_day"
              ? times.length + " Times a day"
              : frequency}
            {frequency === "weekly" &&
              dayOfWeek !== undefined &&
              " on " + daysMap[dayOfWeek]}
            {frequency === "monthly" && dayOfMonth && " on the " + dayOfMonth}
          </Text>
        </View>
        {notes && (
          <Text variant={"muted"} className="font-semibold">
            {notes}
          </Text>
        )}
      </View>
      <View className={`flex-row mt-2 gap-x-1 gap-y-1 flex-wrap`}>
        {renderTimes}
      </View>
    </View>
  );
};

export default MedicationCard;
