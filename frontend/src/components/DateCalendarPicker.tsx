import CalendarPicker, { type ChangedDate } from "react-native-calendar-picker";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { Text } from "./ui/text";
import { CalendarDays } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useWindowDimensions } from "react-native";
import { THEME } from "@/lib/theme";

interface IProps {
  startDate: string;
  endDate?: string;
  onDateChange: (date: Date | null, type: ChangedDate) => void;
}

const parseCalendarDate = (value?: string): Date | undefined => {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);

  if (
    !year ||
    !month ||
    !day ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return undefined;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
};

const DateCalendarPicker = ({ startDate, endDate, onDateChange }: IProps) => {
  const { colorScheme } = useColorScheme();
  const { width: windowWidth } = useWindowDimensions();

  const colors = THEME[colorScheme === "dark" ? "dark" : "light"];

  const calendarWidth = Math.min(windowWidth - 64, 360);
  const dialogWidth = calendarWidth + 32;

  const selectedStartDate = parseCalendarDate(startDate);
  const selectedEndDate = parseCalendarDate(endDate);

  return (
    <Dialog>
      <DialogTrigger className="flex-row items-center gap-x-2 ">
        <CalendarDays color={colors.foreground} size={20} />
        <Text className="text-foreground">Change Intake Duration</Text>
      </DialogTrigger>

      <DialogContent
        overlayClassName="bg-transparent"
        className="bg-background border-border items-center p-4"
        style={{
          width: dialogWidth,
          maxWidth: windowWidth - 32,
        }}
        showCloseButton={false}
      >
        <CalendarPicker
          width={calendarWidth}
          onDateChange={onDateChange}
          selectedStartDate={selectedStartDate}
          selectedEndDate={selectedEndDate}
          allowRangeSelection={true}
          textStyle={{
            color: colors.foreground,
            fontSize: 14,
          }}
          monthTitleStyle={{
            color: colors.foreground,
            fontSize: 17,
            fontWeight: "600",
          }}
          yearTitleStyle={{
            color: colors.foreground,
            fontSize: 15,
            fontWeight: "500",
          }}
          previousTitleStyle={{
            color: colors.primary,
            fontSize: 14,
          }}
          nextTitleStyle={{
            color: colors.primary,
            fontSize: 14,
          }}
          headerWrapperStyle={{
            backgroundColor: colors.background,
          }}
          dayLabelsWrapper={{
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
            borderTopColor: colors.border,
            borderTopWidth: 1,
          }}
          todayBackgroundColor={colors.accent}
          todayTextStyle={{
            color: colors.primary,
            fontWeight: "600",
          }}
          selectedDayStyle={{
            backgroundColor: colors.primary,
          }}
          selectedDayTextStyle={{
            color: colors.primaryForeground,
            fontWeight: "600",
          }}
          selectedRangeStyle={{
            backgroundColor: colors.accent,
          }}
          selectedRangeStartStyle={{
            backgroundColor: colors.primary,
          }}
          selectedRangeEndStyle={{
            backgroundColor: colors.primary,
          }}
          selectedRangeStartTextStyle={{
            color: colors.primaryForeground,
            fontWeight: "600",
          }}
          selectedRangeEndTextStyle={{
            color: colors.primaryForeground,
            fontWeight: "600",
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default DateCalendarPicker;
