import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SpeakerHigh, X } from "phosphor-react-native";

import { Fretboard, fitScale, type ChordMark } from "@/src/components/Fretboard";
import { FEEDBACK_MS, playChordNotes, playFeedback, playNote, preloadFeedback, preloadNotes, stopChordNotes } from "@/src/audio/sampler";
import { resumeWebAudio } from "@/src/audio/webAudio";
import { ResultView } from "@/src/ear/ResultView";
import { bestKey, formatTime, type Best, type Section } from "@/src/ear/questions";
import { INTERVAL_LEVELS, type QuizLevel } from "@/src/ear/games";
import { INTERVALS, intervalById, intervalSub, intervalTitle, placeInterval, type IntervalId, type Spot } from "@/src/ear/intervals";
import { saveAttempt, saveSession } from "@/src/ear/stats";
import { cellKey, type BoxWindow, type DegreeKey, type IntervalDef } from "@/src/music/theory";
import { useResultsVersion } from "@/src/results";
import { useSettings } from "@/src/settings";
import { storage } from "@/src/utils/storage";
import { tr } from "@/src/i18n";
import { useLeaveGuard } from "@/src/tabNav";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const SECTION: Section = "interval";
const NOTE_GAP = 650; // ms between the two notes of the arpeggio
const NO_DEGREES = new Map<number, IntervalDef>();
const NO_LAYERS = new Set<DegreeKey>();

type Props = {
  level: QuizLevel; // the level of « Reconnais l’intervalle » launched from Défis
  count: number;
  onPhase: (phase: "setup" | "running" | "done") => void;
  onExit: () => void;
  onResults: () => void;
  bottomPad: number;
  topPad: number;
  navInset: number;
};

type Q = { id: IntervalId; down: boolean; root: Spot; other: Spot };

/** Défis › Reconnais l’intervalle (FS-38): two notes are played and shown on the neck, the player names the interval. */
export function IntervalQuiz({ level, count, onPhase, onExit, onResults, bottomPad, topPad, navInset }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { settings, nameOf } = useSettings();
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availW = winW - insets.left - insets.right; // the Défis screen keeps the safe-area margins
  const lvl = INTERVAL_LEVELS.find((l) => l.id === level.id) ?? INTERVAL_LEVELS[0];
  const choices = INTERVALS.filter((i) => (lvl.intervals ?? []).includes(i.id));
  const [phase, setPhase] = useState<"setup" | "running" | "done">("setup");
  const [q, setQ] = useState<Q | null>(null);
  const [answer, setAnswer] = useState<IntervalId | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [finalMs, setFinalMs] = useState(0);
  const [best, setBest] = useState<Best | null>(null);
  const [isRecord, setIsRecord] = useState(false);
  const [sideH, setSideH] = useState(0); // landscape: the height of the choices column (the buttons fill it)

  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const startRef = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const askedAt = useRef(0);
  const resultsRef = useRef<boolean[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const key = `${bestKey(SECTION, count)}_${lvl.id}`; // records per level
  const resultsV = useResultsVersion();

  useEffect(() => {
    storage.getItem(key, null).then((v) => {
      try {
        setBest(typeof v === "string" ? (JSON.parse(v) as Best) : null);
      } catch {
        setBest(null);
      }
    });
  }, [key, phase, resultsV]);
  useEffect(() => onPhase(phase), [phase, onPhase]);
  useEffect(() => {
    start();
    return () => {
      clearTimers();
      stopChordNotes();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      if (pausedAt.current === null) setElapsed(Date.now() - startRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [phase]);
  useFocusEffect(
    React.useCallback(
      () => () => {
        clearTimers();
        stopChordNotes();
        exitRef.current();
      },
      [],
    ),
  );

  const pause = () => {
    if (pausedAt.current === null) pausedAt.current = Date.now();
  };
  const resume = () => {
    if (pausedAt.current === null) return;
    startRef.current += Date.now() - pausedAt.current;
    pausedAt.current = null;
  };
  useLeaveGuard(phase === "running", {
    pause: () => {
      pause();
      stopChordNotes();
    },
    resume,
    quit: () => {
      clearTimers();
      exitRef.current();
    },
  });

  /** The interval as an arpeggio: the root, then the other note (then both together, to hear the colour). */
  const playInterval = (a: number, b: number, together = false) => {
    stopChordNotes();
    const vol = settings.volume * 0.9;
    const seq = [
      { midi: a, at: 0 },
      { midi: b, at: NOTE_GAP },
    ];
    if (together) seq.push({ midi: a, at: 2 * NOTE_GAP + 250 }, { midi: b, at: 2 * NOTE_GAP + 270 });
    playChordNotes(seq, vol);
  };
  const playQ = (qq: Q, together = false) => playInterval(qq.root.midi, qq.other.midi, together);

  const ask = (prev?: Q) => {
    let iv = choices[Math.floor(Math.random() * choices.length)];
    if (prev && choices.length > 1 && iv.id === prev.id && Math.random() < 0.7) {
      const others = choices.filter((c) => c.id !== prev.id);
      iv = others[Math.floor(Math.random() * others.length)];
    }
    const down = !!lvl.down && Math.random() < 0.5;
    const nq: Q = { id: iv.id, down, ...placeInterval(iv.semi, down) };
    setQ(nq);
    setAnswer(null);
    askedAt.current = Date.now();
    later(() => playQ(nq), 250); // played as soon as the question shows
  };

  const start = () => {
    resumeWebAudio();
    preloadFeedback();
    preloadNotes(Array.from({ length: 50 }, (_, i) => 40 + i));
    clearTimers();
    resultsRef.current = [];
    setResults([]);
    setElapsed(0);
    pausedAt.current = null;
    startRef.current = Date.now();
    setPhase("running");
    ask();
  };

  const finish = () => {
    resume();
    const ms = Date.now() - startRef.current;
    const score = resultsRef.current.filter(Boolean).length;
    setFinalMs(ms);
    setPhase("done");
    saveSession({ t: Date.now(), s: SECTION, count, score, ms });
    const better = !best || score > best.score || (score === best.score && ms < best.timeMs);
    setIsRecord(better);
    if (better) {
      const next = { score, timeMs: ms, at: Date.now() };
      setBest(next);
      storage.setItem(key, JSON.stringify(next));
    }
  };

  const next = () => {
    resume();
    if (resultsRef.current.length >= count) finish();
    else ask(q ?? undefined);
  };

  const choose = (id: IntervalId) => {
    if (!q || answer) return;
    const ok = id === q.id;
    setAnswer(id);
    resultsRef.current = [...resultsRef.current, ok];
    setResults(resultsRef.current);
    saveAttempt({ t: Date.now(), s: SECTION, key: `i${q.id}`, label: q.id, ms: Date.now() - askedAt.current, errors: ok ? 0 : 2 });
    clearTimers();
    playFeedback(ok ? "success" : "error", settings.volume);
    if (ok) later(next, 1000);
    else {
      // Wrong: the chrono stops, the right interval is played again (notes, then together).
      pause();
      later(() => playQ(q, true), FEEDBACK_MS.error + 150);
    }
  };

  // The neck: the root (1) and the other note (? until answered).
  const neck = useMemo(() => {
    if (!q) return null;
    const marks = new Map<string, ChordMark>();
    marks.set(cellKey(q.root.string, q.root.fret), { kind: "played", degree: "root", label: "1" });
    marks.set(cellKey(q.other.string, q.other.fret), { kind: "played", degree: answer ? "third" : "fifth", label: answer ? intervalById(q.id).label : "?" });
    const frets = [q.root.fret, q.other.fret];
    const window: BoxWindow = { min: Math.min(...frets), max: Math.max(...frets), cells: new Set([cellKey(q.root.string, q.root.fret), cellKey(q.other.string, q.other.fret)]) };
    return { marks, window };
  }, [q, answer]);

  // ---------- running ----------
  if (phase === "running" && q && neck) {
    const done = results.length;
    const right = answer === q.id;
    const landscape = winW > winH;
    // Many choices (Expert: 12) or landscape: smaller buttons, 3 columns, so everything fits without scrolling.
    const compact = landscape || choices.length > 8;
    const sideW = landscape ? Math.round(Math.min(420, Math.max(240, (availW - navInset) * 0.4))) : 0;
    const leftW = landscape ? availW - navInset - sideW - 3 * spacing.lg : availW - 2 * spacing.lg;
    const cols = landscape ? (choices.length > 8 ? 3 : 2) : compact ? 3 : 2;
    // Widths in pixels: a percentage inside a ScrollView is not resolved on iPhone (each button took the full width).
    const gridW = landscape ? sideW : leftW;
    const itemW = Math.floor((gridW - (cols - 1) * spacing.sm) / cols);
    // Landscape: the buttons share the whole height of the column, top to bottom.
    const rows = Math.ceil(choices.length / cols);
    const fillH = landscape && sideH ? Math.max(40, Math.min(110, Math.floor((sideH - (rows - 1) * spacing.sm) / rows))) : 0;

    const neckView = (
      <View style={landscape ? null : styles.bleed}>
        <Fretboard
          fretScale={landscape ? fitScale(leftW, 12) : winW > 700 ? fitScale(leftW + 2 * spacing.lg, 15) : 1}
          rowH={landscape ? 24 : 30}
          degreeMap={NO_DEGREES}
          visibleLayers={NO_LAYERS}
          labelMode="degree"
          showNeutral={false}
          nameOf={nameOf}
          onNotePress={(midi) => playNote(midi, settings.volume)}
          windowRange={neck.window}
          marks={neck.marks}
        />
      </View>
    );
    const askRow = (
      <View style={styles.askRow}>
        <Pressable
          testID="interval-replay"
          onPress={() => playQ(q)}
          style={({ pressed }) => [styles.listen, compact && styles.listenCompact, pressed && styles.pressed]}
          accessibilityLabel={tr("Réécouter")}
        >
          <SpeakerHigh size={compact ? 22 : 28} color={colors.onBrandPrimary} weight="fill" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.question, compact && styles.questionCompact]}>
            {answer ? (right ? tr("Bravo !") : tr("C’était : {name}", { name: intervalTitle(q.id) })) : tr("Quel intervalle entends-tu ?")}
          </Text>
          <Text style={styles.hint} numberOfLines={2}>
            {answer
              ? `${nameOf(q.root.midi % 12)} → ${nameOf(q.other.midi % 12)} · ${q.down ? tr("en descendant") : tr("en montant")}`
              : lvl.down
                ? tr("1 = la note jouée en premier · le ? peut être plus grave ou plus aigu")
                : tr("1 = la note jouée en premier · touche le haut-parleur pour réécouter")}
          </Text>
        </View>
      </View>
    );
    const grid = (
      <View style={styles.grid}>
        {choices.map((c) => {
          const isRight = !!answer && c.id === q.id;
          const isWrong = answer === c.id && c.id !== q.id;
          return (
            <Pressable
              key={c.id}
              testID={`interval-choice-${c.id}`}
              onPress={() => choose(c.id)}
              disabled={!!answer}
              style={({ pressed }) => [styles.choice, { width: itemW }, compact && styles.choiceCompact, fillH ? { height: fillH, minHeight: 0 } : null, isRight && styles.choiceRight, isWrong && styles.choiceWrong, pressed && styles.pressed]}
            >
              <Text style={[styles.choiceName, compact && !(fillH > 60) && styles.choiceNameCompact, (isRight || isWrong) && styles.choiceNameOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {intervalTitle(c.id)}
              </Text>
              <Text style={[styles.choiceSub, compact && styles.choiceSubCompact, (isRight || isWrong) && styles.choiceNameOn]} numberOfLines={1}>
                {intervalSub(c.id)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
    const review =
      answer && !right ? (
        <View style={styles.reviewRow}>
          <Pressable
            testID="interval-hear-mine"
            onPress={() => playInterval(q.root.midi, q.root.midi + (q.down ? -1 : 1) * intervalById(answer).semi, true)}
            style={({ pressed }) => [styles.secondary, compact && styles.btnCompact, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>{tr("Écouter mon choix")}</Text>
          </Pressable>
          <Pressable testID="interval-next" onPress={next} style={({ pressed }) => [styles.primarySmall, compact && styles.btnCompact, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>{tr("Suivant")}</Text>
          </Pressable>
        </View>
      ) : null;

    return (
      <View style={[styles.flex, { paddingTop: topPad }]} testID="interval-quiz-running">
        <View style={[styles.topRow, landscape && styles.topRowCompact, { paddingRight: navInset + spacing.lg }]}>
          <Text style={styles.label} numberOfLines={1}>
            {tr("Reconnais l’intervalle")} · {tr(lvl.name)}
          </Text>
          <Text style={styles.chrono}>{formatTime(elapsed)}</Text>
          <Pressable
            testID="interval-stop"
            onPress={() => {
              clearTimers();
              stopChordNotes();
              onExit();
            }}
            style={styles.roundBtn}
            accessibilityLabel={tr("Arrêter")}
          >
            <X size={18} color={colors.onSurface} />
          </Pressable>
        </View>
        <View style={[styles.dots, landscape && { paddingRight: navInset + spacing.lg }]}>
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={[styles.dot, i < done && { backgroundColor: results[i] ? colors.success : colors.error }, i === done && styles.dotNow]} />
          ))}
        </View>
        {landscape ? (
          // Landscape: the neck and the question on the left, the choices on the side.
          <View style={[styles.sideRow, { paddingRight: navInset + spacing.lg, paddingBottom: bottomPad }]}>
            <View style={{ width: leftW, gap: spacing.sm }}>
              {neckView}
              {askRow}
              {review}
            </View>
            <View style={{ width: sideW, flex: 0 }} onLayout={(e) => setSideH(e.nativeEvent.layout.height)} testID="interval-choices-side">
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {grid}
              </ScrollView>
            </View>
          </View>
        ) : (
          <ScrollView key={`run-${Math.round(winW)}`} contentContainerStyle={[styles.runContent, compact && styles.runContentCompact, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
            {neckView}
            {askRow}
            {grid}
            {review}
          </ScrollView>
        )}
      </View>
    );
  }

  // ---------- done ----------
  if (phase === "done") {
    return (
      <View style={[styles.flex, { paddingBottom: bottomPad }]}>
        <ResultView
          sectionLabel={`${tr("Reconnais l’intervalle")} · ${tr(lvl.name)}`}
          score={results.filter(Boolean).length}
          count={count}
          timeMs={finalMs}
          best={best}
          isRecord={isRecord}
          onReplay={start}
          replayLabel={tr("Rejouer")}
          progress={null}
          nameOf={nameOf}
          onSetup={onExit}
          onResults={onResults}
        />
      </View>
    );
  }

  return null;
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingLeft: spacing.lg, height: 52 },
  topRowCompact: { height: 46 },
  sideRow: { flex: 1, flexDirection: "row", gap: spacing.lg, paddingLeft: spacing.lg },
  label: { flex: 1, fontFamily: fonts.display, fontSize: 15, color: c.onSurfaceSecondary },
  chrono: { fontFamily: fonts.display, fontSize: 24, fontWeight: "700", color: c.brandPrimary, fontVariant: ["tabular-nums"] },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", gap: 4, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  dot: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.surfaceTertiary },
  dotNow: { backgroundColor: c.brandPrimary },
  runContent: { paddingHorizontal: spacing.lg, gap: spacing.md },
  runContentCompact: { gap: spacing.sm },
  bleed: { marginHorizontal: -spacing.lg },
  askRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  listen: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  listenCompact: { width: 48, height: 48, borderRadius: 24 },
  question: { fontFamily: fonts.display, fontSize: 20, fontWeight: "700", color: c.onSurface },
  questionCompact: { fontSize: 17 },
  hint: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choice: { minHeight: 58, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)", alignItems: "center", justifyContent: "center", gap: 2 },
  choiceRight: { backgroundColor: "#10B981", borderColor: "#10B981" },
  choiceWrong: { backgroundColor: "#B91C1C", borderColor: "#B91C1C" },
  choiceCompact: { minHeight: 44, paddingVertical: 4, paddingHorizontal: 6, borderRadius: radius.sm, gap: 0 },
  choiceName: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface },
  choiceNameCompact: { fontSize: 14 },
  choiceSub: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary },
  choiceSubCompact: { fontSize: 10.5 },
  btnCompact: { height: 40 },
  choiceNameOn: { color: "#FFFFFF" },
  reviewRow: { flexDirection: "row", gap: spacing.sm },
  primarySmall: { flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onBrandPrimary },
  secondary: { flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontFamily: fonts.display, fontSize: 15, color: c.onSurface },
  pressed: { opacity: 0.85 },
}));
