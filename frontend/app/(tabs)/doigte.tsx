import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LANDSCAPE_NAV_W } from "@/src/components/AppTabBar";
import { resumeWebAudio, stopWebNotes, webAudioScheduling } from "@/src/audio/webAudio";
import { MAJOR, PAIR_FORMULA, PAIR_STYLES, pairRoots, pairSequence, type PairStyle } from "@/src/music/triadPairs";
import { TempoButton } from "@/src/components/TempoSheet";
import { KeyButton, KeyWheel } from "@/src/components/KeyWheel";
import { ExerciseLibrary, PRESETS, type ExercisePreset } from "@/src/components/ExerciseLibrary";
import { shortName } from "@/src/music/shortNames";
import { Pill, PillRow } from "@/src/components/Pill";
import { Sheet } from "@/src/components/Sheet";
import { PositionChips } from "@/src/components/PositionChips";
import { ARP_SHAPES, ARP_TYPES, arpFormula, arpGroupsUpDown, arpTwoStringGroups, arpRoutes, arpShapePlacements, arpUpDown, arpWindow, type ArpNote, type ArpTypeId } from "@/src/music/arpeggios";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CaretLeft, Info, Metronome, Play, Repeat, Stop } from "phosphor-react-native";

import { Fretboard, fitScale } from "@/src/components/Fretboard";
import { ScalePicker } from "@/src/components/ScalePicker";
import { Chip, ChipRow, SectionLabel } from "@/src/components/Chip";
import { Score, useScore } from "@/src/components/Score";
import { StudioBackground } from "@/src/components/StudioBackground";
import { playClick, playNote, preloadClicks, preloadNotes, initAudio } from "@/src/audio/sampler";
import { runSequence } from "@/src/audio/sequencer";
import { playRendered, prerender, renderedPlayback, type RenderSpec } from "@/src/audio/render";
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
  stringCountsFor,
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
import { tr } from "@/src/i18n";
import { useTabReset } from "@/src/tabNav";

const LANDSCAPE_ROW_MIN = 22;

// Note values per notes-per-beat of the exercise: [slow pace, normal pace].
const PACE_NOTES: Record<number, [string, string]> = { 2: ["noires", "croches"], 3: ["triolets de noires", "triolets"], 4: ["croches", "doubles croches"] };

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
  // One focused sheet per pill ("exercise" = the title), and the key wheel.
  const [sheet, setSheet] = useState<null | "exercise" | "scale" | "arpType" | "where" | "variant" | "display">(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const closeSheet = () => setSheet(null);
  const [horizontal, setHorizontal] = useState(false);
  const [setIdx, setSetIdx] = useState(0);
  // Horizontal: number of strings a group is spread over (null = one note per string).
  const [stringCount, setStringCount] = useState<number | null>(null);
  const [extent, setExtent] = useState<Extent>("octave");
  // Subject of the exercises: scales (with the exercises above) or the 4-note arpeggio shapes.
  const [subject, setSubject] = useState<"scale" | "arp" | "pairs">("scale");
  // The tab opens on the exercise library; a card opens the exercise screen, set for that exercise.
  // S’exercer: the library or an exercise.
  const [view, setView] = useState<"library" | "exercise">("library");
  const [presetId, setPresetId] = useState<string | null>(null);
  const arp = subject === "arp";
  // Triad pairs (IV & V of the key, through a position of the major scale), played in triplets.
  const pairs = subject === "pairs";
  const [pairStyle, setPairStyle] = useState<PairStyle>("up");
  const [arpType, setArpType] = useState<ArpTypeId>("maj7");
  const [arpShape, setArpShape] = useState(0);
  const [arpVariant, setArpVariant] = useState(0);
  const [towardBody, setTowardBody] = useState(true);
  // Horizontal arpeggios: the 5 shapes linked two by two, or the triad on pairs of strings (+ the 7th or not).
  const [arpKind, setArpKind] = useState<"shapes" | "twoStrings">("shapes");
  const [withSeventh, setWithSeventh] = useState(true);
  const cancelRef = useRef<(() => void) | null>(null);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  // Phones in portrait: the menu button is a round icon, the play button has no label.
  const usableW = width - insets.left - insets.right - 8;
  const fretScale = isLandscape ? fitScale(usableW, 16) : 1;
  // Landscape: the tab bar sits at the top right, over the header (no bottom bar).
  const tabBarH = usesNativeTabs || width > height ? 0 : 49 + insets.bottom;

  useEffect(() => {
    initAudio();
    preloadClicks();
    return () => cancelRef.current?.();
  }, []);

  const formula = useMemo(() => SCALES.find((s) => s.id === scaleId)!, [scaleId]);
  // What is shown on the neck and written on the score: the scale, or the chord of the arpeggio.
  const shown = useMemo(() => (pairs ? PAIR_FORMULA : arp ? arpFormula(arpType) : formula), [pairs, arp, arpType, formula]);
  // The score spells the notes from a 7-note scale (key signature): the major scale for the triad pairs.
  const scoreFormula = pairs ? MAJOR : shown;
  // Arpeggios are played 4 notes per beat (like the seventh arpeggios): same pulse, tempo and groups.
  const twoStrings = arp && horizontal && arpKind === "twoStrings";
  // Arpeggios: 4 notes per beat; the triad on 2 strings without its 7th: 3 notes per beat (triplets).
  const rhythmId: ExerciseId = pairs ? "triads" : arp ? (twoStrings && !withSeventh ? "triads" : "sevenths") : exerciseId;
  const degreeMap = useMemo(() => buildDegreeMap(rootPc, shown), [rootPc, shown]);
  const degrees = useMemo(() => formulaDegrees(shown), [shown]);
  const visibleLayers = useMemo(() => new Set(degrees), [degrees]);
  const colored = useMemo(() => new Set<DegreeKey>(["root"]), []);
  const boxes = useMemo(() => scaleBoxes(rootPc, pairs ? MAJOR : formula, true), [rootPc, pairs, formula, settings.fretCount]);
  const pos = Math.min(position, boxes.length - 1);
  // 2/2 (the same position an octave up) only where it fits on the neck and gives something to play.
  const hasSecond = useMemo(
    () =>
      boxes.map((b) => {
        const w = boxVariant(b, 1);
        if (w.max > settings.fretCount || w.min > w.max) return false;
        if (arp || horizontal || twoStrings) return true;
        const seq = pairs ? pairSequence(rootPc, w, pairStyle) : buildExercise(positionLadder(rootPc, formula, w), exerciseId, rootPc, startOnRoot);
        return seq.length > 0;
      }),
    [boxes, settings.fretCount, arp, horizontal, twoStrings, pairs, rootPc, pairStyle, formula, exerciseId, startOnRoot],
  );
  const variant = hasSecond[pos] ? (variants[pos] ?? 0) : 0;
  const positionWindow = useMemo(() => boxVariant(boxes[pos], variant), [boxes, pos, variant]);

  // Exercises that don't fit the scale (triads on a pentatonic, anything but the scale on special scales).
  useEffect(() => {
    if (!exerciseAllowed(exerciseId, formula)) setExerciseId("scale");
  }, [formula, exerciseId]);

  // Horizontal mode: needs groups of 2+ notes (no single-note scale) and a 7-note or pentatonic scale (no special scale).
  const horizontalOk = !pairs && (arp || !formula.special);
  useEffect(() => {
    if (horizontal && !horizontalOk) setHorizontal(false);
  }, [horizontal, horizontalOk]);
  useEffect(() => {
    if (!arp && horizontal && exerciseId === "scale") setExerciseId("thirds");
  }, [arp, horizontal, exerciseId]);
  // Lowest strings by default whenever the exercise (so the group size) changes.
  useEffect(() => {
    setSetIdx(0);
  }, [exerciseId]);

  // Horizontal mode: the chord groups stay on a set of adjacent strings and climb the neck.
  const stringCounts = useMemo(() => stringCountsFor(exerciseId), [exerciseId]);
  const nStrings = stringCount !== null && stringCounts.includes(stringCount) ? stringCount : stringCounts[stringCounts.length - 1];
  const stringSets = useMemo(() => stringSetsFor(exerciseId, nStrings), [exerciseId, nStrings]);
  const setI = Math.min(setIdx, stringSets.length - 1);
  const hGroups = useMemo(
    () => (horizontal ? buildHorizontalGroups(rootPc, formula, exerciseId, stringSets[setI], extent === "all" ? -1 : 0, extent) : []),
    [horizontal, rootPc, formula, exerciseId, stringSets, setI, extent, settings.fretCount],
  );
  // Only the notes actually played are lit (no orphan note without its group at the ends of the neck).
  // Arpeggios: the shape in one position, or the route from the shape to its neighbour (horizontal).
  const arpList = useMemo<ArpNote[][]>(
    () => (!arp ? [] : horizontal ? arpRoutes(arpType, arpShape, rootPc, towardBody) : arpShapePlacements(arpType, arpShape, rootPc)),
    [arp, horizontal, arpType, arpShape, rootPc, towardBody, settings.fretCount],
  );
  const arpV = Math.max(0, Math.min(arpVariant, arpList.length - 1));
  const twoStringGroups = useMemo(
    () => (twoStrings ? arpTwoStringGroups(arpType, rootPc, withSeventh) : []),
    [twoStrings, arpType, rootPc, withSeventh, settings.fretCount],
  );
  const arpNotes = useMemo<ArpNote[]>(() => (twoStrings ? twoStringGroups.flat() : arpList[arpV] ?? []), [twoStrings, twoStringGroups, arpList, arpV]);
  useEffect(() => {
    setArpVariant(0);
  }, [arpType, rootPc, horizontal, towardBody]);
  const windowRange = useMemo(
    () => (arp ? arpWindow(arpNotes, horizontal) : horizontal ? routeWindow(hGroups) : positionWindow),
    [arp, arpNotes, horizontal, hGroups, positionWindow],
  );
  const stringSetName = (st: { strings: number[] }) => st.strings.map((s) => nameOf(pcOf(TUNING[s]))).join("·");

  const ladder = useMemo(() => positionLadder(rootPc, formula, positionWindow), [rootPc, formula, positionWindow]);
  const sequence = useMemo(
    () => (pairs ? pairSequence(rootPc, positionWindow, pairStyle) : twoStrings ? arpGroupsUpDown(twoStringGroups) : arp ? arpUpDown(arpNotes, !horizontal && startOnRoot) : horizontal ? hGroups.flat() : buildExercise(ladder, exerciseId, rootPc, startOnRoot)),
    [pairs, positionWindow, pairStyle, twoStrings, twoStringGroups, arp, arpNotes, horizontal, hGroups, ladder, exerciseId, rootPc, startOnRoot],
  );
  const exercise = EXERCISES.find((e) => e.id === rhythmId)!;

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
  const landscapeRoom = height - insets.top - tabBarH - bottomChrome - 52 - 22 - 8 - 6 * LANDSCAPE_ROW_MIN - 6;
  const tabOn = settings.showTab && (!isLandscape || landscapeRoom >= 214);
  const { layout } = useScore(sequence, pairs ? "triads" : arp ? "path" : exerciseId, exercise.perBeat, rootPc, scoreFormula, tabOn, slow, bpm, pulseOf(rhythmId, slow).half);
  const rowH = isLandscape
    ? Math.max(
        showScore ? LANDSCAPE_ROW_MIN : 26,
        Math.min(34, Math.floor((height - insets.top - tabBarH - bottomChrome - 52 - 22 - 8 - (showScore ? layout.height + 6 : 0)) / 6)),
      )
    : 34;

  // Tempo is in beats (quarter notes) per minute; each exercise has its own ceiling (its fastest notes stay playable).
  const maxBpm = maxBpmFor(rhythmId, slow);
  const pulse = pulseOf(rhythmId, slow);
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
    commitBpm(String(defaultBpmFor(rhythmId, slow)));
  }, [rhythmId, slow, commitBpm]);
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
    [pos, boxes.length, hasSecond],
  );

  const showStep = useCallback(
    (i: number, silent = false) => {
      const step = sequence[i];
      if (!step) return;
      if (!silent) playNote(step.midi, settings.volume);
      setStepIdx(i);
      setActive(step.loc ? { midi: step.midi, string: step.loc.string, fret: step.loc.fret } : null);
    },
    [sequence, settings.volume],
  );

  const pickPreset = (p: ExercisePreset) => {
    stop();
    setSubject(p.subject);
    if (p.exerciseId) setExerciseId(p.exerciseId);
    setHorizontal(p.horizontal);
    if (p.arpKind) setArpKind(p.arpKind);
    setPresetId(p.id);
    setView("exercise");
  };
  const backToLibrary = () => {
    stop();
    setSheet(null);
    setView("library");
  };
  useTabReset("doigte", backToLibrary); // the S’exercer tab always opens on the library (FS-36)


  // iPhone / Android: the whole sequence is mixed ahead into one sound file (render.ts) — the rhythm no longer depends on
  // the JavaScript thread. It is mixed while nothing plays, a moment after each change, so Play starts at once.
  const renderSpec = (): RenderSpec => ({
    midis: sequence.map((st) => st.midi),
    noteMs: 60000 / bpm / pulse.notesPerPulse,
    beatMs: 60000 / bpm,
    beats: countBeats,
    firstBeat: countOffset,
    loop,
    volume: settings.volume,
    metronome: metronome ? { barPulses: pulse.barPulses, volume: settings.volume * 0.8 } : null,
  });
  useEffect(() => {
    if (!renderedPlayback || playing || !sequence.length) return;
    const id = setTimeout(() => prerender(renderSpec()), 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence, bpm, loop, metronome, settings.volume, countBeats, playing]);

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
    if (renderedPlayback) {
      let cancelled = false;
      cancelRef.current = () => {
        cancelled = true;
      };
      setPlaying(true);
      // The screen follows the sound itself (its position in the file), not a separate timer.
      playRendered(renderSpec(), {
        onBeat: (bt) => setBeat(countOffset + bt + 1),
        onNote: (n) => {
          if (n === 0) setBeat(null);
          showStep(n, true);
        },
        onEnd: finish,
      }).then((h) => {
        if (cancelled) {
          h?.stop();
          return;
        }
        if (!h) {
          startLive(finish); // could not load the mixed file: the live sampler plays it
          return;
        }
        cancelRef.current = h.stop;
      });
      return;
    }
    startLive(finish);
  };

  const startLive = (finish: () => void) => {
    resumeWebAudio();
    cancelRef.current = runSequence({
      length: sequence.length,
      noteMs: 60000 / bpm / pulse.notesPerPulse,
      beatMs: 60000 / bpm, // a beat = the pulse (quarter note, or half note for the slow triplets)
      beats: countBeats,
      loop,
      onBeat: (b) => {
        if (!webAudioScheduling) playClick(countOffset + b, settings.volume);
        setBeat(countOffset + b + 1);
      },
      onNote: (n) => {
        if (n === 0) setBeat(null);
        showStep(n, webAudioScheduling);
      },
      onClick: metronome ? (k) => playClick(k % pulse.barPulses, settings.volume * 0.8) : undefined,
      // Web: sounds scheduled ahead on the audio clock (notes, count-in and metronome stay exactly together).
      audio: webAudioScheduling
        ? {
            beat: (b, at) => playClick(countOffset + b, settings.volume, at),
            note: (n, at) => playNote(sequence[n].midi, settings.volume, at),
            click: metronome ? (k, at) => playClick(k % pulse.barPulses, settings.volume * 0.8, at) : undefined,
            cancel: stopWebNotes,
          }
        : undefined,
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

  const selectArpShape = (i: number) => {
    if (i === arpShape) setArpVariant(arpList.length > 1 ? (arpV + 1) % arpList.length : 0);
    else {
      setArpShape(i);
      setArpVariant(0);
    }
  };
  const arpSymbol = ARP_TYPES.find((t) => t.id === arpType)!.symbol;
  const empty = sequence.length === 0;

  const exerciseChips = EXERCISES.map((e) => {
    const ok = exerciseAllowed(e.id, formula) && !(horizontal && e.id === "scale");
    return (
      <Chip
        key={e.id}
        testID={`exercise-${e.id}`}
        label={tr(e.name)}
        selected={exerciseId === e.id}
        dim={!ok}
        onPress={() => ok && setExerciseId(e.id)}
      />
    );
  });

  const modeChips = (
    <>
      <Chip testID="mode-position" label={tr("Sur une position")} selected={!horizontal} onPress={() => setHorizontal(false)} />
      <Chip testID="mode-horizontal" label={tr("Horizontal")} selected={horizontal} dim={!horizontalOk} onPress={() => horizontalOk && setHorizontal(true)} />
    </>
  );
  const stringChips = stringSets.map((st, i) => (
    <Chip key={i} testID={`hz-strings-${i}`} label={stringSetName(st)} selected={setI === i} onPress={() => setSetIdx(i)} />
  ));

  const arpTypeChips = ARP_TYPES.map((t) => (
    <Chip key={t.id} testID={`arp-type-${t.id}`} label={`${nameOf(rootPc)}${t.symbol}`} selected={arpType === t.id} onPress={() => setArpType(t.id)} />
  ));
  const arpShapeChips = ARP_SHAPES.map((name, i) => (
    <Chip
      key={name}
      testID={`arp-shape-${i}`}
      label={tr(name)}
      badge={arpShape === i && arpList.length > 1 ? `${arpV + 1}/${arpList.length}` : undefined}
      badgeTone={arpV === 1 ? "accent" : "primary"}
      selected={arpShape === i}
      onPress={() => selectArpShape(i)}
    />
  ));

  const [pairA, pairB] = pairRoots(rootPc);
  const pairStyleChips = PAIR_STYLES.map((st) => (
    <Chip key={st.id} testID={`pair-style-${st.id}`} label={tr(st.name)} selected={pairStyle === st.id} onPress={() => setPairStyle(st.id)} />
  ));

  // The played / touched note isn't written out (it goes too fast during the sequence): only a route problem is.
  const infoContent = empty ? (
    <Text style={styles.infoMeta} numberOfLines={1}>
      {horizontal ? tr("Parcours impossible sur ces cordes.") : tr("Position trop courte : essayez 1/2.")}
    </Text>
  ) : null;

  // ---- What each pill says: the screen shows everything that is set ----
  const arpOther = ARP_SHAPES[(arpShape + (towardBody ? 1 : ARP_SHAPES.length - 1)) % ARP_SHAPES.length];
  const arpBadge = (horizontal ? `${tr(ARP_SHAPES[arpShape])} → ${tr(arpOther)}` : tr("Schéma {name}", { name: tr(ARP_SHAPES[arpShape]) })) + (arpList.length > 1 ? ` · ${arpV + 1}/${arpList.length}` : "");
  const twoBadge = withSeventh ? tr("2 cordes · avec 7e") : tr("2 cordes · triade");
  const positionBadge = twoStrings ? twoBadge : arp ? arpBadge : horizontal ? tr("Horizontal · {strings}", { strings: stringSetName(stringSets[setI]) }) : (hasSecond[pos] ? `Pos. ${pos + 1} · ${variant + 1}/2` : `Pos. ${pos + 1}`);
  const scaleExercise = EXERCISES.find((e) => e.id === exerciseId)!;
  const preset = PRESETS.find((p) => p.id === presetId);
  const exerciseTitle = preset ? tr(preset.name) : pairs
    ? tr("Paires de triades")
    : arp
      ? twoStrings
        ? tr("3 sons sur 2 cordes")
        : tr("Arpèges 4 sons")
      : tr(scaleExercise.name);
  // Landscape: short labels, so that the whole header fits on one row next to the tab bar.
  const exerciseShort = pairs ? tr("Paires") : arp ? (twoStrings ? tr("Triades 2 cordes") : tr("Arpèges")) : tr(scaleExercise.name);
  const whereShort = twoStrings
    ? withSeventh
      ? tr("2 cordes · 7e")
      : tr("2 cordes")
    : arp
      ? horizontal
        ? `${tr(ARP_SHAPES[arpShape])} → ${tr(arpOther)}`
        : tr("Schéma {name}", { name: tr(ARP_SHAPES[arpShape]) })
      : horizontal
        ? stringSetName(stringSets[setI])
        : (hasSecond[pos] ? `Pos. ${pos + 1} · ${variant + 1}/2` : `Pos. ${pos + 1}`);
  const modeLabel = !pairs ? (horizontal ? tr("Horizontal") : tr("Sur une position")) : null;
  const keyLabel = `${nameOf(rootPc)}${arp ? arpSymbol : ""}`;
  const paceNotes = PACE_NOTES[exercise.perBeat] ?? ["noires", "croches"];

  // ---- Sheet contents ----
  // Title sheet: what the exercise is (and, in landscape, the display settings).
  const exerciseSheet = (
    <>
      <Text style={styles.hint}>
        {pairs
          ? tr("Les triades majeures des degrés IV et V de la tonalité ({a} et {b}), à travers les renversements, dans une position de la gamme majeure. Aussi valable en mineur mélodique.", { a: nameOf(pairA), b: nameOf(pairB) })
          : twoStrings
            ? tr("La triade sur Mi-La, Ré-Sol puis Si-Mi : fondamentale sur la corde grave, tierce et quinte sur la suivante.")
            : arp
              ? horizontal
                ? tr("L’arpège passe du schéma choisi au schéma voisin en se déplaçant sur le manche.")
                : tr("5 schémas · ∆7, 7, m7, Ø")
              : horizontal
                ? `${tr(scaleExercise.description)} ${tr("Les groupes restent sur les mêmes cordes et montent le long du manche.")}`
                : tr(scaleExercise.description)}
      </Text>
    </>
  );

  const whereSheet = twoStrings ? (
    <>
      <Text style={styles.hint}>{tr("La triade sur Mi-La, Ré-Sol puis Si-Mi : fondamentale sur la corde grave, tierce et quinte sur la suivante.")}</Text>
      <SectionLabel>{tr("7e")}</SectionLabel>
      <ChipRow testID="arp-seventh-selector">
        <Chip testID="arp-seventh-on" label={tr("Avec la 7e (elle commence)")} selected={withSeventh} onPress={() => setWithSeventh(true)} />
        <Chip testID="arp-seventh-off" label={tr("Sans la 7e")} selected={!withSeventh} onPress={() => setWithSeventh(false)} />
      </ChipRow>
    </>
  ) : arp ? (
    <>
      <SectionLabel>{tr("Schéma")}</SectionLabel>
      <ChipRow testID="arp-shape-selector">{arpShapeChips}</ChipRow>
      {horizontal ? (
        <>
          <SectionLabel>{tr("Déplacement")}</SectionLabel>
          <ChipRow testID="arp-direction">
            <Chip testID="arp-toward-body" label={tr("Vers la caisse")} selected={towardBody} onPress={() => setTowardBody(true)} />
            <Chip testID="arp-toward-nut" label={tr("Vers le sillet")} selected={!towardBody} onPress={() => setTowardBody(false)} />
          </ChipRow>
        </>
      ) : (
        <>
          <SectionLabel>{tr("Départ")}</SectionLabel>
          <ChipRow testID="arp-start-selector">
            <Chip testID="arp-start-lowest" label={tr("Note la plus grave")} selected={!startOnRoot} onPress={() => setStartOnRoot(false)} />
            <Chip testID="arp-start-root" label={tr("Tonique")} selected={startOnRoot} onPress={() => setStartOnRoot(true)} />
          </ChipRow>
        </>
      )}
    </>
  ) : horizontal ? (
    <>
      <SectionLabel>{tr("Cordes")}</SectionLabel>
      {stringCounts.length > 1 ? (
        <ChipRow testID="hz-string-count">
          {stringCounts.map((n) => (
            <Chip
              key={n}
              testID={`hz-string-count-${n}`}
              label={tr("Sur {n} cordes", { n })}
              selected={nStrings === n}
              onPress={() => {
                setStringCount(n);
                setSetIdx(0);
              }}
            />
          ))}
        </ChipRow>
      ) : null}
      <ChipRow testID="hz-strings">{stringChips}</ChipRow>
      <SectionLabel>{tr("Étendue")}</SectionLabel>
      <ChipRow testID="hz-extent">
        {EXTENTS.map((e) => (
          <Chip key={e.id} testID={`hz-extent-${e.id}`} label={tr(e.name)} selected={extent === e.id} onPress={() => setExtent(e.id)} />
        ))}
      </ChipRow>
    </>
  ) : (
    <>
      <SectionLabel>{tr("Position")}</SectionLabel>
      <PositionChips boxes={boxes} selected={pos} variants={variants} single={hasSecond.map((ok) => !ok)} onChange={selectPosition} prefix="fingering-position" hideAll />
      {!pairs ? (
        <>
          <SectionLabel>{tr("Départ")}</SectionLabel>
          <ChipRow testID="start-selector">
            <Chip testID="start-lowest" label={tr("Note la plus grave")} selected={!startOnRoot} onPress={() => setStartOnRoot(false)} />
            <Chip testID="start-root" label={tr("Tonique")} selected={startOnRoot} onPress={() => setStartOnRoot(true)} />
          </ChipRow>
        </>
      ) : null}
    </>
  );

  const displaySheet = (
    <>
      <SectionLabel>{tr("Partition")}</SectionLabel>
      <ChipRow testID="tab-selector">
        <Chip testID="tab-on" label={tr("Notes + tablature")} selected={settings.showTab} onPress={() => update({ showTab: true })} />
        <Chip testID="tab-off" label={tr("Notes seules")} selected={!settings.showTab} onPress={() => update({ showTab: false })} />
      </ChipRow>
      <SectionLabel>{tr("Partition en paysage")}</SectionLabel>
      <ChipRow testID="score-landscape-selector">
        <Chip testID="score-landscape-on" label={tr("Affichée")} selected={settings.showScoreLandscape} onPress={() => update({ showScoreLandscape: true })} />
        <Chip testID="score-landscape-off" label={tr("Masquée")} selected={!settings.showScoreLandscape} onPress={() => update({ showScoreLandscape: false })} />
      </ChipRow>
      <SectionLabel>{tr("Étiquettes")}</SectionLabel>
      <ChipRow testID="label-selector">
        <Chip testID="label-note" label={tr("Noms des notes")} selected={settings.labelMode === "note"} onPress={() => update({ labelMode: "note" })} />
        <Chip testID="label-degree" label={tr("Degrés")} selected={settings.labelMode === "degree"} onPress={() => update({ labelMode: "degree" })} />
      </ChipRow>
    </>
  );

  // ---- The pills: one per setting, each opens only that setting ----
  const pills = (
    <>
      <Pill testID="pill-key" label={keyLabel} accent onPress={() => setKeyOpen(true)} />
      {pairs ? null : arp ? (
        <Pill testID="pill-arp-type" label={tr(arpFormula(arpType).name)} onPress={() => setSheet("arpType")} />
      ) : (
        <Pill testID="pill-scale" label={tr(formula.name)} onPress={() => setSheet("scale")} />
      )}
      <Pill testID="pill-where" label={positionBadge} onPress={() => setSheet("where")} />
      {pairs ? <Pill testID="pill-variant" label={tr(PAIR_STYLES.find((p) => p.id === pairStyle)!.name)} onPress={() => setSheet("variant")} /> : null}
      <Pill testID="pill-display" label={tr("Affichage")} onPress={() => setSheet("display")} />
    </>
  );

  // ---- The playback bar: loop, metronome, tempo (+ count-in), play ----
  const playbackBar = (
    <View style={[styles.playbar, isLandscape && styles.playbarLandscape]} testID="playback-bar">
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
        min={MIN_BPM}
        max={maxBpm}
        half={pulse.half}
        subLabel={tr(slow ? paceNotes[0] : paceNotes[1])}
        defaultBpm={defaultBpmFor(rhythmId, slow)}
        onBpm={(v) => commitBpm(String(v))}
        pace={{ slow, onChange: setSlow, slowLabel: `${tr("Lent")} · ${tr(paceNotes[0])}`, normalLabel: `${tr("Normal")} · ${tr(paceNotes[1])}` }}
        loop={loop}
        onLoop={setLoop}
        metronome={metronome}
        onMetronome={setMetronome}
      />
      <Pressable testID="fingering-play" onPress={togglePlay} style={({ pressed }) => [styles.playBig, pressed && styles.pressed, empty && styles.dim]} accessibilityLabel={playing ? tr("Stop") : tr("Jouer")}>
        {playing ? <Stop size={22} color={colors.onBrandPrimary} weight="fill" /> : <Play size={22} color={colors.onBrandPrimary} weight="fill" />}
      </Pressable>
    </View>
  );

  if (view === "library") return <ExerciseLibrary currentId={presetId} onPick={pickPreset} />;

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="fingering-screen">
      <StudioBackground />
      {isLandscape ? (
        // Landscape: one row aligned with the tab bar — exercise, key, scale, position… then tempo + play.
        <View style={[styles.header, styles.headerLandscape, { paddingTop: insets.top + spacing.xs, paddingRight: LANDSCAPE_NAV_W + spacing.md }]}>
<Pressable testID="back-to-library" onPress={backToLibrary} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} accessibilityLabel={tr("Exercices")} hitSlop={6}>
            <CaretLeft size={20} color={colors.onSurface} weight="bold" />
          </Pressable>
          <Pressable testID="open-exercise" onPress={() => setSheet("exercise")} style={({ pressed }) => [styles.titleRow, pressed && styles.pressed]} accessibilityRole="button">
            <Text style={[styles.title, styles.titleCompact]} testID="fingering-title" numberOfLines={1}>
              {exerciseShort}
            </Text>
            <Info size={14} color={colors.onSurfaceTertiary} weight="bold" />
          </Pressable>
          <KeyButton rootPc={rootPc} nameOf={nameOf} onChange={setRootPc} />
          <View style={styles.headerPills}>
            <PillRow inset={false}>
              {pairs ? null : arp ? (
                <Pill testID="pill-arp-type" label={shortName(arpFormula(arpType))} onPress={() => setSheet("arpType")} />
              ) : (
                <Pill testID="pill-scale" label={shortName(formula)} onPress={() => setSheet("scale")} />
              )}
              <Pill testID="pill-where" label={whereShort} onPress={() => setSheet("where")} />
              {pairs ? <Pill testID="pill-variant" label={pairStyle === "alt" ? tr("Alterné") : pairStyle === "up" ? "Up" : "Down"} onPress={() => setSheet("variant")} /> : null}
            </PillRow>
            {infoContent}
          </View>
          <View style={styles.transportPill} testID="transport-pill">
            <TempoButton
              count={beat}
              bpm={bpm}
              min={MIN_BPM}
              max={maxBpm}
              half={pulse.half}
              defaultBpm={defaultBpmFor(rhythmId, slow)}
              onBpm={(v) => commitBpm(String(v))}
              pace={{ slow, onChange: setSlow, slowLabel: `${tr("Lent")} · ${tr(paceNotes[0])}`, normalLabel: `${tr("Normal")} · ${tr(paceNotes[1])}` }}
              loop={loop}
              onLoop={setLoop}
              metronome={metronome}
              onMetronome={setMetronome}
            />
            <Pressable testID="fingering-play" onPress={togglePlay} style={({ pressed }) => [styles.playRound, pressed && styles.pressed, empty && styles.dim]} accessibilityLabel={playing ? tr("Stop") : tr("Jouer")}>
              {playing ? <Stop size={20} color={colors.onBrandPrimary} weight="fill" /> : <Play size={20} color={colors.onBrandPrimary} weight="fill" />}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable testID="back-to-library" onPress={backToLibrary} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} accessibilityLabel={tr("Exercices")} hitSlop={6}>
            <CaretLeft size={20} color={colors.onSurface} weight="bold" />
          </Pressable>
          {/* The title is the exercise: touching it tells what the exercise is. */}
          <Pressable testID="open-exercise" onPress={() => setSheet("exercise")} style={({ pressed }) => [styles.headerText, pressed && styles.pressed]} accessibilityRole="button">
            <Text style={styles.kicker}>{modeLabel ? `${tr("S’exercer")} · ${modeLabel}` : tr("S’exercer")}</Text>
            <View style={styles.titleRow}>
              <Text style={styles.title} testID="fingering-title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {exerciseTitle}
              </Text>
              <Info size={18} color={colors.onSurfaceTertiary} weight="bold" />
            </View>
            {pairs ? <Text style={styles.titleSub}>{tr("Paire {a} & {b}", { a: nameOf(pairA), b: nameOf(pairB) })}</Text> : null}
          </Pressable>
        </View>
      )}

      {!isLandscape ? <PillRow testID="fingering-pills">{pills}</PillRow> : null}

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

      {!isLandscape ? (
        <View style={[styles.bottom, { paddingBottom: bottomChrome + spacing.sm }]}>
          <View style={styles.bottomRow} testID="fingering-info">
            {infoContent}
          </View>
          {playbackBar}
        </View>
      ) : null}

      <KeyWheel visible={keyOpen} rootPc={rootPc} nameOf={nameOf} onClose={() => setKeyOpen(false)} onChange={setRootPc} />

      <Sheet visible={sheet === "exercise"} onClose={closeSheet} title={exerciseTitle} testID="exercise-sheet">
        {exerciseSheet}
        {/* Landscape: no "Affichage" pill, its settings are here. */}
        {isLandscape ? displaySheet : null}
      </Sheet>
      <ScalePicker
        visible={sheet === "scale"}
        onClose={closeSheet}
        mode="scale"
        onModeChange={() => {}}
        scalesOnly
        hideAllPosition
        hideLabels
        title={tr("Gamme")}
        rootPc={rootPc}
        onRootChange={setRootPc}
        selectedId={scaleId}
        onSelect={setScaleId}
        nameOf={nameOf}
        positions={[]}
        selectedPosition={pos}
        positionVariants={variants}
        onPositionChange={selectPosition}
        labelMode={settings.labelMode}
        onLabelModeChange={(m) => update({ labelMode: m })}
      />
      <Sheet visible={sheet === "arpType"} onClose={closeSheet} title={tr("Type d’arpège")} testID="arp-type-sheet">
        <ChipRow testID="arp-type-selector">{arpTypeChips}</ChipRow>
      </Sheet>
      <Sheet visible={sheet === "where"} onClose={closeSheet} title={twoStrings ? tr("7e") : arp ? tr("Schéma") : horizontal ? tr("Cordes") : tr("Position")} testID="where-sheet">
        {whereSheet}
      </Sheet>
      <Sheet visible={sheet === "variant"} onClose={closeSheet} title={tr("Variante")} testID="variant-sheet">
        <ChipRow testID="pair-style-selector">{pairStyleChips}</ChipRow>
      </Sheet>
      <Sheet visible={sheet === "display"} onClose={closeSheet} title={tr("Affichage")} testID="display-sheet">
        {displaySheet}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  segment: { flexDirection: "row", marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: 4, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary },
  segBtn: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segBtnActive: { backgroundColor: c.brandPrimary },
  segText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurfaceTertiary },
  segTextActive: { color: c.onBrandPrimary, fontWeight: "700" },
  screen: { flex: 1, backgroundColor: c.surface },
  headerLandscape: { gap: spacing.sm, paddingBottom: spacing.xs, minHeight: 48 },
  headerPills: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // Tempo + play grouped in one pill (landscape header).
  // Landscape: metronome + play grouped in one rounded square, same look as the setting pills.
  transportPill: { flexDirection: "row", alignItems: "center", gap: 6, padding: 4, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, flexShrink: 0 },
  playRound: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  kicker: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  // Playback bar: loop, metronome, tempo, play — the same in portrait (bottom) and landscape (end of the pill row).
  playbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: 28, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  playbarLandscape: { padding: 4, borderRadius: 26, width: 300, flexShrink: 0 },
  barToggle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  barToggleOn: { backgroundColor: c.brandTertiary, borderColor: c.brandPrimary },
  playBig: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  bottom: { marginTop: "auto", paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  landscapeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 2 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
  headerText: { flex: 1, flexShrink: 1, minWidth: 0 },
  // Phones in portrait: 4 round buttons of the same size, closer together, that never shrink or get pushed out.
  headerCompact: { gap: spacing.sm },
  playBtnRound: { width: 44, paddingHorizontal: 0, justifyContent: "center", flexShrink: 0 },
  headerTextCompact: { flexShrink: 0, maxWidth: 260 },
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
  infoBottom: { marginTop: "auto", flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 36, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  bottomInfo: { marginTop: "auto", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 2, alignItems: "flex-start" },
  bottomBadge: { fontFamily: fonts.text, fontSize: 14, color: c.onSurfaceSecondary },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 26, paddingHorizontal: spacing.sm },
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
