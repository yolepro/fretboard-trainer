import React, { useEffect, useState } from "react";
import { Keyboard, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tr } from "@/src/i18n";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Props = {
  bpm: number;
  min: number;
  max: number;
  /** The tempo counts half notes (slow triplets) instead of quarter notes. */
  half?: boolean;
  defaultBpm: number;
  onBpm: (bpm: number) => void;
  /** Note pace (Doigté only): slow = notes twice as long. The labels name the note values. */
  pace?: { slow: boolean; onChange: (slow: boolean) => void; slowLabel: string; normalLabel: string };
  loop: boolean;
  onLoop: (v: boolean) => void;
  metronome: boolean;
  onMetronome: (v: boolean) => void;
  testID?: string;
};

const PRESETS = [60, 80, 100, 120];

/** Round header button showing the tempo; opens the "Tempo et lecture" sheet (tempo, note pace, loop, metronome). */
export function TempoButton(props: Props) {
  const { bpm, half, testID = "tempo-button" } = props;
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable testID={testID} onPress={() => setOpen(true)} style={({ pressed }) => [styles.button, pressed && styles.pressed]} accessibilityLabel={tr("Tempo")}>
        <View style={styles.note}>
          <View style={[styles.noteHead, half && styles.noteHeadHalf]} />
          <View style={styles.noteStem} />
        </View>
        <Text style={styles.buttonText}>{bpm}</Text>
      </Pressable>
      <TempoSheet {...props} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function TempoSheet({ visible, onClose, bpm, min, max, half, defaultBpm, onBpm, pace, loop, onLoop, metronome, onMetronome }: Props & { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(String(bpm));
  useEffect(() => setText(String(bpm)), [bpm]);
  const commit = (raw: string | number) => {
    const n = typeof raw === "number" ? raw : parseInt(raw, 10);
    const v = Math.max(min, Math.min(max, Number.isFinite(n) ? n : bpm));
    setText(String(v));
    if (v !== bpm) onBpm(v);
  };
  const toggle = (id: string, title: string, sub: string, value: boolean, onChange: (v: boolean) => void) => (
    <Pressable testID={id} onPress={() => onChange(!value)} style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.borderStrong, true: colors.brandPrimary }} thumbColor={colors.surfaceInverse} />
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="tempo-sheet-backdrop" />
      <View style={styles.sheet} testID="tempo-sheet">
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>{tr("Tempo et lecture")}</Text>
          <Pressable testID="tempo-sheet-close" onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}>
          <Text style={styles.label}>{half ? tr("Tempo (BPM, à la blanche)") : tr("Tempo (BPM, à la noire)")}</Text>
          <View style={styles.tempoCard}>
            <Pressable testID="tempo-minus" onPress={() => commit(bpm - 5)} style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}>
              <Text style={styles.roundText}>−</Text>
            </Pressable>
            <View style={styles.tempoCenter}>
              <TextInput
                testID="tempo-input"
                value={text}
                onChangeText={setText}
                onEndEditing={() => commit(text)}
                onSubmitEditing={() => {
                  commit(text);
                  Keyboard.dismiss();
                }}
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={3}
                selectTextOnFocus
                style={styles.tempoValue}
              />
              <Text style={styles.tempoSub}>{tr("BPM · max {n}", { n: max })}</Text>
            </View>
            <Pressable testID="tempo-plus" onPress={() => commit(bpm + 5)} style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}>
              <Text style={styles.roundText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.presets}>
            {PRESETS.filter((p) => p >= min && p <= max).map((p) => (
              <Pressable key={p} testID={`tempo-preset-${p}`} onPress={() => commit(p)} style={({ pressed }) => [styles.preset, bpm === p && styles.presetOn, pressed && styles.pressed]}>
                <Text style={[styles.presetText, bpm === p && styles.presetTextOn]}>{p}</Text>
              </Pressable>
            ))}
            <Pressable testID="tempo-preset-default" onPress={() => commit(defaultBpm)} style={({ pressed }) => [styles.preset, pressed && styles.pressed]}>
              <Text style={styles.presetText}>{tr("Par défaut")}</Text>
            </Pressable>
          </View>

          {pace ? (
            <>
              <Text style={styles.label}>{tr("Débit des notes")}</Text>
              <View style={styles.segment}>
                <Pressable testID="pace-slow" onPress={() => pace.onChange(true)} style={[styles.segBtn, pace.slow && styles.segBtnOn]}>
                  <Text style={[styles.segText, pace.slow && styles.segTextOn]} numberOfLines={1}>{pace.slowLabel}</Text>
                </Pressable>
                <Pressable testID="pace-normal" onPress={() => pace.onChange(false)} style={[styles.segBtn, !pace.slow && styles.segBtnOn]}>
                  <Text style={[styles.segText, !pace.slow && styles.segTextOn]} numberOfLines={1}>{pace.normalLabel}</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>{tr("Lent : les notes durent deux fois plus longtemps.")}</Text>
            </>
          ) : null}

          <Text style={styles.label}>{tr("Lecture")}</Text>
          {toggle("loop-toggle", tr("Boucle"), tr("Rejoue l’exercice sans s’arrêter"), loop, onLoop)}
          {toggle("metronome-toggle", tr("Métronome"), tr("Un clic sur chaque temps"), metronome, onMetronome)}
          <Text style={styles.hint}>{tr("Décompte automatique : 1 mesure (½ sous 70 BPM).")}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  button: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.brandPrimary, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: fonts.display, fontSize: 13, fontWeight: "700", color: c.onSurface, marginTop: 1 },
  note: { width: 10, height: 11, marginTop: -2 },
  noteHead: { position: "absolute", left: 0, bottom: 0, width: 7, height: 5, borderRadius: 3, backgroundColor: c.brandPrimary, transform: [{ rotate: "-20deg" }] },
  noteHeadHalf: { backgroundColor: "transparent", borderWidth: 1.3, borderColor: c.brandPrimary },
  noteStem: { position: "absolute", left: 6, bottom: 3, width: 1.3, height: 9, backgroundColor: c.brandPrimary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { maxHeight: "88%", backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: c.borderStrong, marginBottom: spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  title: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onSurface },
  close: { fontSize: 18, color: c.onSurfaceTertiary },
  label: { fontFamily: fonts.text, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: c.onSurfaceTertiary, marginTop: spacing.lg, marginBottom: spacing.sm },
  tempoCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.surfaceTertiary, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  roundBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  roundText: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface, lineHeight: 28 },
  tempoCenter: { alignItems: "center" },
  tempoValue: { minWidth: 110, textAlign: "center", fontFamily: fonts.display, fontSize: 44, fontWeight: "700", color: c.onSurface, padding: 0 },
  tempoSub: { fontFamily: fonts.text, fontSize: 11, color: c.onSurfaceTertiary },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  preset: { height: 34, minWidth: 50, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  presetOn: { borderColor: c.brandPrimary },
  presetText: { fontFamily: fonts.text, fontSize: 13, color: c.onSurface },
  presetTextOn: { color: c.brandPrimary, fontWeight: "700" },
  segment: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary },
  segBtn: { flex: 1, height: 40, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segBtnOn: { backgroundColor: c.brandPrimary },
  segText: { fontFamily: fonts.display, fontSize: 13, color: c.onSurfaceTertiary },
  segTextOn: { color: c.onBrandPrimary, fontWeight: "700" },
  hint: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary, marginTop: spacing.sm },
  toggleRow: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  toggleText: { flex: 1 },
  toggleTitle: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700", color: c.onSurface },
  toggleSub: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary, marginTop: 2 },
}));
