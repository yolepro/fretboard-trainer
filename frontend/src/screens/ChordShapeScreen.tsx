import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeft, CaretRight, Play, Stop } from "phosphor-react-native";

import { LANDSCAPE_NAV_W } from "@/src/components/AppTabBar";
import { Chip } from "@/src/components/Chip";
import { ChordScore, fitCount, windowOf } from "@/src/components/ChordScore";
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
type Show = "fingers" | "degrees";

const playedOf = (v: Voicing) => v.strings.filter((s): s is NonNullable<Played> => !!s);
const fretSpan = (v: Voicing): [number, number] => {
  const f = playedOf(v).map((s) => s.fret).filter((n) => n > 0);
  return f.length ? [Math.min(...f), Math.max(...f)] : [0, 0];
};

/** Explorer › Les formes à jouer: a chord shape on the whole neck, a zoom on it, and the score of its shapes. */
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
  const [show, setShow] = useState<Show>("fingers");
  const [keyOpen, setKeyOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [playing, setPlaying] = useState(false);

  // Every shape the arrows go through. Barré, power chords and CAGED: the shapes of the same chord along the neck.
  const list: Voicing[] = useMemo(() => {
    if (kind === "open") return OPEN_CHORDS.map((_, i) => openVoicing(i));
    if (kind === "barre") return [barreVoicing(rootPc, typeId, "E"), barreVoicing(rootPc, typeId, "A")];
    if (kind === "power") return ([6, 5, 4] as const).map((s) => powerVoicing(rootPc, s, power8));
    return cagedVoicings(rootPc, minor, 17);
  }, [kind, rootPc, typeId, power8, minor]);
  const at = Math.min(idx, list.length - 1);
  const v = list[at];
  const chordName = `${nameOf(v.rootPc)}${v.symbol}`;
  const [lo, hi] = fretSpan(v);
  const hasOpen = v.strings.some((s) => s?.fret === 0);
  const sameChord = kind !== "open"; // the other shapes of the list are the same chord: ghosts on the neck, positions
  const ghosts = sameChord ? list.filter((_, i) => i !== at) : [];
  const neckTo = Math.min(settings.fretCount, Math.max(15, ...list.map((s) => fretSpan(s)[1])));

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
  const select = (i: number) => {
    stopChordNotes();
    setPlaying(false);
    setIdx(((i % list.length) + list.length) % list.length);
  };

  const styleLabel = settings.chordStyle === "both" ? tr("Arpégé puis plaqué") : settings.chordStyle === "block" ? tr("Plaqué") : tr("Arpégé");
  const typeLabel = kind === "power" ? (power8 ? "1-5-8" : "1-5") : kind === "caged" ? tr(minor ? "Mineur" : "Majeur") : tr(CHORD_TYPES.find((c) => c.id === typeId)!.name);

  // Names of a shape: on its position chip, above its measure.
  const shortOf = (s: Voicing, i: number) =>
    kind === "caged" ? `${s.name.replace("Forme ", "")} · ${i + 1}` : kind === "barre" ? nameOf(s.rootString === 6 ? 4 : 9) : kind === "power" ? `${tr("Corde")} ${s.rootString}` : `${nameOf(s.rootPc)}${s.symbol}`;
  const chipOf = (s: Voicing, i: number) => (kind === "caged" ? `${tr("Pos.")} ${i + 1} · ${s.name.replace("Forme ", "")}` : kind === "barre" ? tr(s.name) : shortOf(s, i));
  const where = hasOpen && lo === 0 ? tr("au sillet") : `${tr("cases")} ${hasOpen ? 0 : lo}–${hi}`;
  const desc = kind === "open" ? `${tr(v.typeName)} · ${where}` : `${tr(v.name)} · ${where}`;

  // Formula chips: the chord's degrees in order, each with its color.
  const degs = useMemo(() => {
    const order = ["1", "♭3", "3", "5", "♭7", "7"];
    const set = new Set(playedOf(v).map((s) => s.deg));
    return order.filter((d) => set.has(d));
  }, [v]);

  const showLabel = show === "fingers" ? tr("Doigts") : tr("Degrés");
  const pills = (
    <>
      {kind !== "open" ? <Pill testID="pill-key" label={nameOf(rootPc)} accent onPress={() => setKeyOpen(true)} /> : null}
      {kind !== "open" ? <Pill testID="pill-type" label={typeLabel} onPress={() => setSheet("type")} /> : null}
      {kind === "open" ? <Pill testID="pill-shape" label={chordName} accent onPress={() => setSheet("shape")} /> : null}
      <Pill testID="pill-show" label={showLabel} onPress={() => setShow(show === "fingers" ? "degrees" : "fingers")} />
    </>
  );
  const chips =
    sameChord && list.length > 1 ? (
      <View style={styles.chips} testID="shape-positions">
        {list.map((s, i) => (
          <Pressable key={i} testID={`shape-pos-${i}`} onPress={() => select(i)} style={({ pressed }) => [styles.posChip, i === at && styles.posChipOn, pressed && styles.pressed]}>
            <Text style={[styles.posChipText, i === at && styles.posChipTextOn]} numberOfLines={1}>
              {chipOf(s, i)}
            </Text>
          </Pressable>
        ))}
      </View>
    ) : null;

  const sheets = (
    <>
      <KeyWheel visible={keyOpen} rootPc={rootPc} nameOf={nameOf} onClose={() => setKeyOpen(false)} onChange={setRootPc} />
      <Sheet visible={sheet === "type"} onClose={() => setSheet(null)} title={tr("Type")} testID="shape-type-sheet">
        <View style={styles.wrap}>
          {kind === "barre"
            ? CHORD_TYPES.map((c) => <Chip key={c.id} testID={`type-${c.id}`} label={tr(c.name)} selected={typeId === c.id} onPress={() => { setTypeId(c.id); setSheet(null); }} />)
            : kind === "power"
              ? [false, true].map((o) => <Chip key={String(o)} testID={`type-power-${o ? 8 : 5}`} label={o ? tr("1-5-8 (avec l’octave)") : "1-5"} selected={power8 === o} onPress={() => { setPower8(o); setSheet(null); }} />)
              : [false, true].map((m) => <Chip key={String(m)} testID={`type-${m ? "min" : "maj"}`} label={tr(m ? "Mineur" : "Majeur")} selected={minor === m} onPress={() => { setMinor(m); setIdx(0); setSheet(null); }} />)}
        </View>
      </Sheet>
      <Sheet visible={sheet === "shape"} onClose={() => setSheet(null)} title={tr("Accord")} testID="shape-shape-sheet">
        <View style={{ gap: spacing.md }}>
          {[...new Set(OPEN_CHORDS.map((c) => c.type))].map((t) => (
            <View key={t} style={{ gap: spacing.xs }}>
              <Text style={styles.sheetLabel}>{tr(t)}</Text>
              <View style={styles.wrap}>
                {OPEN_CHORDS.map((c, i) =>
                  c.type === t ? <Chip key={i} testID={`open-${i}`} label={`${nameOf(c.root)}${c.symbol}`} selected={i === at} onPress={() => { select(i); setSheet(null); }} /> : null,
                )}
              </View>
            </View>
          ))}
        </View>
      </Sheet>
    </>
  );

  const playIcon = playing ? <Stop size={18} color={colors.onBrandPrimary} weight="fill" /> : <Play size={18} color={colors.onBrandPrimary} weight="fill" />;
  const backBtn = (
    <Pressable testID="shape-back" onPress={onBack} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} accessibilityLabel={tr("Explorer")} hitSlop={6}>
      <CaretLeft size={20} color={colors.onSurface} weight="bold" />
    </Pressable>
  );

  // ---------- Landscape: the whole neck on the left, the score on the side ----------
  if (landscape) {
    const availW = width - insets.left - insets.right - 2 * spacing.lg;
    const panelW = Math.round(Math.max(210, Math.min(380, availW * 0.3)));
    const leftW = availW - panelW - spacing.md;
    const bodyH = height - insets.top - insets.bottom - 48 - spacing.xs - spacing.sm;
    const rowH = Math.max(14, Math.min(28, (bodyH - (chips ? 90 : 50) - 24) / 6));
    const scoreW = panelW - 2 * spacing.sm;
    const k = fitCount(scoreW, list.length);
    const idxs = windowOf(at, k, list.length);
    return (
      <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="chord-shape-screen">
        <StudioBackground />
        <View style={[styles.header, styles.headerLandscape, { paddingTop: insets.top + spacing.xs, paddingRight: LANDSCAPE_NAV_W + spacing.md }]}>
          {backBtn}
          <Text style={[styles.title, styles.titleLandscape]} numberOfLines={1} testID="shape-title">
            {tr(SHAPE_TITLES[kind])}
          </Text>
          <View style={styles.headerPills}>
            <PillRow inset={false}>{pills}</PillRow>
          </View>
          <View style={styles.transportPill}>
            <Pressable testID="shape-play" onPress={play} style={({ pressed }) => [styles.playRound, pressed && styles.pressed]} accessibilityLabel={`${tr("Écouter")} · ${styleLabel}`}>
              {playIcon}
            </Pressable>
          </View>
        </View>
        <View style={[styles.body, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={{ width: leftW, gap: spacing.sm }}>
            <ChordNeck voicing={v} ghosts={ghosts} from={1} to={neckTo} width={leftW} rowH={rowH} show={show} frame testID="chord-neck-full" />
            {chips}
            <Text style={styles.muted} numberOfLines={1}>
              {chordName} · {desc}
            </Text>
          </View>
          <View style={[styles.panel, { width: panelW }]} testID="shape-score-panel">
            <View style={styles.panelHead}>
              <Text style={[styles.sectionTitle, { flex: 1 }]}>{tr("Partition")}</Text>
              {list.length > 1 ? (
                <>
                  <Pressable testID="shape-prev" onPress={() => select(at - 1)} style={({ pressed }) => [styles.miniArrow, pressed && styles.pressed]} accessibilityLabel={tr("Forme précédente")} hitSlop={6}>
                    <CaretLeft size={14} color={colors.onSurface} weight="bold" />
                  </Pressable>
                  <Text style={styles.counter}>
                    {at + 1} / {list.length}
                  </Text>
                  <Pressable testID="shape-next" onPress={() => select(at + 1)} style={({ pressed }) => [styles.miniArrow, pressed && styles.pressed]} accessibilityLabel={tr("Forme suivante")} hitSlop={6}>
                    <CaretRight size={14} color={colors.onSurface} weight="bold" />
                  </Pressable>
                </>
              ) : null}
            </View>
            <ChordScore voicings={list} idxs={idxs} selected={at} width={scoreW} gap={6.5} labelOf={shortOf} colorNotes={show === "degrees"} background={colors.surfaceSecondary} onPick={select} testID="shape-score" />
            {list.length > k && list.length <= 12 ? (
              <View style={styles.dots}>
                {list.map((_, i) => (
                  <View key={i} style={[styles.dot, idxs.includes(i) && styles.dotSeen, i === at && styles.dotOn]} />
                ))}
              </View>
            ) : null}
          </View>
        </View>
        {sheets}
      </View>
    );
  }

  // ---------- Portrait ----------
  const contentW = width - insets.left - insets.right - 2 * spacing.lg;
  const zoomW = contentW - 2 * (36 + spacing.sm);
  const k = fitCount(contentW, list.length);
  const idxs = windowOf(at, k, list.length);
  const zoomFrom = hi <= 5 ? 1 : lo;
  const zoomTo = zoomFrom + Math.max(5, hi - zoomFrom + 1) - 1;

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="chord-shape-screen">
      <StudioBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        {backBtn}
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} testID="shape-title">
          {tr(SHAPE_TITLES[kind])}
        </Text>
      </View>
      <PillRow testID="shape-pills">{pills}</PillRow>
      <ScrollView style={styles.middle} contentContainerStyle={styles.middleContent} showsVerticalScrollIndicator={false}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.chordName} testID="shape-chord-name" numberOfLines={1}>
              {chordName}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {desc}
            </Text>
            {v.note ? (
              <Text style={styles.note} testID="shape-note">
                {tr(v.note)}
              </Text>
            ) : null}
          </View>
          <View style={styles.formula}>
            {degs.map((d) => (
              <View key={d} style={[styles.degChip, { backgroundColor: degColor(d, colors) }]}>
                <Text style={styles.degChipText}>{d}</Text>
              </View>
            ))}
          </View>
        </View>

        {chips}
        {sameChord ? (
          <View style={{ gap: 4 }}>
            <Text style={styles.sectionTitle}>{tr("Sur tout le manche")}</Text>
            <ChordNeck voicing={v} ghosts={ghosts} from={1} to={neckTo} width={contentW} rowH={9} show={null} frame testID="chord-neck-full" />
          </View>
        ) : null}

        <View style={styles.neckRow}>
          <Pressable testID="shape-prev" onPress={() => select(at - 1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]} accessibilityLabel={tr("Forme précédente")} hitSlop={6}>
            <CaretLeft size={18} color={colors.onSurface} weight="bold" />
          </Pressable>
          <ChordNeck voicing={v} from={zoomFrom} to={zoomTo} width={zoomW} rowH={26} show={show} allNums testID="chord-neck" />
          <Pressable testID="shape-next" onPress={() => select(at + 1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]} accessibilityLabel={tr("Forme suivante")} hitSlop={6}>
            <CaretRight size={18} color={colors.onSurface} weight="bold" />
          </Pressable>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.sectionTitle}>{sameChord ? `${tr("Partition")} · ${chordName}` : tr("Partition")}</Text>
          <ChordScore voicings={list} idxs={idxs} selected={at} width={contentW} labelOf={shortOf} colorNotes={show === "degrees"} background={colors.surface} onPick={select} testID="shape-score" />
        </View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: (usesNativeTabs ? insets.bottom : 0) + spacing.sm }]}>
        <Pressable testID="shape-play" onPress={play} style={({ pressed }) => [styles.playbar, pressed && styles.pressed]} accessibilityRole="button">
          <View style={styles.playRound}>{playIcon}</View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.playTitle}>{tr("Écouter")}</Text>
            <Text style={styles.muted} numberOfLines={1}>
              {styleLabel} · {tr("à changer dans Réglages")}
            </Text>
          </View>
        </Pressable>
      </View>
      {sheets}
    </View>
  );
}

function degColor(d: string, c: ReturnType<typeof useTheme>["colors"]) {
  if (d === "1") return c.degreeRoot;
  if (d.endsWith("3")) return c.degree3rd;
  if (d.endsWith("5")) return c.degree5th;
  return c.degree7th;
}

type NeckProps = {
  voicing: Voicing;
  ghosts?: Voicing[]; // the other shapes of the same chord, drawn as rings
  from: number;
  to: number;
  width: number;
  rowH: number;
  show: Show | null; // null: plain dots (overview)
  frame?: boolean; // frame the shape's zone
  allNums?: boolean;
  testID?: string;
};

/** A neck drawn as it is held: high e on top, the nut on the left. */
function ChordNeck({ voicing, ghosts = [], from, to, width, rowH, show, frame, allNums, testID }: NeckProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const nut = from <= 1;
  const gutter = rowH >= 16 ? 22 : 14;
  const n = to - from + 1;
  const colW = (width - gutter) / n;
  const dot = Math.max(6, Math.min(rowH - 3, colW - 4, 26));
  const top = rowH / 2 + 3;
  const h = rowH * 5;
  const cx = (f: number) => (f === 0 ? gutter / 2 - 1 : gutter + (f - from + 0.5) * colW);
  const ry = (i: number) => top + (5 - i) * rowH; // i: 0 = low E
  const [lo, hi] = fretSpan(voicing);
  const hasOpen = voicing.strings.some((s) => s?.fret === 0);
  const strings = voicing.strings;

  // Barre: finger 1 on several strings at the lowest fret.
  const one = strings.map((s, i) => (s && s.fret === lo && s.fret > 0 && s.finger === 1 ? i : -1)).filter((i) => i >= 0);
  const barre = show && one.length >= 2 ? { a: Math.max(...one), b: Math.min(...one) } : null;
  const inlay = Math.max(2, Math.min(5, rowH * 0.2));
  const markSize = Math.min(13, rowH);

  return (
    <View style={{ width, height: top + h + rowH / 2 + 18 }} testID={testID}>
      <View style={{ position: "absolute", left: gutter, top: top - rowH / 2, width: width - gutter, height: rowH * 6, backgroundColor: "#2A1E14", borderRadius: 3 }} />
      {[3, 5, 7, 9, 12, 15, 17, 19, 21].filter((f) => f >= from && f <= to).flatMap((f) =>
        (f === 12 || f === 24 ? [1.5, 3.5] : [2.5]).map((k) => (
          <View key={`in${f}-${k}`} style={{ position: "absolute", left: cx(f) - inlay, top: top + k * rowH - inlay, width: 2 * inlay, height: 2 * inlay, borderRadius: inlay, backgroundColor: "rgba(231,229,228,0.28)" }} />
        )),
      )}
      {Array.from({ length: n + 1 }, (_, i) => {
        const isNut = nut && i === 0;
        const w = isNut ? 4 : 1.5;
        return <View key={`f${i}`} style={{ position: "absolute", left: gutter + i * colW - w / 2, top: top - 2, width: w, height: h + 4, backgroundColor: isNut ? "#E7E5E4" : "#8A8F98" }} />;
      })}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const t = Math.max(0.8, 0.7 + (5 - i) * 0.3 * Math.min(1, rowH / 20));
        return <View key={`s${i}`} style={{ position: "absolute", left: gutter, top: ry(i) - t / 2, width: width - gutter, height: t, backgroundColor: "#C9B79C", opacity: 0.85 }} />;
      })}
      {frame && hi > 0 ? (
        <View
          style={{
            position: "absolute",
            left: hasOpen && nut ? 0 : cx(lo) - colW / 2 - 2,
            top: top - rowH / 2 - 3,
            width: cx(hi) + colW / 2 + 2 - (hasOpen && nut ? 0 : cx(lo) - colW / 2 - 2),
            height: rowH * 6 + 6,
            borderWidth: 2,
            borderColor: colors.brandPrimary,
            borderRadius: 6,
            backgroundColor: "rgba(245,158,11,0.10)",
          }}
        />
      ) : null}
      {ghosts.flatMap((g, gi) =>
        g.strings.map((s, i) => {
          if (!s || s.fret < from - 1 || s.fret > to || (s.fret === 0 && !nut)) return null;
          const d = dot * 0.7;
          return <View key={`g${gi}-${i}`} style={{ position: "absolute", left: cx(s.fret) - d / 2, top: ry(i) - d / 2, width: d, height: d, borderRadius: d / 2, borderWidth: 1.5, borderColor: degColor(s.deg, colors), opacity: 0.55 }} />;
        }),
      )}
      {barre ? (
        <View
          style={{
            position: "absolute",
            left: cx(lo) - dot / 2 - 2,
            top: ry(barre.a) - dot / 2 - 2,
            width: dot + 4,
            height: ry(barre.b) - ry(barre.a) + dot + 4,
            borderRadius: dot,
            backgroundColor: "rgba(244,244,245,0.20)",
            borderWidth: 1,
            borderColor: "rgba(244,244,245,0.45)",
          }}
        />
      ) : null}
      {strings.map((s, i) => {
        if (s === null)
          return (
            <Text key={`m${i}`} style={[styles.mark, { left: cx(0) - 10, top: ry(i) - 9, fontSize: markSize, color: "#F87171" }]}>
              ×
            </Text>
          );
        if (s.fret === 0) {
          const d = Math.min(dot * 0.85, gutter - 4);
          if (show === "degrees")
            return (
              <Text key={`m${i}`} style={[styles.mark, { left: cx(0) - 10, top: ry(i) - 9, fontSize: Math.min(12, rowH), color: degColor(s.deg, colors), fontWeight: "700" }]}>
                {s.deg}
              </Text>
            );
          return <View key={`m${i}`} style={{ position: "absolute", left: cx(0) - d / 2, top: ry(i) - d / 2, width: d, height: d, borderRadius: d / 2, borderWidth: 2, borderColor: degColor(s.deg, colors) }} />;
        }
        if (s.fret < from || s.fret > to) return null;
        return (
          <View
            key={`d${i}`}
            style={{ position: "absolute", left: cx(s.fret) - dot / 2, top: ry(i) - dot / 2, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: degColor(s.deg, colors), alignItems: "center", justifyContent: "center" }}
          >
            {show ? <Text style={[styles.dotText, { fontSize: Math.max(9, Math.round(dot * 0.5)) }]}>{show === "fingers" ? (s.finger || "") : s.deg}</Text> : null}
          </View>
        );
      })}
      {Array.from({ length: n }, (_, i) => from + i).map((f) =>
        allNums || [3, 5, 7, 9, 12, 15, 17, 19, 21].includes(f) || f === lo ? (
          <Text key={`n${f}`} style={[styles.fretNum, { left: cx(f) - 12, top: top + h + rowH / 2 + 2 }, f === lo && styles.fretNumOn]}>
            {f}
          </Text>
        ) : null,
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md, minHeight: 48 },
  headerLandscape: { gap: spacing.sm, paddingBottom: spacing.xs },
  headerPills: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 24, fontWeight: "700", color: c.onSurface },
  titleLandscape: { flex: 0, flexShrink: 1, fontSize: 20, maxWidth: 220 },
  transportPill: { flexDirection: "row", alignItems: "center", padding: 4, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, flexShrink: 0 },
  body: { flex: 1, flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  panel: { alignSelf: "flex-start", padding: spacing.sm, gap: 4, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniArrow: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  counter: { fontFamily: fonts.text, fontSize: 11, fontWeight: "600", color: c.onSurfaceSecondary, minWidth: 30, textAlign: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, paddingTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.border },
  dotSeen: { backgroundColor: c.onSurfaceTertiary },
  dotOn: { backgroundColor: c.brandPrimary },
  middle: { flex: 1 },
  middleContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.md },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  chordName: { fontFamily: fonts.display, fontSize: 32, fontWeight: "700", color: c.onSurface },
  muted: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  note: { fontFamily: fonts.text, fontSize: 12, color: c.brandPrimary, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.text, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "600", color: c.onSurfaceTertiary },
  formula: { flexDirection: "row", gap: 6, flexShrink: 0 },
  degChip: { minWidth: 30, height: 26, paddingHorizontal: 6, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  degChipText: { fontFamily: fonts.display, fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  chips: { flexDirection: "row", gap: 6 },
  posChip: { flex: 1, minHeight: 36, paddingHorizontal: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  posChipOn: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  posChipText: { fontFamily: fonts.text, fontSize: 12, fontWeight: "600", color: c.onSurface },
  posChipTextOn: { color: c.brandPrimary },
  neckRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  arrow: { width: 36, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  mark: { position: "absolute", width: 20, textAlign: "center", fontFamily: fonts.text, lineHeight: 18 },
  dotText: { fontFamily: fonts.display, fontWeight: "700", color: "#FFFFFF" },
  fretNum: { position: "absolute", width: 24, textAlign: "center", fontFamily: fonts.text, fontSize: 10, color: c.onSurfaceTertiary },
  fretNumOn: { color: c.brandPrimary, fontWeight: "700" },
  bottom: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  playbar: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: 28, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  playRound: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  playTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onSurface },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sheetLabel: { fontFamily: fonts.text, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "600", color: c.onSurfaceTertiary },
  pressed: { opacity: 0.85 },
}));
