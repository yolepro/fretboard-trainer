import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { CaretLeft, CaretRight, Crosshair } from "phosphor-react-native";

import { Chip, ChipRow, SectionLabel } from "@/src/components/Chip";
import { SECTIONS, bestKey, formatTime, intervalName, positionText, type Best, type Section } from "@/src/ear/questions";
import { MIN_TRIES, loadHistory, since, targetStats, tops, type Attempt, type Period, type SessionRec, type TargetStat } from "@/src/ear/stats";
import { STRING_LABELS, TUNING, octaveOf, pcOf } from "@/src/music/theory";
import { storage } from "@/src/utils/storage";
import { getLang, tr } from "@/src/i18n";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Props = {
  section: Section;
  onSection: (s: Section) => void;
  nameOf: (pc: number) => string;
  bottomPad: number;
  onTrainWeak: () => void;
  onTrainZone: (keys: string[]) => void;
};

type View_ = "home" | "map" | "tops";
type Mode = "speed" | "acc";

const COUNTS = [5, 10, 20];
const PERIODS: Period[] = [7, 30, 0];
// Green (good) → dark red (bad); the steps also differ in lightness.
const HEAT = ["#34D399", "#FBBF24", "#F97316", "#B91C1C"];
const HEAT_ON = ["#06281D", "#2A1C02", "#2A1203", "#FFFFFF"];
const SPEED_STEPS = [1800, 2600, 3300];
const RATE_STEPS = [0, 0.2, 0.4];

const secs = (ms: number) => {
  const t = (ms / 1000).toFixed(1);
  return `${getLang() === "fr" ? t.replace(".", ",") : t} s`;
};
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const periodLabel = (p: Period) => (p === 0 ? tr("Tout") : tr("{n} jours", { n: p }));

function whenText(at?: number) {
  if (!at) return "";
  const days = Math.floor((Date.now() - at) / 86400000);
  return days <= 0 ? tr("aujourd’hui") : days === 1 ? tr("hier") : tr("il y a {n} jours", { n: days });
}

function speedBucket(ms: number) {
  return ms < SPEED_STEPS[0] ? 0 : ms < SPEED_STEPS[1] ? 1 : ms < SPEED_STEPS[2] ? 2 : 3;
}
function rateBucket(rate: number) {
  return rate <= RATE_STEPS[0] ? 0 : rate < RATE_STEPS[1] ? 1 : rate < RATE_STEPS[2] ? 2 : 3;
}

export function ResultsPanel({ section, onSection, nameOf, bottomPad, onTrainWeak, onTrainZone }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [view, setView] = useState<View_>("home");
  const [period, setPeriod] = useState<Period>(30);
  const [mode, setMode] = useState<Mode>("speed");
  const [history, setHistory] = useState<{ attempts: Attempt[]; sessions: SessionRec[] } | null>(null);
  const [bests, setBests] = useState<(Best | null)[]>([]);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);
  useEffect(() => {
    Promise.all(
      COUNTS.map((n) =>
        storage.getItem(bestKey(section, n), null).then((v) => {
          try {
            return typeof v === "string" ? (JSON.parse(v) as Best) : null;
          } catch {
            return null;
          }
        }),
      ),
    ).then(setBests);
    setSel(null);
    if (section !== "board" && view === "map") setView("home");
  }, [section, view]);

  const from = since(period);
  const attempts = useMemo(() => (history?.attempts ?? []).filter((a) => a.s === section && a.t >= from), [history, section, from]);
  const sessions = useMemo(() => (history?.sessions ?? []).filter((x) => x.s === section && x.t >= from).slice(-10), [history, section, from]);
  const stats = useMemo(() => targetStats(attempts), [attempts]);
  const top = useMemo(() => tops([...stats.values()]), [stats]);

  const nameOfStat = (st: TargetStat) => {
    const a = st.sample;
    if (a.midi !== undefined) return `${nameOf(pcOf(a.midi))}${octaveOf(a.midi)}`;
    if (a.s === "interval" && a.label) return intervalName(a.label);
    return cap(tr(a.label ?? "?"));
  };
  const whereOfStat = (st: TargetStat) => {
    const a = st.sample;
    if (a.string !== undefined && a.fret !== undefined) return positionText({ string: a.string, fret: a.fret });
    if (a.s === "degree" && a.sub) return tr(a.sub);
    if (a.s === "interval" && a.label) return a.label;
    return "";
  };

  const periodChip = (
    <Pressable
      testID="results-period"
      onPress={() => setPeriod(PERIODS[(PERIODS.indexOf(period) + 1) % PERIODS.length])}
      style={({ pressed }) => [styles.periodPill, pressed && styles.pressed]}
      accessibilityLabel={tr("Période")}
    >
      <Text style={styles.periodText}>{periodLabel(period)}</Text>
    </Pressable>
  );

  const segment = (
    <View style={styles.segment}>
      {(["speed", "acc"] as const).map((m) => (
        <Pressable key={m} testID={`results-mode-${m}`} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && styles.segBtnOn]}>
          <Text style={[styles.segText, mode === m && styles.segTextOn]}>{m === "speed" ? tr("Vitesse") : tr("Justesse")}</Text>
        </Pressable>
      ))}
    </View>
  );

  const subHeader = (title: string) => (
    <View style={styles.subHeader}>
      <Pressable testID="results-back" onPress={() => setView("home")} style={styles.backBtn} accessibilityLabel={tr("Retour")}>
        <CaretLeft size={18} color={colors.onSurface} weight="bold" />
      </Pressable>
      <Text style={styles.subTitle} numberOfLines={1}>
        {title}
      </Text>
      {periodChip}
    </View>
  );

  // ---------- Neck map (Manche) ----------
  if (view === "map") {
    const cell = (s: number, f: number) => stats.get(`b${s}-${f}`);
    const selStat = sel ? stats.get(sel) : undefined;
    const [ss, sf] = (sel ?? "").slice(1).split("-").map(Number);
    // “Travailler cette zone”: the touched fret ± 2, on its string and the neighbouring ones.
    const zf0 = Math.max(0, sf - 2);
    const zf1 = Math.min(12, sf + 2);
    const zs0 = Math.max(0, ss - 1);
    const zs1 = Math.min(5, ss + 1);
    const inZone = (s: number, f: number) => !sel || (s >= zs0 && s <= zs1 && f >= zf0 && f <= zf1);
    const zoneKeys = () => {
      const keys: string[] = [];
      for (let s = zs0; s <= zs1; s++) for (let f = zf0; f <= zf1; f++) keys.push(`b${s}-${f}`);
      return keys;
    };
    const zoneStrings = Array.from({ length: zs1 - zs0 + 1 }, (_, i) => STRING_LABELS[zs1 - i]).join(", ");
    return (
      <View style={styles.flex}>
        {subHeader(tr("Carte du manche"))}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
          {segment}
          <View style={styles.neck} testID="results-neck">
            {STRING_LABELS.map((label, s) => (
              <View key={s} style={styles.neckRow}>
                <Text style={styles.neckLabel}>{label}</Text>
                {Array.from({ length: 13 }, (_, f) => {
                  const st = cell(s, f);
                  const b = st && st.tries >= MIN_TRIES ? (mode === "speed" ? (Number.isFinite(st.medianMs) ? speedBucket(st.medianMs) : 3) : rateBucket(st.rate)) : -1;
                  const id = `b${s}-${f}`;
                  return (
                    <Pressable
                      key={f}
                      testID={`results-cell-${s}-${f}`}
                      onPress={() => setSel(id)}
                      style={[
                        styles.cell,
                        f === 0 && styles.cellOpen,
                        b >= 0 ? { backgroundColor: HEAT[b] } : st ? styles.cellFew : null,
                        sel && inZone(s, f) && styles.cellZone,
                        !inZone(s, f) && styles.cellOut,
                        sel === id && styles.cellSel,
                      ]}
                    >
                      {b >= 0 ? (
                        <Text style={[styles.cellText, { color: HEAT_ON[b] }]} numberOfLines={1}>
                          {nameOf(pcOf(TUNING[s] + f))}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <View style={styles.neckRow}>
              <Text style={styles.neckLabel} />
              {Array.from({ length: 13 }, (_, f) => (
                <Text key={f} style={[styles.fretNum, f === 0 && styles.cellOpen]}>
                  {[0, 3, 5, 7, 9, 12].includes(f) ? f : ""}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.legend}>
            {(mode === "speed" ? [`< ${secs(SPEED_STEPS[0])}`, `< ${secs(SPEED_STEPS[1])}`, `< ${secs(SPEED_STEPS[2])}`, `≥ ${secs(SPEED_STEPS[2])}`] : [tr("0 raté"), "< 20 %", "20–40 %", "> 40 %"]).map((l, i) => (
              <View key={l} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: HEAT[i] }]} />
                <Text style={styles.legendText}>{l}</Text>
              </View>
            ))}
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: colors.surfaceTertiary }]} />
              <Text style={styles.legendText}>{tr("jamais")}</Text>
            </View>
          </View>

          {sel ? (
            <View style={styles.card} testID="results-cell-detail">
              <View style={styles.detailHead}>
                <Text style={styles.detailNote}>{`${nameOf(pcOf(TUNING[ss] + sf))}${octaveOf(TUNING[ss] + sf)}`}</Text>
                <Text style={styles.muted}>{positionText({ string: ss, fret: sf })}</Text>
              </View>
              <View style={styles.detailGrid}>
                <Figure label={tr("Essais")} value={String(selStat?.tries ?? 0)} />
                <Figure label={tr("Temps médian")} value={selStat && Number.isFinite(selStat.medianMs) ? secs(selStat.medianMs) : "—"} />
                <Figure label={tr("Ratée")} value={selStat ? `${selStat.missed} / ${selStat.tries}` : "—"} />
              </View>
              {!selStat ? (
                <Text style={styles.muted}>{tr("Jamais demandée sur cette période.")}</Text>
              ) : selStat.tries < MIN_TRIES ? (
                <Text style={styles.muted}>{tr("Pas encore assez d’essais pour la classer (3 minimum).")}</Text>
              ) : null}
              <Pressable testID="results-train-zone" onPress={() => onTrainZone(zoneKeys())} style={({ pressed }) => [styles.trainBtn, pressed && styles.pressed]}>
                <Crosshair size={18} color={colors.brandPrimary} weight="bold" />
                <Text style={styles.trainText}>{tr("Travailler cette zone")}</Text>
              </Pressable>
              <Text style={styles.muted}>
                {tr("Cases {a} à {b}, cordes {s} · le jeu pioche dans le cadre orange, les cases les plus faibles plus souvent.", { a: zf0, b: zf1, s: zoneStrings })}
              </Text>
            </View>
          ) : null}
          <Text style={styles.foot}>{tr("Touche une case pour voir son détail. Gris : jamais demandée. Une case n’est coloriée qu’après 3 essais.")}</Text>
        </ScrollView>
      </View>
    );
  }

  // ---------- Top lists ----------
  if (view === "tops") {
    const groups =
      mode === "speed"
        ? [
            { title: tr("Les plus rapides"), items: top.fast, color: HEAT[0], value: (s: TargetStat) => secs(s.medianMs), bar: (s: TargetStat) => s.medianMs / 6000 },
            { title: tr("Les plus lentes"), items: top.slow, color: HEAT[2], value: (s: TargetStat) => secs(s.medianMs), bar: (s: TargetStat) => s.medianMs / 6000 },
          ]
        : [
            { title: tr("Les plus sûres · jamais ratées"), items: top.safe, color: HEAT[0], value: (s: TargetStat) => `0 / ${s.tries}`, bar: () => 1 },
            { title: tr("Les plus fragiles · ratées / essais"), items: top.fragile, color: HEAT[2], value: (s: TargetStat) => `${s.missed} / ${s.tries}`, bar: (s: TargetStat) => s.rate },
          ];
    return (
      <View style={styles.flex}>
        {subHeader(tr("Mes notes"))}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
          {segment}
          {top.ranked === 0 ? (
            <Text style={styles.empty}>{tr("Pas encore assez de réponses : une note est classée après 3 essais.")}</Text>
          ) : (
            groups.map((g) => (
              <View key={g.title} style={styles.group}>
                <SectionLabel>{g.title}</SectionLabel>
                <View style={styles.card}>
                  {g.items.length === 0 ? <Text style={styles.muted}>{tr("Aucune pour l’instant.")}</Text> : null}
                  {g.items.map((st, i) => (
                    <View key={st.key} style={[styles.topRow, i < g.items.length - 1 && styles.topRowSep]}>
                      <Text style={styles.rank}>{i + 1}</Text>
                      <View style={styles.topMid}>
                        <View style={styles.topNameRow}>
                          <Text style={styles.topName} numberOfLines={1}>
                            {nameOfStat(st)}
                          </Text>
                          <Text style={styles.topWhere} numberOfLines={1}>
                            {whereOfStat(st)}
                          </Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View style={[styles.bar, { width: `${Math.round(Math.max(0.04, Math.min(1, g.bar(st))) * 100)}%`, backgroundColor: g.color }]} />
                        </View>
                      </View>
                      <Text style={styles.topValue}>{g.value(st)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
          {section !== "chords" ? (
            <Pressable testID="results-train-weak" onPress={onTrainWeak} style={({ pressed }) => [styles.trainBtn, pressed && styles.pressed]}>
              <Crosshair size={18} color={colors.brandPrimary} weight="bold" />
              <Text style={styles.trainText}>{tr("Travailler mes points faibles")}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.foot}>{tr("Une note n’est classée qu’après 3 essais. Temps = médiane, sans les pauses du chrono. Une note passée compte comme ratée.")}</Text>
        </ScrollView>
      </View>
    );
  }

  // ---------- Home: records, progress, links ----------
  const perNote = sessions.map((x) => x.ms / Math.max(1, x.count));
  const half = Math.floor(perNote.length / 2);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const trend = perNote.length >= 4 ? Math.round((avg(perNote.slice(half)) / avg(perNote.slice(0, half)) - 1) * 100) : null;
  const W = 300;
  const H = 80;
  const lo = Math.min(...perNote);
  const hi = Math.max(...perNote);
  const pts = perNote.map((v, i) => ({
    x: perNote.length > 1 ? (i * W) / (perNote.length - 1) : W / 2,
    y: 8 + (hi > lo ? ((v - lo) / (hi - lo)) * (H - 16) : (H - 16) / 2),
    good: sessions[i].score / sessions[i].count >= 0.8,
  }));

  return (
    <View style={styles.flex}>
      <ChipRow testID="results-section-selector">
        {SECTIONS.map((s) => (
          <Chip key={s.id} testID={`results-section-${s.id}`} label={tr(s.label)} selected={section === s.id} onPress={() => onSection(s.id)} />
        ))}
      </ChipRow>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{tr("Records")}</Text>
          {periodChip}
        </View>
        <View style={styles.records}>
          {COUNTS.map((n, i) => {
            const b = bests[i];
            return (
              <View key={n} style={styles.recordCard} testID={`results-record-${n}`}>
                <Text style={styles.muted}>{tr("{n} notes", { n })}</Text>
                <Text style={styles.recordScore}>{b ? `${b.score}/${n}` : "—"}</Text>
                <Text style={styles.recordTime}>{b ? formatTime(b.timeMs) : " "}</Text>
                <Text style={styles.recordWhen} numberOfLines={1}>
                  {b ? whenText(b.at) : tr("pas encore joué")}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.card} testID="results-progress">
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{tr("Dernières parties")}</Text>
            {trend !== null ? (
              <Text style={[styles.trend, { color: trend <= 0 ? HEAT[0] : HEAT[2] }]}>{tr("{p} % de temps par note", { p: `${trend > 0 ? "+" : "−"}${Math.abs(trend)}` })}</Text>
            ) : null}
          </View>
          {perNote.length >= 2 ? (
            <>
              <Svg width="100%" height={H} viewBox={`-6 0 ${W + 12} ${H}`} preserveAspectRatio="none">
                {[0.25, 0.5, 0.75].map((k) => (
                  <Line key={k} x1={-6} x2={W + 6} y1={H * k} y2={H * k} stroke={colors.border} strokeWidth={1} />
                ))}
                <Polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={colors.brandPrimary} strokeWidth={2.5} strokeLinejoin="round" />
                {pts.map((p, i) => (
                  <Circle key={i} cx={p.x} cy={p.y} r={4} fill={p.good ? colors.brandPrimary : colors.surface} stroke={colors.brandPrimary} strokeWidth={2} />
                ))}
              </Svg>
              <Text style={styles.foot}>{tr("Temps par note (plus bas = plus rapide) · point plein : 80 % de bonnes réponses ou plus")}</Text>
            </>
          ) : (
            <Text style={styles.muted}>{tr("Termine au moins 2 parties pour voir ta progression.")}</Text>
          )}
        </View>

        {section === "board" ? (
          <Pressable testID="results-open-map" onPress={() => setView("map")} style={({ pressed }) => [styles.card, styles.linkCard, pressed && styles.pressed]}>
            <View style={styles.miniNeck}>
              {Array.from({ length: 6 }, (_, s) => (
                <View key={s} style={styles.miniRow}>
                  {Array.from({ length: 13 }, (_, f) => {
                    const st = stats.get(`b${s}-${f}`);
                    const b = st && st.tries >= MIN_TRIES ? (Number.isFinite(st.medianMs) ? speedBucket(st.medianMs) : 3) : -1;
                    return <View key={f} style={[styles.miniCell, { backgroundColor: b >= 0 ? HEAT[b] : colors.surfaceTertiary }]} />;
                  })}
                </View>
              ))}
            </View>
            <View style={styles.linkText}>
              <Text style={styles.cardTitle}>{tr("Carte du manche")}</Text>
              <Text style={styles.muted}>{tr("Vitesse et justesse, case par case")}</Text>
            </View>
            <CaretRight size={18} color={colors.onSurfaceTertiary} weight="bold" />
          </Pressable>
        ) : null}

        <Pressable testID="results-open-tops" onPress={() => setView("tops")} style={({ pressed }) => [styles.card, styles.linkCard, pressed && styles.pressed]}>
          <View style={styles.linkText}>
            <Text style={styles.cardTitle}>{tr("Notes rapides, lentes, fragiles")}</Text>
            <Text style={styles.muted} numberOfLines={2}>
              {top.slow[0] || top.fragile[0]
                ? [top.slow[0] && tr("Plus lente : {x}", { x: nameOfStat(top.slow[0]) }), top.fragile[0] && tr("plus ratée : {x}", { x: nameOfStat(top.fragile[0]) })].filter(Boolean).join(" · ")
                : tr("Classement après 3 essais par note")}
            </Text>
          </View>
          <CaretRight size={18} color={colors.onSurfaceTertiary} weight="bold" />
        </Pressable>

        {history && attempts.length === 0 ? <Text style={styles.empty}>{tr("Aucune réponse sur cette période : lance une partie pour remplir ton tableau de bord.")}</Text> : null}
      </ScrollView>
    </View>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.figure}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.figureValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.md },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontFamily: fonts.text, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "600", color: c.onSurfaceTertiary },
  periodPill: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  periodText: { fontFamily: fonts.display, fontSize: 13, color: c.onSurface },
  records: { flexDirection: "row", gap: spacing.sm },
  recordCard: { flex: 1, minWidth: 0, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)", gap: 2 },
  recordScore: { fontFamily: fonts.display, fontSize: 22, fontWeight: "700", color: c.onSurface },
  recordTime: { fontFamily: fonts.display, fontSize: 14, color: c.brandPrimary, fontVariant: ["tabular-nums"] },
  recordWhen: { fontFamily: fonts.text, fontSize: 11, color: c.onSurfaceTertiary },
  card: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)", gap: spacing.sm },
  cardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface },
  trend: { fontFamily: fonts.text, fontSize: 12, fontWeight: "600" },
  muted: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  foot: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary, lineHeight: 17 },
  empty: { fontFamily: fonts.text, fontSize: 14, color: c.onSurfaceTertiary, textAlign: "center", marginTop: spacing.md },
  linkCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  linkText: { flex: 1, minWidth: 0, gap: 2 },
  miniNeck: { gap: 2 },
  miniRow: { flexDirection: "row", gap: 2 },
  miniCell: { width: 7, height: 7, borderRadius: 2 },
  subHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  subTitle: { flex: 1, fontFamily: fonts.display, fontSize: 20, fontWeight: "700", color: c.onSurface },
  segment: { flexDirection: "row", padding: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  segBtn: { flex: 1, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segBtnOn: { backgroundColor: c.brandPrimary },
  segText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurfaceTertiary },
  segTextOn: { color: c.onBrandPrimary, fontWeight: "700" },
  neck: { padding: 6, paddingTop: 10, borderRadius: radius.md, backgroundColor: c.fretboardWood, gap: 3 },
  neckRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  neckLabel: { width: 14, textAlign: "center", fontFamily: fonts.display, fontSize: 11, fontWeight: "600", color: c.onSurfaceTertiary },
  cell: { flex: 1, minWidth: 0, height: 30, borderRadius: 6, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  cellOpen: { marginRight: 3 },
  cellFew: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: c.borderStrong },
  cellZone: { borderColor: c.brandPrimary },
  cellOut: { opacity: 0.35 },
  cellSel: { borderWidth: 2, borderStyle: "solid", borderColor: c.onSurface },
  cellText: { fontFamily: fonts.display, fontSize: 9, fontWeight: "700" },
  fretNum: { flex: 1, minWidth: 0, textAlign: "center", fontFamily: fonts.display, fontSize: 10, color: c.onSurfaceTertiary },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceSecondary },
  detailHead: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, flexWrap: "wrap" },
  detailNote: { fontFamily: fonts.display, fontSize: 26, fontWeight: "700", color: c.onSurface },
  detailGrid: { flexDirection: "row", gap: spacing.sm },
  figure: { flex: 1, gap: 2 },
  figureValue: { fontFamily: fonts.display, fontSize: 18, fontWeight: "700", color: c.onSurface },
  group: { gap: spacing.xs },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  topRowSep: { borderBottomWidth: 1, borderBottomColor: c.border },
  rank: { width: 18, fontFamily: fonts.display, fontSize: 13, fontWeight: "700", color: c.onSurfaceTertiary },
  topMid: { flex: 1, minWidth: 0, gap: 4 },
  topNameRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  topName: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface, flexShrink: 1 },
  topWhere: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary, flexShrink: 1 },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: c.surfaceTertiary },
  bar: { height: 4, borderRadius: 2 },
  topValue: { minWidth: 56, textAlign: "right", fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onSurface, fontVariant: ["tabular-nums"] },
  trainBtn: { height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: c.brandPrimary, backgroundColor: c.brandTertiary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  trainText: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onSurface },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
}));
