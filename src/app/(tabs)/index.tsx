import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Link href={"/about"}>Go to about screen</Link>
      <Text className="text-yellow-900">
        Edit app/index.tsx to edit this screen.
      </Text>
    </View>
  );
}
