import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";
import { ArrowClockwise, Eye, Fire, Microphone, SkipForward, SpeakerHigh, Stop, Trophy } from "phosphor-react-native";

import { Chip, ChipRow } from "@/src/components/Chip";
import { Glass } from "@/src/components/Glass";
import { NoteHint } from "@/src/components/NoteHint";
import { playNote, restorePlaybackMode, stopAll } from "@/src/audio/sampler";
import { usePitchDetector } from "@/src/audio/usePitchDetector";
import type { PitchFrame } from "@/src/music/yin";
import { CHORDS, DEGREE_META, degreeKeyFromNum, freqToMidiFloat, octaveOf, pcOf, type DegreeKey } from "@/src/music/theory";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { storage } from "@/src/utils/storage";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type QuizMode = "visual" | "listen" | "degree";
type Question = {
  targetMidi: number;
  pitchClassOnly: boolean;
  prompt: string;
  big: string;
  degree?: DegreeKey;
  degreeLabel?: string;
};
type Feedback = { kind: "correct" | "wrong"; text: string } | null;
type Perm = "unknown" | "granted" | "ask" | "blocked";

const QUIZ_CHORDS = CHORDS.filter((c) => ["maj", "min", "dom7", "maj7", "m7", "m7b5", "dom9", "m9", "dom11", "dom13", "six", "sus4"].includes(c.id));
const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const BEST_KEY = "fretstudio_best";

export default function EarScreen() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const { settings, nameOf } = useSettings();

  const [mode, setMode] = useState<QuizMode>("visual");
  const [question, setQuestion] = useState<Question | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [listening, setListening] = useState(false);
  const [perm, setPerm] = useState<Perm>("unknown");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [detected, setDetected] = useState<{ midi: number; cents: number; freq: number } | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const revealedRef = useRef(false);
  const autoNext = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width: winW } = useWindowDimensions();

  const qRef = useRef<Question | null>(null);
  const answeredRef = useRef(false);
  const penalizedRef = useRef(false);
  const ignoreUntil = useRef(0);
  const stable = useRef<{ midi: number; count: number }>({ midi: -1, count: 0 });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const nameRef = useRef(nameOf);
  nameRef.current = nameOf;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    storage.getItem(BEST_KEY, 0).then((v) => setBest(typeof v === "number" ? v : 0));
    if (Platform.OS === "web") {
      setPerm("ask");
    } else {
      getRecordingPermissionsAsync().then((r) => setPerm(r.granted ? "granted" : r.canAskAgain ? "ask" : "blocked"));
    }
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const listeningRef = useRef(false);
  const suspendToken = useRef(0);
  const [suspended, setSuspended] = useState(false);

  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playTarget = useCallback((midi: number) => {
    const vol = settingsRef.current.volume;
    ignoreUntil.current = Date.now() + 2300;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (listeningRef.current && Platform.OS !== "web") {
      // iOS: the mic stream switches the audio session to record-only, which mutes playback.
      // Pause the mic, restore playback mode, play the reference note, then resume listening.
      const token = ++suspendToken.current;
      setSuspended(true);
      later(async () => {
        try {
          await restorePlaybackMode();
        } catch {
          // keep going, playback may still work
        }
        if (token === suspendToken.current) playNote(midi, vol);
      }, 150);
      stopTimer.current = setTimeout(() => {
        if (token !== suspendToken.current) return;
        stopAll();
        setSuspended(false);
      }, 2100);
    } else {
      playNote(midi, vol);
      stopTimer.current = setTimeout(() => stopAll(), 1800);
    }
  }, []);

  useEffect(() => () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
  }, []);

  const makeQuestion = useCallback(
    (m: QuizMode): Question => {
      const name = nameRef.current;
      if (m === "degree") {
        const root = rand(0, 11);
        const chord = QUIZ_CHORDS[rand(0, QUIZ_CHORDS.length - 1)];
        const pool = chord.intervals.filter((i) => i.num !== 1);
        const iv = pool[rand(0, pool.length - 1)];
        const key = degreeKeyFromNum(iv.num);
        const degName = ({ "6": "sixte", "4": "quarte", "2": "seconde" } as Record<string, string>)[iv.label] ?? DEGREE_META[key].name;
        return {
          targetMidi: 48 + pcOf(root + iv.semi),
          pitchClassOnly: true,
          prompt: `Joue la ${degName} (${iv.label}) de`,
          big: `${name(root)}${chord.symbol}`,
          degree: key,
          degreeLabel: iv.label,
        };
      }
      const midi = m === "listen" ? rand(40, 72) : rand(40, 76);
      const n = `${name(pcOf(midi))}${octaveOf(midi)}`;
      return {
        targetMidi: midi,
        pitchClassOnly: false,
        prompt: m === "listen" ? "Écoute et rejoue cette note (bonne octave)" : "Joue la note à la bonne octave",
        big: n,
      };
    },
    [],
  );

  const next = useCallback(
    (m: QuizMode = mode) => {
      if (autoNext.current) clearTimeout(autoNext.current);
      autoNext.current = null;
      revealedRef.current = false;
      const q = makeQuestion(m);
      qRef.current = q;
      answeredRef.current = false;
      penalizedRef.current = false;
      stable.current = { midi: -1, count: 0 };
      setQuestion(q);
      setRevealed(false);
      setFeedback(null);
      setWrongCount(0);
      if (m === "listen") playTarget(q.targetMidi);
    },
    [mode, makeQuestion, playTarget],
  );

  useEffect(() => {
    next(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, settings.notation, settings.accidental]);

  const onCorrect = () => {
    answeredRef.current = true;
    if (revealedRef.current) {
      setFeedback({ kind: "correct", text: "Bonne note ! (réponse révélée, pas de point)" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      autoNext.current = setTimeout(() => next(modeRef.current), 1400);
      return;
    }
    setScore((v) => v + 1);
    setStreak((v) => {
      const n = v + 1;
      setBest((b) => {
        if (n > b) {
          storage.setItem(BEST_KEY, n);
          return n;
        }
        return b;
      });
      return n;
    });
    setRevealed(true);
    setFeedback({ kind: "correct", text: "Bravo ! Bonne note" });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    autoNext.current = setTimeout(() => next(modeRef.current), 1400);
  };

  const onWrong = (midi: number) => {
    if (!penalizedRef.current) {
      penalizedRef.current = true;
      setStreak(0);
    }
    setWrongCount((v) => v + 1);
    const q = qRef.current;
    const played = `${nameRef.current(pcOf(midi))}${octaveOf(midi)}`;
    let text = `Tu joues ${played} — essaie encore`;
    if (q && !q.pitchClassOnly && pcOf(midi) === pcOf(q.targetMidi)) {
      const diff = octaveOf(q.targetMidi) - octaveOf(midi);
      text = `Bonne note, mauvaise octave (${played}) — vise ${Math.abs(diff)} octave${Math.abs(diff) > 1 ? "s" : ""} plus ${diff > 0 ? "haut" : "bas"}`;
    }
    setFeedback({ kind: "wrong", text });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };

  const onFrame = (f: PitchFrame) => {
    if (!f || f.clarity < 0.85) {
      stable.current = { midi: -1, count: 0 };
      setDetected(null);
      return;
    }
    const mf = freqToMidiFloat(f.freq, settingsRef.current.a4);
    const midi = Math.round(mf);
    const cents = Math.round((mf - midi) * 100);
    setDetected({ midi, cents, freq: f.freq });
    const q = qRef.current;
    if (!q || answeredRef.current || Date.now() < ignoreUntil.current) return;
    if (stable.current.midi === midi) stable.current.count += 1;
    else stable.current = { midi, count: 1 };
    const match = q.pitchClassOnly ? pcOf(midi) === pcOf(q.targetMidi) : midi === q.targetMidi;
    if (match && stable.current.count === 3) onCorrect();
    else if (!match && stable.current.count === 6) onWrong(midi);
  };

  listeningRef.current = listening;
  const { status, error } = usePitchDetector(listening && !suspended, onFrame);

  // Stop the mic when leaving the Ear tab
  useFocusEffect(
    useCallback(() => {
      return () => {
        setListening(false);
        setDetected(null);
      };
    }, []),
  );

  useEffect(() => {
    if (!error) return;
    setListening(false);
    if (error === "denied") setPerm("blocked");
  }, [error]);

  const requestMic = async () => {
    if (Platform.OS === "web") {
      setPerm("granted");
      setListening(true);
      return;
    }
    try {
      const r = await requestRecordingPermissionsAsync();
      if (r.granted) {
        setPerm("granted");
        setListening(true);
      } else setPerm(r.canAskAgain ? "ask" : "blocked");
    } catch {
      setPerm("blocked");
    }
  };

  const toggleMic = () => {
    if (listening) {
      setListening(false);
      setDetected(null);
      return;
    }
    if (perm === "granted") setListening(true);
    else requestMic();
  };

  const skip = () => {
    setStreak(0);
    next();
  };

  const reveal = () => {
    if (!question) return;
    setRevealed(true);
    revealedRef.current = true;
    penalizedRef.current = true;
    setStreak(0);
    playTarget(question.targetMidi);
  };

  // Pulse animation
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (status === "listening") pulse.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
    else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [status, pulse]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.18 }],
  }));

  const accent =
    feedback?.kind === "correct"
      ? question?.degree
        ? colors[DEGREE_META[question.degree].color]
        : colors.success
      : feedback?.kind === "wrong"
        ? colors.error
        : listening
          ? colors.brandPrimary
          : colors.borderStrong;

  const centsOff = detected ? Math.max(-50, Math.min(50, detected.cents)) : 0;
  const inTune = detected && Math.abs(detected.cents) <= 10;
  const answerName = question ? `${nameOf(pcOf(question.targetMidi))}${question.pitchClassOnly && mode === "degree" ? "" : octaveOf(question.targetMidi)}` : "";

  return (
    <View style={styles.screen} testID="ear-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Oreille</Text>
        <View style={styles.stats}>
          <View style={styles.stat} testID="score-counter">
            <Text style={styles.statValue}>{score}</Text>
            <Text style={styles.statLabel}>Score</Text>
          </View>
          <View style={styles.stat} testID="streak-counter">
            <View style={styles.statInline}>
              <Fire size={14} color={colors.brandPrimary} weight="fill" />
              <Text style={styles.statValue}>{streak}</Text>
            </View>
            <Text style={styles.statLabel}>Série</Text>
          </View>
          <View style={styles.stat} testID="best-counter">
            <View style={styles.statInline}>
              <Trophy size={14} color={colors.degree7th} weight="fill" />
              <Text style={styles.statValue}>{best}</Text>
            </View>
            <Text style={styles.statLabel}>Record</Text>
          </View>
        </View>
      </View>

      <ChipRow testID="quiz-mode-selector">
        <Chip testID="quiz-mode-visual" label="Trouve la note" selected={mode === "visual"} onPress={() => setMode("visual")} />
        <Chip testID="quiz-mode-listen" label="Écoute & rejoue" selected={mode === "listen"} onPress={() => setMode("listen")} />
        <Chip testID="quiz-mode-degree" label="Degrés d’accord" selected={mode === "degree"} onPress={() => setMode("degree")} />
      </ChipRow>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {question ? (
          <Glass style={styles.questionCard} testID="question-card">
            <Text style={styles.prompt} testID="question-prompt">{question.prompt}</Text>
            <View style={styles.bigRow}>
              <Text style={styles.big} testID="question-target">
                {mode === "listen" && !revealed ? "?" : question.big}
              </Text>
              {question.degree ? (
                <View style={[styles.degreeBadge, { backgroundColor: colors[DEGREE_META[question.degree].color] }]}>
                  <Text style={[styles.degreeBadgeText, { color: colors[DEGREE_META[question.degree].on] }]}>{question.degreeLabel}</Text>
                </View>
              ) : null}
            </View>
            {revealed ? (
              <Text style={styles.answer} testID="question-answer">Réponse : {answerName}</Text>
            ) : (
              <Text style={styles.hint}>{question.pitchClassOnly ? "N’importe quelle octave" : "Octave exacte requise"}</Text>
            )}
            <View style={styles.actions}>
              <Pressable testID="replay-button" onPress={() => playTarget(question.targetMidi)} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
                <SpeakerHigh size={18} color={colors.onSurface} />
                <Text style={styles.actionText}>{mode === "listen" ? "Réécouter" : "Écouter"}</Text>
              </Pressable>
              <Pressable testID="reveal-button" onPress={reveal} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
                <Eye size={18} color={colors.onSurface} />
                <Text style={styles.actionText}>Révéler</Text>
              </Pressable>
              <Pressable testID="skip-button" onPress={skip} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
                <SkipForward size={18} color={colors.onSurface} />
                <Text style={styles.actionText}>Passer</Text>
              </Pressable>
            </View>
          </Glass>
        ) : null}

        <Pressable testID="mic-toggle-button" onPress={toggleMic} style={({ pressed }) => [styles.dialWrap, pressed && styles.pressed]}>
          <Animated.View style={[styles.ring, { borderColor: accent }, ringStyle]} />
          <View style={[styles.dial, { borderColor: accent }]} testID="tuner-dial">
            {detected && !suspended ? (
              <>
                <Text style={[styles.dialNote, { color: feedback?.kind === "correct" ? accent : colors.onSurface }]} testID="detected-note">
                  {nameOf(pcOf(detected.midi))}
                  <Text style={styles.dialOct}>{octaveOf(detected.midi)}</Text>
                </Text>
                <Text style={styles.dialFreq} testID="detected-frequency">{detected.freq.toFixed(1)} Hz</Text>
              </>
            ) : (
              <>
                {listening ? (
                  <Microphone size={40} color={colors.brandPrimary} weight="fill" />
                ) : (
                  <Microphone size={40} color={colors.muted} />
                )}
                <Text style={styles.dialIdle} testID="dial-status">
                  {suspended
                    ? "Écoute la note…"
                    : status === "starting"
                      ? "Connexion au micro…"
                      : listening
                        ? "Joue une note…"
                        : perm === "granted"
                          ? "Touchez pour démarrer l’écoute"
                          : perm === "blocked"
                            ? "Micro bloqué, voir ci-dessous"
                            : "Touchez pour autoriser le micro"}
                </Text>
              </>
            )}
          </View>
        </Pressable>
        <View style={styles.dialHintRow}>
          {listening ? <Stop size={14} color={colors.muted} weight="fill" /> : null}
          <Text style={styles.dialHint} testID="dial-hint">
            {listening ? "Touchez le cercle pour arrêter l’écoute" : "Le cercle démarre et arrête l’écoute"}
          </Text>
        </View>

        <View style={styles.meter} testID="cents-meter">
          <View style={styles.meterTrack} />
          <View style={styles.meterCenter} />
          <View
            style={[
              styles.meterNeedle,
              { left: `${50 + centsOff}%`, backgroundColor: detected ? (inTune ? colors.success : colors.warning) : colors.muted },
            ]}
          />
          <View style={styles.meterLabels}>
            <Text style={styles.meterLabel}>-50</Text>
            <Text style={styles.meterLabel} testID="cents-value">{detected ? `${detected.cents > 0 ? "+" : ""}${detected.cents} ct` : "0"}</Text>
            <Text style={styles.meterLabel}>+50</Text>
          </View>
        </View>

        {feedback ? (
          <View style={[styles.feedback, { borderColor: accent }]} testID="quiz-feedback">
            <Text style={[styles.feedbackText, { color: accent }]}>{feedback.text}</Text>
          </View>
        ) : null}

        {question && (wrongCount >= 2 || revealed) ? (
          <NoteHint
            targetMidi={question.targetMidi}
            pitchClassOnly={question.pitchClassOnly}
            degree={question.degree}
            degreeLabel={question.degreeLabel}
            nameOf={nameOf}
            width={winW - spacing.lg * 2 - 8}
          />
        ) : wrongCount === 1 ? (
          <Text style={styles.hintSoon} testID="hint-soon">Encore une erreur et je te montre où jouer la note</Text>
        ) : null}

        {perm === "blocked" ? (
          <View style={styles.permCard} testID="mic-blocked-card">
            <Text style={styles.permTitle}>Micro bloqué</Text>
            <Text style={styles.permText}>Autorise le micro dans les réglages pour que l’app entende ta guitare.</Text>
            {Platform.OS !== "web" ? (
              <Pressable testID="open-settings-button" onPress={() => Linking.openSettings()} style={styles.permBtn}>
                <Text style={styles.permBtnText}>Ouvrir les réglages</Text>
              </Pressable>
            ) : (
              <Pressable testID="retry-mic-button" onPress={() => { setPerm("ask"); requestMic(); }} style={styles.permBtn}>
                <Text style={styles.permBtnText}>Réessayer</Text>
              </Pressable>
            )}
          </View>
        ) : perm === "ask" && !listening ? (
          <View style={styles.permCard} testID="mic-permission-card">
            <Text style={styles.permTitle}>Écoute en temps réel</Text>
            <Text style={styles.permText}>Le micro analyse ta guitare directement sur l’appareil pour valider tes notes. Rien n’est enregistré.</Text>
          </View>
        ) : null}

        {error && error !== "denied" ? (
          <Text style={styles.errorText} testID="mic-error">Micro indisponible : {error}</Text>
        ) : null}

        <Pressable testID="new-question-button" onPress={() => next()} style={styles.newQ}>
          <ArrowClockwise size={16} color={colors.muted} />
          <Text style={styles.newQText}>Nouvelle question</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const DIAL = 200;

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  title: { fontFamily: fonts.display, fontSize: 28, fontWeight: "700", color: c.onSurface },
  stats: { flexDirection: "row", gap: spacing.lg },
  stat: { alignItems: "center" },
  statInline: { flexDirection: "row", alignItems: "center", gap: 3 },
  statValue: { fontFamily: fonts.display, fontSize: 20, fontWeight: "700", color: c.onSurface },
  statLabel: { fontFamily: fonts.text, fontSize: 11, color: c.muted },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, alignItems: "stretch" },
  questionCard: { padding: spacing.lg },
  prompt: { fontFamily: fonts.text, fontSize: 15, color: c.onSurfaceTertiary },
  bigRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  big: { fontFamily: fonts.display, fontSize: 44, fontWeight: "700", color: c.onSurface },
  degreeBadge: { paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  degreeBadgeText: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700" },
  hint: { fontFamily: fonts.text, fontSize: 12, color: c.muted, marginTop: spacing.xs },
  answer: { fontFamily: fonts.display, fontSize: 14, color: c.brandPrimary, marginTop: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: c.surfaceTertiary,
  },
  actionText: { fontFamily: fonts.display, fontSize: 13, color: c.onSurface },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  dialWrap: { width: DIAL + 40, height: DIAL + 40, alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  ring: { position: "absolute", width: DIAL, height: DIAL, borderRadius: DIAL / 2, borderWidth: 3 },
  dial: {
    width: DIAL,
    height: DIAL,
    borderRadius: DIAL / 2,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceSecondary,
    padding: spacing.lg,
  },
  dialNote: { fontFamily: fonts.display, fontSize: 60, fontWeight: "700" },
  dialOct: { fontSize: 22, color: c.muted },
  dialFreq: { fontFamily: fonts.display, fontSize: 14, color: c.onSurfaceTertiary },
  dialIdle: { fontFamily: fonts.text, fontSize: 13, color: c.muted, textAlign: "center", marginTop: spacing.sm },
  dialHintRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: spacing.xs },
  dialHint: { fontFamily: fonts.text, fontSize: 12, color: c.muted },
  meter: { height: 44, marginTop: spacing.sm, marginHorizontal: spacing.lg },
  meterTrack: { position: "absolute", top: 10, left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: c.surfaceTertiary },
  meterCenter: { position: "absolute", top: 4, left: "50%", width: 2, marginLeft: -1, height: 16, backgroundColor: c.onSurfaceTertiary },
  meterNeedle: { position: "absolute", top: 2, width: 6, marginLeft: -3, height: 20, borderRadius: 3 },
  meterLabels: { position: "absolute", top: 26, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between" },
  meterLabel: { fontFamily: fonts.display, fontSize: 11, color: c.muted },
  feedback: { borderWidth: 1.5, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: c.surfaceSecondary },
  feedbackText: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", textAlign: "center" },
  permCard: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.brandTertiary },
  permTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onBrandTertiary },
  permText: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, marginTop: 4 },
  permBtn: { marginTop: spacing.sm, height: 44, borderRadius: radius.pill, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  permBtnText: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700", color: c.onBrandPrimary },
  errorText: { fontFamily: fonts.text, fontSize: 12, color: c.error, marginTop: spacing.sm, textAlign: "center" },
  hintSoon: { fontFamily: fonts.text, fontSize: 12, color: c.muted, textAlign: "center", marginTop: spacing.sm },
  newQ: { flexDirection: "row", alignSelf: "center", alignItems: "center", gap: 6, height: 44, marginTop: spacing.sm },
  newQText: { fontFamily: fonts.text, fontSize: 13, color: c.muted },
}));
