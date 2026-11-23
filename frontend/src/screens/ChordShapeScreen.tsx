import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeft, CaretRight, Play, Stop } from "phosphor-react-native";

import { LANDSCAPE_NAV_W } from "@/src/components/AppTabBar";
import { Chip } from "@/src/components/Chip";
import { Segment } from "@/src/components/GameCard";
import { KeyWheel } from "@/src/components/KeyWheel";
import { Pill, PillRow } from "@/src/components/Pill";
import { Sheet } from "@/src/components/Sheet";
import { StudioBackground } from "@/src/components/StudioBackground";
import { initAudio, playChordNotes, preloadNotes, stopChordNotes } from "@/src/audio/sampler";
import { resumeWebAudio } from "@/src/audio/webAudio";
import {
  CHORD_TYPES,
  OPEN_CHORDS,
  barreVoicing,
  cagedVoicings,
  openVoicing,
  powerVoicing,
  voicingMidis,
  type ChordTypeId,
  type Played,
  type Voicing,
} from "@/src/music/chordShapes";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { tr } from "@/src/i18n";

export type ShapeKind = "open" | "barre" | "power" | "caged";
export const SHAPE_TITLES: Record<ShapeKind, string> = {
  open: "Accords ouverts",
  barre: "Accords barrés",
  power: "Power chords",
  caged: "Système CAGED",
};

type SheetId = "type" | "shape" | null;

/** Explorer › Les formes à jouer: one chord shape on the neck (fingers or degrees), ‹ › to the next shape. */
export function ChordShapeScreen({ kind, onBack }: { kind: ShapeKind; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { settings, nameOf } = useSettings();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const [rootPc, setRootPc] = useState(kind === "barre" ? 5 : kind === "power" ? 4 : 0); // F barré, E5, C CAGED
  const [typeId, setTypeId] = useState<ChordTypeId>("maj");
  const [power8, setPower8] = useState(false);
  const [minor, setMinor] = useState(false);
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState<"fingers" | "degrees">("fingers");
  const [keyOpen, setKeyOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [playing, setPlaying] = useState(false);

  // Every shape the arrows go through, for the current key and type.
  const list: Voicing[] = useMemo(() => {
    if (kind === "open") return OPEN_CHORDS.map((_, i) => openVoicing(i));
    if (kind === "barre") return [barreVoicing(rootPc, typeId, "E"), barreVoicing(rootPc, typeId, "A")];
    if (kind === "power") return ([6, 5, 4] as const).map((s) => powerVoicing(rootPc, s, power8));
    return cagedVoicings(rootPc, minor, 17);
  }, [kind, rootPc, typeId, power8, minor]);
  const at = Math.min(idx, list.length - 1);
  const v = list[at];
  const chordName = `${nameOf(v.rootPc)}${v.symbol}`;

  useEffect(() => {
    preloadNotes(Array.from({ length: 30 }, (_, i) => 40 + i));
    return () => stopChordNotes();
  }, []);

  const play = () => {
    if (playing) {
      stopChordNotes();
      setPlaying(false);
      return;
    }
    resumeWebAudio(); // Safari (iPhone): the audio clock only runs after a tap
    initAudio();
    const notes = voicingMidis(v);
    const seq: { midi: number; at: number }[] = [];
    let t = 0;
    if (settings.chordStyle !== "block") {
      notes.forEach((m, i) => seq.push({ midi: m, at: i * 280 }));
      t = notes.length * 280 + 350;
    }
    if (settings.chordStyle !== "arp") notes.forEach((m, i) => seq.push({ midi: m, at: t + i * 30 })); // a light strum
    playChordNotes(seq, settings.volume * 0.85);
    setPlaying(true);
    const last = (seq[seq.length - 1]?.at ?? 0) + 1600;
    setTimeout(() => setPlaying(false), last);
  };
  const move = (d: number) => {
    stopChordNotes();
    setPlaying(false);
    setIdx((at + d + list.length) % list.length);
  };

  const styleLabel = settings.chordStyle === "both" ? tr("Arpégé puis plaqué") : settings.chordStyle === "block" ? tr("Plaqué") : tr("Arpégé");
  const typeLabel = kind === "power" ? (power8 ? "1-5-8" : "1-5") : kind === "caged" ? tr(minor ? "Mineur" : "Majeur") : tr(CHORD_TYPES.find((c) => c.id === typeId)!.name);
  const shapeLabel = kind === "open" ? chordName : tr(v.name);

  // Formula chips: the chord's degrees in order, each with its color.
  const degs = useMemo(() => {
    const order = ["1", "♭3", "3", "5", "♭7", "7"];
    const set = new Set(v.strings.filter((s): s is NonNullable<Played> => !!s).map((s) => s.deg));
    return order.filter((d) => set.has(d));
  }, [v]);

  const pad = spacing.lg;
  const neckW = Math.min(landscape ? 560 : 520, width - insets.left - insets.right - 2 * pad - (landscape ? LANDSCAPE_NAV_W : 0));

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="chord-shape-screen">
      <StudioBackground />
      <View style={[styles.header, { paddingTop: insets.top + (landscape ? spacing.xs : spacing.sm) }, landscape && { paddingRight: LANDSCAPE_NAV_W + spacing.md }]}>
        <Pressable testID="shape-back" onPress={onBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} accessibilityLabel={tr("Explorer")} hitSlop={6}>
          <CaretLeft size={20} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} testID="shape-title">
          {tr(SHAPE_TITLES[kind])}
        </Text>
      </View>
      <PillRow testID="shape-pills">
        {kind !== "open" ? <Pill testID="pill-key" label={nameOf(rootPc)} accent onPress={() => setKeyOpen(true)} /> : null}
        {kind !== "open" ? <Pill testID="pill-type" label={typeLabel} onPress={() => setSheet("type")} /> : null}
        <Pill testID="pill-shape" label={shapeLabel} accent={kind === "open"} onPress={() => setSheet("shape")} />
      </PillRow>
      <ScrollView style={styles.middle} contentContainerStyle={[styles.middleContent, { paddingBottom: (usesNativeTabs || landscape ? insets.bottom : 0) + spacing.xl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.chordName} testID="shape-chord-name" numberOfLines={1}>
              {chordName}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {kind === "open" ? tr(v.typeName) : `${tr(v.name)} · ${typeLabel}`}
            </Text>
          </View>
          <View style={styles.formula}>
            {degs.map((d) => (
              <View key={d} style={[styles.degChip, { backgroundColor: degColor(d, colors) }]}>
                <Text style={styles.degChipText}>{d}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.neckRow}>
          <Pressable testID="shape-prev" onPress={() => move(-1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]} accessibilityLabel={tr("Forme précédente")} hitSlop={6}>
            <CaretLeft size={18} color={colors.onSurface} weight="bold" />
          </Pressable>
          <ChordNeck voicing={v} width={neckW - 2 * 40} show={show} rowH={landscape ? 24 : 30} />
          <Pressable testID="shape-next" onPress={() => move(1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]} accessibilityLabel={tr("Forme suivante")} hitSlop={6}>
            <CaretRight size={18} color={colors.onSurface} weight="bold" />
          </Pressable>
        </View>
        <Text style={[styles.muted, styles.counter]}>
          {at + 1} / {list.length}
        </Text>

        <View style={styles.segmentWrap}>
          <Segment
            testID="shape-show"
            value={show}
            onChange={setShow}
            options={[
              { id: "fingers", label: tr("Doigts") },
              { id: "degrees", label: tr("Degrés") },
            ]}
          />
        </View>

        <Pressable testID="shape-play" onPress={play} style={({ pressed }) => [styles.playbar, pressed && styles.pressed]} accessibilityRole="button">
          <View style={styles.playRound}>{playing ? <Stop size={20} color={colors.onBrandPrimary} weight="fill" /> : <Play size={20} color={colors.onBrandPrimary} weight="fill" />}</View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.playTitle}>{tr("Écouter")}</Text>
            <Text style={styles.muted} numberOfLines={1}>
              {styleLabel} · {tr("à changer dans Réglages")}
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      <KeyWheel visible={keyOpen} rootPc={rootPc} nameOf={nameOf} onClose={() => setKeyOpen(false)} onChange={setRootPc} />
      <Sheet visible={sheet === "type"} onClose={() => setSheet(null)} title={tr("Type")} testID="shape-type-sheet">
        <View style={styles.chips}>
          {kind === "barre"
            ? CHORD_TYPES.map((c) => <Chip key={c.id} testID={`type-${c.id}`} label={tr(c.name)} selected={typeId === c.id} onPress={() => { setTypeId(c.id); setSheet(null); }} />)
            : kind === "power"
              ? [false, true].map((o) => <Chip key={String(o)} testID={`type-power-${o ? 8 : 5}`} label={o ? tr("1-5-8 (avec l’octave)") : "1-5"} selected={power8 === o} onPress={() => { setPower8(o); setSheet(null); }} />)
              : [false, true].map((m) => <Chip key={String(m)} testID={`type-${m ? "min" : "maj"}`} label={tr(m ? "Mineur" : "Majeur")} selected={minor === m} onPress={() => { setMinor(m); setIdx(0); setSheet(null); }} />)}
        </View>
      </Sheet>
      <Sheet visible={sheet === "shape"} onClose={() => setSheet(null)} title={kind === "open" ? tr("Accord") : tr("Forme")} testID="shape-shape-sheet">
        {kind === "open" ? (
          <View style={{ gap: spacing.md }}>
            {[...new Set(OPEN_CHORDS.map((c) => c.type))].map((t) => (
              <View key={t} style={{ gap: spacing.xs }}>
                <Text style={styles.sheetLabel}>{tr(t)}</Text>
                <View style={styles.chips}>
                  {OPEN_CHORDS.map((c, i) =>
                    c.type === t ? <Chip key={i} testID={`open-${i}`} label={`${nameOf(c.root)}${c.symbol}`} selected={i === at} onPress={() => { setIdx(i); setSheet(null); }} /> : null,
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.chips}>
            {list.map((s, i) => (
              <Chip key={s.name} testID={`shape-${i}`} label={tr(s.name)} selected={i === at} onPress={() => { setIdx(i); setSheet(null); }} />
            ))}
          </View>
        )}
      </Sheet>
    </View>
  );
}

function degColor(d: string, c: ReturnType<typeof useTheme>["colors"]) {
  if (d === "1") return c.degreeRoot;
  if (d.endsWith("3")) return c.degree3rd;
  if (d.endsWith("5")) return c.degree5th;
  return c.degree7th;
}

/** A neck window drawn as it is held: high e on top, the nut on the left, a few frets wide. */
function ChordNeck({ voicing, width, show, rowH }: { voicing: Voicing; width: number; show: "fingers" | "degrees"; rowH: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const played = voicing.strings.filter((s): s is NonNullable<Played> => !!s);
  const fretted = played.filter((s) => s.fret > 0).map((s) => s.fret);
  const maxF = fretted.length ? Math.max(...fretted) : 1;
  const minF = fretted.length ? Math.min(...fretted) : 1;
  const start = maxF <= 5 ? 1 : minF; // at the nut when it fits
  const span = Math.max(5, maxF - start + 1);
  const gutter = 24;
  const cell = Math.max(28, (width - gutter) / span);
  const neckW = cell * span;
  const top = rowH / 2;
  const h = rowH * 5;
  const dot = Math.min(rowH - 4, cell - 6, 26);
  const rows = [...voicing.strings].reverse(); // 1st string (high e) on top
  const labels = ["e", "B", "G", "D", "A", "E"];

  // Barre: finger 1 on several strings at the lowest fret.
  const barre = useMemo(() => {
    const at = rows.map((s, r) => (s && s.fret === minF && s.fret > 0 && s.finger === 1 ? r : -1)).filter((r) => r >= 0);
    return at.length >= 2 ? { from: Math.min(...at), to: Math.max(...at), fret: minF } : null;
  }, [voicing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ width: gutter + neckW, height: h + top * 2 + 18 }} testID="chord-neck">
      {/* frets */}
      {Array.from({ length: span + 1 }, (_, i) => (
        <View
          key={`f${i}`}
          style={{ position: "absolute", left: gutter + i * cell - (i === 0 && start === 1 ? 2 : 0.5), top, width: i === 0 && start === 1 ? 5 : 1, height: h, backgroundColor: i === 0 && start === 1 ? colors.onSurfaceSecondary : colors.borderStrong }}
        />
      ))}
      {/* strings */}
      {rows.map((_, r) => (
        <View key={`s${r}`} style={{ position: "absolute", left: gutter, top: top + r * rowH - 0.5, width: neckW, height: r >= 3 ? 1.6 : 1, backgroundColor: colors.onSurfaceTertiary }} />
      ))}
      {/* ○ / × at the nut, string names */}
      {rows.map((s, r) => (
        <Text key={`m${r}`} style={[styles.mark, { top: top + r * rowH - 9, color: s === null ? colors.onSurfaceTertiary : s.fret === 0 ? (show === "degrees" ? degColor(s.deg, colors) : colors.onSurface) : colors.onSurfaceTertiary }]}>
          {s === null ? "×" : s.fret === 0 ? (show === "degrees" ? s.deg : "○") : labels[r]}
        </Text>
      ))}
      {barre ? (
        <View
          style={{
            position: "absolute",
            left: gutter + (barre.fret - start + 0.5) * cell - dot / 2,
            top: top + barre.from * rowH - dot / 2,
            width: dot,
            height: (barre.to - barre.from) * rowH + dot,
            borderRadius: dot / 2,
            backgroundColor: "rgba(244,244,245,0.18)",
            borderWidth: 1,
            borderColor: colors.borderStrong,
          }}
        />
      ) : null}
      {rows.map((s, r) =>
        s && s.fret > 0 ? (
          <View
            key={`d${r}`}
            style={{
              position: "absolute",
              left: gutter + (s.fret - start + 0.5) * cell - dot / 2,
              top: top + r * rowH - dot / 2,
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: degColor(s.deg, colors),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={styles.dotText}>{show === "fingers" ? (s.finger || "") : s.deg}</Text>
          </View>
        ) : null,
      )}
      {/* fret numbers */}
      {Array.from({ length: span }, (_, i) => (
        <Text key={`n${i}`} style={[styles.fretNum, { left: gutter + i * cell, width: cell, top: h + top * 2 }]}>
          {i === 0 || [3, 5, 7, 9, 12, 15].includes(start + i) ? start + i : ""}
        </Text>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md, minHeight: 48 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 24, fontWeight: "700", color: c.onSurface },
  middle: { flex: 1 },
  middleContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md, alignItems: "stretch" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  chordName: { fontFamily: fonts.display, fontSize: 32, fontWeight: "700", color: c.onSurface },
  muted: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  formula: { flexDirection: "row", gap: 6, flexShrink: 0 },
  degChip: { minWidth: 30, height: 26, paddingHorizontal: 6, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  degChipText: { fontFamily: fonts.display, fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  neckRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  arrow: { width: 36, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  counter: { textAlign: "center", marginTop: -spacing.sm },
  mark: { position: "absolute", left: 0, width: 22, textAlign: "center", fontFamily: fonts.text, fontSize: 14, lineHeight: 18 },
  dotText: { fontFamily: fonts.display, fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  fretNum: { position: "absolute", textAlign: "center", fontFamily: fonts.text, fontSize: 11, color: c.onSurfaceTertiary },
  segmentWrap: { alignSelf: "center", minWidth: 220 },
  playbar: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: 28, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  playRound: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  playTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onSurface },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sheetLabel: { fontFamily: fonts.text, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "600", color: c.onSurfaceTertiary },
  pressed: { opacity: 0.85 },
}));
