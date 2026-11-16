import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CaretDown, Play, Stop } from "phosphor-react-native";

import { Fretboard, fitScale } from "@/src/components/Fretboard";
import { ScalePicker } from "@/src/components/ScalePicker";
import { Chip, ChipRow, SectionLabel } from "@/src/components/Chip";
import { Score, useScore } from "@/src/components/Score";
import { StudioBackground } from "@/src/components/StudioBackground";
import { playClick, playNote, preloadClicks, preloadNotes, initAudio } from "@/src/audio/sampler";
import { runSequence } from "@/src/audio/sequencer";
import {
  EXERCISES,
  EXTENTS,
  MIN_BPM,
  buildExercise,
  buildHorizontalGroups,
  defaultBpmFor,
  exerciseAllowed,
  maxBpmFor,
  pulseOf,
  positionLadder,
  routeWindow,
  stringSetsFor,
  type Extent,
  type ExerciseId,
} from "@/src/music/exercises";
import {
  DEGREE_META,
  SCALES,
  boxVariant,
  cellKey,
  buildDegreeMap,
  degreeKeyFromNum,
  formulaDegrees,
  octaveOf,
  pcOf,
  scaleBoxes,
  TUNING,
  type DegreeKey,
} from "@/src/music/theory";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const LANDSCAPE_ROW_MIN = 22;

export default function FingeringScreen() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const { settings, update, nameOf } = useSettings();

  const [rootPc, setRootPc] = useState(0);
  const [scaleId, setScaleId] = useState("major");
  const [position, setPosition] = useState(0);
  const [variants, setVariants] = useState<number[]>([]);
  const [exerciseId, setExerciseId] = useState<ExerciseId>("scale");
  const [startOnRoot, setStartOnRoot] = useState(false);
  const [bpm, setBpm] = useState(110);
  const [bpmText, setBpmText] = useState("110");
  const [metronome, setMetronome] = useState(false);
  const [loop, setLoop] = useState(false);
  // Slow pace (default): a group of notes lasts 2 beats instead of 1, the BPM keeps a usual value.
  const [slow, setSlow] = useState(true);
  const [beat, setBeat] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [stepIdx, setStepIdx] = useState<number | null>(null);
  const [active, setActive] = useState<{ midi: number; string: number; fret: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [horizontal, setHorizontal] = useState(false);
  const [setIdx, setSetIdx] = useState(0);
  const [extent, setExtent] = useState<Extent>("octave");
  const cancelRef = useRef<(() => void) | null>(null);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const usableW = width - insets.left - insets.right - 8;
  const fretScale = isLandscape ? fitScale(usableW, 16) : 1;
  const tabBarH = usesNativeTabs ? 0 : 49 + insets.bottom;

  useEffect(() => {
    initAudio();
    preloadClicks();
    return () => cancelRef.current?.();
  }, []);

  const formula = useMemo(() => SCALES.find((s) => s.id === scaleId)!, [scaleId]);
  const degreeMap = useMemo(() => buildDegreeMap(rootPc, formula), [rootPc, formula]);
  const degrees = useMemo(() => formulaDegrees(formula), [formula]);
  const visibleLayers = useMemo(() => new Set(degrees), [degrees]);
  const colored = useMemo(() => new Set<DegreeKey>(["root"]), []);
  const boxes = useMemo(() => scaleBoxes(rootPc, formula, true), [rootPc, formula, settings.fretCount]);
  const pos = Math.min(position, boxes.length - 1);
  const variant = variants[pos] ?? 0;
  const positionWindow = useMemo(() => boxVariant(boxes[pos], variant), [boxes, pos, variant]);

  // Exercises that don't fit the scale (triads on a pentatonic, anything but the scale on special scales).
  useEffect(() => {
    if (!exerciseAllowed(exerciseId, formula)) setExerciseId("scale");
  }, [formula, exerciseId]);

  // Horizontal mode: needs groups of 2+ notes (no single-note scale) and a 7-note or pentatonic scale (no special scale).
  const horizontalOk = !formula.special;
  useEffect(() => {
    if (horizontal && !horizontalOk) setHorizontal(false);
  }, [horizontal, horizontalOk]);
  useEffect(() => {
    if (horizontal && exerciseId === "scale") setExerciseId("thirds");
  }, [horizontal, exerciseId]);
  // Lowest strings by default whenever the exercise (so the group size) changes.
  useEffect(() => {
    setSetIdx(0);
  }, [exerciseId]);

  // Horizontal mode: the chord groups stay on a set of adjacent strings and climb the neck.
  const stringSets = useMemo(() => stringSetsFor(exerciseId), [exerciseId]);
  const setI = Math.min(setIdx, stringSets.length - 1);
  const hGroups = useMemo(
    () => (horizontal ? buildHorizontalGroups(rootPc, formula, exerciseId, stringSets[setI], extent === "all" ? -1 : 0, extent) : []),
    [horizontal, rootPc, formula, exerciseId, stringSets, setI, extent, settings.fretCount],
  );
  // Only the notes actually played are lit (no orphan note without its group at the ends of the neck).
  const windowRange = useMemo(() => (horizontal ? routeWindow(hGroups) : positionWindow), [horizontal, hGroups, positionWindow]);
  const stringSetName = (st: { strings: number[] }) => st.strings.map((s) => nameOf(pcOf(TUNING[s]))).join("·");

  const ladder = useMemo(() => positionLadder(rootPc, formula, positionWindow), [rootPc, formula, positionWindow]);
  const sequence = useMemo(
    () => (horizontal ? hGroups.flat() : buildExercise(ladder, exerciseId, rootPc, startOnRoot)),
    [horizontal, hGroups, ladder, exerciseId, rootPc, startOnRoot],
  );
  const exercise = EXERCISES.find((e) => e.id === exerciseId)!;

  // The group of notes being played (or about to be, during the count-in): ringed on the neck.
  const groupSize = exercise.offsets.length;
  const nextCells = useMemo(() => {
    if (groupSize < 2) return null;
    const cur = stepIdx !== null ? stepIdx : beat !== null ? 0 : null;
    if (cur === null) return null;
    const start = Math.floor(cur / groupSize) * groupSize;
    const cells = new Set<string>();
    sequence.slice(start, start + groupSize).forEach((st) => st.loc && cells.add(cellKey(st.loc.string, st.loc.fret)));
    return cells;
  }, [groupSize, stepIdx, beat, sequence]);

  // Score under the fretboard: portrait always; landscape on request (staff only, to save height).
  const showScore = !isLandscape || settings.showScoreLandscape;
  // Landscape: the tablature is shown only when the screen is tall enough (tablets); phones keep the staff alone.
  const landscapeRoom = height - insets.top - tabBarH - bottomChrome - 52 - 52 - 22 - 8 - 6 * LANDSCAPE_ROW_MIN - 6;
  const tabOn = settings.showTab && (!isLandscape || landscapeRoom >= 214);
  const { layout } = useScore(sequence, exerciseId, exercise.perBeat, rootPc, formula, tabOn, slow, bpm, pulseOf(exerciseId, slow).half);
  const rowH = isLandscape
    ? Math.max(
        showScore ? LANDSCAPE_ROW_MIN : 26,
        Math.min(34, Math.floor((height - insets.top - tabBarH - bottomChrome - 52 - 52 - 22 - 8 - (showScore ? layout.height + 6 : 0)) / 6)),
      )
    : 34;

  // Tempo is in beats (quarter notes) per minute; each exercise has its own ceiling (its fastest notes stay playable).
  const maxBpm = maxBpmFor(exerciseId, slow);
  const pulse = pulseOf(exerciseId, slow);
  // Count-in: one bar, or only its second half when the tempo is slow (under 70), so the wait stays short.
  const countBeats = bpm < 70 ? pulse.barPulses / 2 : pulse.barPulses;
  const countOffset = pulse.barPulses - countBeats; // half a bar counts "3, 4" (or "2" in 2/2)
  const commitBpm = useCallback(
    (text: string) => {
      const n = parseInt(text, 10);
      const v = Math.max(MIN_BPM, Math.min(maxBpm, Number.isFinite(n) ? n : 80));
      setBpm(v);
      setBpmText(String(v));
    },
    [maxBpm],
  );
  // Each exercise starts at its own comfortable tempo (eighths 80, triplets 60, sixteenths 50).
  useEffect(() => {
    commitBpm(String(defaultBpmFor(exerciseId, slow)));
  }, [exerciseId, slow, commitBpm]);
  useEffect(() => {
    if (bpm > maxBpm) commitBpm(String(maxBpm));
  }, [bpm, maxBpm, commitBpm]);

  // Load the audio players of every note of the exercise ahead of time: no delay when it starts.
  useEffect(() => {
    preloadNotes(sequence.map((st) => st.midi));
  }, [sequence]);

  const stop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setPlaying(false);
    setActive(null);
    setStepIdx(null);
    setBeat(null);
  }, []);

  // Any change of the exercise stops what is playing.
  useEffect(() => {
    stop();
  }, [sequence, bpm, slow, loop, metronome, stop]);

  const selectPosition = useCallback(
    (i: number | null) => {
      if (i === null) return;
      if (i === pos) {
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
    [pos, boxes.length],
  );

  const showStep = useCallback(
    (i: number) => {
      const step = sequence[i];
      if (!step) return;
      playNote(step.midi, settings.volume);
      setStepIdx(i);
      setActive(step.loc ? { midi: step.midi, string: step.loc.string, fret: step.loc.fret } : null);
    },
    [sequence, settings.volume],
  );

  const togglePlay = () => {
    if (playing) {
      stop();
      return;
    }
    if (!sequence.length) return;
    const finish = () => {
      cancelRef.current = null;
      setPlaying(false);
      setActive(null);
      setStepIdx(null);
      setBeat(null);
    };
    cancelRef.current = runSequence({
      length: sequence.length,
      noteMs: 60000 / bpm / pulse.notesPerPulse,
      beatMs: 60000 / bpm, // a beat = the pulse (quarter note, or half note for the slow triplets)
      beats: countBeats,
      loop,
      onBeat: (b) => {
        playClick(countOffset + b, settings.volume);
        setBeat(countOffset + b + 1);
      },
      onNote: (n) => {
        if (n === 0) setBeat(null);
        showStep(n);
      },
      onClick: metronome ? (k) => playClick(k % pulse.barPulses, settings.volume * 0.8) : undefined,
      onEnd: finish,
    });
    setPlaying(true);
  };

  const onNotePress = useCallback(
    (midi: number, s: number, f: number) => {
      setActive({ midi, string: s, fret: f });
      Haptics.selectionAsync().catch(() => {});
      if (settings.soundOnTap) playNote(midi, settings.volume);
    },
    [settings.soundOnTap, settings.volume],
  );

  const tapNote = useCallback(
    (i: number) => {
      if (!playing) showStep(i);
    },
    [playing, showStep],
  );

  const title = `${nameOf(rootPc)}`;
  const empty = sequence.length === 0;

  const exerciseChips = EXERCISES.map((e) => {
    const ok = exerciseAllowed(e.id, formula) && !(horizontal && e.id === "scale");
    return (
      <Chip
        key={e.id}
        testID={`exercise-${e.id}`}
        label={e.name}
        selected={exerciseId === e.id}
        dim={!ok}
        onPress={() => ok && setExerciseId(e.id)}
      />
    );
  });

  const modeChips = (
    <>
      <Chip testID="mode-position" label="Sur une position" selected={!horizontal} onPress={() => setHorizontal(false)} />
      <Chip testID="mode-horizontal" label="Horizontal" selected={horizontal} dim={!horizontalOk} onPress={() => horizontalOk && setHorizontal(true)} />
    </>
  );
  const stringChips = stringSets.map((st, i) => (
    <Chip key={i} testID={`hz-strings-${i}`} label={stringSetName(st)} selected={setI === i} onPress={() => setSetIdx(i)} />
  ));

  const pickerTop = (
    <>
      <SectionLabel>Exercice</SectionLabel>
      <ChipRow testID="exercise-selector">{exerciseChips}</ChipRow>
      <Text style={styles.hint}>{exercise.description}</Text>

      <SectionLabel>Mode</SectionLabel>
      <ChipRow testID="mode-selector">{modeChips}</ChipRow>
      {horizontal ? (
        <Text style={styles.hint}>Les groupes restent sur les mêmes cordes et montent le long du manche.</Text>
      ) : null}

    </>
  );
  const pickerExtra = (
    <>
      {horizontal ? (
        <>
          <SectionLabel>Cordes</SectionLabel>
          <ChipRow testID="hz-strings">{stringChips}</ChipRow>

          <SectionLabel>Étendue</SectionLabel>
          <ChipRow testID="hz-extent">
            {EXTENTS.map((e) => (
              <Chip key={e.id} testID={`hz-extent-${e.id}`} label={e.name} selected={extent === e.id} onPress={() => setExtent(e.id)} />
            ))}
          </ChipRow>
        </>
      ) : (
        <>
          <SectionLabel>Départ</SectionLabel>
          <ChipRow testID="start-selector">
            <Chip testID="start-lowest" label="Note la plus grave" selected={!startOnRoot} onPress={() => setStartOnRoot(false)} />
            <Chip testID="start-root" label="Tonique" selected={startOnRoot} onPress={() => setStartOnRoot(true)} />
          </ChipRow>
        </>
      )}

      <SectionLabel>Débit des notes</SectionLabel>
      <ChipRow testID="pace-selector">
        <Chip testID="pace-slow" label="Lent (notes 2× plus longues)" selected={slow} onPress={() => setSlow(true)} />
        <Chip testID="pace-normal" label="Normal" selected={!slow} onPress={() => setSlow(false)} />
      </ChipRow>

      <SectionLabel>{pulse.half ? "Tempo (BPM, à la blanche)" : "Tempo (BPM, à la noire)"}</SectionLabel>
      <View style={styles.bpmRow}>
        <Pressable testID="bpm-minus" onPress={() => commitBpm(String(bpm - 5))} style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <TextInput
          testID="bpm-input"
          value={bpmText}
          onChangeText={setBpmText}
          onEndEditing={() => commitBpm(bpmText)}
          onSubmitEditing={() => commitBpm(bpmText)}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={3}
          selectTextOnFocus
          style={styles.bpmInput}
        />
        <Pressable testID="bpm-plus" onPress={() => commitBpm(String(bpm + 5))} style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
        <Pressable
          testID="bpm-ok"
          onPress={() => {
            commitBpm(bpmText);
            Keyboard.dismiss();
          }}
          style={({ pressed }) => [styles.stepBtn, styles.okBtn, pressed && styles.pressed]}
        >
          <Text style={styles.stepText}>OK</Text>
        </Pressable>
        <Text style={styles.bpmHint}>max {maxBpm} pour cet exercice</Text>
      </View>

      <SectionLabel>Lecture</SectionLabel>
      <ChipRow testID="play-options">
        <Chip testID="loop-toggle" label={loop ? "Boucle : oui" : "Boucle : non"} selected={loop} onPress={() => setLoop(!loop)} />
        <Chip testID="metronome-toggle" label={metronome ? "Métronome : oui" : "Métronome : non"} selected={metronome} onPress={() => setMetronome(!metronome)} />
      </ChipRow>

      <SectionLabel>Partition</SectionLabel>
      <ChipRow testID="tab-selector">
        <Chip testID="tab-on" label="Notes + tablature" selected={settings.showTab} onPress={() => update({ showTab: true })} />
        <Chip testID="tab-off" label="Notes seules" selected={!settings.showTab} onPress={() => update({ showTab: false })} />
      </ChipRow>

    </>
  );

  const infoContent = active ? (
    <>
      <Text style={styles.infoNote}>
        {nameOf(pcOf(active.midi))}
        {octaveOf(active.midi)}
      </Text>
      <Text style={styles.infoMeta} numberOfLines={1}>
        Corde {active.string + 1} · Case {active.fret}
        {stepIdx !== null ? ` · Note ${stepIdx + 1}/${sequence.length}` : ""}
      </Text>
    </>
  ) : (
    <Text style={styles.infoMeta} numberOfLines={1}>
      {beat !== null ? `Décompte ${beat}/${pulse.barPulses}…` : empty ? (horizontal ? "Parcours impossible sur ces cordes." : "Position trop courte : essayez 1/2.") : horizontal ? `${exercise.name} · ${stringSetName(stringSets[setI])} · ${sequence.length} notes` : `${exercise.name} · ${sequence.length} notes`}
    </Text>
  );

  const positionBadge = horizontal ? `Horizontal · ${stringSetName(stringSets[setI])}` : `Pos. ${pos + 1} · ${variant + 1}/2`;

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="fingering-screen">
      <StudioBackground />
      <View style={[styles.header, { paddingTop: insets.top + (isLandscape ? spacing.xs : spacing.sm) }]}>
        <View style={isLandscape ? styles.headerTextCompact : styles.headerText}>
          {!isLandscape ? <Text style={styles.brand}>FRETSTUDIO · DOIGTÉ</Text> : null}
          <Text style={[styles.title, isLandscape && styles.titleCompact]} testID="fingering-title" numberOfLines={isLandscape ? 1 : 2}>
            {title} <Text style={styles.titleSub}>{formula.name} · {positionBadge}</Text>
          </Text>
        </View>
        {isLandscape ? (
          <View style={styles.infoInline} testID="fingering-info">
            {infoContent}
          </View>
        ) : null}
        <Pressable testID="open-fingering-picker" onPress={() => setPickerOpen(true)} style={({ pressed }) => [styles.pickerBtn, pressed && styles.pressed]}>
          <Text style={styles.pickerText}>Exercice</Text>
          <CaretDown size={16} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Pressable testID="fingering-play" onPress={togglePlay} style={({ pressed }) => [styles.playBtn, pressed && styles.pressed, empty && styles.dim]}>
          {playing ? <Stop size={20} color={colors.onBrandPrimary} weight="fill" /> : <Play size={20} color={colors.onBrandPrimary} weight="fill" />}
          {!isLandscape ? <Text style={styles.playText}>{playing ? "Stop" : "Jouer"}</Text> : null}
        </Pressable>
      </View>

      {!isLandscape ? (
        <View style={styles.infoBar} testID="fingering-info">
          {infoContent}
        </View>
      ) : null}

      <Fretboard
        fretScale={fretScale}
        rowH={rowH}
        degreeMap={degreeMap}
        visibleLayers={visibleLayers}
        coloredLayers={colored}
        windowRange={windowRange}
        nextCells={nextCells}
        labelMode={settings.labelMode}
        showNeutral={false}
        nameOf={nameOf}
        activeMidi={active}
        onNotePress={onNotePress}
      />

      {showScore ? <Score layout={layout} activeIndex={stepIdx} onNotePress={tapNote} testID="fingering-score" /> : null}

      <ScalePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        mode="scale"
        onModeChange={() => {}}
        scalesOnly
        hideAllPosition
        title="Exercice et gamme"
        top={pickerTop}
        extra={pickerExtra}
        rootPc={rootPc}
        onRootChange={setRootPc}
        selectedId={scaleId}
        onSelect={setScaleId}
        nameOf={nameOf}
        positions={horizontal ? [] : boxes}
        selectedPosition={pos}
        positionVariants={variants}
        onPositionChange={selectPosition}
        labelMode={settings.labelMode}
        onLabelModeChange={(m) => update({ labelMode: m })}
      />

      {isLandscape ? (
        <ChipRow testID="fingering-landscape-row">
          {exerciseChips}
          <Chip testID="fingering-score-toggle" label={settings.showScoreLandscape ? "Partition : oui" : "Partition : non"} selected={settings.showScoreLandscape} onPress={() => update({ showScoreLandscape: !settings.showScoreLandscape })} />
          <View style={styles.divider} />
          {modeChips}
          <View style={styles.divider} />
          {horizontal ? stringChips : boxes.map((_, i) => (
            <Chip
              key={i}
              testID={`fingering-position-${i + 1}`}
              label={`Pos. ${i + 1}`}
              badge={`${(variants[i] ?? 0) + 1}/2`}
              badgeTone={(variants[i] ?? 0) === 1 ? "accent" : "primary"}
              selected={pos === i}
              onPress={() => selectPosition(i)}
            />
          ))}
        </ChipRow>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
  headerText: { flex: 1 },
  headerTextCompact: { flexShrink: 0, maxWidth: 260 },
  infoInline: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 },
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
  titleCompact: { fontSize: 20 },
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
  dim: { opacity: 0.4 },
  infoBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 40, paddingHorizontal: spacing.lg },
  infoNote: { fontFamily: fonts.display, fontSize: 18, fontWeight: "700", color: c.onSurface },
  infoMeta: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  bpmRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  stepBtn: { minWidth: 44, height: 40, paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  okBtn: { borderColor: c.brandPrimary },
  stepText: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface },
  bpmInput: { width: 72, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surfaceTertiary, textAlign: "center", fontFamily: fonts.display, fontSize: 18, fontWeight: "700", color: c.onSurface },
  bpmHint: { flex: 1, fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary },
  divider: { width: 1, height: 24, backgroundColor: c.borderStrong, marginHorizontal: spacing.xs },
  hint: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
}));
