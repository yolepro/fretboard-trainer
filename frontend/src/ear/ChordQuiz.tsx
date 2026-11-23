import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { SpeakerHigh, X } from "phosphor-react-native";

import { FEEDBACK_MS, playChordNotes, playFeedback, preloadFeedback, preloadNotes, stopChordNotes } from "@/src/audio/sampler";
import { resumeWebAudio } from "@/src/audio/webAudio";
import { ResultView } from "@/src/ear/ResultView";
import { bestKey, formatTime, type Best, type Section } from "@/src/ear/questions";
import { CHORD_LEVELS, type ChordLevel } from "@/src/ear/games";
import { saveAttempt, saveSession } from "@/src/ear/stats";
import { useResultsVersion } from "@/src/results";
import { useSettings } from "@/src/settings";
import { storage } from "@/src/utils/storage";
import { tr } from "@/src/i18n";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

/** Chord qualities the quiz can ask (intervals in semitones from the root). */
export const CHORD_TYPES = [
  { id: "maj", name: "Majeur", symbol: "", formula: "1 · 3 · 5", iv: [0, 4, 7] },
  { id: "min", name: "Mineur", symbol: "m", formula: "1 · ♭3 · 5", iv: [0, 3, 7] },
  { id: "dim", name: "Diminué", symbol: "°", formula: "1 · ♭3 · ♭5", iv: [0, 3, 6] },
  { id: "aug", name: "Augmenté", symbol: "+", formula: "1 · 3 · ♯5", iv: [0, 4, 8] },
  { id: "maj7", name: "Majeur 7", symbol: "∆7", formula: "1 · 3 · 5 · 7", iv: [0, 4, 7, 11] },
  { id: "dom7", name: "Septième", symbol: "7", formula: "1 · 3 · 5 · ♭7", iv: [0, 4, 7, 10] },
  { id: "min7", name: "Mineur 7", symbol: "m7", formula: "1 · ♭3 · 5 · ♭7", iv: [0, 3, 7, 10] },
  { id: "m7b5", name: "Demi-diminué", symbol: "Ø", formula: "1 · ♭3 · ♭5 · ♭7", iv: [0, 3, 6, 10] },
] as const;
type ChordId = (typeof CHORD_TYPES)[number]["id"];

/** Sets of chords to tell apart: the levels of « Reconnais l’accord » (see src/ear/games.ts). */
export const SETS: { id: string; name: string; meta: string; chords: ChordId[] }[] = CHORD_LEVELS.map((g) => ({
  id: g.id,
  name: g.name,
  meta: g.meta,
  chords: g.chords.filter((c): c is ChordId => CHORD_TYPES.some((t) => t.id === c)),
}));
type PlayStyle = "block" | "arp" | "both";
const SECTION: Section = "chords";

type Props = {
  level: ChordLevel; // the level of « Reconnais l’accord » launched from Défis
  count: number;
  onPhase: (phase: "setup" | "running" | "done") => void; // Oreille hides its header while a quiz runs
  onExit: () => void; // back to Oreille's games
  onResults: () => void;
  bottomPad: number;
  topPad: number;
  navInset: number;
};

type Q = { chord: (typeof CHORD_TYPES)[number]; root: number };

/** Oreille › Accords: a chord is played, the player says which kind it is. */
export function ChordQuiz({ level, count, onPhase, onExit, onResults, bottomPad, topPad, navInset }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { settings, nameOf } = useSettings();
  // The choice grid is rebuilt when the screen turns: its wrapped rows kept the old width otherwise (iOS).
  const { width: winW } = useWindowDimensions();
  const setId = level.id;
  const style: PlayStyle = settings.chordStyle; // Réglages › Entraînement
  const [phase, setPhase] = useState<"setup" | "running" | "done">("setup");
  const [q, setQ] = useState<Q | null>(null);
  const [answer, setAnswer] = useState<ChordId | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [finalMs, setFinalMs] = useState(0);
  const [best, setBest] = useState<Best | null>(null);
  const [isRecord, setIsRecord] = useState(false);

  const set = SETS.find((s) => s.id === setId) ?? SETS[0];
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const choices = CHORD_TYPES.filter((c) => set.chords.includes(c.id));
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
  const key = `${bestKey(SECTION, count)}_${setId}`; // records per chord set
  const resultsV = useResultsVersion(); // results erased in Réglages: reload the record

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
  // Launched from the library: the quiz starts at once.
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
  // Leaving the tab stops the quiz (nothing to resume: a question is short).
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

  // A guitar-like close voicing; arpeggio (low → high) then the chord, or one of the two.
  const playChord = (qq: Q, how: PlayStyle = style) => {
    clearTimers();
    const notes = qq.chord.iv.map((i) => qq.root + i);
    const vol = settings.volume * 0.85;
    // Notes ring together (playNote alone is monophonic: each note would cut the previous one).
    const seq: { midi: number; at: number }[] = [];
    let t = 0;
    if (how !== "block") {
      notes.forEach((m, i) => seq.push({ midi: m, at: i * 300 }));
      t = notes.length * 300 + 350;
    }
    if (how !== "arp") notes.forEach((m, i) => seq.push({ midi: m, at: t + i * 30 })); // a light strum
    playChordNotes(seq, vol);
  };

  const ask = (prev?: Q) => {
    let chord = choices[Math.floor(Math.random() * choices.length)];
    if (prev && choices.length > 1 && chord.id === prev.chord.id && Math.random() < 0.6) {
      chord = choices.filter((c) => c.id !== prev.chord.id)[Math.floor(Math.random() * (choices.length - 1))];
    }
    const root = 45 + Math.floor(Math.random() * 12); // A2 … G#3
    const nq = { chord, root };
    setQ(nq);
    setAnswer(null);
    askedAt.current = Date.now();
    playChord(nq);
  };

  const start = () => {
    resumeWebAudio(); // Safari (iPhone): the audio clock only runs after a tap
    preloadFeedback();
    preloadNotes(Array.from({ length: 24 }, (_, i) => 45 + i)); // every note a chord can use
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

  const choose = (id: ChordId) => {
    if (!q || answer) return;
    const ok = id === q.chord.id;
    setAnswer(id);
    resultsRef.current = [...resultsRef.current, ok];
    setResults(resultsRef.current);
    saveAttempt({ t: Date.now(), s: SECTION, key: `c${q.chord.id}`, label: q.chord.name, ms: Date.now() - askedAt.current, errors: ok ? 0 : 2 });
    clearTimers();
    playFeedback(ok ? "success" : "error", settings.volume);
    if (ok) {
      later(stopChordNotes, 450); // let the chord fade before the next one
      later(next, 900);
    }
    else {
      // Wrong: the chrono stops, the right chord is played again (arpeggio then block) to hear the difference.
      pause();
      later(() => playChord(q, "both"), FEEDBACK_MS.error + 150);
    }
  };

  // ---------- running ----------
  if (phase === "running" && q) {
    const done = results.length;
    return (
      <View style={[styles.flex, { paddingTop: topPad }]} testID="chord-quiz-running">
        <View style={[styles.topRow, { paddingRight: navInset + spacing.lg }]}>
          <Text style={styles.label} numberOfLines={1}>
            {tr("Reconnais l’accord")} · {tr(set.name)}
          </Text>
          <Text style={styles.chrono}>{formatTime(elapsed)}</Text>
          <Pressable
            testID="chord-stop"
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
        <View style={styles.dots}>
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={[styles.dot, i < done && { backgroundColor: results[i] ? colors.success : colors.error }, i === done && styles.dotNow]} />
          ))}
        </View>
        <ScrollView key={`run-${Math.round(winW)}`} contentContainerStyle={[styles.runContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
          <Pressable testID="chord-replay" onPress={() => playChord(q)} style={({ pressed }) => [styles.listen, pressed && styles.pressed]}>
            <SpeakerHigh size={40} color={colors.onBrandPrimary} weight="fill" />
          </Pressable>
          <Text style={styles.question}>{answer ? (answer === q.chord.id ? tr("Bravo !") : tr("C’était : {name}", { name: tr(q.chord.name) })) : tr("Quel accord entends-tu ?")}</Text>
          <Text style={styles.hint}>{answer ? `${nameOf(q.root % 12)}${q.chord.symbol} · ${q.chord.formula}` : tr("Touche le haut-parleur pour réécouter")}</Text>
          <View style={styles.grid}>
            {choices.map((c) => {
              const isRight = answer && c.id === q.chord.id;
              const isWrong = answer === c.id && c.id !== q.chord.id;
              return (
                <Pressable
                  key={c.id}
                  testID={`chord-choice-${c.id}`}
                  onPress={() => choose(c.id)}
                  disabled={!!answer}
                  style={({ pressed }) => [styles.choice, isRight && styles.choiceRight, isWrong && styles.choiceWrong, pressed && styles.pressed]}
                >
                  <Text style={[styles.choiceName, (isRight || isWrong) && styles.choiceNameOn]}>{tr(c.name)}</Text>
                  <Text style={[styles.choiceFormula, (isRight || isWrong) && styles.choiceNameOn]}>{c.formula}</Text>
                </Pressable>
              );
            })}
          </View>
          {answer && answer !== q.chord.id ? (
            <View style={styles.reviewRow}>
              <Pressable testID="chord-hear-mine" onPress={() => playChord({ chord: CHORD_TYPES.find((c) => c.id === answer)!, root: q.root }, "both")} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>{tr("Écouter mon choix")}</Text>
              </Pressable>
              <Pressable testID="chord-next" onPress={next} style={({ pressed }) => [styles.primarySmall, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>{tr("Suivant")}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  // ---------- done ----------
  if (phase === "done") {
    return (
      <View style={[styles.flex, { paddingBottom: bottomPad }]}>
        <ResultView
          sectionLabel={`${tr("Reconnais l’accord")} · ${tr(set.name)}`}
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

  return null; // between two games: Oreille shows its library
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  // Same as the family titles of S’exercer (“CHALLENGES”).
  sectionTitle: { fontFamily: fonts.text, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "600", color: c.onSurfaceTertiary, paddingTop: spacing.sm },
  lead: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, lineHeight: 18 },
  intro: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)", gap: 4, marginTop: spacing.xs },
  introTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: "700", color: c.onSurface },
  muted: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, lineHeight: 18 },
  sets: { gap: spacing.sm, paddingVertical: spacing.sm },
  setCard: { borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  setHead: { padding: spacing.md, gap: 2 },
  setBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  countRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  setCardOn: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  setName: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingVertical: spacing.xs },
  primary: { marginTop: spacing.xs, height: 56, borderRadius: radius.pill, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  primarySmall: { flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onBrandPrimary },
  secondary: { flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontFamily: fonts.display, fontSize: 15, color: c.onSurface },
  pressed: { opacity: 0.85 },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingLeft: spacing.lg, height: 52 },
  label: { flex: 1, fontFamily: fonts.display, fontSize: 15, color: c.onSurfaceSecondary },
  chrono: { fontFamily: fonts.display, fontSize: 24, fontWeight: "700", color: c.brandPrimary, fontVariant: ["tabular-nums"] },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", gap: 4, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  dot: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.surfaceTertiary },
  dotNow: { backgroundColor: c.brandPrimary },
  runContent: { paddingHorizontal: spacing.lg, alignItems: "center", gap: spacing.md },
  listen: { width: 120, height: 120, borderRadius: 60, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  question: { fontFamily: fonts.display, fontSize: 22, fontWeight: "700", color: c.onSurface, textAlign: "center" },
  hint: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, textAlign: "center" },
  grid: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choice: { flexBasis: "47%", flexGrow: 1, minHeight: 64, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)", alignItems: "center", justifyContent: "center", gap: 2 },
  choiceRight: { backgroundColor: "#10B981", borderColor: "#10B981" },
  choiceWrong: { backgroundColor: "#B91C1C", borderColor: "#B91C1C" },
  choiceName: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onSurface },
  choiceFormula: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary },
  choiceNameOn: { color: "#FFFFFF" },
  reviewRow: { alignSelf: "stretch", flexDirection: "row", gap: spacing.sm },
}));
