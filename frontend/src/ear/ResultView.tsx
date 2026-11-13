import React from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowClockwise, Faders, Trophy } from "phosphor-react-native";

import { formatTime, type Best } from "@/src/ear/questions";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Props = {
  sectionLabel: string;
  score: number;
  count: number;
  timeMs: number;
  best: Best | null;
  isRecord: boolean;
  onReplay: () => void;
  onSetup: () => void;
};

export function ResultView({ sectionLabel, score, count, timeMs, best, isRecord, onReplay, onSetup }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} testID="challenge-result">
      <Text style={styles.section}>{sectionLabel} · terminé</Text>
      {isRecord ? (
        <View style={styles.record} testID="new-record-badge">
          <Trophy size={18} color={colors.onBrandPrimary} weight="fill" />
          <Text style={styles.recordText}>Nouveau record !</Text>
        </View>
      ) : null}
      <Text style={styles.score} testID="result-score">
        {score}
        <Text style={styles.scoreOf}>/{count}</Text>
      </Text>
      <Text style={styles.label}>notes trouvées</Text>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue} testID="result-time">{formatTime(timeMs)}</Text>
          <Text style={styles.statLabel}>Temps total</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{(timeMs / 1000 / Math.max(1, count)).toFixed(1)} s</Text>
          <Text style={styles.statLabel}>Par note</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue} testID="result-best">{best ? `${best.score} · ${formatTime(best.timeMs)}` : "—"}</Text>
          <Text style={styles.statLabel}>Record</Text>
        </View>
      </View>
      <Pressable testID="result-replay-button" onPress={onReplay} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <ArrowClockwise size={20} color={colors.onBrandPrimary} weight="bold" />
        <Text style={styles.primaryText}>Rejouer</Text>
      </Pressable>
      <Pressable testID="result-setup-button" onPress={onSetup} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Faders size={20} color={colors.onSurface} />
        <Text style={styles.secondaryText}>Changer les réglages</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { flex: 1, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  section: { fontFamily: fonts.display, fontSize: 15, color: c.onSurfaceTertiary },
  record: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: c.brandPrimary,
  },
  recordText: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700", color: c.onBrandPrimary },
  score: { fontFamily: fonts.display, fontSize: 88, fontWeight: "700", color: c.onSurface, marginTop: spacing.md },
  scoreOf: { fontSize: 36, color: c.muted },
  label: { fontFamily: fonts.text, fontSize: 14, color: c.onSurfaceTertiary },
  stats: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl, alignSelf: "stretch" },
  stat: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, alignItems: "center" },
  statValue: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface },
  statLabel: { fontFamily: fonts.text, fontSize: 12, color: c.muted, marginTop: 2 },
  primary: {
    alignSelf: "stretch",
    marginTop: spacing.xl,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: c.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryText: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onBrandPrimary },
  secondary: {
    alignSelf: "stretch",
    marginTop: spacing.sm,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTertiary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  secondaryText: { fontFamily: fonts.display, fontSize: 15, color: c.onSurface },
  pressed: { opacity: 0.85 },
}));
