import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";

import { FEEDBACK_MS, playFeedback, playNote, preloadFeedback, restorePlaybackMode, stopAll } from "@/src/audio/sampler";
import { usePitchDetector } from "@/src/audio/usePitchDetector";
import { ChallengeView, type Feedback } from "@/src/ear/ChallengeView";
import { ResultView } from "@/src/ear/ResultView";
import { EarLibrary, earBestKey } from "@/src/ear/EarLibrary";
import { CHORD_LEVELS, EAR_GAMES, defaultCountOf, micGameOf, type ChordLevel, type EarGame } from "@/src/ear/games";
import { FindChallenge } from "@/src/challenge/FindChallenge";
import { resumeWebAudio } from "@/src/audio/webAudio";
import { ResultsPanel } from "@/src/ear/ResultsPanel";
import { ChordQuiz } from "@/src/ear/ChordQuiz";
import { IntervalQuiz } from "@/src/ear/IntervalQuiz";
import { loadHistory, saveAttempt, saveSession, type Attempt } from "@/src/ear/stats";
import { useResultsVersion } from "@/src/results";
import { pickWeakKey, sessionProgress, weaknessScores } from "@/src/ear/weakness";
import { reasonText } from "@/src/ear/labels";
import { LANDSCAPE_NAV_W } from "@/src/components/AppTabBar";
import {
  DEFAULT_OPTIONS,
  lowestPosition,
  candidateKeys,
  makeQuestion,
  positionText,
  type Best,
  type Options,
  type Question,
  type Section,
} from "@/src/ear/questions";
import type { PitchFrame } from "@/src/music/yin";
import { STRING_LABELS, freqToMidiFloat, octaveOf, pcOf } from "@/src/music/theory";
import { usesNativeTabs } from "@/src/navigation";
import { StudioBackground } from "@/src/components/StudioBackground";
import { useSettings } from "@/src/settings";
import { storage } from "@/src/utils/storage";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { CaretLeft, ChartBar } from "phosphor-react-native";
import { tr } from "@/src/i18n";
import { useLeaveGuard, useTabReset } from "@/src/tabNav";

type Phase = "setup" | "running" | "done";
type Perm = "unknown" | "granted" | "ask" | "blocked";
type Timer = ReturnType<typeof setTimeout>;

export default function EarScreen() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  // Landscape: the tab bar is a pill in the top-right corner; keep the header controls beside it.
  const navInset = winW > winH && !usesNativeTabs ? LANDSCAPE_NAV_W : 0;
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
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
  const qStartRef = useRef(0);
  // Weak-points mode: this section's answers, kept up to date during the challenge.
  const historyRef = useRef<Attempt[]>([]);
  const beforeRef = useRef<Attempt[]>([]); // answers before this challenge (for “Tes progrès”)
  const sessionRef = useRef<Attempt[]>([]); // answers of this challenge
  // “Travailler cette zone”: the stat keys of the chosen frets (Manche), else null.
  const zoneRef = useRef<string[] | null>(null);
  const [progress, setProgress] = useState<ReturnType<typeof sessionProgress> | null>(null);
  const [tab, setTab] = useState<"play" | "results">("play");
  // The library (src/ear/games.ts): the open card, and the settings / length kept for each game.
  const [openGame, setOpenGame] = useState<string | null>(null);
  const [gameOpts, setGameOpts] = useState<Record<string, Options>>({});
  const [gameCounts, setGameCounts] = useState<Record<string, number>>({});
  const optsOf = (g: EarGame): Options => gameOpts[g.id] ?? { ...DEFAULT_OPTIONS, count: defaultCountOf(g), ...g.preset };
  const countOf = (g: EarGame) => (g.kind === "mic" ? optsOf(g).count : (gameCounts[g.id] ?? defaultCountOf(g)));
  // Quizzes (Reconnais l’accord, Reconnais l’intervalle): the level chosen per game. Trouve le degré / la gamme: their own screen while open.
  const [quizLevels, setQuizLevels] = useState<Record<string, ChordLevel>>({});
  const levelOf = (g: EarGame) => quizLevels[g.id] ?? g.levels?.[0] ?? CHORD_LEVELS[0];
  const [challenge, setChallenge] = useState<"degree" | "scale" | "chord" | null>(null);
  // The micro game being played (its record key).
  const gameRef = useRef<EarGame>(EAR_GAMES[0]);
  const [curGame, setCurGame] = useState<EarGame>(EAR_GAMES[0]);
  // Quizzes: the game launched runs its own screen (ChordQuiz, IntervalQuiz), mounted until it is left.
  const [chordGame, setChordGame] = useState<{ game: EarGame; level: ChordLevel; count: number; token: number } | null>(null);
  const [chordPhase, setChordPhase] = useState<"setup" | "running" | "done">("setup");
  const chordRunning = !!chordGame && chordPhase === "running";
  // (Accords: only while its quiz is on screen, i.e. on the “play” tab.)
  const showingDone = phase === "done" || (!!chordGame && tab === "play" && chordPhase === "done");
  const leaveChords = useCallback(() => {
    setChordGame(null);
    setChordPhase("setup");
  }, []);
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

  const resultsV = useResultsVersion(); // results erased in Réglages: reload the record
  const micKey = () => earBestKey(gameRef.current, optsRef.current.count);
  const loadBest = useCallback(() => {
    const key = earBestKey(curGame, opts.count);
    storage.getItem(key, null).then((v) => {
      if (key !== earBestKey(gameRef.current, optsRef.current.count)) return;
      try {
        setBest(typeof v === "string" ? (JSON.parse(v) as Best) : null);
      } catch {
        setBest(null);
      }
    });
  }, [curGame, opts.count, resultsV]);

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
        if (token === suspendToken.current) setSuspended(false); // the mic comes back once the sound is over
      }, ms + 450);
    } else playFeedback(kind, vol);
  };

  const targetKeys = () => (zoneRef.current && sectionRef.current === "board" ? zoneRef.current : candidateKeys(sectionRef.current, optsRef.current));

  const newQuestion = () => {
    let forced: string | undefined;
    let focus: Question["focus"];
    if (optsRef.current.weak) {
      const scores = weaknessScores(targetKeys(), historyRef.current);
      const picked = pickWeakKey(scores, qRef.current?.stat.key);
      forced = picked?.key;
      if (picked) focus = { weak: picked.weak, text: picked.weak ? reasonText(picked.reason) : tr("Révision · tu la connais bien") };
    }
    const q = { ...makeQuestion(sectionRef.current, optsRef.current, nameRef.current, forced), focus };
    qRef.current = q;
    answeredRef.current = false;
    attemptsRef.current = 0;
    correctingRef.current = false;
    qStartRef.current = Date.now();
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
    saveSession({ t: Date.now(), s: sectionRef.current, count: optsRef.current.count, score, ms: t });
    setProgress(optsRef.current.weak ? sessionProgress(targetKeys(), beforeRef.current, sessionRef.current) : null);
    if (better) {
      const next = { score, timeMs: t, at: Date.now() };
      setBest(next);
      storage.setItem(micKey(), JSON.stringify(next));
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

  // One line per answered question for the results dashboard.
  const logAttempt = (errors: number, skipped = false) => {
    const q = qRef.current;
    if (!q) return;
    const a: Attempt = {
      t: Date.now(),
      s: sectionRef.current,
      ...q.stat,
      string: q.string,
      fret: q.fret,
      ms: Date.now() - qStartRef.current,
      errors,
      ...(skipped ? { skipped } : {}),
    };
    historyRef.current.push(a);
    sessionRef.current.push(a);
    saveAttempt(a);
  };

  const onCorrect = () => {
    answeredRef.current = true;
    record(true);
    logAttempt(attemptsRef.current);
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

  // Right note name at the wrong height: said in plain words (too low / too high), no octave numbers.
  const octaveHint = (q: Question, midi: number) => {
    if (q.pitchClassOnly || pcOf(midi) !== pcOf(q.targetMidi) || midi === q.targetMidi) return null;
    const higher = q.targetMidi > midi;
    const far = Math.abs(q.targetMidi - midi) > 12;
    const base = higher
      ? far
        ? tr("Bonne note, mais beaucoup trop grave — joue-la bien plus aiguë")
        : tr("Bonne note, mais trop grave — joue-la plus aiguë")
      : far
        ? tr("Bonne note, mais beaucoup trop aiguë — joue-la bien plus grave")
        : tr("Bonne note, mais trop aiguë — joue-la plus grave");
    return q.string !== undefined ? `${base}, ${tr("sur la corde {s} ({l})", { s: q.string + 1, l: STRING_LABELS[q.string] })}` : base;
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
      logAttempt(2);
      setRevealed(true);
      const pos = q.string !== undefined && q.fret !== undefined ? { string: q.string, fret: q.fret } : lowestPosition(q.targetMidi, q.pitchClassOnly);
      const answer = `${name(pcOf(q.targetMidi))}${q.pitchClassOnly ? "" : octaveOf(q.targetMidi)}`;
      // “Manche”: the small neck under the note already shows where it is.
      const where = pos && q.string === undefined ? ` · ${positionText(pos)}` : "";
      setFeedback({ kind: "miss", text: `${tr("Raté — c’était {answer}", { answer })}${where} · ${tr("joue-la pour continuer")}` });
      return;
    }
    const hint = octaveHint(q, midi);
    setFeedback({ kind: "wrong", text: hint ? `${hint} · ${tr("encore 1 chance")}` : tr("Tu joues {note} — encore 1 chance", { note: played }) });
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
      else if (!match && stable.current.count === 6) {
        const hint = octaveHint(q, midi);
        if (hint) setFeedback({ kind: "miss", text: hint });
      }
      return;
    }
    if (match && stable.current.count === 3) onCorrect();
    else if (!match && stable.current.count === 6) onWrong(midi);
  };

  const { status, error, mic } = usePitchDetector(listening && !suspended, onFrame);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    suspendToken.current++;
    setListening(false);
    setSuspended(false);
    setDetected(null);
    setPhase("setup");
    zoneRef.current = null;
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
    historyRef.current = optsRef.current.weak ? (await loadHistory()).attempts.filter((a) => a.s === sectionRef.current) : [];
    beforeRef.current = [...historyRef.current];
    sessionRef.current = [];
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

  /** Makes this micro game the current one (settings, section, record). */
  const selectGame = (g: EarGame, o: Options) => {
    gameRef.current = g;
    setCurGame(g);
    const sec = g.section ?? "board";
    sectionRef.current = sec;
    setSection(sec);
    optsRef.current = o;
    setOpts(o);
  };

  /** “Démarrer · <jeu>” on a card of the library. */
  const startGame = (g: EarGame) => {
    if (g.kind === "chords" || g.kind === "intervals") {
      resumeWebAudio(); // Safari (iPhone): the audio clock only runs after a tap
      setSection(g.section ?? "chords");
      setChordPhase("setup");
      setChordGame({ game: g, level: levelOf(g), count: countOf(g), token: Date.now() });
      return;
    }
    zoneRef.current = null;
    selectGame(g, optsOf(g));
    start();
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
    logAttempt(attemptsRef.current, true);
    advance();
  };

  const sectionLabel =
    tr(curGame.name) +
    (zoneRef.current && section === "board" ? ` · ${tr("Zone")}` : opts.weak ? ` · ${tr("Points faibles")}` : "");
  const micText = suspended
    ? tr("Écoute…")
    : status === "starting"
      ? tr("Connexion au micro…")
      : status === "listening"
        ? tr("Joue la note…")
        : tr("Micro en pause");

  // FS-36: the Défis tab always opens on the games; a game in progress is paused and confirmed before leaving.
  useTabReset("ear", () => {
    stop();
    setChallenge(null);
    leaveChords();
    setTab("play");
    setOpenGame(null);
  });
  useLeaveGuard(phase === "running", {
    pause: () => {
      pauseChrono();
      setListening(false);
    },
    resume: () => {
      resumeChrono();
      setListening(true);
    },
    quit: stop,
  });

  // Trouve le degré / Trouve la gamme: their own screen (levels, records, results), back to Défis with its arrow.
  if (challenge) return <FindChallenge key={challenge} kind={challenge} onBack={() => setChallenge(null)} />;

  return (
    <View style={styles.screen} testID="ear-screen">
      <StudioBackground />
      {mic}
      {phase === "running" && question ? (
        <View style={[styles.flex, { paddingTop: insets.top, paddingBottom: bottomChrome, paddingLeft: insets.left, paddingRight: insets.right }]}>
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
            navInset={navInset}
          />
        </View>
      ) : (
        <View style={[styles.flex, { paddingTop: insets.top + spacing.sm, paddingLeft: insets.left, paddingRight: insets.right }]}>
          {/* Same pattern as S’exercer: results behind a chart icon, a back arrow to return to the games. */}
          {!chordRunning ? (
            <View style={[styles.headRow, { paddingRight: navInset + spacing.lg }]}>
              {(tab === "results" && !showingDone) || showingDone ? (
                <Pressable
                  testID="ear-results-back"
                  onPress={() => {
                    if (showingDone) {
                      // Bilan → back to the games.
                      if (chordGame) leaveChords();
                      else setPhase("setup");
                    } else setTab("play");
                  }}
                  style={styles.iconBtn}
                  accessibilityLabel={tr("Retour aux jeux")}
                >
                  <CaretLeft size={18} color={colors.onSurface} weight="bold" />
                </Pressable>
              ) : null}
              <Text style={styles.title} numberOfLines={1}>
                {showingDone ? (chordGame ? tr(chordGame.game.name) : tr(curGame.name)) : tab === "results" ? tr("Mes résultats") : tr("Défis")}
              </Text>
              {tab === "play" && !showingDone ? (
                <Pressable testID="ear-tab-results" onPress={() => setTab("results")} style={styles.iconBtn} accessibilityLabel={tr("Mes résultats")}>
                  <ChartBar size={20} color={colors.onSurface} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {phase !== "done" && tab === "results" ? (
            <ResultsPanel
              section={section}
              onSection={setSection}
              nameOf={nameOf}
              bottomPad={bottomChrome + spacing.xl}
              onTrainZone={(keys) => {
                // “Travailler cette zone”: weak-points draw restricted to these frets.
                const g = micGameOf(section);
                selectGame(g, { ...optsOf(g), weak: true });
                zoneRef.current = keys;
                setTab("play");
                start();
              }}
              onTrainWeak={() => {
                // Straight into a weak-points challenge for this section, with the game's settings.
                const g = micGameOf(section);
                zoneRef.current = null;
                selectGame(g, { ...optsOf(g), weak: true });
                setTab("play");
                start();
              }}
            />
          ) : phase === "done" ? (
            <View style={[styles.flex, { paddingBottom: bottomChrome + spacing.lg }]}>
              <ResultView
                sectionLabel={sectionLabel}
                score={results.filter(Boolean).length}
                count={opts.count}
                timeMs={finalTime}
                best={best}
                isRecord={isRecord}
                onReplay={start}
                replayLabel={zoneRef.current ? tr("Rejouer cette zone") : opts.weak ? tr("Rejouer mes points faibles") : tr("Rejouer")}
                progress={progress}
                nameOf={nameOf}
                onSetup={() => {
                  zoneRef.current = null;
                  setTab("play");
                  setPhase("setup");
                }}
                onResults={() => {
                  zoneRef.current = null;
                  setTab("results");
                  setPhase("setup");
                }}
              />
            </View>
          ) : chordGame ? (
            (() => {
              const quizProps = {
                level: chordGame.level,
                count: chordGame.count,
                onPhase: setChordPhase,
                onExit: leaveChords,
                onResults: () => {
                  leaveChords();
                  setSection(chordGame.game.section ?? "chords");
                  setTab("results");
                },
                bottomPad: bottomChrome + spacing.xl,
                topPad: 0,
                navInset,
              };
              return chordGame.game.kind === "intervals" ? <IntervalQuiz key={chordGame.token} {...quizProps} /> : <ChordQuiz key={chordGame.token} {...quizProps} />;
            })()
          ) : (
            <EarLibrary
              openId={openGame}
              onOpen={setOpenGame}
              optsOf={optsOf}
              setOptsOf={(g, o) => setGameOpts((m) => ({ ...m, [g.id]: o }))}
              countOf={countOf}
              setCountOf={(g, n) =>
                g.kind === "mic" ? setGameOpts((m) => ({ ...m, [g.id]: { ...optsOf(g), count: n } })) : setGameCounts((m) => ({ ...m, [g.id]: n }))
              }
              onStart={startGame}
              onChallenge={setChallenge}
              levelOf={levelOf}
              setLevelOf={(g, l) => setQuizLevels((m) => ({ ...m, [g.id]: l }))}
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
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.lg, paddingBottom: spacing.xs, minHeight: 48 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 28, fontWeight: "700", color: c.onSurface },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", marginHorizontal: spacing.lg, marginBottom: spacing.xs, padding: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  segBtn: { flex: 1, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segBtnOn: { backgroundColor: c.brandPrimary },
  segText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurfaceTertiary },
  segTextOn: { color: c.onBrandPrimary, fontWeight: "700" },
}));
