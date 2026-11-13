import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";

import { playNote, restorePlaybackMode, stopAll } from "@/src/audio/sampler";
import { usePitchDetector } from "@/src/audio/usePitchDetector";
import { ChallengeView, type Feedback } from "@/src/ear/ChallengeView";
import { ResultView } from "@/src/ear/ResultView";
import { SetupPanel } from "@/src/ear/SetupPanel";
import {
  DEFAULT_OPTIONS,
  SECTIONS,
  bestKey,
  lowestPosition,
  makeQuestion,
  positionText,
  type Best,
  type Options,
  type Question,
  type Section,
} from "@/src/ear/questions";
import type { PitchFrame } from "@/src/music/yin";
import { freqToMidiFloat, octaveOf, pcOf } from "@/src/music/theory";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { storage } from "@/src/utils/storage";
import { fonts, makeStyles, spacing } from "@/src/theme";

type Phase = "setup" | "running" | "done";
type Perm = "unknown" | "granted" | "ask" | "blocked";
type Timer = ReturnType<typeof setTimeout>;

export default function EarScreen() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { settings, nameOf } = useSettings();

  const [section, setSection] = useState<Section>("board");
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTIONS);
  const [phase, setPhase] = useState<Phase>("setup");
  const [question, setQuestion] = useState<Question | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [revealed, setRevealed] = useState(false);
  const [detected, setDetected] = useState<{ midi: number; cents: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const [best, setBest] = useState<Best | null>(null);
  const [isRecord, setIsRecord] = useState(false);
  const [listening, setListening] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [perm, setPerm] = useState<Perm>("unknown");

  const qRef = useRef<Question | null>(null);
  const answeredRef = useRef(false);
  const attemptsRef = useRef(0);
  const stable = useRef({ midi: -1, count: 0 });
  const ignoreUntil = useRef(0);
  const resultsRef = useRef<boolean[]>([]);
  const startRef = useRef(0);
  const timers = useRef<Timer[]>([]);
  const suspendToken = useRef(0);
  const phaseRef = useRef<Phase>("setup");
  phaseRef.current = phase;
  const listeningRef = useRef(false);
  listeningRef.current = listening;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const nameRef = useRef(nameOf);
  nameRef.current = nameOf;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    if (Platform.OS === "web") setPerm("ask");
    else getRecordingPermissionsAsync().then((r) => setPerm(r.granted ? "granted" : r.canAskAgain ? "ask" : "blocked"));
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const bestRef = useRef<Best | null>(null);
  bestRef.current = best;

  const loadBest = useCallback(() => {
    const key = bestKey(section, opts.count);
    storage.getItem(key, null).then((v) => {
      if (key !== bestKey(sectionRef.current, optsRef.current.count)) return;
      try {
        setBest(typeof v === "string" ? (JSON.parse(v) as Best) : null);
      } catch {
        setBest(null);
      }
    });
  }, [section, opts.count]);

  useEffect(() => {
    loadBest();
  }, [loadBest]);

  // Plays a reference note. On native the mic is paused during playback (iOS record session mutes output).
  const playRef = useCallback((midi: number) => {
    const vol = settingsRef.current.volume;
    ignoreUntil.current = Date.now() + 2300;
    if (listeningRef.current && Platform.OS !== "web") {
      const token = ++suspendToken.current;
      setSuspended(true);
      timers.current.push(
        setTimeout(async () => {
          try {
            await restorePlaybackMode();
          } catch {
            // playback may still work
          }
          if (token === suspendToken.current) playNote(midi, vol);
        }, 150),
      );
      timers.current.push(
        setTimeout(() => {
          if (token !== suspendToken.current) return;
          stopAll();
          setSuspended(false);
        }, 2100),
      );
    } else {
      playNote(midi, vol);
      timers.current.push(setTimeout(() => stopAll(), 1800));
    }
  }, []);

  const newQuestion = () => {
    const q = makeQuestion(sectionRef.current, optsRef.current, nameRef.current);
    qRef.current = q;
    answeredRef.current = false;
    attemptsRef.current = 0;
    stable.current = { midi: -1, count: 0 };
    setQuestion(q);
    setFeedback(null);
    setRevealed(false);
    if (q.autoPlay) playRef(q.playMidi);
  };

  const finish = () => {
    const t = Date.now() - startRef.current;
    const score = resultsRef.current.filter(Boolean).length;
    setFinalTime(t);
    setPhase("done");
    setListening(false);
    setSuspended(false);
    const prev = bestRef.current;
    const better = score > 0 && (!prev || score > prev.score || (score === prev.score && t < prev.timeMs));
    setIsRecord(better);
    if (better) {
      const next = { score, timeMs: t };
      setBest(next);
      storage.setItem(bestKey(sectionRef.current, optsRef.current.count), JSON.stringify(next));
    }
  };

  const advance = () => {
    if (phaseRef.current !== "running") return;
    if (resultsRef.current.length >= optsRef.current.count) finish();
    else newQuestion();
  };

  const record = (ok: boolean) => {
    resultsRef.current = [...resultsRef.current, ok];
    setResults(resultsRef.current);
  };

  const onCorrect = () => {
    answeredRef.current = true;
    record(true);
    setRevealed(true);
    setFeedback({ kind: "correct", text: "Bravo !" });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    later(advance, 550);
  };

  const onWrong = (midi: number) => {
    const q = qRef.current;
    if (!q) return;
    attemptsRef.current += 1;
    const name = nameRef.current;
    const played = `${name(pcOf(midi))}${octaveOf(midi)}`;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (attemptsRef.current >= 2) {
      answeredRef.current = true;
      record(false);
      setRevealed(true);
      const pos = q.string !== undefined && q.fret !== undefined ? { string: q.string, fret: q.fret } : lowestPosition(q.targetMidi, q.pitchClassOnly);
      const answer = `${name(pcOf(q.targetMidi))}${q.pitchClassOnly ? "" : octaveOf(q.targetMidi)}`;
      setFeedback({ kind: "miss", text: `Raté — c’était ${answer}${pos ? ` · ${positionText(pos)}` : ""}` });
      later(advance, 1800);
      return;
    }
    let text = `Tu joues ${played} — encore 1 chance`;
    if (!q.pitchClassOnly && pcOf(midi) === pcOf(q.targetMidi)) {
      const diff = octaveOf(q.targetMidi) - octaveOf(midi);
      text = `Bonne note, mauvaise octave — vise ${Math.abs(diff)} octave${Math.abs(diff) > 1 ? "s" : ""} plus ${diff > 0 ? "haut" : "bas"} (encore 1 chance)`;
    }
    setFeedback({ kind: "wrong", text });
  };

  const onFrame = (f: PitchFrame) => {
    if (!f || f.clarity < 0.85) {
      stable.current = { midi: -1, count: 0 };
      setDetected(null);
      return;
    }
    const mf = freqToMidiFloat(f.freq, settingsRef.current.a4);
    const midi = Math.round(mf);
    setDetected({ midi, cents: Math.round((mf - midi) * 100) });
    const q = qRef.current;
    if (!q || answeredRef.current || phaseRef.current !== "running" || Date.now() < ignoreUntil.current) return;
    if (stable.current.midi === midi) stable.current.count += 1;
    else stable.current = { midi, count: 1 };
    const match = q.pitchClassOnly ? pcOf(midi) === pcOf(q.targetMidi) : midi === q.targetMidi;
    if (match && stable.current.count === 3) onCorrect();
    else if (!match && stable.current.count === 6) onWrong(midi);
  };

  const { status, error } = usePitchDetector(listening && !suspended, onFrame);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    suspendToken.current++;
    setListening(false);
    setSuspended(false);
    setDetected(null);
    setPhase("setup");
    stopAll();
  }, []);

  useEffect(() => {
    if (!error) return;
    if (error === "denied") setPerm("blocked");
    stop();
  }, [error, stop]);

  useFocusEffect(
    useCallback(() => {
      loadBest();
      return () => stop();
    }, [stop, loadBest]),
  );

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [phase]);

  const ensureMic = async () => {
    if (Platform.OS === "web") return true;
    try {
      const cur = await getRecordingPermissionsAsync();
      if (cur.granted) return true;
      if (!cur.canAskAgain) {
        setPerm("blocked");
        return false;
      }
      const r = await requestRecordingPermissionsAsync();
      setPerm(r.granted ? "granted" : r.canAskAgain ? "ask" : "blocked");
      return r.granted;
    } catch {
      setPerm("blocked");
      return false;
    }
  };

  const start = async () => {
    if (!(await ensureMic())) return;
    setPerm("granted");
    clearTimers();
    resultsRef.current = [];
    setResults([]);
    setIsRecord(false);
    setElapsed(0);
    startRef.current = Date.now();
    phaseRef.current = "running";
    setPhase("running");
    setListening(true);
    newQuestion();
  };

  const skip = () => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    record(false);
    advance();
  };

  const sectionLabel = SECTIONS.find((s) => s.id === section)!.label;
  const micText = suspended
    ? "Écoute…"
    : status === "starting"
      ? "Connexion au micro…"
      : status === "listening"
        ? "Joue la note…"
        : "Micro en pause";

  return (
    <View style={styles.screen} testID="ear-screen">
      {phase === "running" && question ? (
        <View style={[styles.flex, { paddingTop: insets.top, paddingBottom: bottomChrome }]}>
          <ChallengeView
            sectionLabel={sectionLabel}
            question={question}
            index={revealed ? Math.max(0, results.length - 1) : results.length}
            count={opts.count}
            results={results}
            elapsedMs={elapsed}
            feedback={feedback}
            revealed={revealed}
            detected={detected}
            micText={micText}
            listening={status === "listening"}
            nameOf={nameOf}
            onReplay={() => playRef(question.playMidi)}
            onSkip={skip}
            onStop={stop}
          />
        </View>
      ) : (
        <View style={[styles.flex, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.title}>Oreille</Text>
          {phase === "done" ? (
            <View style={[styles.flex, { paddingBottom: bottomChrome + spacing.lg }]}>
              <ResultView
                sectionLabel={sectionLabel}
                score={results.filter(Boolean).length}
                count={opts.count}
                timeMs={finalTime}
                best={best}
                isRecord={isRecord}
                onReplay={start}
                onSetup={() => setPhase("setup")}
              />
            </View>
          ) : (
            <SetupPanel
              section={section}
              onSection={setSection}
              opts={opts}
              setOpts={setOpts}
              best={best}
              onStart={start}
              perm={perm}
              error={error}
              bottomPad={bottomChrome + spacing.xl}
            />
          )}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  flex: { flex: 1 },
  title: { fontFamily: fonts.display, fontSize: 28, fontWeight: "700", color: c.onSurface, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
}));
