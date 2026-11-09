import { Drawer } from "expo-router/drawer";
import { useColorScheme } from "nativewind";

import { THEME, type ColorScheme } from "../../lib/theme";
import { Text } from "react-native";

export default function TabLayout() {
  const { colorScheme } = useColorScheme();

  const scheme: ColorScheme = colorScheme === "dark" ? "dark" : "light";

  const colors = THEME[scheme];

  return (
    <Drawer
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.foreground,
        headerTitleStyle: {
          color: colors.foreground,
        },

        drawerStyle: {
          backgroundColor: colors.card,
        },

        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.mutedForeground,
        drawerActiveBackgroundColor: colors.accent,

        drawerLabelStyle: {
          fontWeight: "500",
        },

        drawerItemStyle: {
          marginVertical: 5,
          borderRadius: 8,
        },

        sceneStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          headerTitle: "GlucoMind",
          drawerLabel: "Dashboard",
          title: "Dashboard",
        }}
      />

      <Drawer.Screen
        name="about"
        options={{
          headerTitle: "GlucoMind",
          drawerLabel: "About Us",
          title: "About Us",
        }}
      />
      <Drawer.Screen
        name="meals"
        options={{
          headerTitle: "GlucoMind",
          drawerLabel: "Meals",
          title: "Meals",
        }}
      />
      <Drawer.Screen
        name="medications"
        options={{
          headerTitle: "GlucoMind",
          drawerLabel: "Medications",
          title: "Medications",
        }}
      />
    </Drawer>
  );
}
