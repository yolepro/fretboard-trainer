import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { fonts, makeStyles, radius, spacing } from "@/src/theme";

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID: string;
  dotColor?: string;
  dim?: boolean;
  /** Small rounded tag inside the chip (e.g. "1/2"). "accent" is drawn in a second, warmer color. */
  badge?: string;
  badgeTone?: "primary" | "accent";
};

export function Chip({ label, selected, onPress, testID, dotColor, dim, badge, badgeTone = "primary" }: ChipProps) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        dim && styles.dim,
        pressed && styles.pressed,
      ]}
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {badge ? (
        <View style={[styles.badge, badgeTone === "accent" ? styles.badgeAccent : styles.badgePrimary]} testID={`${testID}-badge`}>
          <Text style={[styles.badgeText, badgeTone === "accent" ? styles.badgeTextAccent : styles.badgeTextPrimary]} numberOfLines={1}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ChipRow({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const styles = useStyles();
  return (
    <ScrollView
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.rowContent}
    >
      {children}
    </ScrollView>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.section}>{children}</Text>;
}

const useStyles = makeStyles((c) => ({
  row: { height: 52, flexGrow: 0, flexShrink: 0 },
  rowContent: { alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    height: 36,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
  },
  chipSelected: { backgroundColor: c.brandTertiary, borderColor: c.brandPrimary },
  dim: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.96 }] },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontFamily: fonts.display, fontSize: 14, color: c.onSurfaceTertiary },
  labelSelected: { color: c.onBrandTertiary },
  badge: {
    height: 22,
    minWidth: 34,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  badgePrimary: { backgroundColor: c.brandPrimary },
  badgeAccent: { backgroundColor: c.degree7th },
  badgeText: { fontFamily: fonts.display, fontSize: 12, fontWeight: "700" },
  badgeTextPrimary: { color: c.onBrandPrimary },
  badgeTextAccent: { color: c.onDegree7th },
  section: {
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: c.muted,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
}));
