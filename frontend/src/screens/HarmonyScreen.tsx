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
      const m = midisOf(shown);
      m.forEach((x, k) => seq.push({ midi: x, at: k * beat * 0.5 }));
      m.forEach((x, k) => seq.push({ midi: x, at: 2 * beat + k * 25 }));
      total = 4 * beat;
    } else {
      prog.forEach((d, i) => {
        const t0 = i * 4 * beat;
        const m = midisOf(chords[d]);
        [0, 2].forEach((b) => m.forEach((x, k) => seq.push({ midi: x, at: t0 + b * beat + k * 25 })));
        timers.current.push(setTimeout(() => setSlot(i), t0));
      });
      total = prog.length * 4 * beat;
    }
    playChordNotes(seq, settings.volume * 0.85);
    timers.current.push(setTimeout(() => setPlaying(false), total));
    setPlaying(true);
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

  const contentW = width - insets.left - insets.right - 2 * spacing.lg - (landscape ? LANDSCAPE_NAV_W : 0);
  const same = chords.filter((c) => c.fn === shown.fn && c.deg !== shown.deg);
  const bassLabel = bass === "auto" ? tr("Basse : la plus grave") : tr("Basse sur la corde {n}", { n: bass });
  const name = progName(prog);

  const tag = (f: Fn, small = false) => (
    <Text style={[styles.tag, small && styles.tagSmall, { backgroundColor: FUNCTIONS[f].color }]}>{f}</Text>
  );

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="harmony-screen">
      <StudioBackground />
      <View style={[styles.header, { paddingTop: insets.top + (landscape ? spacing.xs : spacing.sm) }, landscape && { paddingRight: LANDSCAPE_NAV_W + spacing.md }]}>
        <Pressable testID="harmony-back" onPress={onBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} accessibilityLabel={tr("Explorer")} hitSlop={6}>
          <CaretLeft size={20} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {tr("Les degrés de la gamme")}
        </Text>
      </View>
      <PillRow testID="harmony-pills">
        <Pill testID="pill-key" label={tr("{k} majeur", { k: nameOf(keyPc) })} accent onPress={() => setKeyOpen(true)} />
        <Pill testID="pill-bass" label={bassLabel} onPress={() => setBass(BASSES[(BASSES.indexOf(bass) + 1) % BASSES.length])} />
      </PillRow>
      <View style={styles.segment}>
        {(["degrees", "functions"] as const).map((t) => (
          <Pressable key={t} testID={`harmony-tab-${t}`} onPress={() => setTab(t)} style={[styles.segBtn, tab === t && styles.segBtnOn]}>
            <Text style={[styles.segText, tab === t && styles.segTextOn]}>{t === "degrees" ? tr("Les 7 degrés") : tr("Fonctions")}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === "degrees" ? (
          <>
            <View style={styles.tiles}>
              {chords.map((c, i) => {
                const f = FUNCTIONS[c.fn];
                const on = i === sel;
                return (
                  <Pressable
                    key={i}
                    testID={`harmony-degree-${i}`}
                    onPress={() => setSel(i)}
                    style={({ pressed }) => [styles.tile, on && { backgroundColor: f.bg, borderColor: f.color, borderWidth: 2 }, pressed && styles.pressed]}
                  >
                    <Text style={[styles.tileRoman, { color: f.color }]} numberOfLines={1} adjustsFontSizeToFit>
                      {c.roman}
                    </Text>
                    <Text style={styles.tileChord} numberOfLines={1} adjustsFontSizeToFit>
                      {nameOfChord(c)}
                    </Text>
                    {tag(c.fn, true)}
                  </Pressable>
                );
              })}
            </View>
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
          </>
        ) : (
          <>
            <View style={styles.families}>
              {FN_ORDER.map((f) => (
                <View key={f} style={[styles.family, { backgroundColor: FUNCTIONS[f].bg, borderColor: FUNCTIONS[f].color }]}>
                  <Text style={[styles.familyName, { color: FUNCTIONS[f].color }]} numberOfLines={1} adjustsFontSizeToFit>
                    {tr(FUNCTIONS[f].name)}
                  </Text>
                  <Text style={styles.familyFeel}>{tr(FUNCTIONS[f].feel)}</Text>
                  {chords
                    .filter((c) => c.fn === f)
                    .map((c) => (
                      <View key={c.deg} style={styles.familyRow}>
                        <Text style={styles.familyChord}>{nameOfChord(c)}</Text>
                        <Text style={styles.familyRoman}>{c.roman}</Text>
                      </View>
                    ))}
                </View>
              ))}
            </View>
            <Text style={styles.body}>
              {tr("Deux accords de la même fonction partagent 2 ou 3 notes : on peut remplacer l’un par l’autre sans casser la progression. C’est le principe des relatifs (VIm7 pour IΔ, IIm7 pour IVΔ) et du VIIø qui remplace V7.")}
            </Text>
            <View style={styles.tryBox}>
              <Text style={styles.sectionTitle}>{tr("Essaie : touche un accord pour le remplacer")}</Text>
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
                      style={({ pressed }) => [
                        styles.slot,
                        { backgroundColor: f.bg, borderColor: f.color, borderWidth: changed ? 2 : 1 },
                        i === slot && styles.slotOn,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.slotChord} numberOfLines={1} adjustsFontSizeToFit>
                        {nameOfChord(c)}
                      </Text>
                      <Text style={styles.slotRoman}>{c.roman}</Text>
                      {tag(c.fn, true)}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.progName}>{name ? tr(name) : prog.map((d) => chords[d].roman).join(" – ")}</Text>
              <Text style={styles.body}>{tr(SWAP_NOTE[lastFn])}</Text>
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
            </View>
          </>
        )}

        <View style={styles.bleed}>
          <Fretboard
            fretScale={landscape ? fitScale(contentW + 2 * spacing.lg, 15) : 1}
            rowH={landscape ? 26 : 34}
            degreeMap={NO_DEGREES}
            visibleLayers={NO_LAYERS}
            labelMode="degree"
            showNeutral={false}
            nameOf={nameOf}
            onNotePress={onNotePress}
            windowRange={neck.window}
            marks={neck.marks}
          />
        </View>

        {tab === "degrees" ? (
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
        ) : null}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: (usesNativeTabs || landscape ? insets.bottom : 0) + spacing.sm }]}>
        <View style={styles.playbar}>
          <View style={{ flex: 1, paddingLeft: spacing.sm }}>
            <Text style={styles.playTitle} numberOfLines={1}>
              {tab === "degrees" ? tr("Écouter {c}", { c: nameOfChord(shown) }) : tr("Écouter la progression")}
            </Text>
            <Text style={styles.playSub} numberOfLines={1}>
              {tab === "degrees" ? tr("Arpège puis plaqué") : tr("1 mesure par accord")}
            </Text>
          </View>
          <Pressable testID="harmony-play" onPress={play} style={({ pressed }) => [styles.playRound, pressed && styles.pressed]} accessibilityLabel={playing ? tr("Arrêter") : tr("Écouter")}>
            {playing ? <Stop size={20} color={colors.onBrandPrimary} weight="fill" /> : <Play size={20} color={colors.onBrandPrimary} weight="fill" />}
          </Pressable>
        </View>
      </View>

      <KeyWheel visible={keyOpen} rootPc={keyPc} nameOf={nameOf} onClose={() => setKeyOpen(false)} onChange={setKeyPc} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md, minHeight: 48 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 22, fontWeight: "700", color: c.onSurface },
  segment: { flexDirection: "row", marginHorizontal: spacing.lg, marginTop: spacing.xs, padding: 3, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  segBtn: { flex: 1, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segBtnOn: { backgroundColor: c.surfaceTertiary },
  segText: { fontFamily: fonts.text, fontSize: 13, fontWeight: "500", color: c.onSurfaceTertiary },
  segTextOn: { fontWeight: "700", color: c.onSurface },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  muted: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, lineHeight: 18 },
  body: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 19 },
  tiles: { flexDirection: "row", gap: 4 },
  tile: { flex: 1, minWidth: 0, height: 76, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 2 },
  tileRoman: { fontFamily: fonts.display, fontSize: 13, fontWeight: "700" },
  tileChord: { fontFamily: fonts.display, fontSize: 12, fontWeight: "600", color: c.onSurface },
  tag: { fontFamily: fonts.text, fontSize: 10, fontWeight: "700", color: "#101114", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, overflow: "hidden" },
  tagSmall: { fontSize: 9.5 },
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
  familyRow: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  familyChord: { fontFamily: fonts.display, fontSize: 13, fontWeight: "700", color: c.onSurface },
  familyRoman: { fontFamily: fonts.text, fontSize: 11, color: c.onSurfaceTertiary },
  tryBox: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, gap: spacing.sm },
  slots: { flexDirection: "row", gap: 6 },
  slot: { flex: 1, minWidth: 0, height: 80, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: 3 },
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
