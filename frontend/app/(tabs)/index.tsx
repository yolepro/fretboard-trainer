import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CaretDown, Play, Stop } from "phosphor-react-native";

import { Fretboard, fitScale } from "@/src/components/Fretboard";
import { ScalePicker } from "@/src/components/ScalePicker";
import { Chip, ChipRow, SectionLabel } from "@/src/components/Chip";
import { Glass } from "@/src/components/Glass";
import { StudioBackground } from "@/src/components/StudioBackground";
import { playNote, playSequence, initAudio } from "@/src/audio/sampler";
import {
  CHORDS,
  DEGREE_META,
  OCTAVES,
  SCALES,
  buildDegreeMap,
  degreeKeyFromNum,
  formulaDegrees,
  midiToFreq,
  octaveOf,
  pcOf,
  type DegreeKey,
} from "@/src/music/theory";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
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
  const [octave, setOctave] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<DegreeKey>>(new Set());
  // Scale mode: all notes share one color; selected degrees get their own color (tonic by default)
  const [colored, setColored] = useState<Set<DegreeKey>>(new Set(["root"]));
  const [active, setActive] = useState<{ midi: number; string: number; fret: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  // Landscape: frets 0→16 minimum fit on screen, rows sized to the available height.
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

  const formula = useMemo(
    () => (mode === "scale" ? SCALES.find((s) => s.id === scaleId)! : CHORDS.find((c) => c.id === chordId)!),
    [mode, scaleId, chordId],
  );
  const degreeMap = useMemo(() => buildDegreeMap(rootPc, formula), [rootPc, formula]);
  const degrees = useMemo(() => formulaDegrees(formula), [formula]);
  const visibleLayers = useMemo(
    () => (mode === "scale" ? new Set(degrees) : new Set(degrees.filter((d) => !hidden.has(d)))),
    [degrees, hidden, mode],
  );
  const coloredLayers = mode === "scale" ? colored : undefined;

  const onNotePress = useCallback(
    (midi: number, s: number, f: number) => {
      setActive({ midi, string: s, fret: f });
      Haptics.selectionAsync().catch(() => {});
      if (settings.soundOnTap) playNote(midi, settings.volume);
    },
    [settings.soundOnTap, settings.volume],
  );

  const toggleLayer = (d: DegreeKey) => {
    const setter = mode === "scale" ? setColored : setHidden;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const playFormula = () => {
    if (playing) {
      cancelRef.current?.();
      setPlaying(false);
      return;
    }
    const baseOct = octave ?? 3;
    const start = Math.max(40, (baseOct + 1) * 12 + rootPc);
    const notes = formula.intervals.map((i) => start + i.semi);
    if (mode === "scale") notes.push(start + 12);
    cancelRef.current = playSequence(notes, settings.volume);
    setPlaying(true);
    const t = setTimeout(() => setPlaying(false), notes.length * 380 + 200);
    const prevCancel = cancelRef.current;
    cancelRef.current = () => {
      prevCancel();
      clearTimeout(t);
    };
  };

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
          {!isLandscape ? <Text style={styles.brand}>FRETSTUDIO</Text> : null}
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
        octave={octave}
        labelMode={settings.labelMode}
        showNeutral={settings.showNeutral}
        nameOf={nameOf}
        activeMidi={active}
        onNotePress={onNotePress}
      />

      <ChipRow testID="layer-legend">
        {degrees.map((d) => (
          <Chip
            key={d}
            testID={`layer-toggle-${d}`}
            label={DEGREE_META[d].label}
            dotColor={colors[DEGREE_META[d].color]}
            selected={mode === "scale" ? colored.has(d) : !hidden.has(d)}
            dim={mode === "scale" ? false : hidden.has(d)}
            onPress={() => toggleLayer(d)}
          />
        ))}
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

          <SectionLabel>Octave</SectionLabel>
          <ChipRow testID="octave-selector">
            <Chip testID="octave-all" label="Toutes" selected={octave === null} onPress={() => setOctave(null)} />
            {OCTAVES.map((o) => (
              <Chip key={o} testID={`octave-${o}`} label={`Oct. ${o}`} selected={octave === o} onPress={() => setOctave(o)} />
            ))}
          </ChipRow>

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
