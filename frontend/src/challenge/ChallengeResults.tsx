import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { SectionLabel } from "@/src/components/Chip";
import { challengeBestKey, challengeSection, prettyLabel, type ChallengeBest, type ChallengeKind } from "@/src/challenge/rounds";
import { formatTime } from "@/src/ear/questions";
import { secs } from "@/src/ear/labels";
import { MIN_TRIES, loadHistory, since, targetStats, type Attempt, type Period } from "@/src/ear/stats";
import { useResultsVersion } from "@/src/results";
import { DEGREE_META, STRING_LABELS, TUNING, degreeKeyFromNum, pcOf } from "@/src/music/theory";
import { storage } from "@/src/utils/storage";
import { tr } from "@/src/i18n";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const PERIODS: Period[] = [30, 0, 7];
const HEAT = ["#34D399", "#FBBF24", "#F97316", "#B91C1C"];
const SPEED = [1800, 2600, 3300];
const LAST_FRET = 15;

const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

type Props = {
  kind: ChallengeKind;
  nameOf: (pc: number) => string;
  bottomPad: number;
  variant: string; // level + category (or “custom”): records are kept per variant
  lengths: (number | "sprint")[];
};

/** Results of a challenge kind: records, time per degree, neck map. */
export function ChallengeResults({ kind, nameOf, bottomPad, variant, lengths }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [bests, setBests] = useState<(ChallengeBest | null)[]>([]);
  const [period, setPeriod] = useState<Period>(30);
  const [mode, setMode] = useState<"speed" | "acc">("speed");

  const resultsV = useResultsVersion(); // results erased in Réglages: reload
  useEffect(() => {
    loadHistory().then((h) => setAttempts(h.attempts.filter((a) => a.s === challengeSection(kind))));
    Promise.all(
      lengths.map((n) =>
        storage.getItem(challengeBestKey(kind, variant, n), null).then((v) => {
          try {
            return typeof v === "string" ? (JSON.parse(v) as ChallengeBest) : null;
          } catch {
            return null;
          }
        }),
      ),
    ).then(setBests);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, variant, lengths.join(","), resultsV]);

  const from = since(period);
  const list = useMemo(() => (attempts ?? []).filter((a) => a.t >= from), [attempts, from]);
  const cells = useMemo(() => targetStats(list), [list]);
  const byDegree = useMemo(() => {
    const m = new Map<string, Attempt[]>();
    list.forEach((a) => {
      const k = a.label ?? "?";
      m.set(k, [...(m.get(k) ?? []), a]);
    });
    const num = (l: string) => parseInt(l.replace(/[^0-9]/g, ""), 10) || 0;
    return [...m.entries()]
      .map(([label, xs]) => ({ label, num: num(label), ms: median(xs.map((a) => a.ms)), missed: xs.filter((a) => a.errors > 0).length, tries: xs.length }))
      .sort((a, b) => a.num - b.num || a.label.length - b.label.length);
  }, [list]);
  const maxMs = Math.max(4000, ...byDegree.map((d) => d.ms));

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
      <View style={styles.labelRow}>
        <SectionLabel>{tr("Records")}</SectionLabel>
        <Pressable testID="ch-results-period" onPress={() => setPeriod(PERIODS[(PERIODS.indexOf(period) + 1) % PERIODS.length])} style={styles.periodPill}>
          <Text style={styles.periodText}>{period === 0 ? tr("Tout") : tr("{n} jours", { n: period })}</Text>
        </Pressable>
      </View>
      <View style={styles.records}>
        {lengths.map((n, i) => (
          <View key={String(n)} style={styles.recordCard}>
            <Text style={styles.muted}>{n === "sprint" ? tr("Contre-la-montre") : tr("{n} tours", { n })}</Text>
            <Text style={styles.recordTime}>
              {bests[i] ? (n === "sprint" ? tr("{n} tours", { n: bests[i]!.score ?? 0 }) : formatTime(bests[i]!.timeMs)) : "—"}
            </Text>
            <Text style={styles.small}>{bests[i] ? tr(bests[i]!.errors === 1 ? "{n} erreur" : "{n} erreurs", { n: bests[i]!.errors }) : tr("pas encore joué")}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tr("Par degré")}</Text>
        <Text style={styles.small}>{tr("Temps médian pour trouver chaque note · ratées")}</Text>
        {byDegree.length === 0 ? <Text style={styles.muted}>{tr("Aucune note trouvée sur cette période.")}</Text> : null}
        {byDegree.map((d) => {
          const meta = DEGREE_META[degreeKeyFromNum(d.num || 1)];
          const b = d.ms < SPEED[0] ? 0 : d.ms < SPEED[1] ? 1 : d.ms < SPEED[2] ? 2 : 3;
          return (
            <View key={d.label} style={styles.barRow}>
              <View style={[styles.badge, { backgroundColor: colors[meta.color] }]}>
                <Text style={[styles.badgeText, { color: colors[meta.on] }]}>{prettyLabel(d.label)}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${Math.round((d.ms / maxMs) * 100)}%`, backgroundColor: HEAT[b] }]} />
              </View>
              <Text style={styles.barValue}>
                {secs(d.ms)}
                <Text style={styles.small}>{` · ${d.missed}/${d.tries}`}</Text>
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <View style={styles.headRow}>
          <Text style={styles.cardTitle}>{tr("Carte du manche")}</Text>
          <View style={styles.segment}>
            {(["speed", "acc"] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && styles.segBtnOn]}>
                <Text style={[styles.segText, mode === m && styles.segTextOn]}>{m === "speed" ? tr("Vitesse") : tr("Justesse")}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.map}>
          {STRING_LABELS.map((label, s) => (
            <View key={s} style={styles.mapRow}>
              <Text style={styles.mapLabel}>{label}</Text>
              {Array.from({ length: LAST_FRET + 1 }, (_, f) => {
                const st = cells.get(`b${s}-${f}`);
                const b =
                  st && st.tries >= MIN_TRIES
                    ? mode === "speed"
                      ? Number.isFinite(st.medianMs)
                        ? st.medianMs < SPEED[0] ? 0 : st.medianMs < SPEED[1] ? 1 : st.medianMs < SPEED[2] ? 2 : 3
                        : 3
                      : st.rate === 0 ? 0 : st.rate < 0.2 ? 1 : st.rate < 0.4 ? 2 : 3
                    : -1;
                return (
                  <View key={f} style={[styles.mapCell, f === 0 && styles.mapOpen, b >= 0 ? { backgroundColor: HEAT[b] } : st ? styles.mapFew : null]}>
                    {b >= 0 ? <Text style={styles.mapText}>{nameOf(pcOf(TUNING[s] + f))}</Text> : null}
                  </View>
                );
              })}
            </View>
          ))}
          <View style={styles.mapRow}>
            <Text style={styles.mapLabel} />
            {Array.from({ length: LAST_FRET + 1 }, (_, f) => (
              <Text key={f} style={[styles.mapNum, f === 0 && styles.mapOpen]}>
                {[0, 3, 5, 7, 9, 12, 15].includes(f) ? f : ""}
              </Text>
            ))}
          </View>
        </View>
        <Text style={styles.small}>{tr("Gris : jamais demandée. Une case n’est coloriée qu’après 3 essais.")}</Text>
      </View>
      {attempts && list.length === 0 ? <Text style={styles.empty}>{tr("Aucune réponse sur cette période : lance une partie pour remplir ton tableau de bord.")}</Text> : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.md },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  periodPill: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  periodText: { fontFamily: fonts.display, fontSize: 13, color: c.onSurface },
  records: { flexDirection: "row", gap: spacing.sm },
  recordCard: { flex: 1, minWidth: 0, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)", gap: 2 },
  recordTime: { fontFamily: fonts.display, fontSize: 18, fontWeight: "700", color: c.brandPrimary, fontVariant: ["tabular-nums"] },
  card: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)", gap: spacing.sm },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface },
  muted: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  small: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary },
  empty: { fontFamily: fonts.text, fontSize: 14, color: c.onSurfaceTertiary, textAlign: "center" },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: { minWidth: 30, height: 24, paddingHorizontal: 4, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.display, fontSize: 12, fontWeight: "700" },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: c.surfaceTertiary },
  bar: { height: 10, borderRadius: 5 },
  barValue: { minWidth: 84, textAlign: "right", fontFamily: fonts.display, fontSize: 13, fontWeight: "700", color: c.onSurface },
  segment: { flexDirection: "row", padding: 3, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary },
  segBtn: { height: 28, paddingHorizontal: 10, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segBtnOn: { backgroundColor: c.brandPrimary },
  segText: { fontFamily: fonts.display, fontSize: 12, color: c.onSurfaceTertiary },
  segTextOn: { color: c.onBrandPrimary, fontWeight: "700" },
  map: { padding: 4, borderRadius: radius.sm, backgroundColor: c.fretboardWood, gap: 2 },
  mapRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  mapLabel: { width: 12, textAlign: "center", fontFamily: fonts.display, fontSize: 9, color: c.onSurfaceTertiary },
  mapCell: { flex: 1, minWidth: 0, height: 18, borderRadius: 3, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  mapOpen: { marginRight: 2 },
  mapFew: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: c.borderStrong },
  mapText: { fontFamily: fonts.display, fontSize: 7, fontWeight: "700", color: "#101114" },
  mapNum: { flex: 1, minWidth: 0, textAlign: "center", fontFamily: fonts.display, fontSize: 8, color: c.onSurfaceTertiary },
}));
