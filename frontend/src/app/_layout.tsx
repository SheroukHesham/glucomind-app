//**Todo: add theme and switch

import "@/global.css";
// import { useColorScheme } from "@/hooks/use-color-scheme.web";
// import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import StoreProvider from "./StoreProvider";

export default function RootLayout() {
  const isRegistered = false;
  const isLoggedIn = false;
  // const colorScheme = useColorScheme();
  return (
    <StoreProvider>
      {/* <ThemeProvider
        value={NAV_THEME[colorScheme === "dark" ? "dark" : "light"]}
      > */}
      {/* <StatusBar style={colorScheme === "dark" ? "light" : "dark"} /> */}

      <Stack>
        <Stack.Screen
          name="register"
          options={{ headerShown: false }}
          redirect={isRegistered}
        />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
          redirect={isRegistered}
        />
      </Stack>
      <PortalHost />
      {/* </ThemeProvider> */}
    </StoreProvider>
  );
}
