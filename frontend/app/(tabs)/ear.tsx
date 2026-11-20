import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";

import { FEEDBACK_MS, playFeedback, playNote, preloadFeedback, restorePlaybackMode, stopAll } from "@/src/audio/sampler";
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
import { StudioBackground } from "@/src/components/StudioBackground";
import { useSettings } from "@/src/settings";
import { storage } from "@/src/utils/storage";
import { fonts, makeStyles, spacing } from "@/src/theme";
import { tr } from "@/src/i18n";

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
  // Missed twice: the answer is shown and the player must play it to move on; the chrono is paused meanwhile.
  const correctingRef = useRef(false);
  const pausedAtRef = useRef<number | null>(null);
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

  // Success / error sound. Same care as the reference note: on native the mic pauses while it plays, and the
  // detector ignores what it hears meanwhile (the sound must not count as a played note).
  const feedbackSound = (kind: "success" | "error") => {
    const vol = settingsRef.current.volume;
    const ms = FEEDBACK_MS[kind];
    ignoreUntil.current = Math.max(ignoreUntil.current, Date.now() + ms + 400);
    if (listeningRef.current && Platform.OS !== "web") {
      const token = ++suspendToken.current;
      setSuspended(true);
      later(async () => {
        try {
          await restorePlaybackMode();
        } catch {
          // playback may still work
        }
        if (token === suspendToken.current) playFeedback(kind, vol);
      }, 120);
      later(() => {
        if (token === suspendToken.current) setSuspended(false);
      }, ms + 250);
    } else playFeedback(kind, vol);
  };

  const newQuestion = () => {
    const q = makeQuestion(sectionRef.current, optsRef.current, nameRef.current);
    qRef.current = q;
    answeredRef.current = false;
    attemptsRef.current = 0;
    correctingRef.current = false;
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
    setFeedback({ kind: "correct", text: tr("Bravo !") });
    feedbackSound("success");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    later(advance, 550);
  };

  const pauseChrono = () => {
    if (pausedAtRef.current === null) pausedAtRef.current = Date.now();
  };
  const resumeChrono = () => {
    if (pausedAtRef.current === null) return;
    startRef.current += Date.now() - pausedAtRef.current;
    pausedAtRef.current = null;
  };

  // The shown answer has been played: on to the next note (the question stays counted as missed).
  const onCorrected = () => {
    correctingRef.current = false;
    answeredRef.current = true;
    resumeChrono();
    setFeedback({ kind: "correct", text: tr("C’est ça !") });
    feedbackSound("success");
    later(advance, 550);
  };

  const onWrong = (midi: number) => {
    const q = qRef.current;
    if (!q) return;
    attemptsRef.current += 1;
    const name = nameRef.current;
    const played = `${name(pcOf(midi))}${octaveOf(midi)}`;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    feedbackSound("error");
    if (attemptsRef.current >= 2) {
      correctingRef.current = true;
      pauseChrono();
      stable.current = { midi: -1, count: 0 };
      record(false);
      setRevealed(true);
      const pos = q.string !== undefined && q.fret !== undefined ? { string: q.string, fret: q.fret } : lowestPosition(q.targetMidi, q.pitchClassOnly);
      const answer = `${name(pcOf(q.targetMidi))}${q.pitchClassOnly ? "" : octaveOf(q.targetMidi)}`;
      // “Manche”: the small neck under the note already shows where it is.
      const where = pos && q.string === undefined ? ` · ${positionText(pos)}` : "";
      setFeedback({ kind: "miss", text: `${tr("Raté — c’était {answer}", { answer })}${where} · ${tr("joue-la pour continuer")}` });
      return;
    }
    let text = tr("Tu joues {note} — encore 1 chance", { note: played });
    if (!q.pitchClassOnly && pcOf(midi) === pcOf(q.targetMidi)) {
      const diff = octaveOf(q.targetMidi) - octaveOf(midi);
      text = tr(`Bonne note, mauvaise octave — vise {n} octave${Math.abs(diff) > 1 ? "s" : ""} plus ${diff > 0 ? "haut" : "bas"} (encore 1 chance)`, { n: Math.abs(diff) });
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
    if (correctingRef.current) {
      if (match && stable.current.count === 3) onCorrected();
      return;
    }
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
    const id = setInterval(() => {
      if (pausedAtRef.current === null) setElapsed(Date.now() - startRef.current);
    }, 100);
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
    preloadFeedback();
    setPerm("granted");
    clearTimers();
    resultsRef.current = [];
    setResults([]);
    setIsRecord(false);
    setElapsed(0);
    startRef.current = Date.now();
    pausedAtRef.current = null;
    phaseRef.current = "running";
    setPhase("running");
    setListening(true);
    newQuestion();
  };

  const skip = () => {
    if (correctingRef.current) {
      // Already counted as missed: just move on.
      correctingRef.current = false;
      answeredRef.current = true;
      resumeChrono();
      advance();
      return;
    }
    if (answeredRef.current) return;
    answeredRef.current = true;
    record(false);
    advance();
  };

  const sectionLabel = tr(SECTIONS.find((s) => s.id === section)!.label);
  const micText = suspended
    ? tr("Écoute…")
    : status === "starting"
      ? tr("Connexion au micro…")
      : status === "listening"
        ? tr("Joue la note…")
        : tr("Micro en pause");

  return (
    <View style={styles.screen} testID="ear-screen">
      <StudioBackground />
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
          <Text style={styles.title}>{tr("Oreille")}</Text>
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
