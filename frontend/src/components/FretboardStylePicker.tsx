import React from "react";
import { Pressable, Text, View } from "react-native";

import {
  FRETBOARD_STYLES,
  MARKER_SIZE,
  fretboardPalette,
  type FretboardPalette,
  type FretboardStyleId,
} from "@/src/fretboardStyles";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const PREVIEW_H = 46;
const STRINGS = [
  { top: 10, h: 1, wound: false },
  { top: 22, h: 1.6, wound: true },
  { top: 34, h: 2.2, wound: true },
];

function Preview({ p, rootColor }: { p: FretboardPalette; rootColor: string }) {
  const styles = useStyles();
  const m = MARKER_SIZE[p.markerShape];
  const w = m.w * 0.8;
  const h = m.h * 0.8;
  return (
    <View style={[styles.preview, { backgroundColor: p.open }]}>
      <View style={{ width: 12, borderRightWidth: 4, borderRightColor: p.nut, backgroundColor: p.open }} />
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: i % 2 ? p.woodAlt : p.wood,
            borderRightWidth: 2,
            borderRightColor: p.fretWire,
          }}
        >
          {i === 1 ? (
            <View
              style={{
                position: "absolute",
                alignSelf: "center",
                top: PREVIEW_H / 2 - h / 2,
                width: w,
                height: h,
                borderRadius: m.radius,
                backgroundColor: p.marker,
                opacity: 0.9,
                transform: m.rotate ? [{ rotate: "45deg" }] : undefined,
              }}
            />
          ) : null}
        </View>
      ))}
      {STRINGS.map((s, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: s.top,
            height: s.h,
            backgroundColor: s.wound ? p.stringWound : p.stringPlain,
          }}
        />
      ))}
      <View pointerEvents="none" style={[styles.previewNote, { backgroundColor: rootColor }]} />
    </View>
  );
}

type Props = {
  value: FretboardStyleId;
  onChange: (id: FretboardStyleId) => void;
};

export function FretboardStylePicker({ value, onChange }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.list} testID="fretboard-style-picker">
      {FRETBOARD_STYLES.map((s) => {
        const selected = s.id === value;
        return (
          <Pressable
            key={s.id}
            testID={`fretboard-style-${s.id}`}
            onPress={() => onChange(s.id)}
            style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.pressed]}
          >
            <Preview p={fretboardPalette(s.id, colors)} rootColor={colors.degreeRoot} />
            <View style={styles.cardText}>
              <Text style={[styles.name, selected && styles.nameSelected]}>{s.name}</Text>
              <Text style={styles.desc}>{s.description}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  list: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
  },
  cardSelected: { borderColor: c.brandPrimary, borderWidth: 2, padding: spacing.sm - 1 },
  pressed: { opacity: 0.85 },
  preview: {
    width: 118,
    height: PREVIEW_H,
    flexDirection: "row",
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  previewNote: { position: "absolute", left: 50, top: PREVIEW_H / 2 - 7, width: 14, height: 14, borderRadius: 7 },
  cardText: { flex: 1 },
  name: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onSurfaceSecondary },
  nameSelected: { color: c.brandPrimary },
  desc: { fontFamily: fonts.text, fontSize: 12, color: c.muted, marginTop: 2 },
}));
