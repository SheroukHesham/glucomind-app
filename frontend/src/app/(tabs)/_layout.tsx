import { Drawer } from "expo-router/drawer";
import { useColorScheme } from "nativewind";

import { THEME, type ColorScheme } from "../../lib/theme";

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
          drawerLabel: "Dashboard",
          title: "Dashboard",
        }}
      />

      <Drawer.Screen
        name="about"
        options={{
          drawerLabel: "About Us",
          title: "About Us",
        }}
      />
    </Drawer>
  );
}
