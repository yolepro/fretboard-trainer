import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";
import { Microphone, Stop } from "phosphor-react-native";

import { usePitchDetector } from "@/src/audio/usePitchDetector";
import { MIN_RMS, type PitchFrame } from "@/src/music/yin";
import { freqToMidiFloat, octaveOf, pcOf } from "@/src/music/theory";
import { useSettings } from "@/src/settings";
import { tr } from "@/src/i18n";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

// Level shown on a log scale: 0.0005 (silence) … 0.3 (very loud).
const LMIN = Math.log10(0.0005);
const LMAX = Math.log10(0.3);
const levelPct = (v: number) => Math.max(0, Math.min(1, (Math.log10(Math.max(v, 1e-6)) - LMIN) / (LMAX - LMIN)));

// The thresholds the challenges use (FindChallenge): a right note from 0.70, a mistake from 0.85.
const CLARITY_OK = 0.7;
const CLARITY_SURE = 0.85;

/**
 * Mic test (Réglages): what the detector receives — the level, the note it hears, its clarity —
 * with the thresholds the games use, to see why a note is or is not heard.
 */
export function MicTester() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { settings, nameOf } = useSettings();
  const [on, setOn] = useState(false);
  const [denied, setDenied] = useState(false);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [frame, setFrame] = useState<PitchFrame>(null);
  const [lastNote, setLastNote] = useState<{ name: string; cents: number; clarity: number; freq: number } | null>(null);
  const peakAt = useRef(0);
  // Leaving Réglages turns the mic off (tab screens stay mounted).
  useFocusEffect(useCallback(() => () => setOn(false), []));

  const { status, error, mic } = usePitchDetector(on, (f, l) => {
    setLevel(l);
    const now = Date.now();
    setPeak((p) => {
      if (l >= p || now - peakAt.current > 1500) {
        peakAt.current = now;
        return l;
      }
      return p;
    });
    setFrame(f);
    if (f) {
      const mf = freqToMidiFloat(f.freq, settings.a4);
      const m = Math.round(mf);
      setLastNote({ name: `${nameOf(pcOf(m))}${octaveOf(m)}`, cents: Math.round((mf - m) * 100), clarity: f.clarity, freq: f.freq });
    }
  });

  const toggle = async () => {
    if (on) {
      setOn(false);
      return;
    }
    if (Platform.OS !== "web") {
      try {
        const cur = await getRecordingPermissionsAsync();
        const ok = cur.granted || (cur.canAskAgain && (await requestRecordingPermissionsAsync()).granted);
        if (!ok) {
          setDenied(true);
          return;
        }
      } catch {
        setDenied(true);
        return;
      }
    }
    setDenied(false);
    setLastNote(null);
    setOn(true);
  };

  const heard = frame !== null;
  const clarity = frame?.clarity ?? 0;
  const tone = !heard ? colors.onSurfaceTertiary : clarity >= CLARITY_SURE ? colors.success : clarity >= CLARITY_OK ? colors.warning : colors.error;

  return (
    <View style={styles.wrap} testID="mic-tester">
      {mic}
      <Pressable testID="mic-test-toggle" onPress={toggle} style={({ pressed }) => [styles.btn, on && styles.btnOn, pressed && { opacity: 0.85 }]}>
        {on ? <Stop size={18} color={colors.onBrandPrimary} weight="fill" /> : <Microphone size={18} color={colors.onSurface} />}
        <Text style={[styles.btnText, on && styles.btnTextOn]}>{on ? tr("Arrêter le test") : tr("Tester le micro")}</Text>
      </Pressable>
      {denied ? <Text style={styles.warn}>{tr("Micro refusé : autorise-le dans les réglages de l’iPhone.")}</Text> : null}
      {status === "error" ? <Text style={styles.warn}>{tr("Micro indisponible")} {error ? `(${error})` : ""}</Text> : null}

      {on ? (
        <>
          <View style={styles.noteRow}>
            <Text style={[styles.note, { color: tone }]} testID="mic-test-note">
              {lastNote ? lastNote.name : "—"}
            </Text>
            <View style={styles.noteInfo}>
              <Text style={styles.small}>{lastNote ? `${lastNote.freq.toFixed(1)} Hz · ${lastNote.cents > 0 ? "+" : ""}${lastNote.cents} cents` : tr("Joue une note…")}</Text>
              <Text style={[styles.small, { color: tone }]}>
                {!heard
                  ? level < MIN_RMS
                    ? tr("Trop faible : rapproche la guitare ou joue plus fort")
                    : tr("Son reçu, mais pas de note nette")
                  : clarity >= CLARITY_SURE
                    ? tr("Note nette : comptée partout")
                    : clarity >= CLARITY_OK
                      ? tr("Note un peu floue : acceptée si c’est la bonne")
                      : tr("Trop floue : ignorée")}
              </Text>
            </View>
          </View>

          <Text style={styles.label}>{tr("Niveau du signal")}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${levelPct(level) * 100}%`, backgroundColor: level < MIN_RMS ? colors.onSurfaceTertiary : colors.brandPrimary }]} />
            <View style={[styles.peak, { left: `${levelPct(peak) * 100}%` }]} />
            <View style={[styles.mark, { left: `${levelPct(MIN_RMS) * 100}%` }]} />
          </View>
          <Text style={styles.small}>{tr("Le trait blanc : en dessous, la détection ne se déclenche pas.")}</Text>

          <Text style={styles.label}>{tr("Netteté de la note")}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(0, clarity) * 100}%`, backgroundColor: tone }]} />
            <View style={[styles.mark, { left: `${CLARITY_OK * 100}%` }]} />
            <View style={[styles.mark, { left: `${CLARITY_SURE * 100}%` }]} />
          </View>
          <Text style={styles.small}>{tr("Traits : 70 % (bonne note acceptée) et 85 % (erreur comptée).")}</Text>
          {status === "starting" ? <Text style={styles.small}>{tr("Démarrage du micro…")}</Text> : null}
        </>
      ) : (
        <Text style={styles.small}>{tr("Affiche ce que le micro entend : le niveau, la note reconnue et sa netteté, avec les seuils utilisés par les jeux.")}</Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  btn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary },
  btnOn: { backgroundColor: c.brandPrimary },
  btnText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurface },
  btnTextOn: { color: c.onBrandPrimary, fontWeight: "700" },
  warn: { fontFamily: fonts.text, fontSize: 13, color: c.warning },
  noteRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  note: { minWidth: 72, fontFamily: fonts.display, fontSize: 36, fontWeight: "700" },
  noteInfo: { flex: 1, gap: 2 },
  label: { fontFamily: fonts.text, fontSize: 12, fontWeight: "600", color: c.onSurfaceSecondary, marginTop: spacing.xs },
  track: { height: 12, borderRadius: 6, backgroundColor: c.surfaceTertiary, overflow: "hidden", position: "relative" },
  fill: { height: 12, borderRadius: 6 },
  peak: { position: "absolute", top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: c.brandPrimary, opacity: 0.6 },
  mark: { position: "absolute", top: -2, bottom: -2, width: 2, marginLeft: -1, backgroundColor: c.onSurface },
  small: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary, lineHeight: 16 },
}));
