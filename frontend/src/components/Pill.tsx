import React from "react";
import { Pressable, Text } from "react-native";

import { HintScrollRow } from "@/src/components/ScrollHint";
import { CaretDown } from "phosphor-react-native";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

/**
 * One setting of the screen, shown as it is set ("G", "Majeure", "Position 1 · 1/2"…): touching it opens only that
 * setting. `accent`: the key, drawn like the brand color.
 */
export function Pill({ label, onPress, accent = false, testID }: { label: string; onPress: () => void; accent?: boolean; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.pill, accent && styles.pillAccent, pressed && styles.pressed]} accessibilityRole="button">
      <Text style={[styles.label, accent && styles.labelAccent]} numberOfLines={1}>
        {label}
      </Text>
      <CaretDown size={12} color={accent ? colors.onBrandTertiary : colors.onSurfaceTertiary} weight="bold" />
    </Pressable>
  );
}

/** The row of pills under the header (scrolls sideways when it doesn't fit). */
export function PillRow({ children, testID, inset = true }: { children: React.ReactNode; testID?: string; inset?: boolean }) {
  const styles = useStyles();
  return (
    <HintScrollRow testID={testID} style={[styles.row, inset && styles.rowFixed]} contentContainerStyle={[styles.rowContent, inset && styles.rowInset]}>
      {children}
    </HintScrollRow>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexGrow: 0, flexShrink: 1, minWidth: 0 },
  // Under a header (column layout): never squeezed to nothing when the screen is full.
  rowFixed: { flexShrink: 0, minHeight: 44 },
  rowContent: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  rowInset: { paddingHorizontal: spacing.lg },
  pill: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
  },
  pillAccent: { backgroundColor: c.brandTertiary, borderColor: c.brandPrimary },
  label: { fontFamily: fonts.display, fontSize: 14, color: c.onSurface, maxWidth: 220 },
  labelAccent: { color: c.onBrandTertiary, fontWeight: "700" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
}));
