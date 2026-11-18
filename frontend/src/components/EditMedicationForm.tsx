import { IMedication } from "@/interfaces";
import { View } from "react-native";
import { Text } from "./ui/text";
import { daysMap, formatCalendarDate } from "@/functions";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { MedicationFormValues, medicationSchema } from "@/validations";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import SingleSelect from "./SingleSelect";
import { EMPTY_MEDICATION, SELECT_MEDICATION_FREQUENCY_LIST } from "@/data";
import { ChangedDate } from "react-native-calendar-picker";
import { Dispatch, SetStateAction, useCallback, useState } from "react";
import {
  Calendar1,
  CalendarDays,
  NotebookPen,
  PillBottle,
  Repeat1,
} from "lucide-react-native";
import DateCalendarPicker from "./DateCalendarPicker";
import { useColorScheme } from "nativewind";
import { router, useFocusEffect } from "expo-router";
import { Button } from "./ui/button";
import MedicationTimePicker from "./MedicationTimePicker";
import { useUpdateMedication } from "@/lib/queries/medications";

interface IProps {
  medication: IMedication;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
}

const EditMedicationForm = ({ medication, setIsEditing }: IProps) => {
  const MAX_TIMES_PER_DAY = 11;
  const START = 2;
  const { times, endDate, startDate, _id, userId } = medication;

  const [timesPerDay, setTimesPerDay] = useState<number>(times.length);

  const { colorScheme } = useColorScheme();
  const form = useForm<MedicationFormValues>({
    resolver: yupResolver(medicationSchema),
    values: { ...medication },
  });

  useFocusEffect(
    useCallback(() => {
      return () => {
        form.reset(EMPTY_MEDICATION);
        setTimesPerDay(0);
        setIsEditing(false);
      };
    }, [form.reset]),
  );

  function onDateChange(date: Date | null, type: ChangedDate) {
    console.log("Calendar selection:", { date, type });

    // The calendar can emit null when a selection is cleared/reset.
    if (!date || Number.isNaN(date.getTime())) {
      return;
    }

    const formattedDate = formatCalendarDate(date);

    if (type === "END_DATE") {
      form.setValue("endDate", formattedDate, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    } else {
      form.setValue("startDate", formattedDate, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  }

  const updateMedication = useUpdateMedication(userId, medication._id);
  const onSubmit = async (data: MedicationFormValues) => {
    try {
      await updateMedication.mutateAsync({
        _id,
        userId,
        ...data,
      });

      router.back();
    } catch (error) {
      console.error("Failed to update medication:", error);
    }
  };

  return (
    <View className="flex-col gap-y-4">
      <View>
        <View className="flex-row items-center mb-2  gap-x-1 ">
          <Label className="text-lg">Name</Label>
        </View>
        <Controller
          control={form.control}
          name="name"
          render={({
            field: { onChange, onBlur, value },
            fieldState: { error },
          }) => (
            <>
              <Input
                id="name"
                placeholder="Enter your medication name"
                keyboardType="default"
                returnKeyType="next"
                submitBehavior="submit"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
              {error && (
                <Text className="text-red-700 font-medium">
                  {error.message}
                </Text>
              )}
            </>
          )}
        />
      </View>

      <View>
        <View className="flex-row items-center mb-2  gap-x-1 ">
          <PillBottle
            size={16}
            color={colorScheme === "dark" ? "#F4F7F4" : "#171C18"}
          />
          <Label className="text-lg">Dosage</Label>
        </View>
        <Controller
          control={form.control}
          name="dosage"
          render={({
            field: { onChange, onBlur, value },
            fieldState: { error },
          }) => (
            <>
              <Input
                id="dosage"
                placeholder="Enter your medication dosage"
                keyboardType="default"
                returnKeyType="next"
                submitBehavior="submit"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
              {error && (
                <Text className="text-red-700 font-medium">
                  {error.message}
                </Text>
              )}
            </>
          )}
        />
      </View>

      <View>
        <View className="flex-row items-center mb-2  gap-x-1">
          <Repeat1
            size={16}
            color={colorScheme === "dark" ? "#F4F7F4" : "#171C18"}
          />
          <Label className="text-lg">Intake Frequency</Label>
        </View>
        <Controller
          control={form.control}
          name="frequency"
          render={({
            field: { onChange, onBlur, value },
            fieldState: { error },
          }) => (
            <SingleSelect
              selectLabel="Intake Frequency"
              list={SELECT_MEDICATION_FREQUENCY_LIST}
              placeholder="Select the medication intake frequency"
              value={value}
              onChange={(value) => {
                onChange(value);
                if (value !== "times_per_day") {
                  form.setValue("times", [form.getValues("times")[0]]);
                  setTimesPerDay(1);
                }
                if (value !== "weekly") {
                  form.setValue("dayOfWeek", undefined);
                }
                if (value !== "monthly") {
                  form.setValue("dayOfMonth", undefined);
                }
              }}
              onBlur={onBlur}
              error={error?.message}
            />
          )}
        />
      </View>

      {form.watch("frequency") === "times_per_day" && (
        <View className="flex-row gap-x-4">
          <View className="flex-row items-center gap-x-1 mb-2">
            <Repeat1
              size={16}
              color={colorScheme === "dark" ? "#F4F7F4" : "#171C18"}
            />
            <Label className="text-lg">Times per Day</Label>
          </View>
          <SingleSelect
            selectLabel="Times per Day"
            disabled={!(form.watch("frequency") === "times_per_day")}
            list={Array.from({ length: MAX_TIMES_PER_DAY }, (_, index) => ({
              value: (index + START).toString(),
              label: (index + START).toString(),
            }))}

            value={timesPerDay?.toString()}
            onChange={(value) => setTimesPerDay(Number(value))}
            size="sm"
          />
        </View>
      )}
      {form.watch("frequency") === "weekly" && (
        <View className="flex-col ">
          <View className="flex-row items-center gap-x-1 mb-2">
            <Calendar1
              size={16}
              color={colorScheme === "dark" ? "#F4F7F4" : "#171C18"}
            />
            <Label className="text-lg">Day of The Week</Label>
          </View>
          <Controller
            control={form.control}
            name="dayOfWeek"
            render={({
              field: { onChange, onBlur, value },
              fieldState: { error },
            }) => (
              <SingleSelect
                selectLabel="Day of the Week"
                list={Array.from({ length: 6 }, (_, index) => ({
                  value: index.toString(),
                  label: daysMap[index],
                }))}
                placeholder="Select the day of week"
                value={value?.toString()}
                onChange={onChange}
                onBlur={onBlur}
                error={error?.message}
              />
            )}
          />
        </View>
      )}
      {form.watch("frequency") === "monthly" && (
        <View className="flex-col ">
          <View className="flex-row items-center gap-x-1 mb-2">
            <Calendar1
              size={16}
              color={colorScheme === "dark" ? "#F4F7F4" : "#171C18"}
            />
            <Label className="text-lg">Day of The Month</Label>
          </View>
          <Controller
            control={form.control}
            name="dayOfMonth"
            render={({
              field: { onChange, onBlur, value },
              fieldState: { error },
            }) => (
              <SingleSelect
                selectLabel="Day of the Month"
                list={Array.from({ length: 31 }, (_, index) => ({
                  value: (index + 1).toString(),
                  label: (index + 1).toString(),
                }))}
                placeholder="Select day of the month"
                value={value?.toString()}
                onChange={onChange}
                onBlur={onBlur}
                error={error?.message}
              />
            )}
          />
        </View>
      )}

      <MedicationTimePicker form={form} timesPerDay={timesPerDay} />

      <View>
        <View className="flex-row items-center gap-x-1 mb-2">
          <CalendarDays
            size={16}
            color={colorScheme === "dark" ? "#F4F7F4" : "#171C18"}
          />
          <Label className="text-lg">Intake Duration</Label>
        </View>

        <View className="flex-row justify-between mr-2">
          {form.watch("frequency") === "once" ? (
            <Text>On {form.watch("startDate") ?? "-"}</Text>
          ) : (
            <View>
              <Text className="font-semibold">
                Start {form.watch("startDate") ?? "-"}
              </Text>
              <Text className="font-semibold">
                End {form.watch("endDate") ?? "-"}
              </Text>
            </View>
          )}
          <DateCalendarPicker
            startDate={startDate}
            endDate={endDate}
            onDateChange={onDateChange}
          />
        </View>
        <Controller
          control={form.control}
          name="startDate"
          render={({
            field: { onChange, onBlur, value },
            fieldState: { error },
          }) => (
            <>
              {error && (
                <Text className="text-red-700 font-medium">
                  {error.message}
                </Text>
              )}
            </>
          )}
        />
      </View>

      <View>
        <View className="flex-row items-center gap-x-1 mb-2">
          <NotebookPen
            size={16}
            color={colorScheme === "dark" ? "#F4F7F4" : "#171C18"}
          />
          <Label className="text-lg">Notes</Label>
        </View>

        <Controller
          control={form.control}
          name="notes"
          render={({
            field: { onChange, onBlur, value },
            fieldState: { error },
          }) => (
            <>
              <Input
                id="notes"
                placeholder="Eg: After Meal"
                keyboardType="default"
                returnKeyType="next"
                submitBehavior="submit"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline={true}
                textAlignVertical="top"
              />
              {error && (
                <Text className="text-red-700 font-medium">
                  {error.message}
                </Text>
              )}
            </>
          )}
        />
      </View>
      <Button className="mt-5" onPress={() => form.handleSubmit(onSubmit)()}>
        <Text>Save Changes</Text>
      </Button>
    </View>
  );
};

export default EditMedicationForm;
