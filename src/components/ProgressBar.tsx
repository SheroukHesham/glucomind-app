import { vars } from "nativewind";
import { Text, View } from "react-native";

export default function ProgressBar({
  current,
  TOTAL_STEPS,
}: {
  current: number;
  TOTAL_STEPS: number;
}) {
  const progress = 100 / TOTAL_STEPS;
  const customVars = vars({
    "--dynamic-w": `${progress}%`,
  });

  const renderBar = Array.from(
    { length: TOTAL_STEPS },
    (_, index) => index + 1,
  ).map((idx) => {
    return (
      <View key={idx} className="flex-row flex items-center overflow-hidden ">
        <View
          className={`${idx <= current ? "bg-primary" : "bg-transparent"}  size-8 w-8  rounded-full   border outline-2 border-primary flex justify-center items-center`}
        >
          <Text
            className={`text-center font-semibold ${idx <= current ? "text-primary-foreground" : "text-primary"}`}
          >
            {idx}
          </Text>
        </View>
        {idx !== TOTAL_STEPS && (
          <View className=" w-6 sm:w-8 border-b-2 justify-center flex items-center  border-b-primary" />
        )}
      </View>
    );
  });

  return (
    <View
      className="w-full rounded-md   flex flex-row items-center justify-center
    "
    >
      {/* <View
        style={customVars}
        className="bg-[#007AFF] w-[var(--dynamic-w)] h-full rounded-md"
      /> */}
      {renderBar}
    </View>
  );
}
