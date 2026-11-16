import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CaretDown, Play, Stop } from "phosphor-react-native";

import { Fretboard, fitScale } from "@/src/components/Fretboard";
import { ScalePicker } from "@/src/components/ScalePicker";
import { PositionChips } from "@/src/components/PositionChips";
import { Chip, ChipRow, SectionLabel } from "@/src/components/Chip";
import { Score, useScore } from "@/src/components/Score";
import { runSequence } from "@/src/audio/sequencer";
import { Glass } from "@/src/components/Glass";
import { StudioBackground } from "@/src/components/StudioBackground";
import { playNote, preloadNotes, initAudio } from "@/src/audio/sampler";
import { positionLadder } from "@/src/music/exercises";
import {
  CHORDS,
  DEGREE_META,
  SCALES,
  buildDegreeMap,
  degreeKeyFromNum,
  formulaDegrees,
  midiToFreq,
  octaveOf,
  pcOf,
  boxVariant,
  playbackPath,
  scaleBoxes,
  type DegreeKey,
} from "@/src/music/theory";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { APP_VERSION } from "@/src/version";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

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
  const [position, setPosition] = useState<number | null>(null);
  // Per-position variant: 0 = 1/2 (low), 1 = 2/2 (same box 12 frets higher)
  const [variants, setVariants] = useState<number[]>([]);
  const [active, setActive] = useState<{ midi: number; string: number; fret: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [stepIdx, setStepIdx] = useState<number | null>(null);
  const [startOnRoot, setStartOnRoot] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  // Landscape: frets 0→16 minimum fit on screen, rows sized to the available height.
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const usableW = width - insets.left - insets.right - 8;
  const fretScale = isLandscape ? fitScale(usableW, 16) : 1;
  const tabBarH = usesNativeTabs ? 0 : 49 + insets.bottom;
  useEffect(() => {
    initAudio();
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
  const boxes = useMemo(() => scaleBoxes(rootPc, formula, mode === "scale"), [rootPc, formula, mode]);
  // Scales don't have the same number of positions: drop a selection that no longer exists.
  useEffect(() => {
    if (position !== null && position >= boxes.length) {
      setPosition(null);
      setVariants([]);
    }
  }, [boxes.length, position]);
  const variant = position !== null ? variants[position] ?? 0 : 0;
  // Memoized so the Fretboard's scroll effect only fires when the window really changes.
  const windowRange = useMemo(
    () => (position !== null && boxes[position] ? boxVariant(boxes[position], variant) : null),
    [boxes, position, variant],
  );

  // The notes "Écouter" plays: also what the score under the neck shows.
  // With a scale position selected: every note of the position, from its lowest note (or lowest root) upward.
  // Otherwise: from the root up to the octave.
  const path = useMemo(() => {
    if (mode === "scale" && windowRange) {
      let ladder = positionLadder(rootPc, formula, windowRange);
      if (startOnRoot) {
        const r = ladder.findIndex((st) => pcOf(st.midi) === pcOf(rootPc));
        if (r > 0) ladder = ladder.slice(r);
      }
      if (ladder.length) return ladder;
    }
    return playbackPath(rootPc, formula, mode === "scale", windowRange);
  }, [rootPc, formula, mode, windowRange, startOnRoot]);
  useEffect(() => {
    preloadNotes(path.map((st) => st.midi));
  }, [path]);
  useEffect(() => {
    setStepIdx(null);
  }, [path]);
  const showScore = !isLandscape || settings.showScoreLandscape;
  const { layout } = useScore(path, "path", 2, rootPc, formula, settings.showTab && !isLandscape);
  const rowH = isLandscape
    ? Math.max(
        showScore ? 22 : 26,
        Math.min(34, Math.floor((height - insets.top - tabBarH - bottomChrome - 52 - 52 - 22 - 8 - (showScore ? layout.height + 6 : 0)) / 6)),
      )
    : 34;

  // Tap a position to select it; tap the selected one again to switch between 1/2 and 2/2.
  // Changing position (or going back to "Tout le manche") puts every position back on 1/2.
  const selectPosition = useCallback(
    (i: number | null) => {
      if (i !== null && i === position) {
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
    [position, boxes.length],
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
  const playFormula = () => {
    if (playing) {
      cancelRef.current?.();
      cancelRef.current = null;
      setPlaying(false);
      setActive(null);
      setStepIdx(null);
      return;
    }
    if (!path.length) return;
    cancelRef.current = runSequence({
      length: path.length,
      noteMs: 380,
      beatMs: 760,
      beats: 0,
      loop: false,
      leadMs: 30,
      onBeat: () => {},
      onNote: (i) => {
        const step = path[i];
        playNote(step.midi, settings.volume);
        setStepIdx(i);
        setActive(step.loc ? { midi: step.midi, string: step.loc.string, fret: step.loc.fret } : null);
      },
      onEnd: () => {
        cancelRef.current = null;
        setPlaying(false);
        setActive(null);
        setStepIdx(null);
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

  const activeIv = active ? degreeMap.get(pcOf(active.midi)) : undefined;
  const activeKey = activeIv ? degreeKeyFromNum(activeIv.num) : null;
  const title = `${nameOf(rootPc)}${mode === "chord" ? formula.symbol : ""}`;

  const infoContent = active ? (
    <>
      <View
        style={[
          styles.infoDot,
          {
            backgroundColor: !activeKey
              ? colors.degreeNeutral
              : coloredLayers && !coloredLayers.has(activeKey)
                ? colors.degreeUniform
                : colors[DEGREE_META[activeKey].color],
          },
        ]}
      />
      <Text style={styles.infoNote} testID="active-note-name">
        {nameOf(pcOf(active.midi))}
        {octaveOf(active.midi)}
      </Text>
      <Text style={styles.infoMeta} numberOfLines={1}>
        {activeIv ? `${DEGREE_META[activeKey!].label} (${activeIv.label})` : "Hors gamme"} · Corde {active.string + 1} · Case {active.fret} ·{" "}
        {midiToFreq(active.midi, settings.a4).toFixed(1)} Hz
      </Text>
    </>
  ) : (
    <Text style={styles.infoMeta}>Touchez une note pour l’écouter</Text>
  );

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="fretboard-screen">
      <StudioBackground />
      <View style={[styles.header, { paddingTop: insets.top + (isLandscape ? spacing.xs : spacing.sm) }]}>
        <View style={isLandscape ? styles.headerTextCompact : styles.headerText}>
          {!isLandscape ? <Text style={styles.brand} testID="app-version">FRETSTUDIO · v{APP_VERSION}</Text> : null}
          <Text style={[styles.title, isLandscape && styles.titleCompact]} testID="fretboard-title" numberOfLines={isLandscape ? 1 : 2}>
            {title} <Text style={styles.titleSub}>{formula.name}</Text>
          </Text>
        </View>
        {isLandscape ? (
          <View style={styles.infoInline} testID="note-info-bar">
            {infoContent}
          </View>
        ) : null}
        <Pressable
          testID="open-scale-picker"
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.pickerBtn, pressed && styles.pressed]}
        >
          <Text style={styles.pickerText}>{mode === "scale" ? "Gamme" : "Accord"}</Text>
          <CaretDown size={16} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Pressable
          testID="play-formula-button"
          onPress={playFormula}
          style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
        >
          {playing ? <Stop size={20} color={colors.onBrandPrimary} weight="fill" /> : <Play size={20} color={colors.onBrandPrimary} weight="fill" />}
          {!isLandscape ? <Text style={styles.playText}>{playing ? "Stop" : "Écouter"}</Text> : null}
        </Pressable>
      </View>

      {!isLandscape ? (
        <View style={styles.infoBar} testID="note-info-bar">
          {infoContent}
        </View>
      ) : null}

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

      {showScore ? <Score layout={layout} activeIndex={stepIdx} onNotePress={tapScoreNote} testID="manche-score" /> : null}

      <ChipRow testID="layer-legend">
        {degrees.map((d) => (
          <Chip
            key={d}
            testID={`layer-toggle-${d}`}
            label={DEGREE_META[d].label}
            dotColor={colors[DEGREE_META[d].color]}
            selected={colored.has(d)}
            onPress={() => toggleLayer(d)}
          />
        ))}
        {isLandscape ? (
          <Chip testID="manche-score-toggle" label={settings.showScoreLandscape ? "Partition : oui" : "Partition : non"} selected={settings.showScoreLandscape} onPress={() => update({ showScoreLandscape: !settings.showScoreLandscape })} />
        ) : null}
        {isLandscape && boxes.length > 0 ? (
          <>
            <View style={styles.legendDivider} />
            <Chip testID="landscape-position-all" label="Tout" selected={position === null} onPress={() => selectPosition(null)} />
            {boxes.map((_, i) => {
              const v = variants[i] ?? 0;
              return (
                <Chip
                  key={`p${i}`}
                  testID={`landscape-position-${i + 1}`}
                  label={`Pos. ${i + 1}`}
                  badge={`${v + 1}/2`}
                  badgeTone={v === 1 ? "accent" : "primary"}
                  selected={position === i}
                  onPress={() => selectPosition(i)}
                />
              );
            })}
          </>
        ) : null}
      </ChipRow>

      <ScalePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        mode={mode}
        onModeChange={setMode}
        rootPc={rootPc}
        onRootChange={setRootPc}
        selectedId={mode === "scale" ? scaleId : chordId}
        onSelect={(id) => (mode === "scale" ? setScaleId(id) : setChordId(id))}
        nameOf={nameOf}
        positions={boxes}
        selectedPosition={position}
        positionVariants={variants}
        onPositionChange={selectPosition}
        labelMode={settings.labelMode}
        onLabelModeChange={(m) => update({ labelMode: m })}
      />

      {!isLandscape ? (
      <ScrollView
        style={styles.panelScroll}
        contentContainerStyle={[styles.panelContent, { paddingBottom: bottomChrome + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Glass style={styles.panel} testID="control-panel">
          <View style={styles.segment}>
            {(["scale", "chord"] as Mode[]).map((m) => (
              <Pressable
                key={m}
                testID={`mode-${m}`}
                onPress={() => setMode(m)}
                style={[styles.segBtn, mode === m && styles.segBtnActive]}
              >
                <Text style={[styles.segText, mode === m && styles.segTextActive]}>{m === "scale" ? "Gamme" : "Accord / Triade"}</Text>
              </Pressable>
            ))}
          </View>

          <SectionLabel>Tonalité</SectionLabel>
          <ChipRow testID="root-selector">
            {Array.from({ length: 12 }, (_, pc) => (
              <Chip key={pc} testID={`root-${pc}`} label={nameOf(pc)} selected={rootPc === pc} onPress={() => setRootPc(pc)} />
            ))}
          </ChipRow>

          {boxes.length > 0 ? (
            <>
              <SectionLabel>Position (boîte de gamme)</SectionLabel>
              <PositionChips boxes={boxes} selected={position} variants={variants} onChange={selectPosition} />
            </>
          ) : null}

          <SectionLabel>{mode === "scale" ? "Gamme" : "Accord"}</SectionLabel>
          <ChipRow testID="formula-selector">
            {(mode === "scale" ? SCALES : CHORDS).map((f) => (
              <Chip
                key={f.id}
                testID={`formula-${f.id}`}
                label={mode === "scale" ? f.name : `${nameOf(rootPc)}${f.symbol || ""} · ${f.name}`}
                selected={(mode === "scale" ? scaleId : chordId) === f.id}
                onPress={() => (mode === "scale" ? setScaleId(f.id) : setChordId(f.id))}
              />
            ))}
          </ChipRow>

          <SectionLabel>Étiquettes</SectionLabel>
          <ChipRow testID="label-mode-selector">
            <Chip testID="label-mode-note" label="Noms des notes" selected={settings.labelMode === "note"} onPress={() => update({ labelMode: "note" })} />
            <Chip testID="label-mode-degree" label="Degrés" selected={settings.labelMode === "degree"} onPress={() => update({ labelMode: "degree" })} />
            <Chip
              testID="toggle-neutral"
              label={settings.showNeutral ? "Notes neutres : oui" : "Notes neutres : non"}
              selected={settings.showNeutral}
              onPress={() => update({ showNeutral: !settings.showNeutral })}
            />
          </ChipRow>

          {mode === "scale" ? (
            <>
              <SectionLabel>Écoute et partition : départ</SectionLabel>
              <ChipRow testID="manche-start-selector">
                <Chip testID="manche-start-lowest" label="Note la plus grave" selected={!startOnRoot} onPress={() => setStartOnRoot(false)} />
                <Chip testID="manche-start-root" label="Tonique" selected={startOnRoot} onPress={() => setStartOnRoot(true)} />
              </ChipRow>
            </>
          ) : null}

          <SectionLabel>Partition</SectionLabel>
          <ChipRow testID="manche-tab-selector">
            <Chip testID="manche-tab-on" label="Notes + tablature" selected={settings.showTab} onPress={() => update({ showTab: true })} />
            <Chip testID="manche-tab-off" label="Notes seules" selected={!settings.showTab} onPress={() => update({ showTab: false })} />
          </ChipRow>

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
        </Glass>
      </ScrollView>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  legendDivider: { width: 1, height: 24, backgroundColor: c.borderStrong, marginHorizontal: spacing.xs },
  headerTextCompact: { flexShrink: 0, maxWidth: 260 },
  titleCompact: { fontSize: 20 },
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
  infoNote: { fontFamily: fonts.display, fontSize: 18, fontWeight: "700", color: c.onSurface },
  infoMeta: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  panelScroll: { flex: 1 },
  panelContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  panel: { paddingVertical: spacing.md },
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
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
