import React, { memo, useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  DEGREE_META,
  DOUBLE_MARKERS,
  FRET_COUNT,
  SINGLE_MARKERS,
  TUNING,
  degreeKeyFromNum,
  octaveOf,
  pcOf,
  type DegreeKey,
  type IntervalDef,
} from "@/src/music/theory";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const OPEN_W = 46;
const NODE = 26;
const STRING_THICK = [1, 1.4, 1.8, 2.4, 3, 3.6];

const baseFretWidth = (n: number) => (n === 0 ? OPEN_W : 78 * Math.pow(2, -n / 28));
export const fretWidth = (n: number, scale = 1) => Math.round(baseFretWidth(n) * scale);
const FRETS = Array.from({ length: FRET_COUNT + 1 }, (_, i) => i);

/** Scale factor so frets 0..lastFret fit exactly in `available` px (never enlarges). */
export function fitScale(available: number, lastFret: number) {
  let w = 0;
  for (let f = 0; f <= lastFret; f++) w += baseFretWidth(f);
  return Math.min(1, available / w);
}

type Props = {
  degreeMap: Map<number, IntervalDef>;
  visibleLayers: Set<DegreeKey>;
  /** If set, only these degrees use their degree color; other visible notes use one uniform color. */
  coloredLayers?: Set<DegreeKey>;
  octave: number | null;
  labelMode: "note" | "degree";
  showNeutral: boolean;
  nameOf: (pc: number) => string;
  activeMidi?: { string: number; fret: number } | null;
  onNotePress: (midi: number, stringIdx: number, fret: number) => void;
  fretScale?: number;
  rowH?: number;
  /** Scale box: notes outside these frets are faded, and the window is highlighted. */
  windowRange?: { min: number; max: number } | null;
};

function FretboardImpl({
  degreeMap,
  visibleLayers,
  coloredLayers,
  octave,
  labelMode,
  showNeutral,
  nameOf,
  activeMidi,
  onNotePress,
  fretScale = 1,
  rowH = 34,
  windowRange = null,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const boardH = rowH * 6;
  const widths = useMemo(() => FRETS.map((f) => fretWidth(f, fretScale)), [fretScale]);
  const totalW = useMemo(() => widths.reduce((s, w) => s + w, 0), [widths]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollRef = useRef<any>(null);
  const scrollX = useRef(0);
  const viewW = useRef(0);
  const inWindow = (f: number) => !windowRange || (f >= windowRange.min && f <= windowRange.max);

  // Landscape fits frets 0→16: reset any scroll left over from portrait.
  useEffect(() => {
    if (fretScale < 1) scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [fretScale]);

  // Only scroll when the selected position is (partly) off-screen.
  useEffect(() => {
    if (!windowRange) return;
    let start = 0;
    for (let f = 0; f < windowRange.min; f++) start += widths[f];
    let end = start;
    for (let f = windowRange.min; f <= windowRange.max; f++) end += widths[f];
    const visible = start >= scrollX.current && end <= scrollX.current + viewW.current;
    if (visible && viewW.current > 0) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, start - widths[0]), animated: true });
  }, [windowRange, widths]);

  return (
    <ScrollView
      ref={scrollRef}
      onScroll={(e) => {
        scrollX.current = e.nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={32}
      onLayout={(e) => {
        viewW.current = e.nativeEvent.layout.width;
      }}
      horizontal
      showsHorizontalScrollIndicator={false}
      testID="fretboard-scroll"
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View testID="fretboard">
        <View style={{ width: totalW, height: boardH }}>
          {/* Layer 0: wood, fret wires, pearl markers */}
          <View style={styles.layerRow}>
            {FRETS.map((f) => (
              <View
                key={`w${f}`}
                style={[
                  { width: widths[f], height: boardH },
                  f === 0 ? styles.openCell : f % 2 ? styles.wood : styles.woodAlt,
                  windowRange && inWindow(f) && styles.boxCell,
                  f === 0 ? styles.nut : styles.fretWire,
                ]}
              >
                {SINGLE_MARKERS.includes(f) ? <View testID={`fret-marker-${f}`} style={[styles.marker, { top: rowH * 3 - 6 }]} /> : null}
                {DOUBLE_MARKERS.includes(f) ? (
                  <>
                    <View testID={`fret-marker-${f}-a`} style={[styles.marker, { top: rowH * 2 - 6 }]} />
                    <View testID={`fret-marker-${f}-b`} style={[styles.marker, { top: rowH * 4 - 6 }]} />
                  </>
                ) : null}
              </View>
            ))}
          </View>

          {/* Layer 1: strings */}
          {TUNING.map((_, s) => (
            <View
              key={`s${s}`}
              pointerEvents="none"
              style={[
                styles.string,
                {
                  top: rowH * (s + 0.5) - STRING_THICK[s] / 2,
                  height: STRING_THICK[s],
                  backgroundColor: s < 2 ? colors.stringPlain : colors.stringWound,
                },
              ]}
            />
          ))}

          {/* Layer 2: notes */}
          <View style={[styles.layerRow, styles.abs]}>
            {FRETS.map((f) => (
              <View key={`n${f}`} style={{ width: widths[f] }}>
                {TUNING.map((open, s) => {
                  const midi = open + f;
                  const pc = pcOf(midi);
                  const iv = degreeMap.get(pc);
                  const key = iv ? degreeKeyFromNum(iv.num) : null;
                  const inOct = octave === null || octaveOf(midi) === octave;
                  const highlighted = !!(iv && key && visibleLayers.has(key) && inOct);
                  const faded = highlighted && !inWindow(f);
                  const isActive = activeMidi?.string === s && activeMidi?.fret === f;
                  const meta = key ? DEGREE_META[key] : null;
                  const node = Math.min(NODE, rowH - 2);
                  const uniform = !!(coloredLayers && key && !coloredLayers.has(key));
                  const bg = meta ? (uniform ? colors.degreeUniform : colors[meta.color]) : undefined;
                  const fg = meta ? (uniform ? colors.onDegreeUniform : colors[meta.on]) : undefined;
                  return (
                    <Pressable
                      key={s}
                      testID={`note-s${s}-f${f}`}
                      onPress={() => onNotePress(midi, s, f)}
                      style={[styles.slot, { height: rowH }]}
                      hitSlop={2}
                    >
                      {highlighted && meta ? (
                        <View
                          style={[
                            styles.node,
                            { backgroundColor: bg, width: node, height: node, borderRadius: node / 2 },
                            key === "root" && !uniform && styles.rootNode,
                            isActive && styles.activeNode,
                            faded && !isActive && styles.faded,
                          ]}
                        >
                          <Text style={[styles.nodeText, { color: fg }]} numberOfLines={1}>
                            {labelMode === "degree" ? iv!.label : nameOf(pc)}
                          </Text>
                        </View>
                      ) : showNeutral || isActive ? (
                        <View style={[styles.neutral, isActive && styles.activeNode]}>
                          <Text style={styles.neutralText} numberOfLines={1}>
                            {nameOf(pc)}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* Fret numbers */}
        <View style={styles.layerRow}>
          {FRETS.map((f) => {
            const marked = SINGLE_MARKERS.includes(f) || DOUBLE_MARKERS.includes(f);
            return (
              <View key={`fn${f}`} style={[styles.fretNumCell, { width: widths[f] }]}>
                <Text testID={`fret-number-${f}`} style={[styles.fretNum, marked && styles.fretNumMarked]}>
                  {f}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

export const Fretboard = memo(FretboardImpl);

const useStyles = makeStyles((c) => ({
  scroll: { flexGrow: 0, flexShrink: 0 },
  scrollContent: { paddingRight: 16 },
  layerRow: { flexDirection: "row" },
  abs: { position: "absolute", top: 0, left: 0 },
  openCell: { backgroundColor: c.surface },
  wood: { backgroundColor: c.fretboardWood },
  woodAlt: { backgroundColor: c.fretboardWoodAlt },
  boxCell: { backgroundColor: c.boxHighlight },
  faded: { opacity: 0.22 },
  nut: { borderRightWidth: 6, borderRightColor: c.nut },
  fretWire: { borderRightWidth: 2, borderRightColor: c.fretWire },
  marker: {
    position: "absolute",
    alignSelf: "center",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: c.fretMarker,
    opacity: 0.85,
  },
  string: { position: "absolute", left: 0, right: 0 },
  slot: { alignItems: "center", justifyContent: "center" },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rootNode: { borderWidth: 2, borderColor: c.onSurface },
  activeNode: { transform: [{ scale: 1.2 }], borderWidth: 2, borderColor: c.surfaceInverse },
  nodeText: { fontFamily: fonts.display, fontSize: 10, fontWeight: "700" },
  neutral: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.degreeNeutral,
    opacity: 0.75,
  },
  neutralText: { fontFamily: fonts.display, fontSize: 8, color: c.onDegreeNeutral },
  fretNumCell: { height: 22, alignItems: "center", justifyContent: "center" },
  fretNum: { fontFamily: fonts.display, fontSize: 11, color: c.muted },
  fretNumMarked: { color: c.fretMarker, fontWeight: "700" },
}));
