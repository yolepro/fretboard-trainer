import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shortName } from "@/src/music/shortNames";
import { LANDSCAPE_NAV_W } from "@/src/components/AppTabBar";
import { resumeWebAudio, stopWebNotes, webAudioScheduling } from "@/src/audio/webAudio";
import { KeyButton, KeyWheel } from "@/src/components/KeyWheel";
import { Pill, PillRow } from "@/src/components/Pill";
import { Sheet } from "@/src/components/Sheet";
import { PositionChips } from "@/src/components/PositionChips";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Metronome, Play, Repeat, Stop } from "phosphor-react-native";

import { Fretboard, fitScale } from "@/src/components/Fretboard";
import { ScalePicker } from "@/src/components/ScalePicker";
import { Chip, ChipRow, SectionLabel } from "@/src/components/Chip";
import { Score, useScore } from "@/src/components/Score";
import { runSequence } from "@/src/audio/sequencer";
import { playRendered, prerender, renderedPlayback, type RenderSpec } from "@/src/audio/render";
import { StudioBackground } from "@/src/components/StudioBackground";
import { playClick, playNote, preloadClicks, preloadNotes, initAudio } from "@/src/audio/sampler";
import { TempoButton } from "@/src/components/TempoSheet";
import { positionLadder, windowNotes } from "@/src/music/exercises";
import {
  CHORDS,
  DEGREE_META,
  SCALES,
  buildDegreeMap,
  degreeKeyFromNum,
  formulaDegrees,
  pcOf,
  boxVariant,
  playbackPath,
  scaleBoxes,
  type DegreeKey,
} from "@/src/music/theory";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { tr } from "@/src/i18n";

type Mode = "scale" | "chord";

export default function FretboardScreen() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const { settings, update, nameOf } = useSettings();

  const [mode, setMode] = useState<Mode>("scale");
  const [rootPc, setRootPc] = useState(0);
  const [scaleId, setScaleId] = useState("major");
  const [chordId, setChordId] = useState("maj7");
  // All notes share one color; selected degrees get their own color (tonic by default)
  const [colored, setColored] = useState<Set<DegreeKey>>(new Set(["root"]));
  const [position, setPosition] = useState<number | null>(0); // scale mode opens on Pos. 1
  // Per-position variant: 0 = 1/2 (low), 1 = 2/2 (same box 12 frets higher)
  const [variants, setVariants] = useState<number[]>([]);
  const [active, setActive] = useState<{ midi: number; string: number; fret: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [stepIdx, setStepIdx] = useState<number | null>(null);
  const [startOnRoot, setStartOnRoot] = useState(true);
  // One focused sheet per pill, and the key wheel.
  const [sheet, setSheet] = useState<null | "formula" | "where" | "display">(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const closeSheet = () => setSheet(null);
  // Listening: eighth notes at this tempo (quarter note), with the same options as the Doigté section.
  const [bpm, setBpm] = useState(80);
  const [loop, setLoop] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  // Landscape: frets 0→16 minimum fit on screen, rows sized to the available height.
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const usableW = width - insets.left - insets.right - 8;
  const fretScale = isLandscape ? fitScale(usableW, 16) : 1;
  // Landscape: the tab bar sits at the top right, over the header (no bottom bar).
  const tabBarH = usesNativeTabs || width > height ? 0 : 49 + insets.bottom;
  useEffect(() => {
    initAudio();
    preloadClicks();
    return () => cancelRef.current?.();
  }, []);

  const formula = useMemo(
    () => (mode === "scale" ? SCALES.find((s) => s.id === scaleId)! : CHORDS.find((c) => c.id === chordId)!),
    [mode, scaleId, chordId],
  );
  const degreeMap = useMemo(() => buildDegreeMap(rootPc, formula), [rootPc, formula]);
  const degrees = useMemo(() => formulaDegrees(formula), [formula]);
  const visibleLayers = useMemo(() => new Set(degrees), [degrees]);
  const coloredLayers = colored;
  // For scales, windows are widened so the visible notes form an unbroken run of the scale (chords keep the raw box).
  const boxes = useMemo(() => scaleBoxes(rootPc, formula, mode === "scale"), [rootPc, formula, mode, settings.fretCount]);
  // Scales don't have the same number of positions: drop a selection that no longer exists.
  useEffect(() => {
    if (position !== null && position >= boxes.length) {
      setPosition(mode === "scale" && boxes.length > 0 ? 0 : null);
      setVariants([]);
    }
  }, [boxes.length, position, mode]);
  // Coming back to scales (from chords): Pos. 1 again.
  useEffect(() => {
    if (mode === "scale") {
      setPosition(0);
      setVariants([]);
    }
  }, [mode]);
  // 2/2 only where the position fits on the neck (setting: 20–24 frets).
  const hasSecond = useMemo(
    () =>
      boxes.map((b) => {
        const w = boxVariant(b, 1);
        return w.max <= settings.fretCount && w.min <= w.max && (!w.cells || w.cells.size > 0);
      }),
    [boxes, settings.fretCount],
  );
  const variant = position !== null && hasSecond[position] ? (variants[position] ?? 0) : 0;
  // Memoized so the Fretboard's scroll effect only fires when the window really changes.
  const windowRange = useMemo(
    () => (position !== null && boxes[position] ? boxVariant(boxes[position], variant) : null),
    [boxes, position, variant],
  );

  // The notes "Écouter" plays: also what the score under the neck shows.
  // With a scale position selected: every note of the position, from its lowest note (or lowest root) upward.
  // Otherwise: from the root up to the octave.
  const path = useMemo(() => {
    if (windowRange) {
      // A position is selected: every note of the position, scales (contiguous ladder) and chords (all chord tones).
      let ladder = mode === "scale" ? positionLadder(rootPc, formula, windowRange) : windowNotes(rootPc, formula, windowRange);
      if (startOnRoot) {
        const r = ladder.findIndex((st) => pcOf(st.midi) === pcOf(rootPc));
        if (r > 0) ladder = ladder.slice(r);
      }
      if (ladder.length) return ladder;
    }
    return playbackPath(rootPc, formula, mode === "scale", windowRange);
  }, [rootPc, formula, mode, windowRange, startOnRoot, settings.fretCount]);
  useEffect(() => {
    preloadNotes(path.map((st) => st.midi));
  }, [path]);
  useEffect(() => {
    setStepIdx(null);
  }, [path]);
  // Any change of what is played stops the playback (a loop would otherwise go on with the old notes).
  useEffect(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setPlaying(false);
    setBeat(null);
  }, [path, bpm, loop, metronome]);
  const showScore = !isLandscape || settings.showScoreLandscape;
  // Landscape: the tablature is shown only when the screen is tall enough (tablets); phones keep the staff alone.
  const landscapeRoom = height - insets.top - tabBarH - bottomChrome - 52 - 22 - 8 - 6 * 22 - 6;
  const tabOn = settings.showTab && (!isLandscape || landscapeRoom >= 188);
  const { layout } = useScore(path, "path", 2, rootPc, formula, tabOn, false, bpm);
  const rowH = isLandscape
    ? Math.max(
        showScore ? 22 : 26,
        Math.min(34, Math.floor((height - insets.top - tabBarH - bottomChrome - 52 - 22 - 8 - (showScore ? layout.height + 6 : 0)) / 6)),
      )
    : 34;

  // Tap a position to select it; tap the selected one again to switch between 1/2 and 2/2.
  // Changing position (or going back to "Tout le manche") puts every position back on 1/2.
  const selectPosition = useCallback(
    (i: number | null) => {
      if (i !== null && i === position) {
        if (!hasSecond[i]) return; // no 2/2 here
        setVariants((prev) => {
          const next = Array.from({ length: boxes.length }, (_, k) => prev[k] ?? 0);
          next[i] = next[i] === 1 ? 0 : 1;
          return next;
        });
      } else {
        setVariants([]);
        setPosition(i);
      }
    },
    [position, boxes.length, hasSecond],
  );

  const onNotePress = useCallback(
    (midi: number, s: number, f: number) => {
      setActive({ midi, string: s, fret: f });
      Haptics.selectionAsync().catch(() => {});
      if (settings.soundOnTap) playNote(midi, settings.volume);
    },
    [settings.soundOnTap, settings.volume],
  );

  const toggleLayer = (d: DegreeKey) => {
    setColored((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  // "Écouter": climbs from the root (inside the selected position) to the root one octave above, then stops.
  // Each note is highlighted on the neck while it sounds, at the place closest to the left of the position.
  // Count-in: one bar (4 beats), or its second half ("3, 4") when the tempo is under 70.
  const countBeats = bpm < 70 ? 2 : 4;
  // iPhone / Android: the whole sequence is mixed ahead into one sound file (render.ts), so the rhythm no longer depends on
  // the JavaScript thread; it is mixed while nothing plays, a moment after each change.
  const renderSpec = (): RenderSpec => ({
    midis: path.map((st) => st.midi),
    noteMs: 60000 / bpm / 2,
    beatMs: 60000 / bpm,
    beats: countBeats,
    firstBeat: 4 - countBeats,
    loop,
    volume: settings.volume,
    metronome: metronome ? { barPulses: 4, volume: settings.volume * 0.8 } : null,
  });
  useEffect(() => {
    if (!renderedPlayback || playing || !path.length) return;
    const id = setTimeout(() => prerender(renderSpec()), 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, bpm, loop, metronome, settings.volume, countBeats, playing]);
  const showPathStep = (i: number) => {
    const step = path[i];
    setStepIdx(i);
    setActive(step.loc ? { midi: step.midi, string: step.loc.string, fret: step.loc.fret } : null);
  };
  const endPlay = () => {
    cancelRef.current = null;
    setPlaying(false);
    setActive(null);
    setStepIdx(null);
    setBeat(null);
  };
  const playFormula = () => {
    if (playing) {
      cancelRef.current?.();
      endPlay();
      return;
    }
    if (!path.length) return;
    if (renderedPlayback) {
      let cancelled = false;
      cancelRef.current = () => {
        cancelled = true;
      };
      setPlaying(true);
      // The screen follows the sound itself (its position in the file), not a separate timer.
      playRendered(renderSpec(), {
        onBeat: (b) => setBeat(4 - countBeats + b + 1),
        onNote: (i) => {
          if (i === 0) setBeat(null);
          showPathStep(i);
        },
        onEnd: endPlay,
      }).then((h) => {
        if (cancelled) {
          h?.stop();
          return;
        }
        if (!h) {
          playLive(); // could not load the mixed file: the live sampler plays it
          return;
        }
        cancelRef.current = h.stop;
      });
      return;
    }
    playLive();
  };
  const playLive = () => {
    resumeWebAudio();
    cancelRef.current = runSequence({
      length: path.length,
      noteMs: 60000 / bpm / 2,
      beatMs: 60000 / bpm,
      beats: countBeats,
      loop,
      leadMs: 30,
      onBeat: (b) => {
        if (!webAudioScheduling) playClick(4 - countBeats + b, settings.volume);
        setBeat(4 - countBeats + b + 1);
      },
      onClick: metronome ? (k) => playClick(k % 4, settings.volume * 0.8) : undefined,
      // Web: sounds scheduled ahead on the audio clock (notes, count-in and metronome stay exactly together).
      audio: webAudioScheduling
        ? {
            beat: (b, at) => playClick(4 - countBeats + b, settings.volume, at),
            note: (i, at) => playNote(path[i].midi, settings.volume, at),
            click: metronome ? (k, at) => playClick(k % 4, settings.volume * 0.8, at) : undefined,
            cancel: stopWebNotes,
          }
        : undefined,
      onNote: (i) => {
        if (i === 0) setBeat(null);
        const step = path[i];
        if (!webAudioScheduling) playNote(step.midi, settings.volume);
        setStepIdx(i);
        setActive(step.loc ? { midi: step.midi, string: step.loc.string, fret: step.loc.fret } : null);
      },
      onEnd: () => {
        cancelRef.current = null;
        setPlaying(false);
        setActive(null);
        setStepIdx(null);
        setBeat(null);
      },
    });
    setPlaying(true);
  };

  const tapScoreNote = useCallback(
    (i: number) => {
      if (playing) return;
      const step = path[i];
      if (!step) return;
      playNote(step.midi, settings.volume);
      setStepIdx(i);
      setActive(step.loc ? { midi: step.midi, string: step.loc.string, fret: step.loc.fret } : null);
    },
    [playing, path, settings.volume],
  );

  const positionLabel = position === null ? tr("Tout le manche") : hasSecond[position] ? `Pos. ${position + 1} · ${variant + 1}/2` : `Pos. ${position + 1}`;
  const formulaPillLabel = `${mode === "scale" ? tr("Gamme") : tr("Accord")} · ${isLandscape ? shortName(formula) : tr(formula.name)}`;

  const legend = (
    <ChipRow testID="layer-legend">
      {degrees.map((d) => (
        <Chip key={d} testID={`layer-toggle-${d}`} label={tr(DEGREE_META[d].label)} dotColor={colors[DEGREE_META[d].color]} selected={colored.has(d)} onPress={() => toggleLayer(d)} />
      ))}
    </ChipRow>
  );

  // ---- Sheets: one per pill ----
  const whereSheet = (
    <>
      <SectionLabel>{tr("Position")}</SectionLabel>
      <PositionChips boxes={boxes} selected={position} variants={variants} single={hasSecond.map((ok) => !ok)} onChange={selectPosition} prefix="manche-position" />
      {windowRange ? (
        <>
          <SectionLabel>{tr("Écoute et partition : départ")}</SectionLabel>
          <ChipRow testID="manche-start-selector">
            <Chip testID="manche-start-lowest" label={tr("Note la plus grave")} selected={!startOnRoot} onPress={() => setStartOnRoot(false)} />
            <Chip testID="manche-start-root" label={tr("Tonique")} selected={startOnRoot} onPress={() => setStartOnRoot(true)} />
          </ChipRow>
        </>
      ) : null}
    </>
  );
  const displaySheet = (
    <>
      <SectionLabel>{tr("Partition")}</SectionLabel>
      <ChipRow testID="manche-tab-selector">
        <Chip testID="manche-tab-on" label={tr("Notes + tablature")} selected={settings.showTab} onPress={() => update({ showTab: true })} />
        <Chip testID="manche-tab-off" label={tr("Notes seules")} selected={!settings.showTab} onPress={() => update({ showTab: false })} />
      </ChipRow>
      <SectionLabel>{tr("Partition en paysage")}</SectionLabel>
      <ChipRow testID="manche-score-landscape">
        <Chip testID="manche-score-landscape-on" label={tr("Affichée")} selected={settings.showScoreLandscape} onPress={() => update({ showScoreLandscape: true })} />
        <Chip testID="manche-score-landscape-off" label={tr("Masquée")} selected={!settings.showScoreLandscape} onPress={() => update({ showScoreLandscape: false })} />
      </ChipRow>
      <SectionLabel>{tr("Étiquettes")}</SectionLabel>
      <ChipRow testID="manche-label-selector">
        <Chip testID="manche-label-note" label={tr("Noms des notes")} selected={settings.labelMode === "note"} onPress={() => update({ labelMode: "note" })} />
        <Chip testID="manche-label-degree" label={tr("Degrés")} selected={settings.labelMode === "degree"} onPress={() => update({ labelMode: "degree" })} />
      </ChipRow>
      {/* Landscape: the degree colors aren't under the score, they are here. */}
      {isLandscape ? (
        <>
          <SectionLabel>{tr("Couleurs des degrés")}</SectionLabel>
          {legend}
        </>
      ) : null}
    </>
  );

  const playButton = (round: boolean) => (
    <Pressable
      testID="play-formula-button"
      onPress={playFormula}
      style={({ pressed }) => [round ? styles.playRound : styles.playBig, pressed && styles.pressed]}
      accessibilityLabel={playing ? tr("Stop") : tr("Écouter")}
    >
      {playing ? <Stop size={round ? 20 : 22} color={colors.onBrandPrimary} weight="fill" /> : <Play size={round ? 20 : 22} color={colors.onBrandPrimary} weight="fill" />}
    </Pressable>
  );

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="fretboard-screen">
      <StudioBackground />
      {isLandscape ? (
        // Landscape: one row aligned with the tab bar — like S'exercer.
        <View style={[styles.header, styles.headerLandscape, { paddingTop: insets.top + spacing.xs, paddingRight: LANDSCAPE_NAV_W + spacing.md }]}>
          <Text style={[styles.title, styles.titleCompact]} testID="fretboard-title" numberOfLines={1}>
            {tr("Explorer")}
          </Text>
          <KeyButton rootPc={rootPc} nameOf={nameOf} onChange={setRootPc} />
          <View style={styles.headerPills}>
            <PillRow inset={false}>
              <Pill testID="pill-formula" label={formulaPillLabel} onPress={() => setSheet("formula")} />
              {boxes.length > 0 ? <Pill testID="pill-position" label={positionLabel} onPress={() => setSheet("where")} /> : null}
              <Pill testID="pill-display" label={tr("Affichage")} onPress={() => setSheet("display")} />
            </PillRow>
          </View>
          <View style={styles.transportPill} testID="transport-pill">
            <TempoButton count={beat} bpm={bpm} min={30} max={200} defaultBpm={80} onBpm={setBpm} loop={loop} onLoop={setLoop} metronome={metronome} onMetronome={setMetronome} />
            {playButton(true)}
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
            <View style={styles.headerText}>
              {/* The key, the scale / chord and the position are on the pills just below. */}
              <Text style={styles.title} testID="fretboard-title" numberOfLines={1}>
                {tr("Explorer")}
              </Text>
            </View>
          </View>
          <PillRow testID="manche-pills">
            <Pill testID="pill-key" label={nameOf(rootPc)} accent onPress={() => setKeyOpen(true)} />
            <Pill testID="pill-formula" label={formulaPillLabel} onPress={() => setSheet("formula")} />
            {boxes.length > 0 ? <Pill testID="pill-position" label={positionLabel} onPress={() => setSheet("where")} /> : null}
            <Pill testID="pill-display" label={tr("Affichage")} onPress={() => setSheet("display")} />
          </PillRow>
        </>
      )}

      <Fretboard
        fretScale={fretScale}
        rowH={rowH}
        degreeMap={degreeMap}
        visibleLayers={visibleLayers}
        coloredLayers={coloredLayers}
        windowRange={windowRange}
        labelMode={settings.labelMode}
        showNeutral={settings.showNeutral}
        nameOf={nameOf}
        activeMidi={active}
        onNotePress={onNotePress}
      />

      {isLandscape && showScore ? <Score layout={layout} activeIndex={stepIdx} onNotePress={tapScoreNote} testID="manche-score" /> : null}

      {!isLandscape ? (
        <>
          {/* Portrait: score, degree colors and intervals scroll between the neck and the playback bar (small phones). */}
          <ScrollView style={styles.middle} contentContainerStyle={styles.middleContent} showsVerticalScrollIndicator={false}>
          {showScore ? <Score layout={layout} activeIndex={stepIdx} onNotePress={tapScoreNote} testID="manche-score" /> : null}
          {legend}
          <View style={styles.formulaRow} testID="formula-intervals">
            {formula.intervals.map((i) => {
              const k = degreeKeyFromNum(i.num);
              return (
                <View key={`${i.semi}-${i.label}`} style={[styles.ivPill, { borderColor: colors[DEGREE_META[k].color] }]}>
                  <Text style={[styles.ivLabel, { color: colors[DEGREE_META[k].color] }]}>{i.label}</Text>
                  <Text style={styles.ivNote}>{nameOf(rootPc + i.semi)}</Text>
                </View>
              );
            })}
          </View>
          </ScrollView>
          {/* Playback bar: the same as in S'exercer (loop, metronome, tempo, play). */}
          <View style={[styles.bottom, { paddingBottom: bottomChrome + spacing.sm }]}>
            <View style={styles.playbar} testID="playback-bar">
              <Pressable testID="loop-toggle" onPress={() => setLoop(!loop)} style={({ pressed }) => [styles.barToggle, loop && styles.barToggleOn, pressed && styles.pressed]} accessibilityLabel={tr("Boucle")} accessibilityState={{ selected: loop }}>
                <Repeat size={20} color={loop ? colors.onBrandTertiary : colors.onSurfaceTertiary} weight="bold" />
              </Pressable>
              <Pressable testID="metronome-toggle" onPress={() => setMetronome(!metronome)} style={({ pressed }) => [styles.barToggle, metronome && styles.barToggleOn, pressed && styles.pressed]} accessibilityLabel={tr("Métronome")} accessibilityState={{ selected: metronome }}>
                <Metronome size={20} color={metronome ? colors.onBrandTertiary : colors.onSurfaceTertiary} weight="bold" />
              </Pressable>
              <TempoButton
                variant="bar"
                playbackInSheet={false}
                count={beat}
                bpm={bpm}
                min={30}
                max={200}
                subLabel={tr("croches")}
                defaultBpm={80}
                onBpm={setBpm}
                loop={loop}
                onLoop={setLoop}
                metronome={metronome}
                onMetronome={setMetronome}
              />
              {playButton(false)}
            </View>
          </View>
        </>
      ) : null}

      <KeyWheel visible={keyOpen} rootPc={rootPc} nameOf={nameOf} onClose={() => setKeyOpen(false)} onChange={setRootPc} />
      <ScalePicker
        visible={sheet === "formula"}
        onClose={closeSheet}
        mode={mode}
        onModeChange={setMode}
        hideLabels
        rootPc={rootPc}
        onRootChange={setRootPc}
        selectedId={mode === "scale" ? scaleId : chordId}
        onSelect={(id) => (mode === "scale" ? setScaleId(id) : setChordId(id))}
        nameOf={nameOf}
        positions={[]}
        selectedPosition={position}
        positionVariants={variants}
        onPositionChange={selectPosition}
        labelMode={settings.labelMode}
        onLabelModeChange={(m) => update({ labelMode: m })}
        title={mode === "scale" ? tr("Gamme") : tr("Accord")}
      />
      <Sheet visible={sheet === "where"} onClose={closeSheet} title={tr("Position")} testID="manche-where-sheet">
        {whereSheet}
      </Sheet>
      <Sheet visible={sheet === "display"} onClose={closeSheet} title={tr("Affichage")} testID="manche-display-sheet">
        {displaySheet}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  kicker: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary },
  headerLandscape: { gap: spacing.sm, paddingBottom: spacing.xs, minHeight: 48 },
  headerPills: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  playRound: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  playBig: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  middle: { flex: 1 },
  middleContent: { paddingBottom: spacing.sm },
  bottom: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  playbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: 28, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  barToggle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  barToggleOn: { backgroundColor: c.brandTertiary, borderColor: c.brandPrimary },
  // Landscape: metronome + play grouped in one rounded square, same look as the setting pills.
  transportPill: { flexDirection: "row", alignItems: "center", gap: 6, padding: 4, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, flexShrink: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  headerText: { flex: 1, flexShrink: 1, minWidth: 0 },
  // Phones in portrait: 4 round buttons of the same size, closer together, that never shrink or get pushed out.
  headerCompact: { gap: spacing.sm },
  playBtnRound: { width: 44, paddingHorizontal: 0, justifyContent: "center", flexShrink: 0 },
  legendDivider: { width: 1, height: 24, backgroundColor: c.borderStrong, marginHorizontal: spacing.xs },
  headerTextCompact: { flexShrink: 0, maxWidth: 260 },
  titleCompact: { fontSize: 20 },
  infoInline: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 },
  roundMenuBtn: { flexShrink: 0, width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: c.surfaceTertiary,
  },
  pickerText: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700", color: c.onSurface },
  brand: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 3, color: c.brandPrimary },
  title: { fontFamily: fonts.display, fontSize: 26, fontWeight: "700", color: c.onSurface },
  titleSub: { fontFamily: fonts.text, fontSize: 15, fontWeight: "400", color: c.onSurfaceTertiary },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: c.brandPrimary,
  },
  playText: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700", color: c.onBrandPrimary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 40,
    paddingHorizontal: spacing.lg,
  },
  infoDot: { width: 10, height: 10, borderRadius: 5 },
  infoBottom: { marginTop: "auto", flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 36, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  infoNote: { fontFamily: fonts.display, fontSize: 18, fontWeight: "700", color: c.onSurface },
  infoMeta: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  panelScroll: { flex: 1 },
  panelContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  panel: { paddingVertical: spacing.md },
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTertiary,
  },
  segBtn: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segBtnActive: { backgroundColor: c.brandPrimary },
  segText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurfaceTertiary },
  segTextActive: { color: c.onBrandPrimary, fontWeight: "700" },
  formulaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  ivPill: {
    minWidth: 48,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    backgroundColor: c.surfaceSecondary,
  },
  ivLabel: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700" },
  ivNote: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceSecondary },
}));
