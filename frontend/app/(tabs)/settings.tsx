import React from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Eye,
  Hash,
  Lock,
  Minus,
  MusicNotes,
  Plus,
  SpeakerHigh,
  Stack,
  Target,
  TextAa,
  Timer,
  Trash,
  Waveform,
} from "phosphor-react-native";

import { Chip } from "@/src/components/Chip";
import { playNote } from "@/src/audio/sampler";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { storage } from "@/src/utils/storage";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type IconType = React.ComponentType<{ size?: number; color?: string; weight?: any }>;

function Row({
  icon: Icon,
  title,
  subtitle,
  right,
  testID,
}: {
  icon: IconType;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.iconBox}>
        <Icon size={20} color={colors.brandPrimary} weight="duotone" />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const { settings, update } = useSettings();
  const [resetDone, setResetDone] = React.useState(false);

  const sw = (value: boolean, onChange: (v: boolean) => void, testID: string) => (
    <Switch
      testID={testID}
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.surfaceTertiary, true: colors.brandPrimary }}
      thumbColor={colors.onSurface}
    />
  );

  return (
    <View style={styles.screen} testID="settings-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Réglages</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }} showsVerticalScrollIndicator={false}>
        <Group title="Audio">
          <Row
            testID="setting-sound-on-tap"
            icon={SpeakerHigh}
            title="Son au toucher"
            subtitle="Joue un sample de guitare acoustique"
            right={sw(settings.soundOnTap, (v) => update({ soundOnTap: v }), "switch-sound-on-tap")}
          />
          <View style={styles.sep} />
          <Row testID="setting-volume" icon={Waveform} title="Volume" subtitle={`${Math.round(settings.volume * 100)} %`} />
          <View style={styles.inlineChips}>
            {[0.25, 0.5, 0.8, 1].map((v) => (
              <Chip key={v} testID={`volume-${Math.round(v * 100)}`} label={`${Math.round(v * 100)}%`} selected={settings.volume === v} onPress={() => update({ volume: v })} />
            ))}
          </View>
          <View style={styles.sep} />
          <Row testID="setting-note-length" icon={Timer} title="Durée des notes" subtitle="Coupe la résonance après ce délai" />
          <View style={styles.inlineChips}>
            {[
              { v: 400, l: "Très courte" },
              { v: 800, l: "Courte" },
              { v: 1500, l: "Moyenne" },
              { v: 3000, l: "Longue" },
            ].map(({ v, l }) => (
              <Chip key={v} testID={`note-length-${v}`} label={l} selected={settings.noteLength === v} onPress={() => update({ noteLength: v })} />
            ))}
          </View>
          <View style={styles.sep} />
          <Row
            testID="setting-test-sound"
            icon={MusicNotes}
            title="Tester le son"
            subtitle="La 3 (A3, 220 Hz)"
            right={
              <Pressable testID="test-sound-button" onPress={() => playNote(57, settings.volume, settings.noteLength)} style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}>
                <Text style={styles.smallBtnText}>Jouer</Text>
              </Pressable>
            }
          />
        </Group>

        <Group title="Notation">
          <Row testID="setting-notation" icon={TextAa} title="Système" subtitle="Anglo-saxon ou latin" />
          <View style={styles.inlineChips}>
            <Chip testID="notation-english" label="C D E" selected={settings.notation === "english"} onPress={() => update({ notation: "english" })} />
            <Chip testID="notation-latin" label="Do Ré Mi" selected={settings.notation === "latin"} onPress={() => update({ notation: "latin" })} />
          </View>
          <View style={styles.sep} />
          <Row testID="setting-accidental" icon={Hash} title="Altérations" />
          <View style={styles.inlineChips}>
            <Chip testID="accidental-sharp" label="Dièses #" selected={settings.accidental === "sharp"} onPress={() => update({ accidental: "sharp" })} />
            <Chip testID="accidental-flat" label="Bémols b" selected={settings.accidental === "flat"} onPress={() => update({ accidental: "flat" })} />
          </View>
        </Group>

        <Group title="Manche">
          <Row testID="setting-label-mode" icon={Stack} title="Étiquettes des notes" />
          <View style={styles.inlineChips}>
            <Chip testID="settings-label-note" label="Noms" selected={settings.labelMode === "note"} onPress={() => update({ labelMode: "note" })} />
            <Chip testID="settings-label-degree" label="Degrés" selected={settings.labelMode === "degree"} onPress={() => update({ labelMode: "degree" })} />
          </View>
          <View style={styles.sep} />
          <Row
            testID="setting-show-neutral"
            icon={Eye}
            title="Notes neutres"
            subtitle="Affiche les notes hors gamme en gris"
            right={sw(settings.showNeutral, (v) => update({ showNeutral: v }), "switch-show-neutral")}
          />
          <View style={styles.sep} />
          <Row testID="setting-tuning" icon={Lock} title="Accordage" subtitle="Standard · E A D G B E" />
        </Group>

        <Group title="Entraînement">
          <Row
            testID="setting-strict-octave"
            icon={Target}
            title="Octave stricte"
            subtitle="La note jouée doit être à la bonne octave"
            right={sw(settings.strictOctave, (v) => update({ strictOctave: v }), "switch-strict-octave")}
          />
          <View style={styles.sep} />
          <Row
            testID="setting-a4"
            icon={Waveform}
            title="Diapason (La 4)"
            subtitle="Calibration de la détection"
            right={
              <View style={styles.stepper}>
                <Pressable testID="a4-decrease" onPress={() => update({ a4: Math.max(430, settings.a4 - 1) })} style={styles.stepBtn}>
                  <Minus size={16} color={colors.onSurface} />
                </Pressable>
                <Text style={styles.stepValue} testID="a4-value">{settings.a4} Hz</Text>
                <Pressable testID="a4-increase" onPress={() => update({ a4: Math.min(450, settings.a4 + 1) })} style={styles.stepBtn}>
                  <Plus size={16} color={colors.onSurface} />
                </Pressable>
              </View>
            }
          />
          <View style={styles.sep} />
          <Row
            testID="setting-reset-best"
            icon={Trash}
            title="Réinitialiser le record"
            subtitle={resetDone ? "Record remis à zéro" : "Meilleure série du quiz"}
            right={
              <Pressable
                testID="reset-best-button"
                onPress={async () => {
                  await storage.setItem("fretstudio_best", 0);
                  setResetDone(true);
                }}
                style={({ pressed }) => [styles.smallBtn, styles.dangerBtn, pressed && styles.pressed]}
              >
                <Text style={[styles.smallBtnText, styles.dangerText]}>Effacer</Text>
              </Pressable>
            }
          />
        </Group>

        <Text style={styles.footer}>FretStudio · v1.0 · Détection 100 % locale</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 28, fontWeight: "700", color: c.onSurface },
  group: { marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  groupTitle: {
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: c.muted,
    marginBottom: spacing.sm,
  },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, paddingVertical: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.md },
  iconBox: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fonts.text, fontSize: 15, fontWeight: "600", color: c.onSurfaceSecondary },
  rowSub: { fontFamily: fonts.text, fontSize: 12, color: c.muted, marginTop: 2 },
  sep: { height: 1, backgroundColor: c.border, marginLeft: 60 },
  inlineChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingLeft: 60, paddingRight: spacing.md, paddingBottom: spacing.md },
  smallBtn: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  smallBtnText: { fontFamily: fonts.display, fontSize: 13, fontWeight: "700", color: c.onBrandPrimary },
  dangerBtn: { backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.error },
  dangerText: { color: c.error },
  pressed: { opacity: 0.8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  stepBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  stepValue: { fontFamily: fonts.display, fontSize: 14, color: c.onSurface, minWidth: 58, textAlign: "center" },
  footer: { fontFamily: fonts.text, fontSize: 12, color: c.muted, textAlign: "center", marginTop: spacing.xl },
}));
