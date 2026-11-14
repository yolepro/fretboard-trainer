import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Play, Stop } from "phosphor-react-native";

import { Fretboard, fitScale } from "@/src/components/Fretboard";
import { PositionChips } from "@/src/components/PositionChips";
import { Chip, ChipRow, SectionLabel } from "@/src/components/Chip";
import { Glass } from "@/src/components/Glass";
import { StudioBackground } from "@/src/components/StudioBackground";
import { playNote, initAudio } from "@/src/audio/sampler";
import { EXERCISES, buildExercise, exerciseAllowed, positionLadder, type ExerciseId } from "@/src/music/exercises";
import {
  DEGREE_META,
  SCALES,
  boxVariant,
  buildDegreeMap,
  degreeKeyFromNum,
  formulaDegrees,
  octaveOf,
  pcOf,
  scaleBoxes,
  type DegreeKey,
} from "@/src/music/theory";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const TEMPOS = [50, 70, 90, 120, 160];
const PILL_W = 40;
const PILL_GAP = 6;

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
  const [bpm, setBpm] = useState(90);
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [stepIdx, setStepIdx] = useState<number | null>(null);
  const [active, setActive] = useState<{ midi: number; string: number; fret: number } | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const stripRef = useRef<ScrollView>(null);
  const stripW = useRef(0);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const usableW = width - insets.left - insets.right - 8;
  const fretScale = isLandscape ? fitScale(usableW, 16) : 1;
  const tabBarH = usesNativeTabs ? 0 : 49 + insets.bottom;
  const rowH = isLandscape
    ? Math.max(26, Math.min(34, Math.floor((height - insets.top - tabBarH - bottomChrome - 52 - 52 - 22 - 8) / 6)))
    : 34;

  useEffect(() => {
    initAudio();
    return () => cancelRef.current?.();
  }, []);

  const formula = useMemo(() => SCALES.find((s) => s.id === scaleId)!, [scaleId]);
  const degreeMap = useMemo(() => buildDegreeMap(rootPc, formula), [rootPc, formula]);
  const degrees = useMemo(() => formulaDegrees(formula), [formula]);
  const visibleLayers = useMemo(() => new Set(degrees), [degrees]);
  const colored = useMemo(() => new Set<DegreeKey>(["root"]), []);
  const boxes = useMemo(() => scaleBoxes(rootPc, formula, true), [rootPc, formula]);
  const pos = Math.min(position, boxes.length - 1);
  const variant = variants[pos] ?? 0;
  const windowRange = useMemo(() => boxVariant(boxes[pos], variant), [boxes, pos, variant]);

  // Exercises that don't fit the scale (triads on a pentatonic, anything but the scale on special scales).
  useEffect(() => {
    if (!exerciseAllowed(exerciseId, formula)) setExerciseId("scale");
  }, [formula, exerciseId]);

  const ladder = useMemo(() => positionLadder(rootPc, formula, windowRange), [rootPc, formula, windowRange]);
  const sequence = useMemo(
    () => buildExercise(ladder, exerciseId, rootPc, startOnRoot),
    [ladder, exerciseId, rootPc, startOnRoot],
  );
  const exercise = EXERCISES.find((e) => e.id === exerciseId)!;

  const stop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setPlaying(false);
    setActive(null);
    setStepIdx(null);
  }, []);

  // Any change of the exercise stops what is playing.
  useEffect(() => {
    stop();
  }, [sequence, bpm, loop, stop]);

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
    const ms = Math.round(30000 / bpm); // eighth notes
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      showStep(i);
      i += 1;
      if (i >= sequence.length) {
        if (loop) {
          i = 0;
          timer = setTimeout(tick, ms);
        } else {
          timer = setTimeout(() => {
            setPlaying(false);
            setActive(null);
            setStepIdx(null);
          }, ms + 300);
        }
      } else {
        timer = setTimeout(tick, ms);
      }
    };
    cancelRef.current = () => clearTimeout(timer);
    setPlaying(true);
    tick();
  };

  const onNotePress = useCallback(
    (midi: number, s: number, f: number) => {
      setActive({ midi, string: s, fret: f });
      Haptics.selectionAsync().catch(() => {});
      if (settings.soundOnTap) playNote(midi, settings.volume);
    },
    [settings.soundOnTap, settings.volume],
  );

  // Keep the current note of the sequence strip in view.
  useEffect(() => {
    if (stepIdx === null) return;
    stripRef.current?.scrollTo({ x: Math.max(0, stepIdx * (PILL_W + PILL_GAP) - stripW.current / 2), animated: true });
  }, [stepIdx]);

  const labelOf = (midi: number) => {
    const pc = pcOf(midi);
    return settings.labelMode === "degree" ? degreeMap.get(pc)?.label ?? nameOf(pc) : nameOf(pc);
  };
  const title = `${nameOf(rootPc)}`;
  const empty = sequence.length === 0;

  const exerciseChips = EXERCISES.map((e) => {
    const ok = exerciseAllowed(e.id, formula);
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

  const positionBadge = `Pos. ${pos + 1} · ${variant + 1}/2`;

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="fingering-screen">
      <StudioBackground />
      <View style={[styles.header, { paddingTop: insets.top + (isLandscape ? spacing.xs : spacing.sm) }]}>
        <View style={styles.headerText}>
          {!isLandscape ? <Text style={styles.brand}>FRETSTUDIO · DOIGTÉ</Text> : null}
          <Text style={[styles.title, isLandscape && styles.titleCompact]} testID="fingering-title" numberOfLines={isLandscape ? 1 : 2}>
            {title} <Text style={styles.titleSub}>{formula.name} · {positionBadge}</Text>
          </Text>
        </View>
        <Pressable testID="fingering-play" onPress={togglePlay} style={({ pressed }) => [styles.playBtn, pressed && styles.pressed, empty && styles.dim]}>
          {playing ? <Stop size={20} color={colors.onBrandPrimary} weight="fill" /> : <Play size={20} color={colors.onBrandPrimary} weight="fill" />}
          {!isLandscape ? <Text style={styles.playText}>{playing ? "Stop" : "Jouer"}</Text> : null}
        </Pressable>
      </View>

      <View style={styles.infoBar} testID="fingering-info">
        {active ? (
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
            {empty ? "Position trop courte pour cet exercice : essayez 1/2." : `${exercise.name} · ${sequence.length} notes — touchez Jouer`}
          </Text>
        )}
      </View>

      <Fretboard
        fretScale={fretScale}
        rowH={rowH}
        degreeMap={degreeMap}
        visibleLayers={visibleLayers}
        coloredLayers={colored}
        windowRange={windowRange}
        labelMode={settings.labelMode}
        showNeutral={false}
        nameOf={nameOf}
        activeMidi={active}
        onNotePress={onNotePress}
      />

      <ScrollView
        ref={stripRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        testID="sequence-strip"
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
        onLayout={(e) => {
          stripW.current = e.nativeEvent.layout.width;
        }}
      >
        {sequence.map((s, i) => (
          <Pressable
            key={i}
            onPress={() => {
              if (!playing) showStep(i);
            }}
            style={[styles.pill, stepIdx === i && styles.pillActive]}
          >
            <Text style={[styles.pillText, stepIdx === i && styles.pillTextActive]} numberOfLines={1}>
              {labelOf(s.midi)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLandscape ? (
        <ChipRow testID="fingering-landscape-row">
          {exerciseChips}
          <View style={styles.divider} />
          {boxes.map((_, i) => (
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
      ) : (
        <ScrollView
          style={styles.panelScroll}
          contentContainerStyle={[styles.panelContent, { paddingBottom: bottomChrome + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          <Glass style={styles.panel} testID="fingering-panel">
            <SectionLabel>Exercice</SectionLabel>
            <ChipRow testID="exercise-selector">{exerciseChips}</ChipRow>
            <Text style={styles.hint}>{exercise.description}</Text>

            <SectionLabel>Tonalité</SectionLabel>
            <ChipRow testID="fingering-root-selector">
              {Array.from({ length: 12 }, (_, pc) => (
                <Chip key={pc} testID={`fingering-root-${pc}`} label={nameOf(pc)} selected={rootPc === pc} onPress={() => setRootPc(pc)} />
              ))}
            </ChipRow>

            <SectionLabel>Gamme</SectionLabel>
            <ChipRow testID="fingering-scale-selector">
              {SCALES.map((f) => (
                <Chip key={f.id} testID={`fingering-scale-${f.id}`} label={f.name} selected={scaleId === f.id} onPress={() => setScaleId(f.id)} />
              ))}
            </ChipRow>

            <SectionLabel>Position</SectionLabel>
            <PositionChips hideAll boxes={boxes} selected={pos} variants={variants} onChange={selectPosition} prefix="fingering-position" />

            <SectionLabel>Départ</SectionLabel>
            <ChipRow testID="start-selector">
              <Chip testID="start-lowest" label="Note la plus grave" selected={!startOnRoot} onPress={() => setStartOnRoot(false)} />
              <Chip testID="start-root" label="Tonique" selected={startOnRoot} onPress={() => setStartOnRoot(true)} />
            </ChipRow>

            <SectionLabel>Tempo (croches)</SectionLabel>
            <ChipRow testID="tempo-selector">
              {TEMPOS.map((t) => (
                <Chip key={t} testID={`tempo-${t}`} label={`${t}`} selected={bpm === t} onPress={() => setBpm(t)} />
              ))}
              <Chip testID="loop-toggle" label={loop ? "Boucle : oui" : "Boucle : non"} selected={loop} onPress={() => setLoop(!loop)} />
            </ChipRow>

            <SectionLabel>Étiquettes</SectionLabel>
            <ChipRow testID="fingering-label-selector">
              <Chip testID="fingering-label-note" label="Noms des notes" selected={settings.labelMode === "note"} onPress={() => update({ labelMode: "note" })} />
              <Chip testID="fingering-label-degree" label="Degrés" selected={settings.labelMode === "degree"} onPress={() => update({ labelMode: "degree" })} />
            </ChipRow>
          </Glass>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
  headerText: { flex: 1 },
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
  strip: { flexGrow: 0, flexShrink: 0, height: 46 },
  stripContent: { alignItems: "center", gap: PILL_GAP, paddingHorizontal: spacing.lg },
  pill: {
    width: PILL_W,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  pillText: { fontFamily: fonts.display, fontSize: 12, color: c.onSurfaceTertiary },
  pillTextActive: { color: c.onBrandPrimary, fontWeight: "700" },
  divider: { width: 1, height: 24, backgroundColor: c.borderStrong, marginHorizontal: spacing.xs },
  panelScroll: { flex: 1 },
  panelContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  panel: { paddingVertical: spacing.md },
  hint: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
}));
