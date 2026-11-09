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

interface IProps {
  meal: string;
  name: string;
  calories: number;
  cuisine: string;
  cookingTime: string;
}

const MealCards = ({ calories, cookingTime, cuisine, meal, name }: IProps) => {
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
            <Timer className="text-white" strokeWidth={3} />
            <Text className="capitalize">{cookingTime}</Text>
          </Badge>

          <CardTitle>{name}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* <Text className="capitalize font-semibold">{name}</Text> */}
          <View className="flex-row w-full justify-between gap-x-2 text-wrap">
            <CardDescription>
              <b>Calories:</b> {calories}
            </CardDescription>
            <CardDescription>
              {/* <b>Cooking Time:</b> {cookingTime} */}
              <b>{cuisine} Cuisine</b>
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
