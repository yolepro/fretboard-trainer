import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";
import { ArrowClockwise, CaretLeft, ChartBar, DeviceMobile, Faders, Microphone, Play, Trophy, X } from "phosphor-react-native";

import { ChallengeNeck } from "@/src/challenge/ChallengeNeck";
import { ChallengeResults } from "@/src/challenge/ChallengeResults";
import {
  DEFAULT_CHALLENGE,
  DEGREE_SCALES,
  SCALE_CHOICES,
  ROUND_CHOICES,
  buildRound,
  cellId,
  challengeBestKey,
  challengeSection,
  labelOfNum,
  mistakesAllowed,
  nextSetting,
  prettyLabel,
  scaleOf,
  type Cell,
  type ChallengeBest,
  type ChallengeKind,
  type ChallengeOptions,
  type Round,
  type RoundSetting,
} from "@/src/challenge/rounds";
import { LEVELS, levelOptions, neckRounds, type LevelId } from "@/src/challenge/levels";
import { Chip, SectionLabel } from "@/src/components/Chip";
import { KeyButton } from "@/src/components/KeyWheel";
import { LANDSCAPE_NAV_W } from "@/src/components/AppTabBar";
import { StudioBackground } from "@/src/components/StudioBackground";
import { FEEDBACK_MS, playFeedback, playNote, preloadFeedback, restorePlaybackMode } from "@/src/audio/sampler";
import { usePitchDetector } from "@/src/audio/usePitchDetector";
import { formatTime } from "@/src/ear/questions";
import { saveAttempt, saveSession } from "@/src/ear/stats";
import type { PitchFrame } from "@/src/music/yin";
import { DEGREE_META, degreeKeyFromNum, freqToMidiFloat } from "@/src/music/theory";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { storage } from "@/src/utils/storage";
import { tr } from "@/src/i18n";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Props = { kind: ChallengeKind; onBack: () => void; preset?: "neck" };
type Phase = "setup" | "rotate" | "running" | "done"; // rotate: whole-neck game waiting for landscape

const TITLES: Record<ChallengeKind, string> = { degree: "Trouve le degré", scale: "Trouve la gamme" };

/** “Trouve le degré” / “Trouve la gamme”: fill a position by playing (mic) or touching the notes. */
export function FindChallenge({ kind, onBack, preset }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const landscapeRef = useRef(landscape);
  landscapeRef.current = landscape;
  const navInset = landscape && !usesNativeTabs ? LANDSCAPE_NAV_W : 0;
  const bottom = usesNativeTabs ? insets.bottom : 0;
  const { settings, nameOf } = useSettings();

  const [tab, setTab] = useState<"play" | "results">("play");
  const [phase, setPhase] = useState<Phase>("setup");
  const [opts, setOpts] = useState<ChallengeOptions>({ ...DEFAULT_CHALLENGE, rounds: kind === "degree" ? 10 : 1 });
  // Degree challenge: a ready-made level (and one of its categories), or “custom” = every setting by hand.
  const [mode, setMode] = useState<LevelId | "custom">(kind === "degree" ? (preset === "neck" ? "inter" : "beginner") : "custom");
  // No game selected when arriving on a level (except the library's “whole neck” shortcut); tapping it again closes it.
  const [catIdx, setCatIdx] = useState<Record<LevelId, number | null>>({
    beginner: null,
    inter: preset === "neck" ? LEVELS[1].categories.findIndex((c) => c.id === "neck") : null,
    expert: null,
  });
  const [levelRounds, setLevelRounds] = useState<Record<string, number>>({});
  const [round, setRound] = useState<Round | null>(null);
  const [roundIdx, setRoundIdx] = useState(0);
  const [found, setFound] = useState<Cell[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [errors, setErrors] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finalMs, setFinalMs] = useState(0);
  const [best, setBest] = useState<ChallengeBest | null>(null);
  const [isRecord, setIsRecord] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [micDenied, setMicDenied] = useState(false);

  const level = mode === "custom" ? null : LEVELS.find((l) => l.id === mode)!;
  const sel = level ? catIdx[level.id] : null;
  const cat = level && sel !== null ? level.categories[sel] ?? null : null;
  const neckCat = cat?.set?.scope === "neck";
  const roundsKey = level && cat ? `${level.id}-${neckCat ? "neck" : "pos"}` : "";
  const roundChoices = level ? (neckCat ? neckRounds : level.rounds) : ROUND_CHOICES[kind];
  const levelRoundCount = level ? (levelRounds[roundsKey] ?? (neckCat ? neckRounds[0] : level.defaultRounds)) : 0;
  // What is actually played.
  // The answer mode (guitar / touch / both) is a global setting (Réglages › Entraînement).
  const play: ChallengeOptions = { ...(level && cat ? levelOptions(opts, level, cat, levelRoundCount) : opts), input: settings.challengeInput };
  const variant = level && cat ? `${level.id}-${cat.id}` : "custom";
  const sprint = play.sprintSec > 0;

  const optsRef = useRef(play);
  optsRef.current = play;
  const completedRef = useRef(0); // rounds completed (time trial score)
  const lastCellRef = useRef<Cell | null>(null);
  const [score, setScore] = useState(0);
  const [revealed, setRevealed] = useState<Cell[]>([]); // too many mistakes: the missing notes, shown before moving on
  const [failed, setFailed] = useState(0);
  const failedRef = useRef(0);
  const roundErrorsRef = useRef(0);
  const bagRef = useRef<string[]>([]);
  const cycleStartRef = useRef(0); // degrees still to draw (each one before any repeats)
  const pausedAtRef = useRef<number | null>(null); // chrono paused while the answer is shown
  const advanceRef = useRef<() => void>(() => {});
  const roundRef = useRef<Round | null>(null);
  const foundRef = useRef<Cell[]>([]);
  const errorsRef = useRef(0);
  const sinceFindErrors = useRef(0);
  const lastFindAt = useRef(0);
  const startRef = useRef(0);
  const roundIdxRef = useRef(0);
  const busyRef = useRef(false); // between rounds
  const stable = useRef({ midi: -1, count: 0, clear: 0 });
  const ignoreUntil = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const bestKey = challengeBestKey(kind, variant, sprint ? "sprint" : play.rounds);
  useEffect(() => {
    storage.getItem(bestKey, null).then((v) => {
      try {
        setBest(typeof v === "string" ? (JSON.parse(v) as ChallengeBest) : null);
      } catch {
        setBest(null);
      }
    });
  }, [bestKey, phase]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (phase === "rotate" && landscape) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, landscape]);
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      if (pausedAtRef.current !== null) return;
      const e = Date.now() - startRef.current;
      setElapsed(e);
      // Time trial: the clock decides the end.
      if (optsRef.current.sprintSec > 0 && e >= optsRef.current.sprintSec * 1000 && !finishedRef.current) finishRef.current();
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  const finishRef = useRef<() => void>(() => {});
  const finishedRef = useRef(false);
  const useMic = play.input !== "touch" && !micDenied;
  const listening = phase === "running" && useMic && !suspended;

  // Plays a feedback sound; on native the mic pauses meanwhile (iOS lowers the output while recording).
  // Plays something while listening: the detector ignores it, and on native the mic pauses meanwhile.
  const withMicPause = (play: () => void, ms: number) => {
    ignoreUntil.current = Date.now() + ms + 300;
    if (useMic && Platform.OS !== "web") {
      setSuspended(true);
      later(async () => {
        try {
          await restorePlaybackMode();
        } catch {
          // playback may still work
        }
        play();
      }, 120);
      later(() => setSuspended(false), ms + 250);
    } else play();
  };
  const sound = (k: "success" | "error" | "found" | "tick") => withMicPause(() => playFeedback(k, settingsRef.current.volume), FEEDBACK_MS[k]);

  const startRound = (idx: number, prev?: RoundSetting) => {
    const r = buildRound(kind, optsRef.current, nextSetting(kind, optsRef.current, idx, prev, bagRef.current, cycleStartRef.current));
    roundErrorsRef.current = 0;
    setRevealed([]);
    roundRef.current = r;
    roundIdxRef.current = idx;
    foundRef.current = [];
    lastCellRef.current = null;
    sinceFindErrors.current = 0;
    lastFindAt.current = Date.now();
    stable.current = { midi: -1, count: 0, clear: 0 };
    busyRef.current = false;
    setRound(r);
    setRoundIdx(idx);
    setFound([]);
    setWrong(null);
    setMessage(null);
  };

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    busyRef.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const o = optsRef.current;
    resumeChrono();
    const ms = o.sprintSec > 0 ? o.sprintSec * 1000 : Date.now() - startRef.current;
    const errs = errorsRef.current;
    const done = completedRef.current;
    setFinalMs(ms);
    setScore(done);
    setSuspended(false);
    setPhase("done");
    saveSession({ t: Date.now(), s: challengeSection(kind), count: o.sprintSec > 0 ? done : o.rounds, score: errs, ms });
    const prev = best;
    // Time trial: more rounds is better (then fewer mistakes); otherwise the fastest time.
    const better =
      o.sprintSec > 0
        ? done > 0 && (!prev || done > (prev.score ?? 0) || (done === (prev.score ?? 0) && errs < prev.errors))
        : failedRef.current === 0 && (!prev || ms < prev.timeMs); // a record needs every round found
    setIsRecord(better);
    if (better) {
      const next = { timeMs: ms, errors: errs, at: Date.now(), score: done };
      setBest(next);
      storage.setItem(challengeBestKey(kind, variant, o.sprintSec > 0 ? "sprint" : o.rounds), JSON.stringify(next));
    }
  };
  finishRef.current = finish;

  const ensureMic = async () => {
    if (optsRef.current.input === "touch" || Platform.OS === "web") return true;
    try {
      const cur = await getRecordingPermissionsAsync();
      if (cur.granted) return true;
      const r = cur.canAskAgain ? await requestRecordingPermissionsAsync() : cur;
      return r.granted;
    } catch {
      return false;
    }
  };

  const start = async () => {
    const ok = await ensureMic();
    setMicDenied(!ok);
    if (!ok && optsRef.current.input === "mic") return;
    preloadFeedback();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    errorsRef.current = 0;
    completedRef.current = 0;
    finishedRef.current = false;
    failedRef.current = 0;
    bagRef.current = [];
    cycleStartRef.current = Math.floor(Math.random() * 5); // “positions 1 → 5” start anywhere, then go round
    pausedAtRef.current = null;
    setFailed(0);
    setErrors(0);
    setElapsed(0);
    startRef.current = Date.now();
    setPhase("running");
    startRound(0);
  };

  const pauseChrono = () => {
    if (pausedAtRef.current === null) pausedAtRef.current = Date.now();
  };
  const resumeChrono = () => {
    if (pausedAtRef.current === null) return;
    startRef.current += Date.now() - pausedAtRef.current;
    pausedAtRef.current = null;
  };

  // Too many mistakes: show the missing notes (chrono paused), then the next round.
  const revealRound = () => {
    const r = roundRef.current;
    if (!r || busyRef.current) return;
    busyRef.current = true;
    pauseChrono();
    const missing = remaining();
    const now = Date.now();
    missing.forEach((c) =>
      saveAttempt({
        t: now,
        s: challengeSection(kind),
        key: `b${c.string}-${c.fret}`,
        label: c.label,
        sub: r.scaleId,
        string: c.string,
        fret: c.fret,
        ms: now - lastFindAt.current,
        errors: 2,
      }),
    );
    failedRef.current += 1;
    setFailed(failedRef.current);
    setRevealed(missing);
    setWrong(null);
    setMessage({ text: tr("Trop d’erreurs : voici les notes à retenir"), bad: true });
    const idx = roundIdxRef.current;
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      resumeChrono();
      if (optsRef.current.sprintSec === 0 && idx + 1 >= optsRef.current.rounds) finish();
      else if (optsRef.current.sprintSec === 0 || Date.now() - startRef.current < optsRef.current.sprintSec * 1000) startRound(idx + 1, r);
      else finish();
    };
    advanceRef.current = go;
    later(go, 5000);
  };

  // Whole-neck games are played in landscape: ask to turn the phone, start as soon as it is turned.
  const requestStart = () => {
    if (optsRef.current.scope === "neck" && !landscapeRef.current) setPhase("rotate");
    else start();
  };

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    pausedAtRef.current = null;
    setSuspended(false);
    setPhase("setup");
  }, []);

  const onFound = (c: Cell, fromTouch: boolean) => {
    const now = Date.now();
    saveAttempt({
      t: now,
      s: challengeSection(kind),
      key: `b${c.string}-${c.fret}`,
      label: c.label,
      sub: roundRef.current?.scaleId ?? optsRef.current.scaleId,
      string: c.string,
      fret: c.fret,
      ms: now - lastFindAt.current,
      errors: Math.min(2, sinceFindErrors.current),
    });
    lastFindAt.current = now;
    lastCellRef.current = c;
    sinceFindErrors.current = 0;
    foundRef.current = [...foundRef.current, c];
    setFound(foundRef.current);
    setWrong(null);
    setMessage(null);
    const r = roundRef.current!;
    const last = foundRef.current.length >= r.targets.length;
    // A light tick for each note found (the round's last note gets the “success” sound instead).
    // Touched: hear the note itself. Played on the guitar: a very short tick (the guitar is still ringing).
    if (fromTouch) withMicPause(() => playNote(c.midi, settingsRef.current.volume), 700);
    else if (!last || optsRef.current.sprintSec > 0) sound("tick");
    if (last) {
      busyRef.current = true;
      completedRef.current += 1;
      const sprinting = optsRef.current.sprintSec > 0;
      if (!sprinting) sound("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const idx = roundIdxRef.current;
      setMessage({ text: tr("Manche réussie !"), bad: false });
      later(
        () => {
          if (!sprinting && idx + 1 >= optsRef.current.rounds) finish();
          else if (!sprinting || Date.now() - startRef.current < optsRef.current.sprintSec * 1000) startRound(idx + 1, r);
        },
        sprinting ? 350 : 1100, // time trial: no time lost between rounds
      );
    }
  };

  const onMistake = (id: string | null, text: string, fromTouch: boolean) => {
    errorsRef.current += 1;
    sinceFindErrors.current += 1;
    roundErrorsRef.current += 1;
    setErrors(errorsRef.current);
    setWrong(id);
    setMessage({ text, bad: true });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (fromTouch) sound("error");
    later(() => setWrong((w) => (w === id ? null : w)), 700);
    const r = roundRef.current;
    if (r && roundErrorsRef.current >= mistakesAllowed(r.scope)) later(revealRound, 700);
  };

  const remaining = () => {
    const r = roundRef.current;
    if (!r) return [];
    const got = new Set(foundRef.current.map(cellId));
    return r.targets.filter((c) => !got.has(cellId(c)));
  };
  const expected = () => (optsRef.current.order === "up" && kind === "scale" ? remaining()[0] ?? null : null);
  const notHere = () => (kind === "degree" ? tr("Pas ici : ce n’est pas le degré demandé") : tr("Pas ici : cette note n’est pas dans la gamme"));

  // A touch or a played note that matches `cand` (cells of the same pitch / place).
  const tryCells = (cands: Cell[], id: string | null, fromTouch: boolean) => {
    if (busyRef.current || !roundRef.current) return;
    const left = remaining();
    const next = expected();
    // Same pitch at several places (whole neck): the one nearest to the last note found.
    const open = cands.filter((c) => left.some((l) => cellId(l) === cellId(c)));
    const last = lastCellRef.current;
    const hit = last
      ? [...open].sort((a, b) => Math.abs(a.fret - last.fret) + Math.abs(a.string - last.string) - (Math.abs(b.fret - last.fret) + Math.abs(b.string - last.string)))[0]
      : open[0];
    if (!hit) {
      if (cands.length && foundRef.current.some((f) => cands.some((c) => cellId(c) === cellId(f)))) return; // already found
      onMistake(id, notHere(), fromTouch);
      return;
    }
    if (next && cellId(next) !== cellId(hit)) {
      onMistake(id, tr("Dans l’ordre : du grave vers l’aigu"), fromTouch);
      return;
    }
    onFound(hit, fromTouch);
  };

  const onTouch = (string: number, fret: number) => {
    if (phase !== "running" || play.input === "mic") return;
    const id = `${string}-${fret}`;
    const r = roundRef.current;
    if (!r) return;
    const cell = r.targets.find((c) => cellId(c) === id);
    tryCells(cell ? [cell] : [], id, true);
  };

  // Mic. A right note is accepted quickly and with a looser clarity (some notes of a classical guitar, high on the
  // D or G string, are soft and short); a mistake needs a clear, longer note so noise is never counted.
  const onFrame = (f: PitchFrame) => {
    if (!f || f.clarity < 0.7 || Date.now() < ignoreUntil.current) {
      stable.current = { midi: -1, count: 0, clear: 0 };
      return;
    }
    const r = roundRef.current;
    if (!r) return;
    let midi = Math.round(freqToMidiFloat(f.freq, settingsRef.current.a4));
    // Octave slip of the detector (very common on guitar): if nothing of the zone sits at this pitch but a target
    // sits one octave away, take that target.
    const zoneHas = (m: number) => r.targets.some((c) => c.midi === m) || r.tonics.some((c) => c.midi === m);
    if (!zoneHas(midi)) {
      const near = [midi - 12, midi + 12].find((m) => r.targets.some((c) => c.midi === m));
      if (near !== undefined) midi = near;
    }
    if (stable.current.midi === midi) stable.current.count += 1;
    else stable.current = { midi, count: 1, clear: 0 };
    if (f.clarity >= 0.85) stable.current.clear += 1;
    const cands = r.targets.filter((c) => c.midi === midi);
    if (!cands.length && r.tonics.some((c) => c.midi === midi)) return; // playing the shown tonic to find one's bearings is fine
    if (cands.length && stable.current.count === 2) tryCells(cands, null, false);
    else if (!cands.length && stable.current.clear === 6) onMistake(null, notHere(), false);
  };
  usePitchDetector(listening, onFrame);

  // ---------- Views ----------

  const header = (title: string, onLeft: () => void, icon: "back" | "close", right?: React.ReactNode) => (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm, paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + navInset + spacing.sm }]}>
      <Pressable testID="challenge-back" onPress={onLeft} style={styles.roundBtn} accessibilityLabel={icon === "back" ? tr("Retour") : tr("Arrêter")}>
        {icon === "back" ? <CaretLeft size={18} color={colors.onSurface} weight="bold" /> : <X size={18} color={colors.onSurface} />}
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {phase === "running" ? (
        <Text style={[styles.chrono, sprint && play.sprintSec * 1000 - elapsed < 10000 && styles.chronoLow]}>
          {sprint ? formatTime(Math.max(0, play.sprintSec * 1000 - elapsed)) : formatTime(elapsed)}
        </Text>
      ) : null}
      {right}
    </View>
  );

  if (phase === "rotate") {
    return (
      <View style={styles.screen} testID="find-challenge-rotate">
        <StudioBackground />
        <View style={styles.rotateWrap}>
          <View style={styles.rotateIcon}>
            <DeviceMobile size={64} color={colors.brandPrimary} />
            <ArrowClockwise size={28} color={colors.onSurface} weight="bold" style={styles.rotateArrow} />
          </View>
          <Text style={styles.rotateTitle}>{tr("Tourne ton téléphone")}</Text>
          <Text style={styles.rotateText}>{tr("Ce jeu affiche tout le manche : il démarre dès que l’écran est à l’horizontale.")}</Text>
          <Pressable testID="challenge-rotate-cancel" onPress={() => setPhase("setup")} style={({ pressed }) => [styles.secondary, styles.rotateCancel, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>{tr("Annuler")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === "running" && round) {
    const pct = round.targets.length ? found.length / round.targets.length : 0;
    const keyName = nameOf(round.rootPc);
    const scaleName = tr(scaleOf(round.scaleId).name).toLowerCase();
    const big = kind === "degree" ? round.degrees.map((n) => prettyLabel(labelOfNum(round.scaleId, n))).join(" · ") : `${keyName} ${scaleName}`;
    const prompt = kind === "degree" ? tr("Trouve toutes les notes de degré") : tr("Joue toutes les notes de");
    const sub =
      kind === "degree"
        ? tr("de {key} {scale}", { key: keyName, scale: scaleName })
        : play.order === "up"
          ? tr("dans l’ordre, du grave vers l’aigu")
          : tr("dans n’importe quel ordre");
    return (
      <View style={styles.screen} testID="find-challenge-running">
        <StudioBackground />
        {header(sprint ? tr("Manche {i}", { i: roundIdx + 1 }) : tr("Manche {i}/{n}", { i: roundIdx + 1, n: play.rounds }), stop, "close")}
        <ScrollView
          contentContainerStyle={[
            styles.runContent,
            { paddingBottom: bottom + spacing.lg },
            landscape && { paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg, gap: spacing.sm },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {landscape ? (
            // Landscape: one compact line, so the neck can use the whole width.
            <View style={styles.cardLine}>
              <Text style={styles.bigLine}>{big}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {sub}
              </Text>
              <Text style={styles.scope} numberOfLines={1}>
                {round.scope === "neck" ? tr("Tout le manche") : tr("Position {n}", { n: round.position + 1 })}
              </Text>
              <View style={[styles.track, styles.trackLine]}>
                <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
              <Text style={styles.count}>
                {found.length}/{round.targets.length}
              </Text>
            </View>
          ) : (
          <View style={styles.card}>
            <Text style={styles.muted}>{prompt}</Text>
            <View style={styles.targetRow}>
              <Text style={styles.big}>{big}</Text>
              <Text style={styles.sub}>{sub}</Text>
            </View>
            <Text style={styles.scope}>
              {round.scope === "neck"
                ? tr("Tout le manche · cases {a}–{b}", { a: round.min, b: round.max })
                : tr("Position {n} · cases {a}–{b}", { n: round.position + 1, a: round.min, b: round.max })}
            </Text>
            <View style={styles.progressRow}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
              <Text style={styles.count}>
                {found.length}/{round.targets.length}
              </Text>
            </View>
          </View>
          )}
          <ChallengeNeck
            layout={landscape ? "full" : "zoom"} min={round.min} max={round.max} scope={round.scope} found={found} tonics={round.tonics} wrong={wrong} revealed={revealed} onPress={onTouch} disabled={play.input === "mic"} />
          {revealed.length ? (
            <Pressable testID="challenge-next" onPress={() => advanceRef.current()} style={({ pressed }) => [styles.nextBtn, pressed && styles.pressed]}>
              <Text style={styles.nextText}>{tr("J’ai retenu, manche suivante")}</Text>
            </Pressable>
          ) : null}
          <View style={[styles.message, message?.bad && styles.messageBad, message && !message.bad && styles.messageGood]} testID="challenge-message">
            {useMic && !message ? <Microphone size={16} color={colors.onSurfaceTertiary} /> : null}
            <Text style={[styles.messageText, message?.bad && styles.messageTextBad, message && !message.bad && styles.messageTextGood]} numberOfLines={2}>
              {message?.text ??
                (play.input === "touch" ? tr("Touche les cases du manche") : useMic && play.input === "both" ? tr("Joue la note ou touche le manche") : tr("Joue la note…"))}
            </Text>
          </View>
          {revealed.length ? <Text style={styles.hint}>{tr("Cerclées d’orange : les notes qui manquaient. Le chrono est en pause.")}</Text> : null}
          {round.tonics.length ? <Text style={styles.hint}>{tr("Cercles rouges : la tonique, pour te repérer.")}</Text> : null}
          {!revealed.length ? (
            <Text style={styles.hint}>
              {tr("Erreurs dans cette manche : {e}/{n}", { e: Math.min(roundErrorsRef.current, mistakesAllowed(round.scope)), n: mistakesAllowed(round.scope) })}
            </Text>
          ) : null}
          <Text style={styles.hint}>{tr("{n} erreur(s)", { n: errors })}</Text>
        </ScrollView>
      </View>
    );
  }

  if (phase === "done") {
    return (
      <View style={styles.screen} testID="find-challenge-done">
        <StudioBackground />
        <ScrollView contentContainerStyle={[styles.doneWrap, { paddingTop: insets.top + spacing.xl, paddingBottom: bottom + spacing.xl }]}>
          <Text style={styles.muted}>{tr("{title} · terminé", { title: tr(TITLES[kind]) })}</Text>
          {isRecord ? (
            <View style={styles.recordBadge}>
              <Trophy size={18} color={colors.onBrandPrimary} weight="fill" />
              <Text style={styles.recordText}>{tr("Nouveau record !")}</Text>
            </View>
          ) : null}
          <Text style={styles.doneTime}>{sprint ? String(score) : formatTime(finalMs)}</Text>
          <Text style={styles.muted}>
            {sprint ? tr("manches réussies en {s} s", { s: play.sprintSec }) : tr("{n} manches", { n: play.rounds })} ·{" "}
            {tr(errors === 1 ? "{n} erreur" : "{n} erreurs", { n: errors })}
            {failed ? ` · ${tr(failed === 1 ? "{n} manche ratée" : "{n} manches ratées", { n: failed })}` : ""}
          </Text>
          <Text style={styles.muted}>
            {best ? (sprint ? tr("Record : {n} manches", { n: best.score ?? 0 }) : tr("Record : {time}", { time: formatTime(best.timeMs) })) : ""}
          </Text>
          <Pressable testID="challenge-replay" onPress={requestStart} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <ArrowClockwise size={20} color={colors.onBrandPrimary} weight="bold" />
            <Text style={styles.primaryText}>{tr("Rejouer")}</Text>
          </Pressable>
          <Pressable testID="challenge-setup" onPress={() => setPhase("setup")} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Faders size={20} color={colors.onSurface} />
            <Text style={styles.secondaryText}>{tr("Changer les réglages")}</Text>
          </Pressable>
          <Pressable
            testID="challenge-results"
            onPress={() => {
              setTab("results");
              setPhase("setup");
            }}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <ChartBar size={20} color={colors.onSurface} />
            <Text style={styles.secondaryText}>{tr("Voir mes résultats")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ---------- Setup ----------
  const degreeNums = scaleOf(opts.scaleId).intervals.map((i) => String(i.num));
  const toggleDegree = (n: string) => {
    const has = opts.degrees.includes(n);
    if (has && opts.degrees.length === 1) return;
    setOpts({ ...opts, degrees: has ? opts.degrees.filter((x) => x !== n) : [...opts.degrees, n] });
  };
  const toggleScale = (id: string) => {
    const has = opts.scales.includes(id);
    if (has && opts.scales.length === 1) return;
    setOpts({ ...opts, scales: has ? opts.scales.filter((x) => x !== id) : [...opts.scales, id] });
  };
  const levelSummary = level && cat ? summaryOf(play, nameOf) : [];
  const micWarning = micDenied && play.input !== "touch" ? <Text style={styles.warn}>{tr("Micro indisponible : réponds en touchant le manche.")}</Text> : null;
  const recordLine = best ? (
    <Text style={styles.muted}>
      {sprint ? tr("Record : {n} manches", { n: best.score ?? 0 }) : tr("Record ({n} manches) : {time}", { n: play.rounds, time: formatTime(best.timeMs) })}
    </Text>
  ) : null;
  const startButton = (label: string) => (
    <Pressable testID="challenge-start" onPress={requestStart} style={({ pressed }) => [styles.primary, styles.primaryTight, pressed && styles.pressed]}>
      <Play size={22} color={colors.onBrandPrimary} weight="fill" />
      <Text style={styles.primaryText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );

  // Levels: every game keeps its description; the selected one opens with its settings, its rounds and the Start button.
  const levelSetup =
    level ? (
      <View style={styles.cats}>
        {level.categories.map((c, i) => {
          const on = c === cat;
          const ctx = c.set?.scaleId ?? (level.base.scaleId as string | undefined) ?? "major";
          return (
            <View key={c.id} style={[styles.catCard, on && styles.catCardOn]}>
              <Pressable testID={`challenge-cat-${c.id}`} onPress={() => setCatIdx({ ...catIdx, [level.id]: on ? null : i })} style={({ pressed }) => [styles.catHead, pressed && styles.pressed]}>
                <View style={styles.catBadges}>
                  {(c.degrees.length > 4 ? c.degrees.slice(0, 3) : c.degrees).map((n) => (
                    <DegreeBadge key={n} num={n} label={level.base.contextRandom ? n : prettyLabel(labelOfNum(ctx, n))} />
                  ))}
                  {c.degrees.length > 4 ? <Text style={styles.more}>…</Text> : null}
                </View>
                <View style={styles.catText}>
                  <Text style={styles.catName}>{tr(c.name)}</Text>
                  <Text style={styles.muted}>{tr(c.meta)}</Text>
                </View>
              </Pressable>
              <Unfold open={on}>
                <View style={styles.catBody} testID="challenge-cat-open">
                  <View style={styles.summary}>
                    {levelSummary.map((t) => (
                      <View key={t.text} style={[styles.summaryChip, t.random && styles.summaryChipRandom]}>
                        <Text style={[styles.summaryText, t.random && styles.summaryTextRandom]}>{t.text}</Text>
                      </View>
                    ))}
                  </View>
                  {level.keyChoice && !play.randomKey ? (
                    <View style={styles.keyRow}>
                      <KeyButton rootPc={opts.rootPc} nameOf={nameOf} onChange={(pc) => setOpts({ ...opts, rootPc: pc })} testID="challenge-key" />
                      <Text style={styles.muted}>{tr("Ta tonalité")}</Text>
                    </View>
                  ) : null}
                  {sprint ? (
                    <Text style={styles.muted}>{tr("{s} secondes : enchaîne le plus de manches possible.", { s: play.sprintSec })}</Text>
                  ) : (
                    <View style={styles.roundsRow}>
                      <Text style={styles.roundsLabel}>{tr("Manches")}</Text>
                      {roundChoices.map((n) => (
                        <Chip key={n} testID={`challenge-rounds-${n}`} label={String(n)} selected={levelRoundCount === n} onPress={() => setLevelRounds({ ...levelRounds, [roundsKey]: n })} />
                      ))}
                    </View>
                  )}
                  {recordLine}
                  {micWarning}
                  {startButton(tr("Démarrer · {name}", { name: tr(c.name) }))}
                </View>
              </Unfold>
            </View>
          );
        })}
      </View>
    ) : null;

  const customSetup = (
    <>
      <View style={styles.keyRow}>
        {!opts.randomKey ? <KeyButton rootPc={opts.rootPc} nameOf={nameOf} onChange={(pc) => setOpts({ ...opts, rootPc: pc })} testID="challenge-key" /> : null}
        <Chip testID="challenge-random-key" label={tr("Tonalité au hasard")} selected={opts.randomKey} onPress={() => setOpts({ ...opts, randomKey: !opts.randomKey })} />
      </View>

      <SectionLabel>{tr("Manches")}</SectionLabel>
      <View style={styles.wrap}>
        {ROUND_CHOICES[kind].map((n) => (
          <Chip key={n} testID={`challenge-rounds-${n}`} label={String(n)} selected={opts.rounds === n} onPress={() => setOpts({ ...opts, rounds: n })} />
        ))}
      </View>

      {kind === "degree" ? (
        <>
          <SectionLabel>{tr("Tonalité")}</SectionLabel>
          <View style={styles.wrap}>
            {DEGREE_SCALES.map((id) => (
              <Chip key={id} testID={`challenge-scale-${id}`} label={tr(scaleOf(id).name)} selected={!opts.contextRandom && opts.scaleId === id} onPress={() => setOpts({ ...opts, scaleId: id, contextRandom: false })} />
            ))}
            <Chip testID="challenge-scale-random" label={tr("Majeur / mineur au hasard")} selected={opts.contextRandom} onPress={() => setOpts({ ...opts, contextRandom: true })} />
          </View>
          <SectionLabel>{tr("Degrés")}</SectionLabel>
          <View style={styles.wrap}>
            {degreeNums.map((n) => (
              <Chip
                key={n}
                testID={`challenge-degree-${n}`}
                label={n === "1" ? tr("Tonique (1)") : opts.contextRandom ? n : prettyLabel(labelOfNum(opts.scaleId, n))}
                selected={opts.degrees.includes(n)}
                onPress={() => toggleDegree(n)}
              />
            ))}
          </View>
          <Text style={styles.muted}>{tr("Chaque manche demande un autre degré, tiré parmi ceux choisis.")}</Text>
          <SectionLabel>{tr("Zone")}</SectionLabel>
          <View style={styles.wrap}>
            <Chip testID="challenge-scope-position" label={tr("Une position")} selected={opts.scope === "position"} onPress={() => setOpts({ ...opts, scope: "position" })} />
            <Chip testID="challenge-scope-neck" label={tr("Tout le manche")} selected={opts.scope === "neck"} onPress={() => setOpts({ ...opts, scope: "neck" })} />
            <Chip testID="challenge-hide-tonic" label={tr("Cacher la tonique")} selected={opts.hideTonic} onPress={() => setOpts({ ...opts, hideTonic: !opts.hideTonic })} />
          </View>
        </>
      ) : (
        <>
          <SectionLabel>{opts.rounds > 1 ? tr("Gammes (une différente à chaque manche)") : tr("Gammes (tirée au hasard)")}</SectionLabel>
          <View style={styles.wrap}>
            {SCALE_CHOICES.map((id) => (
              <Chip key={id} testID={`challenge-scale-${id}`} label={tr(scaleOf(id).name)} selected={opts.scales.includes(id)} onPress={() => toggleScale(id)} />
            ))}
          </View>
          {opts.rounds > 1 && opts.scales.length < 2 ? <Text style={styles.warn}>{tr("Choisis au moins 2 gammes pour qu’elles changent à chaque manche.")}</Text> : null}
          <SectionLabel>{tr("Ordre")}</SectionLabel>
          <View style={styles.wrap}>
            <Chip testID="challenge-order-free" label={tr("Libre")} selected={opts.order === "free"} onPress={() => setOpts({ ...opts, order: "free" })} />
            <Chip testID="challenge-order-up" label={tr("Montant (grave → aigu)")} selected={opts.order === "up"} onPress={() => setOpts({ ...opts, order: "up" })} />
          </View>
        </>
      )}

      {kind === "scale" || opts.scope === "position" ? (
        <>
          <SectionLabel>{tr("Position")}</SectionLabel>
          <View style={styles.wrap}>
            {[0, 1, 2, 3, 4].map((p) => (
              <Chip key={p} testID={`challenge-pos-${p}`} label={tr("Pos. {n}", { n: p + 1 })} selected={opts.position === p} onPress={() => setOpts({ ...opts, position: p })} />
            ))}
            <Chip testID="challenge-pos-cycle" label={tr("1 → 5")} selected={opts.position === -2} onPress={() => setOpts({ ...opts, position: -2 })} />
            <Chip testID="challenge-pos-random" label={tr("Au hasard")} selected={opts.position === -1} onPress={() => setOpts({ ...opts, position: -1 })} />
          </View>
        </>
      ) : null}
    </>
  );

  return (
    <View style={styles.screen} testID="find-challenge-setup">
      <StudioBackground />
      {header(
        tab === "results" ? tr("Mes résultats") : tr(TITLES[kind]),
        tab === "results" ? () => setTab("play") : onBack,
        "back",
        tab === "play" ? (
          <Pressable testID="challenge-tab-results" onPress={() => setTab("results")} style={styles.roundBtn} accessibilityLabel={tr("Mes résultats")}>
            <ChartBar size={20} color={colors.onSurface} />
          </Pressable>
        ) : null,
      )}
      {tab === "results" ? (
        <ChallengeResults kind={kind} nameOf={nameOf} bottomPad={bottom + spacing.xl} variant={variant} lengths={sprint ? ["sprint"] : roundChoices} />
      ) : (
        <ScrollView contentContainerStyle={[styles.setup, { paddingBottom: bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
          {kind === "degree" ? (
            <View style={styles.levels}>
              {(["beginner", "inter", "expert", "custom"] as const).map((m) => (
                <Pressable key={m} testID={`challenge-level-${m}`} onPress={() => setMode(m)} style={[styles.levelBtn, mode === m && styles.levelBtnOn]}>
                  <Text style={[styles.levelText, mode === m && styles.levelTextOn]} numberOfLines={1}>
                    {m === "custom" ? tr("Perso") : tr(LEVELS.find((l) => l.id === m)!.name)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {level ? (
            levelSetup
          ) : (
            <>
              {customSetup}
              {recordLine}
              {micWarning}
              {startButton(tr("Démarrer le challenge"))}
            </>
          )}
          <Text style={styles.inputNote}>
            {tr("Réponse : {mode} · se change dans Réglages", {
              mode: play.input === "both" ? tr("guitare + toucher") : play.input === "mic" ? tr("guitare (micro)") : tr("toucher l’écran"),
            })}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 22, fontWeight: "700", color: c.onSurface },
  chronoLow: { color: "#F97316" },
  cardLine: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  bigLine: { fontFamily: fonts.display, fontSize: 24, fontWeight: "700", color: c.onSurface },
  trackLine: { minWidth: 60 },
  nextBtn: { height: 48, borderRadius: radius.pill, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  nextText: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onBrandPrimary },
  levels: { flexDirection: "row", padding: 4, marginBottom: spacing.sm, borderRadius: radius.pill, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  levelBtn: { flex: 1, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  levelBtnOn: { backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.brandPrimary },
  levelText: { fontFamily: fonts.display, fontSize: 13, color: c.onSurfaceTertiary },
  levelTextOn: { color: c.onSurface, fontWeight: "700" },
  cats: { gap: spacing.sm, paddingVertical: spacing.sm },
  catCard: { borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  catHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  catBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  roundsRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  roundsLabel: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, marginRight: 4 },
  inputNote: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary, textAlign: "center", marginTop: spacing.md },
  catCardOn: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  catBadges: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 60 },
  more: { fontFamily: fonts.display, fontSize: 14, color: c.onSurfaceTertiary },
  catText: { flex: 1, minWidth: 0, gap: 2 },
  catName: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  primaryTight: { marginTop: spacing.xs },
  rotateWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.md },
  rotateTitle: { fontFamily: fonts.display, fontSize: 24, fontWeight: "700", color: c.onSurface, textAlign: "center" },
  rotateText: { fontFamily: fonts.text, fontSize: 15, color: c.onSurfaceTertiary, textAlign: "center", lineHeight: 21 },
  rotateIcon: { width: 96, height: 96, alignItems: "center", justifyContent: "center", transform: [{ rotate: "90deg" }] },
  rotateArrow: { position: "absolute", right: 0, top: 4 },
  rotateCancel: { alignSelf: "center", paddingHorizontal: spacing.xl },
  summaryChip: { height: 28, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, justifyContent: "center" },
  summaryChipRandom: { borderWidth: 1, borderColor: c.brandPrimary },
  summaryText: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceSecondary },
  summaryTextRandom: { color: c.brandPrimary },
  chrono: { fontFamily: fonts.display, fontSize: 24, fontWeight: "700", color: c.brandPrimary, fontVariant: ["tabular-nums"] },
  segment: { flexDirection: "row", marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  segBtn: { flex: 1, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segBtnOn: { backgroundColor: c.brandPrimary },
  segText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurfaceTertiary },
  segTextOn: { color: c.onBrandPrimary, fontWeight: "700" },
  setup: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  keyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingVertical: spacing.xs },
  muted: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  warn: { fontFamily: fonts.text, fontSize: 13, color: c.warning },
  runContent: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)", gap: 4 },
  targetRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: spacing.sm },
  big: { fontFamily: fonts.display, fontSize: 30, fontWeight: "700", color: c.onSurface },
  sub: { fontFamily: fonts.display, fontSize: 15, color: c.brandPrimary },
  scope: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: "#34D399" },
  count: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700", color: c.onSurface, fontVariant: ["tabular-nums"] },
  message: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: c.surfaceSecondary },
  messageBad: { backgroundColor: "#2A1203" },
  messageGood: { backgroundColor: "#06281D" },
  messageText: { fontFamily: fonts.text, fontSize: 14, fontWeight: "600", color: c.onSurfaceTertiary, textAlign: "center", flexShrink: 1 },
  messageTextBad: { color: "#F97316" },
  messageTextGood: { color: "#34D399" },
  hint: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary, textAlign: "center" },
  doneWrap: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, gap: spacing.xs },
  doneTime: { fontFamily: fonts.display, fontSize: 56, fontWeight: "700", color: c.onSurface, fontVariant: ["tabular-nums"] },
  recordBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, backgroundColor: c.brandPrimary, marginTop: spacing.sm },
  recordText: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700", color: c.onBrandPrimary },
  primary: { alignSelf: "stretch", marginTop: spacing.lg, height: 56, borderRadius: radius.pill, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  primaryText: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onBrandPrimary },
  secondary: { alignSelf: "stretch", marginTop: spacing.sm, height: 48, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  secondaryText: { fontFamily: fonts.display, fontSize: 15, color: c.onSurface },
  pressed: { opacity: 0.85 },
}));

/** What a level sets, in plain words (shown under the categories). */
function summaryOf(o: ChallengeOptions, nameOf: (pc: number) => string): { text: string; random?: boolean }[] {
  const out: { text: string; random?: boolean }[] = [];
  out.push(o.randomKey ? { text: tr("Tonalité : hasard"), random: true } : { text: tr("Tonalité {k}", { k: nameOf(o.rootPc) }) });
  out.push(o.contextRandom ? { text: tr("Majeur / mineur : hasard"), random: true } : { text: tr(scaleOf(o.scaleId).name) });
  if (o.scope === "neck") out.push({ text: tr("Tout le manche") });
  else if (o.position === -1) out.push({ text: tr("Position : hasard"), random: true });
  else if (o.position === -2) out.push({ text: tr("Positions 1 → 5") });
  else out.push({ text: tr("Position {n}", { n: o.position + 1 }) });
  out.push({ text: o.hideTonic ? tr("Tonique cachée") : tr("Tonique affichée") });
  return out;
}

function DegreeBadge({ num, label }: { num: string; label: string }) {
  const styles = useBadgeStyles();
  const { colors } = useTheme();
  const meta = DEGREE_META[degreeKeyFromNum(Number(num) || 1)];
  return (
    <View style={[styles.badge, { backgroundColor: colors[meta.color] }]}>
      <Text style={[styles.text, { color: colors[meta.on] }]}>{label}</Text>
    </View>
  );
}

const useBadgeStyles = makeStyles(() => ({
  badge: { minWidth: 26, height: 26, paddingHorizontal: 4, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.display, fontSize: 11, fontWeight: "700" },
}));

/** Unfolds its content (height + fade) when `open` turns true, folds it back when false. */
function Unfold({ open, children }: { open: boolean; children: React.ReactNode }) {
  const v = React.useRef(new Animated.Value(open ? 1 : 0)).current;
  const [shown, setShown] = React.useState(open);
  React.useEffect(() => {
    if (open) setShown(true);
    Animated.timing(v, { toValue: open ? 1 : 0, duration: open ? 260 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
      if (finished && !open) setShown(false);
    });
  }, [open, v]);
  if (!shown) return null;
  return (
    <Animated.View
      style={{
        overflow: "hidden",
        opacity: v,
        maxHeight: v.interpolate({ inputRange: [0, 1], outputRange: [0, 600] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
