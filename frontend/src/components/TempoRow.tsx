import React, { useEffect, useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";

import { fonts, makeStyles, radius, spacing } from "@/src/theme";

type Props = {
  bpm: number;
  min: number;
  max: number;
  onChange: (bpm: number) => void;
  hint?: string;
  /** Prefix of the test ids ("bpm" → bpm-minus, bpm-input…). */
  prefix?: string;
};

/** Tempo control: −5 / typed value / +5 / OK. The value is clamped to [min, max] when committed. */
export function TempoRow({ bpm, min, max, onChange, hint, prefix = "bpm" }: Props) {
  const styles = useStyles();
  const [text, setText] = useState(String(bpm));
  useEffect(() => setText(String(bpm)), [bpm]);
  const commit = (raw: string | number) => {
    const n = typeof raw === "number" ? raw : parseInt(raw, 10);
    const v = Math.max(min, Math.min(max, Number.isFinite(n) ? n : bpm));
    setText(String(v));
    if (v !== bpm) onChange(v);
  };
  return (
    <View style={styles.row}>
      <Pressable testID={`${prefix}-minus`} onPress={() => commit(bpm - 5)} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      <TextInput
        testID={`${prefix}-input`}
        value={text}
        onChangeText={setText}
        onEndEditing={() => commit(text)}
        onSubmitEditing={() => commit(text)}
        keyboardType="number-pad"
        returnKeyType="done"
        maxLength={3}
        selectTextOnFocus
        style={styles.input}
      />
      <Pressable testID={`${prefix}-plus`} onPress={() => commit(bpm + 5)} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
        <Text style={styles.btnText}>+</Text>
      </Pressable>
      <Pressable
        testID={`${prefix}-ok`}
        onPress={() => {
          commit(text);
          Keyboard.dismiss();
        }}
        style={({ pressed }) => [styles.btn, styles.ok, pressed && styles.pressed]}
      >
        <Text style={styles.btnText}>OK</Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  btn: { minWidth: 44, height: 40, paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  ok: { borderColor: c.brandPrimary },
  btnText: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface },
  input: { width: 72, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surfaceTertiary, textAlign: "center", fontFamily: fonts.display, fontSize: 18, fontWeight: "700", color: c.onSurface },
  hint: { flex: 1, fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
}));
