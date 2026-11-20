import React, { useState } from "react";
import { Text, View } from "react-native";

import { STRING_LABELS } from "@/src/music/theory";
import { fonts, makeStyles, useTheme } from "@/src/theme";

type Props = { string: number; fret: number; label: string };

const FRETS = 12; // the “Manche” challenge asks frets 0–12
const ROW = 13; // string spacing: the whole neck stays ~100 px tall
const OPEN_W = 22;
const LABEL_W = 14;
const MARKERS = new Set([3, 5, 7, 9, 12]);

/** Small read-only neck (frets 0–12) showing where the missed note was. String 0 = high e, on top (tab view). */
export function MiniNeck({ string, fret, label }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const fretW = w > 0 ? (w - LABEL_W - OPEN_W) / FRETS : 0;
  const neckH = ROW * 6;
  const dotX = fret === 0 ? LABEL_W + OPEN_W / 2 : LABEL_W + OPEN_W + (fret - 0.5) * fretW;
  const dotY = ROW / 2 + string * ROW;

  return (
    <View style={styles.wrap} onLayout={(e) => setW(e.nativeEvent.layout.width)} testID="miss-neck" pointerEvents="none">
      {w > 0 ? (
        <>
          <View style={{ height: neckH }}>
            <View style={[styles.wood, { left: LABEL_W + OPEN_W, height: neckH }]} />
            {STRING_LABELS.map((l, s) => (
              <Text key={l + s} style={[styles.stringLabel, { top: s * ROW, height: ROW, lineHeight: ROW, width: LABEL_W }]}>
                {l}
              </Text>
            ))}
            {Array.from({ length: 6 }, (_, s) => (
              <View key={s} style={[styles.string, { left: LABEL_W, top: ROW / 2 + s * ROW - 0.5, height: 1 + s * 0.25 }]} />
            ))}
            <View style={[styles.nut, { left: LABEL_W + OPEN_W - 3, height: neckH }]} />
            {Array.from({ length: FRETS }, (_, i) => (
              <View key={i} style={[styles.fretWire, { left: LABEL_W + OPEN_W + (i + 1) * fretW - 1, height: neckH }]} />
            ))}
            <View style={[styles.dot, { left: dotX - 10, top: dotY - 10, backgroundColor: colors.brandPrimary }]}>
              <Text style={[styles.dotText, { color: colors.onBrandPrimary }]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          </View>
          <View style={styles.numbers}>
            {Array.from({ length: FRETS + 1 }, (_, f) =>
              f === 0 || MARKERS.has(f) ? (
                <Text
                  key={f}
                  style={[
                    styles.num,
                    { left: (f === 0 ? LABEL_W + OPEN_W / 2 : LABEL_W + OPEN_W + (f - 0.5) * fretW) - 10 },
                    f === fret && { color: colors.brandPrimary, fontWeight: "700" },
                  ]}
                >
                  {f}
                </Text>
              ) : null,
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { width: "100%", height: ROW * 6 + 16 },
  wood: { position: "absolute", top: 0, right: 0, backgroundColor: c.fretboardWood, borderRadius: 3 },
  stringLabel: { position: "absolute", left: 0, textAlign: "center", fontFamily: fonts.display, fontSize: 9, color: c.muted },
  string: { position: "absolute", right: 0, backgroundColor: c.onSurfaceTertiary, opacity: 0.7 },
  nut: { position: "absolute", top: 0, width: 3, backgroundColor: c.nut },
  fretWire: { position: "absolute", top: 0, width: 1.5, backgroundColor: c.fretWire },
  dot: { position: "absolute", width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.onSurface },
  dotText: { fontFamily: fonts.display, fontSize: 9, fontWeight: "700" },
  numbers: { height: 16 },
  num: { position: "absolute", top: 2, width: 20, textAlign: "center", fontFamily: fonts.display, fontSize: 10, color: c.muted },
}));
