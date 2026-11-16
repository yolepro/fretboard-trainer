import React, { memo, useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Ellipse, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import { layoutScore, type ScoreLayout, type Shape, type Tone } from "@/src/components/scoreLayout";
import { buildScoreModel, type ScoreModel } from "@/src/music/score";
import type { ExerciseId } from "@/src/music/exercises";
import type { Formula, PathStep } from "@/src/music/theory";
import { useSettings } from "@/src/settings";
import { makeStyles, radius, useTheme } from "@/src/theme";

/** Builds the score model + drawing for a list of notes (memoized on its inputs). */
export function useScore(
  steps: PathStep[],
  kind: ExerciseId | "path",
  perBeat: number,
  rootPc: number,
  formula: Formula,
  showTab: boolean,
  slow = false,
  tempoBpm: number | null = null,
  tempoHalf = false,
): { model: ScoreModel; layout: ScoreLayout } {
  const { settings } = useSettings();
  const model = useMemo(
    () => buildScoreModel({ steps, kind, perBeat, slow, rootPc, formula, accidental: settings.accidental, notation: settings.notation }),
    [steps, kind, perBeat, slow, rootPc, formula, settings.accidental, settings.notation],
  );
  const layout = useMemo(
    () => layoutScore(model, { showTab, tempo: tempoBpm ? { bpm: tempoBpm, half: tempoHalf } : null }),
    [model, showTab, tempoBpm, tempoHalf],
  );
  return { model, layout };
}

type Palette = Record<Tone, string>;

function ShapeView({ s, k, p }: { s: Shape; k: number; p: Palette }) {
  switch (s.t) {
    case "line":
      return <Line key={k} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={p[s.c]} strokeWidth={s.w} />;
    case "ellipse":
      return <Ellipse key={k} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={p[s.c]} transform={`rotate(${s.rot ?? 0} ${s.cx} ${s.cy})`} />;
    case "rect":
      return <Rect key={k} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} fill={p[s.c]} opacity={s.o ?? 1} />;
    case "text":
      return (
        <SvgText key={k} x={s.x} y={s.y} fontSize={s.size} fill={p[s.c]} textAnchor={s.anchor ?? "start"} fontWeight={s.bold ? "700" : "400"} fontStyle={s.italic ? "italic" : "normal"}>
          {s.s}
        </SvgText>
      );
    case "path":
      return <Path key={k} d={s.d} transform={`translate(${s.tx} ${s.ty})`} fill="none" stroke={p[s.c]} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />;
  }
}

// The whole score is drawn once; only the small overlay below changes from one note to the next.
const StaticLayer = memo(function StaticLayer({ layout, palette }: { layout: ScoreLayout; palette: Palette }) {
  return (
    <Svg width={layout.width} height={layout.height}>
      {layout.shapes.map((s, i) => (
        <ShapeView key={i} s={s} k={i} p={palette} />
      ))}
    </Svg>
  );
});

type Props = {
  layout: ScoreLayout;
  /** Index of the note being played / selected (highlighted, kept in view). */
  activeIndex: number | null;
  onNotePress?: (index: number) => void;
  testID?: string;
};

export function Score({ layout, activeIndex, onNotePress, testID }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const palette = useMemo<Palette>(
    () => ({ ink: colors.onSurface, muted: colors.muted, accent: colors.brandPrimary, onAccent: colors.onBrandPrimary, panel: colors.surfaceTertiary }),
    [colors],
  );
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const viewW = useRef(0);

  // A new score starts from its left end.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [layout.shapes]);

  // Keep the current note in view: scroll only when it gets close to an edge.
  useEffect(() => {
    if (activeIndex === null) return;
    const x = layout.eventX[activeIndex];
    if (x === undefined || viewW.current === 0) return;
    if (x < scrollX.current + 50 || x > scrollX.current + viewW.current - 90) {
      scrollRef.current?.scrollTo({ x: Math.max(0, x - viewW.current * 0.3), animated: true });
    }
  }, [activeIndex, layout.eventX]);

  const hl = activeIndex !== null ? layout.highlights[activeIndex] : null;
  return (
    <View style={styles.wrap} testID={testID}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => {
          scrollX.current = e.nativeEvent.contentOffset.x;
        }}
        onLayout={(e) => {
          viewW.current = e.nativeEvent.layout.width;
        }}
      >
        <View style={{ width: layout.width, height: layout.height }}>
          <StaticLayer layout={layout} palette={palette} />
          {hl ? (
            <Svg style={styles.overlay} width={layout.width} height={layout.height} pointerEvents="none">
              <Rect x={layout.eventX[activeIndex!] - 15} y={0} width={30} height={layout.height} rx={8} fill={palette.accent} opacity={0.16} />
              {hl.map((s, i) => (
                <ShapeView key={i} s={s} k={i} p={palette} />
              ))}
            </Svg>
          ) : null}
          {onNotePress
            ? layout.eventX.map((x, i) => (
                <Pressable key={i} onPress={() => onNotePress(i)} style={{ position: "absolute", left: x - 13, top: 0, width: 26, height: layout.height }} />
              ))
            : null}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { marginHorizontal: 8, marginTop: 6, borderRadius: radius.md ?? 12, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  overlay: { position: "absolute", left: 0, top: 0 },
}));
