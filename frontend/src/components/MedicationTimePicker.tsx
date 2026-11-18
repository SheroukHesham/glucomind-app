import { Clock } from "lucide-react-native";
import { Platform, View } from "react-native";
import { Label } from "./ui/label";
import { Controller, UseFormReturn } from "react-hook-form";
import { Button } from "./ui/button";
import { Text } from "./ui/text";
import {
  dateToTimeString,
  formatMedicationTime,
  timeStringToDate,
} from "@/functions";
import { useEffect, useState } from "react";
import { useColorScheme } from "nativewind";
import { MedicationFormValues } from "@/validations";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

interface IProps {
  form: UseFormReturn<MedicationFormValues>;
  timesPerDay: number;
}

const MedicationTimePicker = ({ form, timesPerDay }: IProps) => {
  const [activeTimeIndex, setActiveTimeIndex] = useState<number | null>(null);
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);

  const { colorScheme } = useColorScheme();

  useEffect(() => {}, [form.watch("times")]);

  function getTimeValue(index: number): Date {
    const times = form.getValues("times");

    return timeStringToDate(times[index] || "08:00");
  }

  function updateMedicationTime(index: number, date: Date) {
    const updatedTimes = [...form.getValues("times")];

    updatedTimes[index] = dateToTimeString(date);

    form.setValue("times", updatedTimes, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  function openTimePicker(index: number) {
    setActiveTimeIndex(index);

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: getTimeValue(index),
        mode: "time",
        design: "default",
        is24Hour: true,
        onChange: (event, selectedDate) => {
          if (event.type === "set" && selectedDate) {
            updateMedicationTime(index, selectedDate);
          }
        },
      });
    } else {
      setIsTimePickerVisible(true);
    }
  }

  function handleTimePickerChange(
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) {
    if (event.type === "set" && selectedDate && activeTimeIndex !== null) {
      updateMedicationTime(activeTimeIndex, selectedDate);
    }
  }

  function closeTimePicker() {
    setIsTimePickerVisible(false);
    setActiveTimeIndex(null);
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center mb-2  gap-x-1 ">
        <Clock
          size={16}
          color={colorScheme === "dark" ? "#F4F7F4" : "#171C18"}
        />
        <Label className="text-lg">Scheduled Times</Label>
      </View>

      {form.watch("frequency") !== "times_per_day" ? (
        <Button variant="outline" onPress={() => openTimePicker(0)}>
          <Text>
            {formatMedicationTime(form.watch("times")[0]).formattedTime || "-"}
          </Text>
        </Button>
      ) : (
        Array.from({ length: timesPerDay }, (_, index) => (
          <Button
            key={index}
            variant="outline"
            onPress={() => openTimePicker(index)}
          >
            <Text>
              {`Dose ${index + 1}: ${
                (form.watch("times")[index] &&
                  formatMedicationTime(form.watch("times")[index])
                    .formattedTime) ||
                "   -"
              }`}
            </Text>
          </Button>
        ))
      )}

      {Platform.OS === "ios" &&
        isTimePickerVisible &&
        activeTimeIndex !== null && (
          <View className="gap-2">
            <DateTimePicker
              value={getTimeValue(activeTimeIndex)}
              mode="time"
              is24Hour={true}
              display="spinner"
              onChange={handleTimePickerChange}
            />

            <Button onPress={closeTimePicker}>
              <Text>Done</Text>
            </Button>
          </View>
        )}
    </View>
  );
};

export default MedicationTimePicker;
