import React, { useState } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";

import { tr } from "@/src/i18n";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

/** The 12 keys in circle-of-fifths order, clockwise from the top: C G D A E B F# Db Ab Eb Bb F. */
const CIRCLE = Array.from({ length: 12 }, (_, i) => (i * 7) % 12);

type ButtonProps = { rootPc: number; nameOf: (pc: number) => string; onChange: (pc: number) => void; testID?: string };

/** Round header button showing the current key; opens the key wheel. */
export function KeyButton({ rootPc, nameOf, onChange, testID = "key-button" }: ButtonProps) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const name = nameOf(rootPc);
  const at = CIRCLE.indexOf(((rootPc % 12) + 12) % 12);
  return (
    <>
      <Pressable testID={testID} onPress={() => setOpen(true)} style={({ pressed }) => [styles.button, pressed && styles.pressed]} accessibilityLabel={tr("Tonalité")}>
        {CIRCLE.map((_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI) / 6;
          const on = i === at;
          const r = on ? 2.5 : 1.3;
          return <View key={i} style={[styles.dot, on && styles.dotOn, { width: r * 2, height: r * 2, borderRadius: r, left: 22 + 17.5 * Math.cos(a) - r, top: 22 + 17.5 * Math.sin(a) - r }]} />;
        })}
        <Text style={[styles.buttonText, name.length > 2 && styles.buttonTextLong]} numberOfLines={1}>
          {name}
        </Text>
      </Pressable>
      <KeyWheel visible={open} rootPc={rootPc} nameOf={nameOf} onClose={() => setOpen(false)} onChange={onChange} />
    </>
  );
}

function sector(c: number, r1: number, r2: number, a0: number, a1: number) {
  const p = (r: number, a: number) => `${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`;
  return `M${p(r2, a0)} A${r2},${r2} 0 0 1 ${p(r2, a1)} L${p(r1, a1)} A${r1},${r1} 0 0 0 ${p(r1, a0)} Z`;
}

type WheelProps = { visible: boolean; rootPc: number; nameOf: (pc: number) => string; onClose: () => void; onChange: (pc: number) => void };

/**
 * Key picker laid out like a circle of fifths. Outer ring: the 12 keys (tap to choose, the wheel closes).
 * Inner ring: the relative minor of each key, shown as a landmark only (not tappable). Centre: the chosen key and
 * its key signature.
 */
export function KeyWheel({ visible, rootPc, nameOf, onClose, onChange }: WheelProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const size = Math.max(240, Math.min(360, Math.min(width, height) - 96));
  const c = size / 2;
  const rOut = c - 2;
  const rMid = rOut * 0.655;
  const rIn = rOut * 0.385;
  const at = CIRCLE.indexOf(((rootPc % 12) + 12) % 12);
  const sig = at === 0 ? "" : at < 6 ? `${at} ♯` : at === 6 ? "6 ♯ / 6 ♭" : `${12 - at} ♭`;

  // One touch handler for the whole wheel: only the outer ring (the keys) reacts.
  const onTouch = (e: GestureResponderEvent) => {
    const dx = e.nativeEvent.locationX - c;
    const dy = e.nativeEvent.locationY - c;
    const d = Math.hypot(dx, dy);
    if (d < rMid || d > rOut) return;
    const i = ((Math.round((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI / 6)) % 12) + 12) % 12;
    onChange(CIRCLE[i]);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="key-wheel-backdrop">
        <View style={styles.card}>
          <Text style={styles.title}>{tr("Tonalité")}</Text>
          <Pressable onPress={onTouch} style={{ width: size, height: size }} testID="key-wheel">
            <Svg width={size} height={size} pointerEvents="none">
              {CIRCLE.map((pc, i) => {
                const a0 = -Math.PI / 2 + (i - 0.5) * (Math.PI / 6) + 0.012;
                const a1 = -Math.PI / 2 + (i + 0.5) * (Math.PI / 6) - 0.012;
                const am = -Math.PI / 2 + i * (Math.PI / 6);
                const on = i === at;
                const fill = on ? colors.brandPrimary : colors.surfaceTertiary;
                const ink = on ? colors.onBrandPrimary : colors.onSurface;
                const rk = (rMid + rOut) / 2;
                const rm = (rIn + rMid) / 2;
                return (
                  <React.Fragment key={pc}>
                    <Path d={sector(c, rMid + 2, rOut, a0, a1)} fill={fill} stroke={colors.borderStrong} strokeWidth={1} />
                    <SvgText x={c + rk * Math.cos(am)} y={c + rk * Math.sin(am) + size * 0.02} fill={ink} fontSize={size * 0.058} fontWeight="700" fontFamily={fonts.display} textAnchor="middle">
                      {nameOf(pc)}
                    </SvgText>
                    <Path d={sector(c, rIn + 2, rMid - 2, a0, a1)} fill={fill} stroke={colors.borderStrong} strokeWidth={1} />
                    <SvgText x={c + rm * Math.cos(am)} y={c + rm * Math.sin(am) + size * 0.012} fill={ink} fontSize={size * 0.034} fontFamily={fonts.text} textAnchor="middle">
                      {`${nameOf(pc + 9)}m`}
                    </SvgText>
                  </React.Fragment>
                );
              })}
              <Circle cx={c} cy={c} r={rIn - 4} fill={colors.surface} stroke={colors.brandPrimary} strokeWidth={2} />
              <SvgText x={c} y={c + size * 0.012} fill={colors.onSurface} fontSize={size * 0.1} fontWeight="700" fontFamily={fonts.display} textAnchor="middle">
                {nameOf(rootPc)}
              </SvgText>
              <SvgText x={c} y={c + size * 0.078} fill={colors.brandPrimary} fontSize={size * 0.038} fontFamily={fonts.text} textAnchor="middle">
                {sig}
              </SvgText>
            </Svg>
          </Pressable>
          <Text style={styles.hint}>{tr("Touchez une tonalité · touchez à côté pour fermer")}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  button: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.brandPrimary, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onSurface },
  buttonTextLong: { fontSize: 11 },
  dot: { position: "absolute", backgroundColor: c.muted },
  dotOn: { backgroundColor: c.brandPrimary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: "center", gap: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onSurface },
  hint: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary },
}));
