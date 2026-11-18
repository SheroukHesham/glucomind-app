interface MedicationTimeResult {
  formattedTime: string;
  active: boolean;
}

export function formatMedicationTime(
  time: string,
  now: Date = new Date(),
): MedicationTimeResult {
  const [hours, minutes] = time.split(":").map(Number);

  // Validate HH:mm
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error(`Invalid medication time: ${time}`);
  }

  const medicationDate = new Date(now);
  medicationDate.setHours(hours, minutes, 0, 0);

  const formattedTime = medicationDate
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();

  return {
    formattedTime,
    active: now >= medicationDate,
  };
}

export function timeStringToDate(time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date;
}

export function dateToTimeString(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

export const daysMap: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export const formatCalendarDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};
