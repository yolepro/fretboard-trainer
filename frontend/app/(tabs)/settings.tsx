import React from "react";
import { LANDSCAPE_NAV_W } from "@/src/components/AppTabBar";
import { Pressable, ScrollView, Switch, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Eye,
  Hash,
  Lock,
  Minus,
  MusicNotes,
  Palette,
  Plus,
  SpeakerHigh,
  Stack,
  Target,
  TextAa,
  Trash,
  Waveform,
} from "phosphor-react-native";

import { MicTester } from "@/src/components/MicTester";
import { Chip } from "@/src/components/Chip";
import { FretboardStylePicker } from "@/src/components/FretboardStylePicker";
import { playNote } from "@/src/audio/sampler";
import { usesNativeTabs } from "@/src/navigation";
import { StudioBackground } from "@/src/components/StudioBackground";
import { useSettings } from "@/src/settings";
import { clearHistory } from "@/src/ear/stats";
import { storage } from "@/src/utils/storage";
import { APP_VERSION } from "@/src/version";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { tr } from "@/src/i18n";

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
  const { width, height } = useWindowDimensions();
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
      <StudioBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }, width > height && { paddingRight: LANDSCAPE_NAV_W + spacing.md }]}>
        <Text style={styles.title}>{tr("Réglages")}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }} showsVerticalScrollIndicator={false}>
        <Group title={tr("Langue")}>
          <Row testID="setting-language" icon={Stack} title={tr("Langue de l’application")} />
          <View style={styles.inlineChips}>
            <Chip testID="language-fr" label="Français" selected={settings.language === "fr"} onPress={() => update({ language: "fr" })} />
            <Chip testID="language-en" label="English" selected={settings.language === "en"} onPress={() => update({ language: "en" })} />
          </View>
        </Group>

        <Group title={tr("Audio")}>
          <Row
            testID="setting-sound-on-tap"
            icon={SpeakerHigh}
            title={tr("Son au toucher")}
            subtitle={tr("Joue un sample de guitare acoustique")}
            right={sw(settings.soundOnTap, (v) => update({ soundOnTap: v }), "switch-sound-on-tap")}
          />
          <View style={styles.sep} />
          <Row testID="setting-volume" icon={Waveform} title={tr("Volume")} subtitle={`${Math.round(settings.volume * 100)} %`} />
          <View style={styles.inlineChips}>
            {[0.25, 0.5, 0.8, 1].map((v) => (
              <Chip key={v} testID={`volume-${Math.round(v * 100)}`} label={`${Math.round(v * 100)}%`} selected={settings.volume === v} onPress={() => update({ volume: v })} />
            ))}
          </View>
          <View style={styles.sep} />
          <Row
            testID="setting-test-sound"
            icon={MusicNotes}
            title={tr("Tester le son")}
            subtitle={tr("La 3 (A3, 220 Hz)")}
            right={
              <Pressable testID="test-sound-button" onPress={() => playNote(57, settings.volume)} style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}>
                <Text style={styles.smallBtnText}>{tr("Jouer")}</Text>
              </Pressable>
            }
          />
        </Group>

        <Group title={tr("Notation")}>
          <Row testID="setting-notation" icon={TextAa} title={tr("Système")} subtitle={tr("Anglo-saxon ou latin")} />
          <View style={styles.inlineChips}>
            <Chip testID="notation-english" label="C D E" selected={settings.notation === "english"} onPress={() => update({ notation: "english" })} />
            <Chip testID="notation-latin" label="Do Ré Mi" selected={settings.notation === "latin"} onPress={() => update({ notation: "latin" })} />
          </View>
          <View style={styles.sep} />
          <Row testID="setting-accidental" icon={Hash} title={tr("Altérations")} />
          <View style={styles.inlineChips}>
            <Chip testID="accidental-sharp" label={tr("Dièses #")} selected={settings.accidental === "sharp"} onPress={() => update({ accidental: "sharp" })} />
            <Chip testID="accidental-flat" label={tr("Bémols b")} selected={settings.accidental === "flat"} onPress={() => update({ accidental: "flat" })} />
          </View>
        </Group>

        <Group title={tr("Manche")}>
          <Row testID="setting-fretboard-style" icon={Palette} title={tr("Style du manche")} subtitle={tr("Bois, frettes, cordes et repères")} />
          <FretboardStylePicker value={settings.fretboardStyle} onChange={(id) => update({ fretboardStyle: id })} />
          <View style={styles.sep} />
          <Row testID="setting-label-mode" icon={Stack} title={tr("Étiquettes des notes")} />
          <View style={styles.inlineChips}>
            <Chip testID="settings-label-note" label={tr("Noms")} selected={settings.labelMode === "note"} onPress={() => update({ labelMode: "note" })} />
            <Chip testID="settings-label-degree" label={tr("Degrés")} selected={settings.labelMode === "degree"} onPress={() => update({ labelMode: "degree" })} />
          </View>
          <View style={styles.sep} />
          <Row
            testID="setting-show-neutral"
            icon={Eye}
            title={tr("Notes neutres")}
            subtitle={tr("Affiche les notes hors gamme en gris")}
            right={sw(settings.showNeutral, (v) => update({ showNeutral: v }), "switch-show-neutral")}
          />
          <View style={styles.sep} />
          <Row testID="setting-tuning" icon={Lock} title={tr("Accordage")} subtitle={tr("Standard · E A D G B E")} />
          <View style={styles.sep} />
          <Row
            testID="setting-frets"
            icon={Target}
            title={tr("Nombre de cases du manche")}
            subtitle={tr("De 20 à 24 : le manche, les positions et les exercices s’adaptent")}
            right={
              <View style={styles.stepper}>
                <Pressable testID="frets-decrease" onPress={() => update({ fretCount: Math.max(20, settings.fretCount - 1) })} style={styles.stepBtn}>
                  <Minus size={16} color={colors.onSurface} />
                </Pressable>
                <Text style={styles.stepValue} testID="frets-value">{settings.fretCount}</Text>
                <Pressable testID="frets-increase" onPress={() => update({ fretCount: Math.min(24, settings.fretCount + 1) })} style={styles.stepBtn}>
                  <Plus size={16} color={colors.onSurface} />
                </Pressable>
              </View>
            }
          />
        </Group>

        <Group title={tr("Entraînement")}>
          <Row
            testID="setting-octave-info"
            icon={Target}
            title={tr("Octave exacte")}
            subtitle={tr("Les modes Note et Écoute exigent la bonne octave ; aide affichée après 2 erreurs")}
          />
          <View style={styles.sep} />
          <Row testID="setting-mic-test" icon={Waveform} title={tr("Test du micro")} subtitle={tr("Voir le signal et la note reconnue")} />
          <MicTester />
          <View style={styles.sep} />
          <Row testID="setting-challenge-input" icon={Target} title={tr("Challenges : répondre")} subtitle={tr("En jouant la note, en touchant le manche, ou les deux")} />
          <View style={styles.inlineChips}>
            <Chip testID="challenge-input-both" label={tr("Les deux")} selected={settings.challengeInput === "both"} onPress={() => update({ challengeInput: "both" })} />
            <Chip testID="challenge-input-mic" label={tr("Guitare (micro)")} selected={settings.challengeInput === "mic"} onPress={() => update({ challengeInput: "mic" })} />
            <Chip testID="challenge-input-touch" label={tr("Toucher l’écran")} selected={settings.challengeInput === "touch"} onPress={() => update({ challengeInput: "touch" })} />
          </View>
          <View style={styles.sep} />
          <Row
            testID="setting-a4"
            icon={Waveform}
            title={tr("Diapason (La 4)")}
            subtitle={tr("Calibration de la détection")}
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
            title={tr("Réinitialiser les résultats")}
            subtitle={resetDone ? tr("Résultats effacés") : tr("Records et historique des challenges Oreille")}
            right={
              <Pressable
                testID="reset-best-button"
                onPress={async () => {
                  await Promise.all([
                    ...["board", "listen", "degree", "interval"].flatMap((s) =>
                      [5, 10, 20].map((n) => storage.removeItem(`fretstudio_best_${s}_${n}`)),
                    ),
                    clearHistory(),
                  ]);
                  setResetDone(true);
                }}
                style={({ pressed }) => [styles.smallBtn, styles.dangerBtn, pressed && styles.pressed]}
              >
                <Text style={[styles.smallBtnText, styles.dangerText]}>{tr("Effacer")}</Text>
              </Pressable>
            }
          />
        </Group>

        <Text style={styles.footer} testID="settings-version">FretStudio · v{APP_VERSION} · {tr("Détection 100 % locale")}</Text>
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
  smallBtn: { height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  smallBtnText: { fontFamily: fonts.display, fontSize: 13, fontWeight: "700", color: c.onBrandPrimary },
  dangerBtn: { backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.error },
  dangerText: { color: c.error },
  pressed: { opacity: 0.8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  stepBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  stepValue: { fontFamily: fonts.display, fontSize: 14, color: c.onSurface, minWidth: 58, textAlign: "center" },
  footer: { fontFamily: fonts.text, fontSize: 12, color: c.muted, textAlign: "center", marginTop: spacing.xl },
}));
