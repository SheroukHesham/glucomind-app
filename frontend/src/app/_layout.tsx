import "@/global.css";

import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import StoreProvider from "./StoreProvider";
import {
  getThemeVariables,
  NAV_THEME,
  THEME,
  type ColorScheme,
} from "../lib/theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function RootLayout() {
  const isLoggedIn = true;

  const { colorScheme } = useColorScheme();

  const scheme: ColorScheme = colorScheme === "dark" ? "dark" : "light";

  const colors = THEME[scheme];
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <ThemeProvider value={NAV_THEME[scheme]}>
          <View
            style={[
              { flex: 1, backgroundColor: colors.background },
              getThemeVariables(scheme),
            ]}
          >
            <StatusBar style={scheme === "dark" ? "light" : "dark"} />

            <SafeAreaView
              style={{
                flex: 1,
                backgroundColor: colors.background,
              }}
            >
              <Stack
                screenOptions={{
                  contentStyle: {
                    backgroundColor: colors.background,
                  },
                  headerStyle: {
                    backgroundColor: colors.card,
                  },
                  headerTintColor: colors.foreground,
                  headerTitleStyle: {
                    color: colors.foreground,
                  },
                }}
              >
                <Stack.Protected guard={!isLoggedIn} redirectTo={"/(tabs)"}>
                  <Stack.Screen
                    name="register"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen name="login" options={{ headerShown: false }} />
                </Stack.Protected>

                <Stack.Protected guard={isLoggedIn} redirectTo={"/login"}>
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                  />
                </Stack.Protected>
              </Stack>
            </SafeAreaView>

            <PortalHost />
          </View>
        </ThemeProvider>
      </StoreProvider>
    </QueryClientProvider>
  );
}
