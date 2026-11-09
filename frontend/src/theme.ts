// Design tokens for FretStudio — dark studio theme (from /app/design_guidelines.json).
// Components import `useTheme()` / `makeStyles` from here. No color literals in components.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#101114",
  onSurface: "#F4F4F5",
  surfaceSecondary: "#1C1E24",
  onSurfaceSecondary: "#E4E4E7",
  surfaceTertiary: "#272A31",
  onSurfaceTertiary: "#D4D4D8",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#101114",
  muted: "#71717A",

  brand: "#F59E0B",
  onBrand: "#101114",
  brandPrimary: "#F59E0B",
  onBrandPrimary: "#101114",
  brandSecondary: "#3B82F6",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#2A2015",
  onBrandTertiary: "#FDE68A",

  success: "#10B981",
  onSuccess: "#022C22",
  warning: "#F59E0B",
  onWarning: "#451A03",
  error: "#EF4444",
  onError: "#450A0A",
  info: "#06B6D4",
  onInfo: "#083344",

  border: "#272A31",
  borderStrong: "#3F4350",
  divider: "#1C1E24",

  // Harmonic degrees (strict)
  degreeRoot: "#EF4444",
  onDegreeRoot: "#FFFFFF",
  degree3rd: "#3B82F6",
  onDegree3rd: "#FFFFFF",
  degree5th: "#10B981",
  onDegree5th: "#022C22",
  degree7th: "#F59E0B",
  onDegree7th: "#1A1205",
  degree9th: "#8B5CF6",
  onDegree9th: "#FFFFFF",
  degree11th: "#EC4899",
  onDegree11th: "#FFFFFF",
  degree13th: "#06B6D4",
  onDegree13th: "#083344",
  degreeNeutral: "#52525B",
  onDegreeNeutral: "#E4E4E7",
  degreeUniform: "#D4D4D8",
  onDegreeUniform: "#101114",
  boxHighlight: "#3A2E1C",

  // Fretboard
  fretboardWood: "#1A1715",
  fretboardWoodAlt: "#211C19",
  fretWire: "#52525B",
  fretMarker: "#E5E7EB",
  nut: "#D6D3D1",
  stringPlain: "#C4C4CC",
  stringWound: "#B08D57",

  // Glass & scrims
  glass: "rgba(28,30,36,0.78)",
  scrimTop: "rgba(16,17,20,0.55)",
  scrimBottom: "#101114",
  pulse: "rgba(245,158,11,0.25)",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light: dark, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const fonts = { display: "SpaceGrotesk", text: "DMSans" };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
