import React from "react";
import { Pressable, View } from "react-native";
import Svg, { Ellipse, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import { CLEF_PATH } from "@/src/components/scoreLayout";
import { OPEN_MIDI, type Voicing } from "@/src/music/chordShapes";
import { useSettings } from "@/src/settings";
import { useTheme } from "@/src/theme";

/** How many measures fit a width (at least `minMeasure` px each), never more than `n`. */
export const fitCount = (width: number, n: number, clefW = 30, minMeasure = 52) => Math.max(1, Math.min(n, Math.floor((width - clefW) / minMeasure)));
/** The shapes shown: the current one, centered when it can be, with its neighbours. */
export const windowOf = (sel: number, k: number, n: number) => {
  const s = Math.max(0, Math.min(n - k, sel - Math.floor(k / 2)));
  return Array.from({ length: Math.min(k, n) }, (_, i) => s + i);
};

// Natural step (C = 0 … B = 6) and accidental of each pitch class, spelled with sharps or flats.
const SHARP: [number, string][] = [[0, ""], [0, "♯"], [1, ""], [1, "♯"], [2, ""], [3, ""], [3, "♯"], [4, ""], [4, "♯"], [5, ""], [5, "♯"], [6, ""]];
const FLAT: [number, string][] = [[0, ""], [1, "♭"], [1, ""], [2, "♭"], [2, ""], [3, ""], [4, "♭"], [4, ""], [5, "♭"], [5, ""], [6, "♭"], [6, ""]];

type Props = {
  voicings: Voicing[];
  idxs: number[]; // which voicings get a measure
  selected: number;
  width: number;
  gap?: number; // staff space
  labelOf: (v: Voicing, i: number) => string;
  colorNotes: boolean; // degree colors on the current measure
  background: string; // under the tab numbers
  onPick: (i: number) => void;
  testID?: string;
};

/** Treble clef (guitar, sounding an octave lower) + tab: one measure per chord shape, the current one highlighted. */
export function ChordScore({ voicings, idxs, selected, width, gap = 7, labelOf, colorNotes, background, onPick, testID }: Props) {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const g = gap;
  const tg = Math.max(10.5, g * 1.35); // tab: room for the fret numbers
  const clefW = 30;
  const mw = (width - clefW) / Math.max(1, idxs.length);
  const y0 = 16 + 3.5 * g; // top staff line
  const tabTop = y0 + 6.5 * g + 8;
  const height = tabTop + 5 * tg + 8;
  const sy = (step: number) => y0 + 4 * g - ((step - 30) * g) / 2; // E4 (step 30) on the bottom line
  const spell = settings.accidental === "flat" ? FLAT : SHARP;
  const written = (midi: number) => {
    const w = midi + 12; // guitar is written an octave higher
    const [d, acc] = spell[w % 12];
    return { step: (Math.floor(w / 12) - 1) * 7 + d, acc };
  };
  const degColor = (d: string) => (d === "1" ? colors.degreeRoot : d.endsWith("3") ? colors.degree3rd : d.endsWith("5") ? colors.degree5th : colors.degree7th);
  const ink = colors.onSurface;
  const dim = colors.onSurfaceTertiary;
  const line = colors.borderStrong;

  return (
    <View style={{ width, height }} testID={testID}>
      <Svg width={width} height={height}>
        {idxs.map((vi, m) =>
          vi === selected ? <Rect key={`sel${m}`} x={clefW + m * mw} y={0} width={mw} height={height} rx={8} fill={colors.brandTertiary} /> : null,
        )}
        {[0, 1, 2, 3, 4].map((k) => (
          <Line key={`st${k}`} x1={0} y1={y0 + k * g} x2={width} y2={y0 + k * g} stroke={dim} strokeWidth={1} />
        ))}
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <Line key={`tb${k}`} x1={0} y1={tabTop + k * tg} x2={width} y2={tabTop + k * tg} stroke={line} strokeWidth={1} />
        ))}
        <Path d={CLEF_PATH} transform={`translate(14 ${y0 + 4 * g}) scale(${g / 8})`} fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Ellipse cx={14 - 3.4 * (g / 8)} cy={y0 + 4 * g + 10.6 * (g / 8)} rx={2.1 * (g / 8)} ry={2.1 * (g / 8)} fill={ink} />
        <SvgText x={14} y={y0 + 4 * g + 15 * (g / 8) + 8} fontSize={9} fill={dim} textAnchor="middle" fontWeight="700">
          8
        </SvgText>
        {["T", "A", "B"].map((c, k) => (
          <SvgText key={c} x={8} y={tabTop + tg * 1.1 + k * tg * 1.5} fontSize={10} fill={dim} fontWeight="700" textAnchor="middle">
            {c}
          </SvgText>
        ))}
        {idxs.map((_, m) => (
          <React.Fragment key={`bar${m}`}>
            <Line x1={clefW + (m + 1) * mw - 0.5} y1={y0} x2={clefW + (m + 1) * mw - 0.5} y2={y0 + 4 * g} stroke={dim} strokeWidth={1} />
            <Line x1={clefW + (m + 1) * mw - 0.5} y1={tabTop} x2={clefW + (m + 1) * mw - 0.5} y2={tabTop + 5 * tg} stroke={line} strokeWidth={1} />
          </React.Fragment>
        ))}
        {idxs.map((vi, m) => {
          const v = voicings[vi];
          const on = vi === selected;
          const c = on ? ink : dim;
          const cx = clefW + m * mw + mw / 2;
          const notes = v.strings
            .map((s, i) => (s ? { ...written(OPEN_MIDI[i] + s.fret), deg: s.deg } : null))
            .filter((n): n is { step: number; acc: string; deg: string } => !!n)
            .sort((a, b) => a.step - b.step);
          const out: React.ReactNode[] = [];
          let prev = -99;
          let shifted = false;
          notes.forEach((n, k) => {
            const off = n.step - prev === 1 && !shifted ? 1.5 * g : 0; // a second: the upper note steps aside
            shifted = off > 0;
            prev = n.step;
            const ny = sy(n.step);
            for (let l = 28; l >= n.step; l -= 2) out.push(<Line key={`lb${k}-${l}`} x1={cx - 1.4 * g} y1={sy(l)} x2={cx + 1.4 * g} y2={sy(l)} stroke={c} strokeWidth={1} />);
            for (let l = 40; l <= n.step; l += 2) out.push(<Line key={`la${k}-${l}`} x1={cx - 1.4 * g} y1={sy(l)} x2={cx + 1.4 * g} y2={sy(l)} stroke={c} strokeWidth={1} />);
            if (n.acc)
              out.push(
                <SvgText key={`ac${k}`} x={cx - 1.6 * g} y={ny + g * 0.6} fontSize={g * 1.8} fill={c} textAnchor="end">
                  {n.acc}
                </SvgText>,
              );
            out.push(
              <Ellipse
                key={`n${k}`}
                cx={cx + off}
                cy={ny}
                rx={0.8 * g}
                ry={0.55 * g}
                fill="none"
                stroke={colorNotes && on ? degColor(n.deg) : c}
                strokeWidth={Math.max(1.4, g * 0.24)}
                transform={`rotate(-18 ${cx + off} ${ny})`}
              />,
            );
          });
          v.strings.forEach((s, i) => {
            if (!s) return;
            const ty = tabTop + (5 - i) * tg;
            out.push(<Rect key={`tr${i}`} x={cx - 8} y={ty - 5.5} width={16} height={11} fill={on ? colors.brandTertiary : background} />);
            out.push(
              <SvgText key={`tf${i}`} x={cx} y={ty + Math.min(11, tg * 0.95) * 0.36} fontSize={Math.min(11, tg * 0.95)} fill={c} fontWeight="700" textAnchor="middle">
                {String(s.fret)}
              </SvgText>,
            );
          });
          return (
            <React.Fragment key={`m${m}`}>
              <SvgText x={cx} y={12} fontSize={11} fill={on ? colors.brandPrimary : dim} fontWeight="700" textAnchor="middle">
                {labelOf(v, vi)}
              </SvgText>
              {out}
            </React.Fragment>
          );
        })}
      </Svg>
      {idxs.map((vi, m) => (
        <Pressable
          key={`hit${m}`}
          testID={testID ? `${testID}-measure-${vi}` : undefined}
          onPress={() => onPick(vi)}
          style={{ position: "absolute", left: clefW + m * mw, top: 0, width: mw, height }}
          accessibilityRole="button"
          accessibilityLabel={labelOf(voicings[vi], vi)}
        />
      ))}
    </View>
  );
}

