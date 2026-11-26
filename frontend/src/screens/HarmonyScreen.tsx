import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowClockwise, CaretLeft, Play, Stop } from "phosphor-react-native";

import { LANDSCAPE_NAV_W } from "@/src/components/AppTabBar";
import { Fretboard, fitScale, type ChordMark } from "@/src/components/Fretboard";
import { KeyWheel } from "@/src/components/KeyWheel";
import { Pill, PillRow } from "@/src/components/Pill";
import { StudioBackground } from "@/src/components/StudioBackground";
import { initAudio, playChordNotes, playNote, preloadNotes, stopChordNotes } from "@/src/audio/sampler";
import { barHits } from "@/src/audio/chordPlay";
import { resumeWebAudio } from "@/src/audio/webAudio";
import { chordNum } from "@/src/music/cadences";
import {
  FN_ORDER,
  FUNCTIONS,
  START,
  SWAP_NOTE,
  SYMBOL,
  commonPcs,
  degreeChords,
  degreeVoicing,
  fnOfDegree,
  progName,
  swapDegree,
  whyOf,
  type Bass,
  type DegreeChord,
  type Fn,
} from "@/src/music/harmony";
import { TUNING, cellKey, degreeKeyFromNum, type BoxWindow, type DegreeKey, type IntervalDef } from "@/src/music/theory";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { tr } from "@/src/i18n";

const NO_DEGREES = new Map<number, IntervalDef>();
const NO_LAYERS = new Set<DegreeKey>();
const BASSES: Bass[] = ["auto", 6, 5];
const TEMPO = 80;
const DEGREE_RUN = [0, 1, 2, 3, 4, 5, 6, 0];
const pretty = (l: string) => l.replace(/^b/, "♭");

/** Explorer › Harmonie › Les degrés de la gamme: the 7 chords of a key, their function, and which ones replace each other. */
export function HarmonyScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { settings, nameOf } = useSettings();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const [keyPc, setKeyPc] = useState(0); // C
  const [keyOpen, setKeyOpen] = useState(false);
  const [tab, setTab] = useState<"degrees" | "functions">("degrees");
  const [sel, setSel] = useState(1); // IIm7
  const [bass, setBass] = useState<Bass>("auto");
  const [prog, setProg] = useState<number[]>(START);
  const [slot, setSlot] = useState(0);
  const [lastFn, setLastFn] = useState<Fn>("SD");
  const [playing, setPlaying] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const chords = useMemo(() => degreeChords(keyPc), [keyPc]);
  const nameOfChord = (ch: DegreeChord) => `${nameOf(ch.root)}${SYMBOL[ch.quality]}`;
  const notesOf = (pcs: number[]) => pcs.map((p) => nameOf(p)).join(" ");
  const shown = tab === "degrees" ? chords[sel] : chords[prog[slot]];
  const v = useMemo(() => degreeVoicing(shown, bass), [shown, bass]);
  const fn = FUNCTIONS[shown.fn];

  const neck = useMemo(() => {
    const marks = new Map<string, ChordMark>();
    v.muted.forEach((s) => marks.set(cellKey(s, 0), { kind: "muted", degree: "root", label: "×" }));
    v.notes.forEach((n) => marks.set(cellKey(n.string, n.fret), { kind: "played", degree: degreeKeyFromNum(chordNum(shown, TUNING[n.string] + n.fret)), label: pretty(n.label) }));
    const window: BoxWindow = { min: v.min, max: v.max, cells: new Set(v.notes.map((n) => cellKey(n.string, n.fret))) };
    return { marks, window };
  }, [v, shown]);

  useEffect(() => {
    preloadNotes(Array.from({ length: 30 }, (_, i) => 40 + i));
    return () => {
      timers.current.forEach(clearTimeout);
      stopChordNotes();
    };
  }, []);
  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    stopChordNotes();
    setPlaying(false);
  };
  useEffect(stop, [keyPc, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const midisOf = (ch: DegreeChord) =>
    degreeVoicing(ch, bass)
      .notes.map((n) => TUNING[n.string] + n.fret)
      .sort((a, b) => a - b);
  /** Degrees: the chord as an arpeggio, then strummed. Fonctions: the progression, one bar per chord. */
  const play = () => {
    if (playing) return stop();
    resumeWebAudio();
    initAudio();
    const beat = 60000 / TEMPO;
    const seq: { midi: number; at: number }[] = [];
    let total = 0;
    if (tab === "degrees") {
      // FS-33: the 7 degrees in a row, back to I at the end, one bar each; its tile lights up.
      DEGREE_RUN.forEach((d, i) => {
        const t0 = i * 4 * beat;
        seq.push(...barHits(midisOf(chords[d]), settings.chordStyle, t0, beat));
        timers.current.push(setTimeout(() => setSel(d), t0));
      });
      total = DEGREE_RUN.length * 4 * beat;
    } else {
      prog.forEach((d, i) => {
        const t0 = i * 4 * beat;
        seq.push(...barHits(midisOf(chords[d]), settings.chordStyle, t0, beat));
        timers.current.push(setTimeout(() => setSlot(i), t0));
      });
      total = prog.length * 4 * beat;
    }
    playChordNotes(seq, settings.volume * 0.85);
    timers.current.push(setTimeout(() => setPlaying(false), total));
    setPlaying(true);
  };

  /** Touching a degree's tile: select it and hear it (as set in Réglages › Accords : façon de jouer). */
  const pickDegree = (i: number) => {
    stop();
    setSel(i);
    resumeWebAudio();
    initAudio();
    const beat = 60000 / TEMPO;
    playChordNotes(barHits(midisOf(chords[i]), settings.chordStyle, 0, beat), settings.volume * 0.85);
  };

  const onNotePress = (midi: number) => {
    resumeWebAudio();
    playNote(midi, settings.volume);
  };
  const tapSlot = (i: number) => {
    stop();
    const p = prog.slice();
    p[i] = swapDegree(p[i]);
    setProg(p);
    setSlot(i);
    setLastFn(fnOfDegree(p[i]));
  };

  const same = chords.filter((c) => c.fn === shown.fn && c.deg !== shown.deg);
  const bassLabel = bass === "auto" ? tr("Basse : la plus grave") : tr("Basse sur la corde {n}", { n: bass });
  const name = progName(prog);

  const tag = (f: Fn) => <Text style={[styles.tag, { backgroundColor: FUNCTIONS[f].color }]}>{f}</Text>;

  // ---------- Pieces shared by portrait and landscape ----------
  const backBtn = (
    <Pressable testID="harmony-back" onPress={onBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} accessibilityLabel={tr("Explorer")} hitSlop={6}>
      <CaretLeft size={20} color={colors.onSurface} weight="bold" />
    </Pressable>
  );
  const pills = (
    <>
      <Pill testID="pill-key" label={tr("{k} majeur", { k: nameOf(keyPc) })} accent onPress={() => setKeyOpen(true)} />
      <Pill testID="pill-bass" label={bassLabel} onPress={() => setBass(BASSES[(BASSES.indexOf(bass) + 1) % BASSES.length])} />
    </>
  );
  const segment = (compact: boolean) => (
    <View style={[styles.segment, compact && styles.segmentCompact]}>
      {(["degrees", "functions"] as const).map((t) => (
        <Pressable key={t} testID={`harmony-tab-${t}`} onPress={() => setTab(t)} style={[styles.segBtn, compact && styles.segBtnCompact, tab === t && styles.segBtnOn]}>
          <Text style={[styles.segText, compact && styles.segTextCompact, tab === t && styles.segTextOn]} numberOfLines={1}>
            {t === "degrees" ? (compact ? tr("Degrés") : tr("Les 7 degrés")) : tr("Fonctions")}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  const playIcon = playing ? <Stop size={20} color={colors.onBrandPrimary} weight="fill" /> : <Play size={20} color={colors.onBrandPrimary} weight="fill" />;
  const playLabel = tab === "degrees" ? tr("Écouter les 7 degrés") : tr("Écouter la progression");

  const tiles = (h: number) => (
    <View style={styles.tiles}>
      {chords.map((c, i) => {
        const f = FUNCTIONS[c.fn];
        const on = i === sel;
        return (
          <Pressable
            key={i}
            testID={`harmony-degree-${i}`}
            onPress={() => pickDegree(i)}
            style={({ pressed }) => [styles.tile, { height: h }, on && { backgroundColor: f.bg, borderColor: f.color, borderWidth: 2 }, pressed && styles.pressed]}
          >
            <Text style={[styles.tileRoman, { color: f.color }]} numberOfLines={1} adjustsFontSizeToFit>
              {c.roman}
            </Text>
            <Text style={styles.tileChord} numberOfLines={1} adjustsFontSizeToFit>
              {nameOfChord(c)}
            </Text>
            {tag(c.fn)}
          </Pressable>
        );
      })}
    </View>
  );
  const card = (
    <View style={[styles.card, { borderColor: fn.color }]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>
          {shown.roman} · {nameOfChord(shown)}
        </Text>
        <Text style={[styles.fnName, { color: fn.color }]}>{tr(fn.name)}</Text>
      </View>
      <Text style={styles.muted}>
        {notesOf(shown.pcs)} · {tr("fondamentale sur la corde {n}", { n: v.bass })}
      </Text>
    </View>
  );
  const swaps = (
    <>
      <Text style={styles.body}>{tr(fn.role)}</Text>
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.sectionTitle}>{tr("Interchangeable avec")}</Text>
        {same.map((c) => {
          const common = commonPcs(shown, c);
          return (
            <Pressable key={c.deg} testID={`harmony-swap-${c.deg}`} onPress={() => setSel(c.deg)} style={({ pressed }) => [styles.swap, pressed && styles.pressed]}>
              <View style={styles.swapHead}>
                <Text style={styles.swapChord}>
                  {c.roman} · {nameOfChord(c)}
                </Text>
                <Text style={[styles.swapCommon, { color: fn.color }]}>
                  {common.length === 1 ? tr("1 note commune") : tr("{n} notes communes", { n: common.length })} : {notesOf(common)}
                </Text>
              </View>
              <Text style={styles.swapWhy}>{tr(whyOf(shown.deg, c.deg))}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
  const families = (stacked: boolean) => (
    <View style={[styles.families, stacked && styles.familiesStacked]}>
      {FN_ORDER.map((f) => (
        <View key={f} style={[styles.family, { backgroundColor: FUNCTIONS[f].bg, borderColor: FUNCTIONS[f].color }]}>
          <Text style={[styles.familyName, { color: FUNCTIONS[f].color }]} numberOfLines={1} adjustsFontSizeToFit>
            {tr(FUNCTIONS[f].name)}
            {stacked ? <Text style={styles.familyFeel}>{`  ${tr(FUNCTIONS[f].feel)}`}</Text> : null}
          </Text>
          {stacked ? null : <Text style={styles.familyFeel}>{tr(FUNCTIONS[f].feel)}</Text>}
          <View style={stacked ? styles.familyChordsRow : null}>
            {chords
              .filter((c) => c.fn === f)
              .map((c) => (
                <View key={c.deg} style={styles.familyRow}>
                  <Text style={styles.familyChord}>{nameOfChord(c)}</Text>
                  <Text style={styles.familyRoman}>{c.roman}</Text>
                </View>
              ))}
          </View>
        </View>
      ))}
    </View>
  );
  const principle = (
    <Text style={styles.body}>
      {tr("Deux accords de la même fonction partagent 2 ou 3 notes : on peut remplacer l’un par l’autre sans casser la progression. C’est le principe des relatifs (VIm7 pour IΔ, IIm7 pour IVΔ) et du VIIø qui remplace V7.")}
    </Text>
  );
  const slots = (h: number) => (
    <View style={styles.slots}>
      {prog.map((d, i) => {
        const c = chords[d];
        const f = FUNCTIONS[c.fn];
        const changed = d !== START[i];
        return (
          <Pressable
            key={i}
            testID={`harmony-slot-${i}`}
            onPress={() => tapSlot(i)}
            style={({ pressed }) => [styles.slot, { height: h, backgroundColor: f.bg, borderColor: f.color, borderWidth: changed ? 2 : 1 }, i === slot && styles.slotOn, pressed && styles.pressed]}
          >
            <Text style={styles.slotChord} numberOfLines={1} adjustsFontSizeToFit>
              {nameOfChord(c)}
            </Text>
            <Text style={styles.slotRoman}>{c.roman}</Text>
            {tag(c.fn)}
          </Pressable>
        );
      })}
    </View>
  );
  const progLine = <Text style={styles.progName}>{name ? tr(name) : prog.map((d) => chords[d].roman).join(" – ")}</Text>;
  const swapNote = <Text style={styles.body}>{tr(SWAP_NOTE[lastFn])}</Text>;
  const reset = (
    <Pressable
      testID="harmony-reset"
      onPress={() => {
        stop();
        setProg(START);
        setSlot(0);
        setLastFn("SD");
      }}
      style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
    >
      <ArrowClockwise size={14} color={colors.onSurface} weight="bold" />
      <Text style={styles.resetText}>{tr("Revenir à I – IV – V – I")}</Text>
    </Pressable>
  );
  const fretboard = (scale: number, rowH: number) => (
    <Fretboard
      fretScale={scale}
      rowH={rowH}
      degreeMap={NO_DEGREES}
      visibleLayers={NO_LAYERS}
      labelMode="degree"
      showNeutral={false}
      nameOf={nameOf}
      onNotePress={onNotePress}
      windowRange={neck.window}
      marks={neck.marks}
    />
  );
  const keyWheel = <KeyWheel visible={keyOpen} rootPc={keyPc} nameOf={nameOf} onClose={() => setKeyOpen(false)} onChange={setKeyPc} />;

  // ---------- Landscape: everything to choose on one line at the top, the neck on the left, the explanations on the side ----------
  if (landscape) {
    const availW = width - insets.left - insets.right - 2 * spacing.lg;
    // The neck is shortened (frets 0–12 on screen) to leave room for the degrees and the explanations on its right.
    const panelW = Math.round(Math.max(260, Math.min(460, availW * 0.46)));
    const leftW = availW - panelW - spacing.md;
    const bodyH = height - insets.top - insets.bottom - 48 - spacing.xs - spacing.sm;
    const rowH = Math.floor(Math.max(20, Math.min(32, (bodyH - spacing.sm - 26 - 24) / 6)));
    return (
      <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="harmony-screen">
        <StudioBackground />
        <View style={[styles.header, styles.headerLandscape, { paddingTop: insets.top + spacing.xs, paddingRight: LANDSCAPE_NAV_W + spacing.md }]}>
          {backBtn}
          <Text style={[styles.title, styles.titleLandscape]} numberOfLines={1}>
            {tr("Les degrés de la gamme")}
          </Text>
          <View style={styles.headerPills}>
            <PillRow inset={false}>{pills}</PillRow>
          </View>
          <View style={styles.transportPill}>
            {segment(true)}
            <Pressable testID="harmony-play" onPress={play} style={({ pressed }) => [styles.playRound, styles.playRoundSmall, pressed && styles.pressed]} accessibilityLabel={playing ? tr("Arrêter") : playLabel}>
              {playIcon}
            </Pressable>
          </View>
        </View>
        <View style={[styles.bodyRow, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={{ width: leftW, gap: spacing.sm }}>
            {fretboard(fitScale(leftW, 12), rowH)}
            <Text style={styles.muted} numberOfLines={1}>
              {shown.roman} · {nameOfChord(shown)} = {notesOf(shown.pcs)}
            </Text>
          </View>
          <ScrollView style={{ width: panelW }} contentContainerStyle={styles.panel} showsVerticalScrollIndicator={false} testID="harmony-panel">
            {tab === "degrees" ? (
              <>
                {tiles(52)}
                {card}
                {swaps}
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>{tr("Essaie : touche un accord pour le remplacer")}</Text>
                {slots(56)}
                {progLine}
                {swapNote}
                {reset}
                {families(true)}
                {principle}
              </>
            )}
          </ScrollView>
        </View>
        {keyWheel}
      </View>
    );
  }

  // ---------- Portrait ----------
  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="harmony-screen">
      <StudioBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        {backBtn}
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {tr("Les degrés de la gamme")}
        </Text>
      </View>
      <PillRow testID="harmony-pills">{pills}</PillRow>
      {segment(false)}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === "degrees" ? (
          <>
            {tiles(76)}
            {card}
          </>
        ) : (
          <>
            {families(false)}
            {principle}
            <View style={styles.tryBox}>
              <Text style={styles.sectionTitle}>{tr("Essaie : touche un accord pour le remplacer")}</Text>
              {slots(80)}
              {progLine}
              {swapNote}
              {reset}
            </View>
          </>
        )}
        <View style={styles.bleed}>{fretboard(1, 34)}</View>
        {tab === "degrees" ? swaps : null}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: (usesNativeTabs ? insets.bottom : 0) + spacing.sm }]}>
        <View style={styles.playbar}>
          <View style={{ flex: 1, paddingLeft: spacing.sm }}>
            <Text style={styles.playTitle} numberOfLines={1}>
              {playLabel}
            </Text>
            <Text style={styles.playSub} numberOfLines={1}>
              {tab === "degrees" ? tr("IΔ → VIIø → IΔ · 1 mesure par accord") : tr("1 mesure par accord")}
            </Text>
          </View>
          <Pressable testID="harmony-play" onPress={play} style={({ pressed }) => [styles.playRound, pressed && styles.pressed]} accessibilityLabel={playing ? tr("Arrêter") : tr("Écouter")}>
            {playIcon}
          </Pressable>
        </View>
      </View>
      {keyWheel}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md, minHeight: 48 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 22, fontWeight: "700", color: c.onSurface },
  headerLandscape: { gap: spacing.sm, paddingBottom: spacing.xs },
  titleLandscape: { flex: 0, flexShrink: 1, fontSize: 17, maxWidth: 150 },
  headerPills: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  transportPill: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, flexShrink: 0 },
  segmentCompact: { marginHorizontal: 0, marginTop: 0, padding: 2 },
  segBtnCompact: { flex: 0, height: 26, paddingHorizontal: 8 },
  segTextCompact: { fontSize: 11 },
  bodyRow: { flex: 1, flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  panel: { padding: spacing.sm, gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  familiesStacked: { flexDirection: "column", gap: 4 },
  familyChordsRow: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, rowGap: 2 },
  playRoundSmall: { width: 40, height: 40, borderRadius: 20 },
  segment: { flexDirection: "row", marginHorizontal: spacing.lg, marginTop: spacing.xs, padding: 3, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  segBtn: { flex: 1, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segBtnOn: { backgroundColor: c.surfaceTertiary },
  segText: { fontFamily: fonts.text, fontSize: 13, fontWeight: "500", color: c.onSurfaceTertiary },
  segTextOn: { fontWeight: "700", color: c.onSurface },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  muted: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, lineHeight: 18 },
  body: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 19 },
  tiles: { flexDirection: "row", gap: 4 },
  tile: { flex: 1, minWidth: 0, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 2 },
  tileRoman: { fontFamily: fonts.display, fontSize: 13, fontWeight: "700" },
  tileChord: { fontFamily: fonts.display, fontSize: 12, fontWeight: "600", color: c.onSurface },
  tag: { fontFamily: fonts.text, fontSize: 9.5, fontWeight: "700", color: "#101114", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, overflow: "hidden" },
  card: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, backgroundColor: c.surfaceSecondary, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" },
  cardTitle: { fontFamily: fonts.display, fontSize: 20, fontWeight: "700", color: c.onSurface },
  fnName: { fontFamily: fonts.text, fontSize: 13, fontWeight: "700" },
  bleed: { marginHorizontal: -spacing.lg },
  sectionTitle: { fontFamily: fonts.text, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "600", color: c.onSurfaceTertiary },
  swap: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, gap: 4 },
  swapHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: spacing.sm, flexWrap: "wrap" },
  swapChord: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onSurface },
  swapCommon: { fontFamily: fonts.text, fontSize: 12, fontWeight: "600" },
  swapWhy: { fontFamily: fonts.text, fontSize: 12.5, color: c.onSurfaceTertiary, lineHeight: 18 },
  families: { flexDirection: "row", gap: 6 },
  family: { flex: 1, minWidth: 0, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, gap: 4 },
  familyName: { fontFamily: fonts.text, fontSize: 12, fontWeight: "700" },
  familyFeel: { fontFamily: fonts.text, fontSize: 11, color: c.onSurfaceTertiary, lineHeight: 15 },
  familyRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  familyChord: { fontFamily: fonts.display, fontSize: 13, fontWeight: "700", color: c.onSurface },
  familyRoman: { fontFamily: fonts.text, fontSize: 11, color: c.onSurfaceTertiary },
  tryBox: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, gap: spacing.sm },
  slots: { flexDirection: "row", gap: 6 },
  slot: { flex: 1, minWidth: 0, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: 3 },
  slotOn: { transform: [{ translateY: -2 }] },
  slotChord: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onSurface },
  slotRoman: { fontFamily: fonts.text, fontSize: 11, color: c.onSurfaceSecondary },
  progName: { fontFamily: fonts.display, fontSize: 14, fontWeight: "600", color: c.brandPrimary },
  reset: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: spacing.md, borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary },
  resetText: { fontFamily: fonts.text, fontSize: 12, fontWeight: "600", color: c.onSurface },
  bottom: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  playbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: 28, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  playTitle: { fontFamily: fonts.text, fontSize: 14, fontWeight: "600", color: c.onSurface },
  playSub: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary },
  playRound: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.85 },
}));
