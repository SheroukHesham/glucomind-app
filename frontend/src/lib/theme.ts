import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";
import { vars } from "nativewind";
import themeTokens from "./theme.tokens.json";

export type ColorScheme = "light" | "dark";

export type ThemeColors = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
};

export const THEME = themeTokens as Record<ColorScheme, ThemeColors>;

/**
 * Expose the selected palette as NativeWind CSS variables.
 * Descendant components can use semantic classes such as bg-background.
 */
export function getThemeVariables(scheme: ColorScheme) {
  const colors = THEME[scheme];

  return vars({
    "--background": colors.background,
    "--foreground": colors.foreground,
    "--card": colors.card,
    "--card-foreground": colors.cardForeground,
    "--popover": colors.popover,
    "--popover-foreground": colors.popoverForeground,
    "--primary": colors.primary,
    "--primary-foreground": colors.primaryForeground,
    "--secondary": colors.secondary,
    "--secondary-foreground": colors.secondaryForeground,
    "--muted": colors.muted,
    "--muted-foreground": colors.mutedForeground,
    "--accent": colors.accent,
    "--accent-foreground": colors.accentForeground,
    "--destructive": colors.destructive,
    "--destructive-foreground": colors.destructiveForeground,
    "--border": colors.border,
    "--input": colors.input,
    "--ring": colors.ring,
  });
}

function createNavigationTheme(
  baseTheme: Theme,
  colors: ThemeColors,
  isDark: boolean,
): Theme {
  return {
    ...baseTheme,
    dark: isDark,
    colors: {
      ...baseTheme.colors,
      background: colors.background,
      border: colors.border,
      card: colors.card,
      notification: colors.destructive,
      primary: colors.primary,
      text: colors.foreground,
    },
  };
}

export const NAV_THEME: Record<ColorScheme, Theme> = {
  light: createNavigationTheme(DefaultTheme, THEME.light, false),
  dark: createNavigationTheme(DarkTheme, THEME.dark, true),
};
