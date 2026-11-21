import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ArrowClockwise, CaretLeft, ChartBar, Trophy } from "phosphor-react-native";

import { formatTime, type Best } from "@/src/ear/questions";
import { secs, targetName } from "@/src/ear/labels";
import type { ProgressRow, ProgressTag, sessionProgress } from "@/src/ear/weakness";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { tr } from "@/src/i18n";

type Props = {
  sectionLabel: string;
  score: number;
  count: number;
  timeMs: number;
  best: Best | null;
  isRecord: boolean;
  onReplay: () => void;
  onSetup: () => void;
  onResults: () => void;
  replayLabel: string;
  progress: ReturnType<typeof sessionProgress> | null; // weak-points mode: “Tes progrès”
  nameOf: (pc: number) => string;
};

const TAG_TEXT: Record<ProgressTag, string> = {
  faster: "plus rapide",
  better: "mieux",
  stable: "stable",
  slower: "plus lente",
  again: "à revoir",
  new: "nouvelle",
};
const TAG_TONE: Record<ProgressTag, "up" | "flat" | "down"> = { faster: "up", better: "up", stable: "flat", slower: "down", again: "down", new: "flat" };

function beforeText(r: ProgressRow) {
  if (!r.before.tries) return tr("jamais jouée");
  if (r.before.missed && r.before.medianMs === null) return tr("ratée {m} fois sur {n}", { m: r.before.missed, n: r.before.tries });
  const t = r.before.medianMs !== null ? secs(r.before.medianMs) : "—";
  return r.before.missed ? `${t} · ${tr("ratée {m} fois sur {n}", { m: r.before.missed, n: r.before.tries })}` : t;
}
function afterText(r: ProgressRow) {
  if (r.after.skipped) return tr("passée");
  if (r.after.errors >= 2) return tr("ratée");
  return r.after.errors ? `${secs(r.after.ms)} · ${tr("2e essai")}` : secs(r.after.ms);
}

export function ResultView({ sectionLabel, score, count, timeMs, best, isRecord, onReplay, onSetup, onResults, replayLabel, progress, nameOf }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toneStyle = (t: "up" | "flat" | "down") =>
    t === "up" ? [styles.tag_up, styles.tagText_up] : t === "down" ? [styles.tag_down, styles.tagText_down] : [styles.tag_flat, styles.tagText_flat];
  return (
    <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false} testID="challenge-result">
      <Text style={styles.section}>{tr("{section} · terminé", { section: sectionLabel })}</Text>
      {isRecord ? (
        <View style={styles.record} testID="new-record-badge">
          <Trophy size={18} color={colors.onBrandPrimary} weight="fill" />
          <Text style={styles.recordText}>{tr("Nouveau record !")}</Text>
        </View>
      ) : null}
      <Text style={styles.score} testID="result-score">
        {score}
        <Text style={styles.scoreOf}>/{count}</Text>
      </Text>
      <Text style={styles.label}>{tr("notes trouvées")}</Text>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue} testID="result-time">{formatTime(timeMs)}</Text>
          <Text style={styles.statLabel}>{tr("Temps total")}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{(timeMs / 1000 / Math.max(1, count)).toFixed(1)} s</Text>
          <Text style={styles.statLabel}>{tr("Par note")}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue} testID="result-best">{best ? `${best.score} · ${formatTime(best.timeMs)}` : "—"}</Text>
          <Text style={styles.statLabel}>{tr("Record")}</Text>
        </View>
      </View>
      {progress && progress.rows.length ? (
        <View style={styles.progress} testID="result-progress">
          <View style={styles.progressHead}>
            <Text style={styles.progressTitle}>{tr("Tes progrès")}</Text>
            <Text style={styles.progressHint}>{tr("avant → aujourd’hui")}</Text>
          </View>
          {progress.rows.map((r, i) => (
            <View key={r.key} style={[styles.pRow, i < progress.rows.length - 1 && styles.pRowSep]}>
              <Text style={styles.pName} numberOfLines={1}>
                {targetName(r.sample, nameOf)}
              </Text>
              <Text style={styles.pText} numberOfLines={2}>
                {beforeText(r)} → <Text style={styles.pAfter}>{afterText(r)}</Text>
              </Text>
              <View style={[styles.pTag, toneStyle(TAG_TONE[r.tag])[0]]}>
                <Text style={[styles.pTagText, toneStyle(TAG_TONE[r.tag])[1]]}>{tr(TAG_TEXT[r.tag])}</Text>
              </View>
            </View>
          ))}
          {progress.left.length ? (
            <View style={styles.leftRow}>
              <Text style={styles.pLabel}>{tr("Sorties de la liste :")}</Text>
              {progress.left.map((k) => {
                const a = progress.rows.find((r) => r.key === k)?.sample;
                return a ? (
                  <View key={k} style={[styles.pTag, styles.tag_up]}>
                    <Text style={[styles.pTagText, styles.tagText_up]}>{targetName(a, nameOf)}</Text>
                  </View>
                ) : null;
              })}
            </View>
          ) : null}
          <Text style={styles.progressHint}>
            {tr("Points faibles restants : {n}", { n: progress.weakAfter })}
            {progress.weakAfter !== progress.weakBefore ? ` (${progress.weakAfter > progress.weakBefore ? "+" : "−"}${Math.abs(progress.weakAfter - progress.weakBefore)})` : ""}
          </Text>
        </View>
      ) : null}
      <Pressable testID="result-replay-button" onPress={onReplay} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <ArrowClockwise size={20} color={colors.onBrandPrimary} weight="bold" />
        <Text style={styles.primaryText}>{replayLabel}</Text>
      </Pressable>
      <Pressable testID="result-setup-button" onPress={onSetup} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <CaretLeft size={20} color={colors.onSurface} weight="bold" />
        <Text style={styles.secondaryText}>{tr("Retour aux jeux")}</Text>
      </Pressable>
      <Pressable testID="result-results-button" onPress={onResults} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <ChartBar size={20} color={colors.onSurface} />
        <Text style={styles.secondaryText}>{tr("Voir mes résultats")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, alignItems: "center", justifyContent: "center" },
  progress: { alignSelf: "stretch", marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.brandPrimary, backgroundColor: "rgba(28,30,36,0.80)", gap: 2 },
  progressHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  progressTitle: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onSurface },
  progressHint: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary, marginTop: 4 },
  pRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  pRowSep: { borderBottomWidth: 1, borderBottomColor: c.border },
  pName: { minWidth: 44, maxWidth: 110, fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onSurface },
  pText: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  pLabel: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  pAfter: { color: c.onSurface, fontWeight: "700" },
  pTag: { height: 24, paddingHorizontal: 9, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  pTagText: { fontFamily: fonts.text, fontSize: 12, fontWeight: "600" },
  tag_up: { backgroundColor: "#34D399" },
  tag_flat: { backgroundColor: c.surfaceTertiary },
  tag_down: { backgroundColor: "#F97316" },
  tagText_up: { color: "#06281D" },
  tagText_flat: { color: c.onSurfaceTertiary },
  tagText_down: { color: "#2A1203" },
  leftRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm },
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
