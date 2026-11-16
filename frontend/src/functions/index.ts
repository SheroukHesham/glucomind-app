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

export const daysMap: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};
