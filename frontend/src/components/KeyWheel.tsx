import React, { useRef, useState } from "react";
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
          // Positions are relative to the inside of the 2 px border: the centre is at 20, not 22.
          const on = i === at;
          const r = on ? 2.5 : 1.3;
          return <View key={i} style={[styles.dot, on && styles.dotOn, { width: r * 2, height: r * 2, borderRadius: r, left: 20 + 16 * Math.cos(a) - r, top: 20 + 16 * Math.sin(a) - r }]} />;
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
  const wheelRef = useRef<View>(null);
  const pick = (x: number, y: number) => {
    const dx = x - c;
    const dy = y - c;
    const d = Math.hypot(dx, dy);
    if (!Number.isFinite(d) || d < rMid || d > rOut) return;
    const i = ((Math.round((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI / 6)) % 12) + 12) % 12;
    onChange(CIRCLE[i]);
    onClose();
  };
  const onTouch = (e: GestureResponderEvent) => {
    // Native gives the touch position inside the wheel; on the web a click only carries page coordinates
    // (or offsetX/Y), so the wheel is measured on screen instead.
    const ne = e.nativeEvent as unknown as { locationX?: number; locationY?: number; offsetX?: number; offsetY?: number; pageX?: number; pageY?: number; clientX?: number; clientY?: number };
    if (Number.isFinite(ne.locationX) && Number.isFinite(ne.locationY)) return pick(ne.locationX as number, ne.locationY as number);
    const px = Number.isFinite(ne.clientX) ? (ne.clientX as number) : ne.pageX;
    const py = Number.isFinite(ne.clientY) ? (ne.clientY as number) : ne.pageY;
    if (Number.isFinite(px) && Number.isFinite(py) && wheelRef.current?.measureInWindow) {
      wheelRef.current.measureInWindow((wx, wy) => pick((px as number) - wx, (py as number) - wy));
      return;
    }
    if (Number.isFinite(ne.offsetX) && Number.isFinite(ne.offsetY)) pick(ne.offsetX as number, ne.offsetY as number);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="key-wheel-backdrop">
        <View style={styles.card}>
          <Text style={styles.title}>{tr("Tonalité")}</Text>
          <Pressable ref={wheelRef} onPress={onTouch} style={{ width: size, height: size }} testID="key-wheel">
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
                    <Path d={sector(c, rIn + 2, rMid - 2, a0, a1)} fill={colors.surfaceTertiary} stroke={on ? colors.brandPrimary : colors.borderStrong} strokeWidth={on ? 2 : 1} />
                    <SvgText x={c + rm * Math.cos(am)} y={c + rm * Math.sin(am) + size * 0.012} fill={on ? colors.brandPrimary : colors.onSurface} fontSize={size * 0.034} fontFamily={fonts.text} textAnchor="middle">
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
  button: { flexShrink: 0, width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.brandPrimary, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onSurface },
  buttonTextLong: { fontSize: 11 },
  dot: { position: "absolute", backgroundColor: c.muted },
  dotOn: { backgroundColor: c.brandPrimary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  backdrop: { flex: 1, backgroundColor: "rgba(10,11,14,0.30)", alignItems: "center", justifyContent: "center" },
  // Same see-through frame as the settings sheets.
  card: { backgroundColor: "rgba(28,30,36,0.80)", borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: "center", gap: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onSurface },
  hint: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary },
}));
