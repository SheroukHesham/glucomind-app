import React, { useState } from "react";
import { Checkbox } from "./ui/checkbox";
import { Text } from "./ui/text";
import { View } from "react-native";
import { Button } from "./ui/button";
import { Check } from "lucide-react-native";

interface IProps {
  name: string;
  time: string;
  active: boolean;
}

const MedicationTracker = ({ name, time, active }: IProps) => {
  const [tracked, setTracked] = useState<boolean>(false);
  //   todo: only glow when time to take
  return (
    <View
      className=" w-full rounded-lg py-2 px-5 flex-row justify-between items-center bg-secondary border  border-border "
      style={
        active && {
          shadowColor: "#4C9B62",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 12,
          elevation: 15,
        }
      }
    >
      <View className="flex-col flex-1  justify-center gap-x-2 ">
        <Text className=" text-xl flex-1 capitalize">{name}</Text>
        <Text className="tracking-wider text-base text-primary font-semibold">
          At {time}
        </Text>
      </View>
      <Button
        variant={"outline"}
        className={`w-fit`}
        style={{
          backgroundColor: tracked ? "#279305" : "",
          borderColor: tracked ? "#4C9B62" : "",
        }}

        onPress={() => {
          setTracked((prev) => !prev);
        }}
      >
        {tracked ? (
          <View className="items-center flex-row gap-x-2 ">
            <Check
              size={20}
              className="size-4 text-foreground "
              strokeWidth={3}
            />
            <Text>Tracked</Text>
          </View>
        ) : (
          <Text>Track</Text>
        )}
      </Button>
    </View>
  );
};

export default MedicationTracker;
