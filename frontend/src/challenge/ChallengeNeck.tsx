import React from "react";
import { Pressable, Text, View } from "react-native";

import { cellId, prettyLabel, type Cell } from "@/src/challenge/rounds";
import { DEGREE_META, STRING_LABELS, degreeKeyFromNum } from "@/src/music/theory";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type Props = {
  min: number;
  max: number;
  found: Cell[];
  tonics: Cell[]; // landmarks (not asked)
  wrong: string | null; // cell id flashing red
  revealed?: Cell[]; // too many mistakes: the notes that were missing, shown before moving on
  next?: Cell | null; // order mode: nothing shown, kept for future hints
  onPress: (string: number, fret: number) => void;
  disabled?: boolean;
};

/** The challenge's neck: only the position's frets, empty at first; found notes appear with their degree. */
export function ChallengeNeck({ min, max, found, tonics, wrong, revealed = [], onPress, disabled }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const frets = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  // Whole neck: many frets → smaller notes so everything fits in portrait.
  const compact = frets.length > 8;
  const dotSize = compact ? { width: 20, height: 20, borderRadius: 10 } : null;
  const textSize = compact ? { fontSize: 10 } : null;
  const foundById = new Map(found.map((c) => [cellId(c), c]));
  const tonicById = new Map(tonics.map((c) => [cellId(c), c]));
  const shownById = new Map(revealed.map((c) => [cellId(c), c]));

  return (
    <View style={styles.neck} testID="challenge-neck">
      {STRING_LABELS.map((label, s) => (
        <View key={s} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <View style={[styles.string, { height: 1 + s * 0.35 }]} />
          {frets.map((f) => {
            const id = `${s}-${f}`;
            const missed = shownById.get(id);
            const hit = foundById.get(id) ?? missed;
            const tonic = tonicById.get(id);
            const meta = hit ? DEGREE_META[degreeKeyFromNum(hit.num)] : null;
            return (
              <Pressable
                key={f}
                testID={`challenge-cell-${s}-${f}`}
                disabled={disabled}
                onPress={() => onPress(s, f)}
                style={[styles.cell, f === 0 ? styles.open : styles.fretted]}
                accessibilityLabel={`${label} ${f}`}
              >
                {hit && meta ? (
                  <View style={[styles.dot, dotSize, { backgroundColor: colors[meta.color] }, hit.label === "1" && styles.rootDot, missed && styles.missedDot]}>
                    <Text style={[styles.dotText, textSize, { color: colors[meta.on] }]}>{prettyLabel(hit.label)}</Text>
                  </View>
                ) : wrong === id ? (
                  <View style={[styles.dot, dotSize, styles.wrongDot]}>
                    <Text style={[styles.dotText, textSize, { color: "#FFFFFF" }]}>✕</Text>
                  </View>
                ) : tonic ? (
                  <View style={[styles.dot, dotSize, styles.tonicDot, { borderColor: colors.degreeRoot }]}>
                    <Text style={[styles.dotText, textSize, { color: colors.degreeRoot }]}>1</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={styles.row}>
        <Text style={styles.label} />
        {frets.map((f) => (
          <Text key={f} style={[styles.num, f === 0 && styles.openNum]}>
            {f}
          </Text>
        ))}
      </View>
    </View>
  );
}

const ROW = 40;
const useStyles = makeStyles((c) => ({
  neck: { borderRadius: 12, backgroundColor: c.fretboardWood, paddingVertical: 6, paddingRight: 4 },
  row: { flexDirection: "row", alignItems: "center", height: ROW },
  label: { width: 20, textAlign: "center", fontFamily: fonts.display, fontSize: 11, fontWeight: "600", color: c.onSurfaceTertiary },
  string: { position: "absolute", left: 20, right: 0, top: ROW / 2, backgroundColor: c.onSurfaceTertiary, opacity: 0.55 },
  cell: { flex: 1, height: ROW, alignItems: "center", justifyContent: "center" },
  fretted: { borderRightWidth: 2, borderRightColor: c.fretWire },
  // Open strings: a short column before the nut, off the wood, so it reads as “corde à vide”.
  // (flexGrow/flexBasis, not flex: 0 — on the web flex: 0 means a zero-width column.)
  open: { flexGrow: 0, flexShrink: 0, flexBasis: 32, width: 32, borderRightWidth: 6, borderRightColor: c.nut, backgroundColor: "rgba(0,0,0,0.35)" },
  missedDot: { borderWidth: 3, borderColor: "#F97316" },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  rootDot: { borderWidth: 2, borderColor: c.onSurface },
  wrongDot: { backgroundColor: "#B91C1C" },
  tonicDot: { borderWidth: 2, backgroundColor: "transparent" },
  dotText: { fontFamily: fonts.display, fontSize: 12, fontWeight: "700" },
  num: { flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: 11, color: c.onSurfaceTertiary },
  openNum: { flexGrow: 0, flexShrink: 0, flexBasis: 32, width: 32 },
}));
