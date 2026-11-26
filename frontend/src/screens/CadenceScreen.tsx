import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeft, Play, Repeat, Stop } from "phosphor-react-native";

import { LANDSCAPE_NAV_W } from "@/src/components/AppTabBar";
import { ChordScore, fitCount, windowOf } from "@/src/components/ChordScore";
import { Fretboard, fitScale, type ChordMark } from "@/src/components/Fretboard";
import { KeyWheel } from "@/src/components/KeyWheel";
import { Pill, PillRow } from "@/src/components/Pill";
import { Sheet } from "@/src/components/Sheet";
import { StudioBackground } from "@/src/components/StudioBackground";
import { initAudio, playChordNotes, playNote, preloadNotes, stopChordNotes } from "@/src/audio/sampler";
import { chordOnce } from "@/src/audio/chordPlay";
import { resumeWebAudio } from "@/src/audio/webAudio";
import {
  ALL_CADENCES,
  CADENCES,
  CHORD_STYLES,
  cadenceChords,
  chordNum,
  voicingOf,
  type Chord,
  type ChordStyle,
  type ChordVoicing,
} from "@/src/music/cadences";
import type { Played, Voicing } from "@/src/music/chordShapes";
import { TUNING, cellKey, degreeKeyFromNum, pcOf, type BoxWindow, type DegreeKey, type IntervalDef } from "@/src/music/theory";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { tr } from "@/src/i18n";

const NO_DEGREES = new Map<number, IntervalDef>();
const NO_LAYERS = new Set<DegreeKey>();
const TEMPOS = [60, 70, 80, 100, 120];
const pretty = (l: string) => l.replace(/^b/, "♭");

/** A voicing as ChordScore reads it: strings 6 → 1, one note per string (the lowest of the position). */
function asScoreVoicing(v: ChordVoicing, ch: Chord, name: string): Voicing {
  const strings: Played[] = [0, 1, 2, 3, 4, 5].map((i) => {
    const s = 5 - i;
    const n = v.notes.filter((x) => x.string === s).sort((a, b) => a.fret - b.fret)[0];
    return n ? { fret: n.fret, finger: 0, deg: pretty(n.label) } : null;
  });
  return { name, rootPc: ch.root, symbol: ch.quality, typeName: "", strings, rootString: 6 };
}

/** S’exercer › Cadences: a cadence chosen by its name, played in a key, three ways to play it on the neck. */
export function CadenceScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { settings, nameOf } = useSettings();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const [keyPc, setKeyPc] = useState(7); // G
  const [cadId, setCadId] = useState("pop4");
  const [style, setStyle] = useState<ChordStyle>("simple");
  const [idx, setIdx] = useState(0);
  const [tempo, setTempo] = useState(70);
  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [sheet, setSheet] = useState<"cadence" | "style" | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cad = ALL_CADENCES.find((c) => c.id === cadId) ?? ALL_CADENCES[0];
  const position = 0;
  const chords = useMemo(() => cadenceChords(cad, keyPc, style), [cad, keyPc, style]);
  const voicings = useMemo(() => chords.map((ch) => voicingOf(ch, style, keyPc, position)), [chords, style, keyPc]);
  const at = Math.min(idx, chords.length - 1);
  const nameOfChord = (ch: Chord) => `${nameOf(ch.root)}${ch.quality}`;
  const cur = chords[at];
  const v = voicings[at];
  const keyLabel = cad.minor ? tr("{k} · en {m}", { k: nameOf(keyPc), m: `${nameOf(pcOf(keyPc + 9))}m` }) : tr("{k} majeur", { k: nameOf(keyPc) });
  const styleDef = CHORD_STYLES.find((s) => s.id === style)!;

  // The neck: the current chord, the next one as rings (in position), muted strings.
  const neck = useMemo(() => {
    const marks = new Map<string, ChordMark>();
    if (style !== "simple" && chords.length > 1) {
      const nv = voicings[(at + 1) % chords.length];
      const nch = chords[(at + 1) % chords.length];
      nv.notes.forEach((n) => marks.set(cellKey(n.string, n.fret), { kind: "ghost", degree: degreeKeyFromNum(chordNum(nch, TUNING[n.string] + n.fret)), label: "" }));
    }
    v.muted.forEach((s) => marks.set(cellKey(s, 0), { kind: "muted", degree: "root", label: "×" }));
    v.notes.forEach((n) => marks.set(cellKey(n.string, n.fret), { kind: "played", degree: degreeKeyFromNum(chordNum(cur, TUNING[n.string] + n.fret)), label: pretty(n.label) }));
    const window: BoxWindow = { min: v.min, max: v.max, cells: new Set(v.notes.map((n) => cellKey(n.string, n.fret))) };
    return { marks, window };
  }, [v, voicings, chords, at, cur, style]);

  const scoreVoicings = useMemo(() => chords.map((ch, i) => asScoreVoicing(voicings[i], ch, nameOfChord(ch))), [chords, voicings]); // eslint-disable-line react-hooks/exhaustive-deps

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
  useEffect(stop, [cadId, keyPc, style, settings.chordStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  /** One bar per chord (4 beats), played as set in Réglages › Accords : façon de jouer. */
  const play = () => {
    if (playing) return stop();
    resumeWebAudio();
    initAudio();
    const beat = 60000 / tempo;
    const seq: { midi: number; at: number }[] = [];
    // Each chord once, as set in Réglages › Accords : façon de jouer (arpeggio, strum, or both), at the tempo.
    const starts: number[] = [];
    let total = 0;
    voicings.forEach((vo) => {
      const midis = vo.notes.map((n) => TUNING[n.string] + n.fret);
      const one = chordOnce(midis, settings.chordStyle, total, beat);
      starts.push(total);
      seq.push(...one.hits);
      total = one.next;
    });
    const run = () => {
      playChordNotes(seq, settings.volume * 0.85);
      starts.forEach((t, i) => timers.current.push(setTimeout(() => setIdx(i), t)));
      timers.current.push(setTimeout(() => (loopRef.current ? run() : setPlaying(false)), total));
    };
    setPlaying(true);
    run();
  };
  const loopRef = useRef(loop);
  loopRef.current = loop;

  const onNotePress = (midi: number) => {
    resumeWebAudio();
    playNote(midi, settings.volume);
  };

  const contentW = width - insets.left - insets.right - 2 * spacing.lg - (landscape ? LANDSCAPE_NAV_W : 0);
  const k = fitCount(Math.min(contentW, 600), chords.length);
  const idxs = windowOf(at, k, chords.length);

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="cadence-screen">
      <StudioBackground />
      <View style={[styles.header, { paddingTop: insets.top + (landscape ? spacing.xs : spacing.sm) }, landscape && { paddingRight: LANDSCAPE_NAV_W + spacing.md }]}>
        <Pressable testID="cadence-back" onPress={onBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} accessibilityLabel={tr("S’exercer")} hitSlop={6}>
          <CaretLeft size={20} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} testID="cadence-title">
          {tr(cad.name)}
        </Text>
      </View>
      <PillRow testID="cadence-pills">
        <Pill testID="pill-key" label={keyLabel} accent onPress={() => setKeyOpen(true)} />
        <Pill testID="pill-cadence" label={tr(cad.name)} onPress={() => setSheet("cadence")} />
        <Pill testID="pill-style" label={tr(styleDef.name)} onPress={() => setSheet("style")} />
      </PillRow>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.muted}>
          {cad.roman} · {tr(styleDef.meta)}
        </Text>
        <View style={styles.chips}>
          {chords.map((ch, i) => (
            <Pressable key={i} testID={`cadence-chord-${i}`} onPress={() => setIdx(i)} style={({ pressed }) => [styles.chordChip, i === at && styles.chordChipOn, pressed && styles.pressed]}>
              <Text style={[styles.chordName, i === at && styles.chordNameOn]}>{nameOfChord(ch)}</Text>
              <Text style={styles.chordRoman}>{ch.roman}</Text>
            </Pressable>
          ))}
        </View>
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
        <Text style={styles.muted}>
          {nameOfChord(cur)} = {cur.pcs.map((p) => nameOf(p)).join(" ")}
          {style !== "simple" ? ` · ${tr("Position {n}", { n: position + 1 })}` : ""}
        </Text>
        <View style={{ gap: 6 }}>
          <Text style={styles.sectionTitle}>{tr("Partition")}</Text>
          <ChordScore
            voicings={scoreVoicings}
            idxs={idxs}
            selected={at}
            width={Math.min(contentW, 600)}
            labelOf={(_, i) => chords[i].roman}
            colorNotes={false}
            background={colors.surface}
            onPick={setIdx}
            testID="cadence-score"
          />
        </View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: (usesNativeTabs || landscape ? insets.bottom : 0) + spacing.sm }]}>
        <View style={styles.playbar}>
          <Pressable testID="cadence-loop" onPress={() => setLoop(!loop)} style={[styles.roundSmall, loop && styles.roundOn]} accessibilityLabel={tr("Boucle")}>
            <Repeat size={18} color={loop ? colors.brandPrimary : colors.onSurfaceTertiary} weight="bold" />
          </Pressable>
          <Pressable testID="cadence-tempo" onPress={() => setTempo(TEMPOS[(TEMPOS.indexOf(tempo) + 1) % TEMPOS.length])} style={styles.tempo} accessibilityLabel={tr("Tempo")}>
            <Text style={styles.tempoText}>♩ {tempo}</Text>
            <Text style={styles.tempoSub}>{tr("Tempo")}</Text>
          </Pressable>
          <Pressable testID="cadence-play" onPress={play} style={({ pressed }) => [styles.playRound, pressed && styles.pressed]} accessibilityLabel={playing ? tr("Arrêter") : tr("Écouter")}>
            {playing ? <Stop size={20} color={colors.onBrandPrimary} weight="fill" /> : <Play size={20} color={colors.onBrandPrimary} weight="fill" />}
          </Pressable>
        </View>
      </View>

      <KeyWheel visible={keyOpen} rootPc={keyPc} nameOf={nameOf} onClose={() => setKeyOpen(false)} onChange={setKeyPc} />
      <Sheet visible={sheet === "cadence"} onClose={() => setSheet(null)} title={tr("Cadence")} testID="cadence-sheet">
        <View style={styles.sheetBody}>
          {CADENCES.map((g) => (
            <View key={g.id} style={{ gap: 6 }}>
              <Text style={styles.sectionTitle}>{tr(g.name)}</Text>
              {g.items.map((c) => {
                const on = c.id === cadId;
                return (
                  <Pressable
                    key={c.id}
                    testID={`cadence-${c.id}`}
                    onPress={() => {
                      setCadId(c.id);
                      setIdx(0);
                      setSheet(null);
                    }}
                    style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && styles.pressed]}
                  >
                    <View style={styles.rowHead}>
                      <Text style={styles.rowName}>{tr(c.name)}</Text>
                      <Text style={styles.rowRight}>{c.roman}</Text>
                    </View>
                    <Text style={styles.rowChords}>{cadenceChords(c, keyPc, style).map(nameOfChord).join(" – ")}</Text>
                    <Text style={styles.rowMeta}>
                      {c.minor ? `${tr("En {m}", { m: `${nameOf(pcOf(keyPc + 9))}m` })} · ` : ""}
                      {tr(c.meta)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </Sheet>
      <Sheet visible={sheet === "style"} onClose={() => setSheet(null)} title={tr("Jouer en")} testID="cadence-style-sheet">
        <View style={styles.sheetBody}>
          {CHORD_STYLES.map((s) => {
            const on = s.id === style;
            return (
              <Pressable
                key={s.id}
                testID={`cadence-style-${s.id}`}
                onPress={() => {
                  setStyle(s.id);
                  setSheet(null);
                }}
                style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && styles.pressed]}
              >
                <Text style={styles.rowName}>{tr(s.name)}</Text>
                <Text style={styles.rowChords}>{cadenceChords(cad, keyPc, s.id).map(nameOfChord).join(" – ")}</Text>
                <Text style={styles.rowMeta}>{tr(s.meta)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md, minHeight: 48 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 24, fontWeight: "700", color: c.onSurface },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.md },
  muted: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chordChip: { flexGrow: 1, minWidth: 54, height: 54, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  chordChipOn: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  chordName: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onSurface },
  chordNameOn: { color: c.brandPrimary },
  chordRoman: { fontFamily: fonts.text, fontSize: 11, color: c.onSurfaceTertiary },
  bleed: { marginHorizontal: -spacing.lg },
  sectionTitle: { fontFamily: fonts.text, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "600", color: c.onSurfaceTertiary },
  bottom: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  playbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: 28, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  roundSmall: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  roundOn: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  tempo: { flex: 1, height: 42, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tempoText: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface },
  tempoSub: { fontFamily: fonts.text, fontSize: 11, color: c.onSurfaceTertiary },
  playRound: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  sheetBody: { paddingHorizontal: spacing.lg, gap: spacing.md },
  row: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, gap: 2 },
  rowOn: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  rowHead: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  rowName: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700", color: c.onSurface },
  rowRight: { fontFamily: fonts.display, fontSize: 12, color: c.onSurfaceTertiary },
  rowChords: { fontFamily: fonts.display, fontSize: 13, fontWeight: "600", color: c.brandPrimary },
  rowMeta: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary },
  pressed: { opacity: 0.85 },
}));
