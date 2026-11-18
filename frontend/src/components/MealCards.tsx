import { View } from "react-native";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Text } from "./ui/text";
import { Badge } from "./ui/badge";
import { Timer } from "lucide-react-native";
import { useColorScheme } from "nativewind";

interface IProps {
  meal: string;
  name: string;
  calories: number;
  cuisine: string;
  cookingTime: string;
}

const MealCards = ({ calories, cookingTime, cuisine, meal, name }: IProps) => {
  const { colorScheme } = useColorScheme();
  return (
    <View className="gap-y-2">
      <Text variant={"lead"} className="capitalize ">
        {meal}
      </Text>
      {/* <Badge className="px-5">
      </Badge> */}
      <Card className="pt-3">
        <CardHeader className="gap-y-3 ">
          <Badge variant={"outline"} className="px-5">
            <Timer
              size={16}
              color={colorScheme === "dark" ? "#F4F7F4" : "#171C18"}
            />
            <Text className="capitalize">{cookingTime}</Text>
          </Badge>

          <CardTitle>{name}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* <Text className="capitalize font-semibold">{name}</Text> */}
          <View className="flex-row w-full justify-between gap-x-2 text-wrap">
            <CardDescription>
              <Text> Calories: {calories}</Text>
            </CardDescription>
            <CardDescription>
              {/* <b>Cooking Time:</b> {cookingTime} */}
              {cuisine} Cuisine
            </CardDescription>
          </View>
          {/* <CardDescription className="mt-2">
          </CardDescription> */}
        </CardContent>
        {/* <CardFooter>
          <Text className="text-muted-foreground text-sm font-semibold"></Text>
        </CardFooter> */}
      </Card>
    </View>
  );
};

export default MealCards;
