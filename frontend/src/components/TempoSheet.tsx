import React, { useEffect, useState } from "react";
import { Keyboard, Pressable, Switch, Text, TextInput, View } from "react-native";

import { Chip, ChipRow, SectionLabel } from "@/src/components/Chip";
import { Sheet, SheetBlock } from "@/src/components/Sheet";

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
  /** Count-in in progress: this beat number replaces the tempo in the button. */
  count?: number | null;
  testID?: string;
  /** "bar": wide button of the playback bar (♩ 72 + note values); default: round header button. */
  variant?: "round" | "bar";
  /** Sub-label of the bar button (note values). */
  subLabel?: string;
  /** Loop and metronome are in the playback bar: the sheet then only holds the tempo and the pace. */
  playbackInSheet?: boolean;
};

const PRESETS = [60, 80, 100, 120];

/** Round header button showing the tempo; opens the "Tempo et lecture" sheet (tempo, note pace, loop, metronome). */
export function TempoButton(props: Props) {
  const { bpm, half, count, testID = "tempo-button", variant = "round", subLabel } = props;
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const note = (
    <View style={styles.note}>
      <View style={[styles.noteHead, half && styles.noteHeadHalf]} />
      <View style={styles.noteStem} />
    </View>
  );
  return (
    <>
      {variant === "bar" ? (
        <Pressable testID={testID} onPress={() => setOpen(true)} style={({ pressed }) => [styles.barButton, pressed && styles.pressed]} accessibilityLabel={tr("Tempo")}>
          {count != null ? (
            <Text style={styles.countText} testID="tempo-count">{count}</Text>
          ) : (
            <>
              <View style={styles.barTop}>
                {note}
                <Text style={styles.barValue}>{bpm}</Text>
              </View>
              {subLabel ? (
                <Text style={styles.barSub} numberOfLines={1}>
                  {subLabel}
                </Text>
              ) : null}
            </>
          )}
        </Pressable>
      ) : (
        <Pressable testID={testID} onPress={() => setOpen(true)} style={({ pressed }) => [styles.button, pressed && styles.pressed]} accessibilityLabel={tr("Tempo")}>
          {count != null ? (
            <Text style={styles.countText} testID="tempo-count">{count}</Text>
          ) : (
            <>
              {note}
              <Text style={styles.buttonText}>{bpm}</Text>
            </>
          )}
        </Pressable>
      )}
      <TempoSheet {...props} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function TempoSheet({ visible, onClose, bpm, min, max, half, defaultBpm, onBpm, pace, loop, onLoop, metronome, onMetronome, playbackInSheet = true }: Props & { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
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
    <Sheet visible={visible} onClose={onClose} title={tr("Tempo et lecture")} testID="tempo-sheet">
      <SectionLabel>{half ? tr("Tempo (BPM, à la blanche)") : tr("Tempo (BPM, à la noire)")}</SectionLabel>
      <SheetBlock>
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
      </SheetBlock>
      <ChipRow testID="tempo-presets">
        {PRESETS.filter((p) => p >= min && p <= max).map((p) => (
          <Chip key={p} testID={`tempo-preset-${p}`} label={String(p)} selected={bpm === p} onPress={() => commit(p)} />
        ))}
        <Chip testID="tempo-preset-default" label={tr("Par défaut")} selected={false} onPress={() => commit(defaultBpm)} />
      </ChipRow>

      {pace ? (
        <>
          <SectionLabel>{tr("Débit des notes")}</SectionLabel>
          <SheetBlock>
            <View style={styles.segment}>
              <Pressable testID="pace-slow" onPress={() => pace.onChange(true)} style={[styles.segBtn, pace.slow && styles.segBtnOn]}>
                <Text style={[styles.segText, pace.slow && styles.segTextOn]} numberOfLines={1}>
                  {pace.slowLabel}
                </Text>
              </Pressable>
              <Pressable testID="pace-normal" onPress={() => pace.onChange(false)} style={[styles.segBtn, !pace.slow && styles.segBtnOn]}>
                <Text style={[styles.segText, !pace.slow && styles.segTextOn]} numberOfLines={1}>
                  {pace.normalLabel}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>{tr("Lent : les notes durent deux fois plus longtemps.")}</Text>
          </SheetBlock>
        </>
      ) : null}

      {playbackInSheet ? <SectionLabel>{tr("Lecture")}</SectionLabel> : null}
      <SheetBlock>
        {playbackInSheet ? toggle("loop-toggle", tr("Boucle"), tr("Rejoue l’exercice sans s’arrêter"), loop, onLoop) : null}
        {playbackInSheet ? toggle("metronome-toggle", tr("Métronome"), tr("Un clic sur chaque temps"), metronome, onMetronome) : null}
        <Text style={styles.hint}>{tr("Décompte automatique : 1 mesure (½ sous 70 BPM).")}</Text>
      </SheetBlock>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  button: { flexShrink: 0, width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.brandPrimary, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: fonts.display, fontSize: 13, fontWeight: "700", color: c.onSurface, marginTop: 1 },
  barButton: { flex: 1, minWidth: 0, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  barTop: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  barValue: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onSurface, lineHeight: 19 },
  barSub: { fontFamily: fonts.text, fontSize: 11, color: c.onSurfaceTertiary },
  countText: { fontFamily: fonts.display, fontSize: 22, fontWeight: "700", color: c.brandPrimary },
  note: { width: 10, height: 11, marginTop: -2 },
  noteHead: { position: "absolute", left: 0, bottom: 0, width: 7, height: 5, borderRadius: 3, backgroundColor: c.brandPrimary, transform: [{ rotate: "-20deg" }] },
  noteHeadHalf: { backgroundColor: "transparent", borderWidth: 1.3, borderColor: c.brandPrimary },
  noteStem: { position: "absolute", left: 6, bottom: 3, width: 1.3, height: 9, backgroundColor: c.brandPrimary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  tempoCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.surfaceTertiary, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  roundBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  roundText: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface, lineHeight: 28 },
  tempoCenter: { alignItems: "center" },
  tempoValue: { minWidth: 110, textAlign: "center", fontFamily: fonts.display, fontSize: 44, fontWeight: "700", color: c.onSurface, padding: 0 },
  tempoSub: { fontFamily: fonts.text, fontSize: 11, color: c.onSurfaceTertiary },
  segment: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary },
  segBtn: { flex: 1, height: 40, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segBtnOn: { backgroundColor: c.brandPrimary },
  segText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurfaceTertiary },
  segTextOn: { color: c.onBrandPrimary, fontWeight: "700" },
  hint: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary, marginTop: spacing.sm },
  toggleRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  toggleText: { flex: 1 },
  toggleTitle: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700", color: c.onSurface },
  toggleSub: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary, marginTop: 2 },
}));
