import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { cellId, prettyLabel, type Cell } from "@/src/challenge/rounds";
import { DEGREE_META, STRING_LABELS, degreeKeyFromNum } from "@/src/music/theory";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type Props = {
  min: number;
  max: number;
  scope?: "position" | "neck";
  found: Cell[];
  tonics: Cell[]; // landmarks (not asked)
  wrong: string | null; // cell id flashing red
  revealed?: Cell[]; // too many mistakes: the notes that were missing, shown before moving on
  onPress: (string: number, fret: number) => void;
  disabled?: boolean;
};

const INLAYS = [3, 5, 7, 9, 12, 15, 17, 19, 21];
const LABEL_W = 18;
const OPEN_W = 30;
const MINI_H = 46;

/**
 * The challenge's neck (“mini-map + zoom”):
 * - on top, the whole neck in small at real proportions, with an orange frame on the zone being played;
 * - below, the zone in large, with one greyed fret on each side for context, fret markers (3, 5, 7, 9, 12…).
 * Notes appear where they are found.
 */
export function ChallengeNeck({ min, max, scope = "position", found, tonics, wrong, revealed = [], onPress, disabled }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [w, setW] = useState(0);

  const neck = scope === "neck";
  const g0 = neck ? min : Math.max(0, min - 1); // context frets (greyed, not playable)
  const g1 = neck ? max : max + 1;
  const firstFretted = Math.max(1, g0);
  const cols = g1 - firstFretted + 1;
  const openW = g0 === 0 ? OPEN_W : 0;
  const cw = w > 0 ? (w - LABEL_W - openW) / cols : 0;
  const compact = cw < 34;
  const ROW = compact ? 32 : 40;
  const dot = compact ? 20 : 28;
  const xOf = (f: number) => (f === 0 ? LABEL_W + openW / 2 : LABEL_W + openW + (f - firstFretted + 0.5) * cw);
  const inZone = (f: number) => f >= min && f <= max;

  const foundById = new Map(found.map((c) => [cellId(c), c]));
  const tonicById = new Map(tonics.map((c) => [cellId(c), c]));
  const shownById = new Map(revealed.map((c) => [cellId(c), c]));

  // ---- mini-map: frets 0..last at real proportions (distance from the nut ∝ 1 − 2^(−f/12)) ----
  const last = Math.max(15, max + 2);
  const d = (f: number) => 1 - Math.pow(2, -f / 12);
  const mOpen = 8;
  const mk = w > 0 ? (w - mOpen) / d(last + 0.6) : 0;
  const mx = (f: number) => mOpen + mk * d(f);
  const mMid = (f: number) => (f === 0 ? mOpen / 2 : (mx(f - 1) + mx(f)) / 2);
  const zl = min === 0 ? 0 : mx(min - 1);
  const zr = mx(max);

  const neckH = ROW * 6;

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} testID="challenge-neck">
      {w > 0 ? (
        <>
          {!neck ? (
            <View style={styles.miniWrap}>
              <View style={[styles.mini, { height: MINI_H }]} accessibilityLabel={`Position : cases ${min} à ${max}`}>
                {Array.from({ length: 6 }, (_, s) => (
                  <View key={`ms${s}`} style={[styles.miniString, { top: 5 + s * 7 }]} />
                ))}
                {Array.from({ length: last + 1 }, (_, f) => (
                  <View key={`mf${f}`} style={[f === 0 ? styles.miniNut : styles.miniFret, { left: mx(f) - (f === 0 ? 2 : 0.5) }]} />
                ))}
                {INLAYS.filter((f) => f <= last).flatMap((f) =>
                  (f === 12 ? [12, 30] : [21]).map((y) => <View key={`mi${f}-${y}`} style={[styles.miniInlay, { left: mMid(f) - 2.5, top: y }]} />),
                )}
                <View style={[styles.miniFrame, { left: zl - 1, width: zr - zl + 2 }]} />
              </View>
              <View style={styles.miniLegend}>
                <Text style={styles.miniText}>0</Text>
                <Text style={[styles.miniText, styles.miniZone, { left: (zl + zr) / 2 - 40 }]}>{`${min}–${max}`}</Text>
                <Text style={styles.miniText}>{last}</Text>
              </View>
            </View>
          ) : null}

          <View style={[styles.neck, { height: neckH + 22 }]}>
            {/* open strings column, before the nut */}
            {g0 === 0 ? <View style={[styles.openCol, { left: LABEL_W, width: openW, height: neckH }]} /> : null}
            {/* strings */}
            {STRING_LABELS.map((label, s) => (
              <React.Fragment key={`s${s}`}>
                <Text style={[styles.label, { top: s * ROW + ROW / 2 - 7 }]}>{label}</Text>
                <View style={[styles.string, { top: s * ROW + ROW / 2, height: 1 + s * 0.35, left: LABEL_W }]} />
              </React.Fragment>
            ))}
            {/* nut + fret wires */}
            {g0 === 0 ? <View style={[styles.nut, { left: LABEL_W + openW - 6, height: neckH }]} /> : null}
            {Array.from({ length: cols }, (_, i) => {
              const f = firstFretted + i;
              const left = LABEL_W + openW + i * cw;
              return (
                <React.Fragment key={`f${f}`}>
                  <View style={[styles.fret, { left: left + cw - 1, height: neckH }]} />
                  {INLAYS.includes(f)
                    ? (f === 12 ? [1.5, 3.5] : [2.5]).map((k) => (
                        <View key={`in${f}-${k}`} style={[styles.inlay, { left: left + cw / 2 - 6, top: k * ROW + ROW / 2 - 6 }]} />
                      ))
                    : null}
                  {!inZone(f) ? <View style={[styles.ghost, { left, width: cw, height: neckH }]} /> : null}
                  <Text style={[styles.num, { left: left + cw / 2 - 14, top: neckH + 4 }, INLAYS.includes(f) && styles.numMark, !inZone(f) && styles.numGhost]}>{f}</Text>
                </React.Fragment>
              );
            })}
            {g0 === 0 ? <Text style={[styles.num, { left: LABEL_W + openW / 2 - 14, top: neckH + 4 }, !inZone(0) && styles.numGhost]}>0</Text> : null}

            {/* playable cells + notes */}
            {STRING_LABELS.map((label, s) =>
              Array.from({ length: g1 - g0 + 1 }, (_, i) => {
                const f = g0 + i;
                if (!inZone(f)) {
                  // context frets: only landmarks (tonics), never playable
                  const t = tonicById.get(`${s}-${f}`);
                  return t ? (
                    <View key={`g${s}-${f}`} pointerEvents="none" style={[styles.dot, styles.tonicDot, styles.dim, { width: dot, height: dot, borderRadius: dot / 2, left: xOf(f) - dot / 2, top: s * ROW + ROW / 2 - dot / 2, borderColor: colors.degreeRoot }]}>
                      <Text style={[styles.dotText, compact && styles.dotTextSmall, { color: colors.degreeRoot }]}>1</Text>
                    </View>
                  ) : null;
                }
                const id = `${s}-${f}`;
                const missed = shownById.get(id);
                const hit = foundById.get(id) ?? missed;
                const tonic = tonicById.get(id);
                const meta = hit ? DEGREE_META[degreeKeyFromNum(hit.num)] : null;
                const cellW = f === 0 ? openW : cw;
                return (
                  <Pressable
                    key={`c${s}-${f}`}
                    testID={`challenge-cell-${s}-${f}`}
                    disabled={disabled}
                    onPress={() => onPress(s, f)}
                    accessibilityLabel={`${label} ${f}`}
                    style={[styles.cell, { left: xOf(f) - cellW / 2, top: s * ROW, width: cellW, height: ROW }]}
                  >
                    {hit && meta ? (
                      <View style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: colors[meta.color] }, hit.num === 1 && styles.rootDot, missed && styles.missedDot]}>
                        <Text style={[styles.dotText, compact && styles.dotTextSmall, { color: colors[meta.on] }]}>{prettyLabel(hit.label)}</Text>
                      </View>
                    ) : wrong === id ? (
                      <View style={[styles.dot, styles.wrongDot, { width: dot, height: dot, borderRadius: dot / 2 }]}>
                        <Text style={[styles.dotText, compact && styles.dotTextSmall, { color: "#FFFFFF" }]}>✕</Text>
                      </View>
                    ) : tonic ? (
                      <View style={[styles.dot, styles.tonicDot, { width: dot, height: dot, borderRadius: dot / 2, borderColor: colors.degreeRoot }]}>
                        <Text style={[styles.dotText, compact && styles.dotTextSmall, { color: colors.degreeRoot }]}>1</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              }),
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  miniWrap: { marginBottom: 8 },
  mini: { borderRadius: 6, backgroundColor: c.fretboardWood, overflow: "hidden" },
  miniString: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: c.onSurfaceTertiary, opacity: 0.5 },
  miniFret: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: c.fretWire },
  miniNut: { position: "absolute", top: 0, bottom: 0, width: 4, backgroundColor: c.nut },
  miniInlay: { position: "absolute", width: 5, height: 5, borderRadius: 3, backgroundColor: c.onSurface, opacity: 0.55 },
  miniFrame: { position: "absolute", top: 1, bottom: 1, borderWidth: 2, borderColor: c.brandPrimary, borderRadius: 4, backgroundColor: "rgba(245,165,36,0.18)" },
  miniLegend: { flexDirection: "row", justifyContent: "space-between", height: 16, marginTop: 2 },
  miniText: { fontFamily: fonts.display, fontSize: 11, color: c.onSurfaceTertiary },
  miniZone: { position: "absolute", width: 80, textAlign: "center", color: c.brandPrimary, fontWeight: "700" },
  neck: { borderRadius: 12, backgroundColor: c.fretboardWood, overflow: "hidden" },
  openCol: { position: "absolute", top: 0, backgroundColor: "rgba(0,0,0,0.35)" },
  label: { position: "absolute", left: 0, width: LABEL_W, textAlign: "center", fontFamily: fonts.display, fontSize: 11, fontWeight: "600", color: c.onSurfaceTertiary },
  string: { position: "absolute", right: 0, backgroundColor: c.onSurfaceTertiary, opacity: 0.6 },
  nut: { position: "absolute", top: 0, width: 6, backgroundColor: c.nut },
  fret: { position: "absolute", top: 0, width: 2, backgroundColor: c.fretWire },
  inlay: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: c.onSurface, opacity: 0.35 },
  ghost: { position: "absolute", top: 0, backgroundColor: "rgba(16,17,20,0.6)" },
  num: { position: "absolute", width: 28, textAlign: "center", fontFamily: fonts.display, fontSize: 11, color: c.onSurfaceTertiary },
  numMark: { fontSize: 13, fontWeight: "700", color: c.onSurface },
  numGhost: { opacity: 0.45 },
  cell: { position: "absolute", alignItems: "center", justifyContent: "center" },
  dot: { alignItems: "center", justifyContent: "center" },
  rootDot: { borderWidth: 2, borderColor: c.onSurface },
  missedDot: { borderWidth: 3, borderColor: "#F97316" },
  wrongDot: { backgroundColor: "#B91C1C" },
  tonicDot: { borderWidth: 2, backgroundColor: "transparent" },
  dim: { position: "absolute", opacity: 0.4 },
  dotText: { fontFamily: fonts.display, fontSize: 12, fontWeight: "700" },
  dotTextSmall: { fontSize: 10 },
}));
