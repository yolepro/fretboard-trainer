import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";
import { ArrowClockwise, CaretLeft, ChartBar, Faders, Microphone, Play, Trophy, X } from "phosphor-react-native";

import { ChallengeNeck } from "@/src/challenge/ChallengeNeck";
import { ChallengeResults } from "@/src/challenge/ChallengeResults";
import {
  DEFAULT_CHALLENGE,
  DEGREE_SCALES,
  SCALE_CHOICES,
  buildRound,
  cellId,
  challengeBestKey,
  challengeSection,
  nextSetting,
  prettyLabel,
  scaleOf,
  type Cell,
  type ChallengeBest,
  type ChallengeKind,
  type ChallengeOptions,
  type Round,
} from "@/src/challenge/rounds";
import { Chip, SectionLabel } from "@/src/components/Chip";
import { KeyButton } from "@/src/components/KeyWheel";
import { LANDSCAPE_NAV_W } from "@/src/components/AppTabBar";
import { StudioBackground } from "@/src/components/StudioBackground";
import { FEEDBACK_MS, playFeedback, preloadFeedback, restorePlaybackMode } from "@/src/audio/sampler";
import { usePitchDetector } from "@/src/audio/usePitchDetector";
import { formatTime } from "@/src/ear/questions";
import { saveAttempt, saveSession } from "@/src/ear/stats";
import type { PitchFrame } from "@/src/music/yin";
import { freqToMidiFloat } from "@/src/music/theory";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { storage } from "@/src/utils/storage";
import { tr } from "@/src/i18n";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Props = { kind: ChallengeKind; onBack: () => void };
type Phase = "setup" | "running" | "done";

const ROUND_CHOICES = [3, 5, 10];
const TITLES: Record<ChallengeKind, string> = { degree: "Trouve le degré", scale: "Trouve la gamme" };

/** “Trouve le degré” / “Trouve la gamme”: fill a position by playing (mic) or touching the notes. */
export function FindChallenge({ kind, onBack }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navInset = width > height && !usesNativeTabs ? LANDSCAPE_NAV_W : 0;
  const bottom = usesNativeTabs ? insets.bottom : 0;
  const { settings, nameOf } = useSettings();

  const [tab, setTab] = useState<"play" | "results">("play");
  const [phase, setPhase] = useState<Phase>("setup");
  const [opts, setOpts] = useState<ChallengeOptions>({ ...DEFAULT_CHALLENGE, degrees: kind === "degree" ? ["3"] : [] });
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

  const optsRef = useRef(opts);
  optsRef.current = opts;
  const roundRef = useRef<Round | null>(null);
  const foundRef = useRef<Cell[]>([]);
  const errorsRef = useRef(0);
  const sinceFindErrors = useRef(0);
  const lastFindAt = useRef(0);
  const startRef = useRef(0);
  const roundIdxRef = useRef(0);
  const busyRef = useRef(false); // between rounds
  const stable = useRef({ midi: -1, count: 0 });
  const ignoreUntil = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const bestKey = challengeBestKey(kind, opts.rounds);
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
    if (phase !== "running") return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [phase]);

  const useMic = opts.input !== "touch" && !micDenied;
  const listening = phase === "running" && useMic && !suspended;

  // Plays a feedback sound; on native the mic pauses meanwhile (iOS lowers the output while recording).
  const sound = (k: "success" | "error") => {
    const vol = settingsRef.current.volume;
    ignoreUntil.current = Date.now() + FEEDBACK_MS[k] + 300;
    if (useMic && Platform.OS !== "web") {
      setSuspended(true);
      later(async () => {
        try {
          await restorePlaybackMode();
        } catch {
          // playback may still work
        }
        playFeedback(k, vol);
      }, 120);
      later(() => setSuspended(false), FEEDBACK_MS[k] + 250);
    } else playFeedback(k, vol);
  };

  const startRound = (idx: number, prev?: { rootPc: number; position: number }) => {
    const set = nextSetting(optsRef.current, prev);
    const r = buildRound(kind, optsRef.current, set.rootPc, set.position);
    roundRef.current = r;
    roundIdxRef.current = idx;
    foundRef.current = [];
    sinceFindErrors.current = 0;
    lastFindAt.current = Date.now();
    stable.current = { midi: -1, count: 0 };
    busyRef.current = false;
    setRound(r);
    setRoundIdx(idx);
    setFound([]);
    setWrong(null);
    setMessage(null);
  };

  const finish = () => {
    const ms = Date.now() - startRef.current;
    const errs = errorsRef.current;
    setFinalMs(ms);
    setPhase("done");
    const o = optsRef.current;
    saveSession({ t: Date.now(), s: challengeSection(kind), count: o.rounds, score: errs, ms });
    const prev = best;
    const better = !prev || ms < prev.timeMs;
    setIsRecord(better);
    if (better) {
      const next = { timeMs: ms, errors: errs, at: Date.now() };
      setBest(next);
      storage.setItem(challengeBestKey(kind, o.rounds), JSON.stringify(next));
    }
  };

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
    setErrors(0);
    setElapsed(0);
    startRef.current = Date.now();
    setPhase("running");
    startRound(0);
  };

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSuspended(false);
    setPhase("setup");
  }, []);

  const onFound = (c: Cell) => {
    const now = Date.now();
    saveAttempt({
      t: now,
      s: challengeSection(kind),
      key: `b${c.string}-${c.fret}`,
      label: c.label,
      sub: optsRef.current.scaleId,
      string: c.string,
      fret: c.fret,
      ms: now - lastFindAt.current,
      errors: Math.min(2, sinceFindErrors.current),
    });
    lastFindAt.current = now;
    sinceFindErrors.current = 0;
    foundRef.current = [...foundRef.current, c];
    setFound(foundRef.current);
    setWrong(null);
    setMessage(null);
    const r = roundRef.current!;
    if (foundRef.current.length >= r.targets.length) {
      busyRef.current = true;
      sound("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const idx = roundIdxRef.current;
      setMessage({ text: tr("Manche réussie !"), bad: false });
      later(() => {
        if (idx + 1 >= optsRef.current.rounds) finish();
        else startRound(idx + 1, { rootPc: r.rootPc, position: r.position });
      }, 1100);
    }
  };

  const onMistake = (id: string | null, text: string, fromTouch: boolean) => {
    errorsRef.current += 1;
    sinceFindErrors.current += 1;
    setErrors(errorsRef.current);
    setWrong(id);
    setMessage({ text, bad: true });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (fromTouch) sound("error");
    later(() => setWrong((w) => (w === id ? null : w)), 700);
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
    const hit = cands.find((c) => left.some((l) => cellId(l) === cellId(c)));
    if (!hit) {
      if (cands.length && foundRef.current.some((f) => cands.some((c) => cellId(c) === cellId(f)))) return; // already found
      onMistake(id, notHere(), fromTouch);
      return;
    }
    if (next && cellId(next) !== cellId(hit)) {
      onMistake(id, tr("Dans l’ordre : du grave vers l’aigu"), fromTouch);
      return;
    }
    onFound(hit);
  };

  const onTouch = (string: number, fret: number) => {
    if (phase !== "running" || opts.input === "mic") return;
    const id = `${string}-${fret}`;
    const r = roundRef.current;
    if (!r) return;
    const cell = r.targets.find((c) => cellId(c) === id);
    tryCells(cell ? [cell] : [], id, true);
  };

  const onFrame = (f: PitchFrame) => {
    if (!f || f.clarity < 0.85 || Date.now() < ignoreUntil.current) {
      stable.current = { midi: -1, count: 0 };
      return;
    }
    const midi = Math.round(freqToMidiFloat(f.freq, settingsRef.current.a4));
    if (stable.current.midi === midi) stable.current.count += 1;
    else stable.current = { midi, count: 1 };
    const r = roundRef.current;
    if (!r) return;
    const cands = r.targets.filter((c) => c.midi === midi);
    if (!cands.length && r.tonics.some((c) => c.midi === midi)) return; // playing the shown tonic to find one's bearings is fine
    if (cands.length && stable.current.count === 3) tryCells(cands, null, false);
    else if (!cands.length && stable.current.count === 6) onMistake(null, notHere(), false);
  };
  usePitchDetector(listening, onFrame);

  // ---------- Views ----------
  const scaleName = tr(scaleOf(opts.scaleId).name).toLowerCase();
  const header = (title: string, onLeft: () => void, icon: "back" | "close") => (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm, paddingRight: navInset + spacing.lg }]}>
      <Pressable testID="challenge-back" onPress={onLeft} style={styles.roundBtn} accessibilityLabel={icon === "back" ? tr("Retour") : tr("Arrêter")}>
        {icon === "back" ? <CaretLeft size={18} color={colors.onSurface} weight="bold" /> : <X size={18} color={colors.onSurface} />}
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {phase === "running" ? <Text style={styles.chrono}>{formatTime(elapsed)}</Text> : null}
    </View>
  );

  if (phase === "running" && round) {
    const pct = round.targets.length ? found.length / round.targets.length : 0;
    const keyName = nameOf(round.rootPc);
    const big = kind === "degree" ? opts.degrees.map(prettyLabel).join(" · ") : `${keyName} ${scaleName}`;
    const prompt = kind === "degree" ? tr("Trouve toutes les notes de degré") : tr("Joue toutes les notes de");
    const sub =
      kind === "degree"
        ? tr("de {key} {scale}", { key: keyName, scale: scaleName })
        : opts.order === "up"
          ? tr("dans l’ordre, du grave vers l’aigu")
          : tr("dans n’importe quel ordre");
    return (
      <View style={styles.screen} testID="find-challenge-running">
        <StudioBackground />
        {header(tr("Manche {i}/{n}", { i: roundIdx + 1, n: opts.rounds }), stop, "close")}
        <ScrollView contentContainerStyle={[styles.runContent, { paddingBottom: bottom + spacing.lg }]} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.muted}>{prompt}</Text>
            <View style={styles.targetRow}>
              <Text style={styles.big}>{big}</Text>
              <Text style={styles.sub}>{sub}</Text>
            </View>
            <Text style={styles.scope}>{tr("Position {n} · cases {a}–{b}", { n: round.position + 1, a: round.min, b: round.max })}</Text>
            <View style={styles.progressRow}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
              <Text style={styles.count}>
                {found.length}/{round.targets.length}
              </Text>
            </View>
          </View>
          <ChallengeNeck min={round.min} max={round.max} found={found} tonics={round.tonics} wrong={wrong} onPress={onTouch} disabled={opts.input === "mic"} />
          <View style={[styles.message, message?.bad && styles.messageBad, message && !message.bad && styles.messageGood]} testID="challenge-message">
            {useMic && !message ? <Microphone size={16} color={colors.onSurfaceTertiary} /> : null}
            <Text style={[styles.messageText, message?.bad && styles.messageTextBad, message && !message.bad && styles.messageTextGood]} numberOfLines={2}>
              {message?.text ??
                (opts.input === "touch" ? tr("Touche les cases du manche") : useMic && opts.input === "both" ? tr("Joue la note ou touche le manche") : tr("Joue la note…"))}
            </Text>
          </View>
          {round.tonics.length ? <Text style={styles.hint}>{tr("Cercles rouges : la tonique, pour te repérer.")}</Text> : null}
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
          <Text style={styles.doneTime}>{formatTime(finalMs)}</Text>
          <Text style={styles.muted}>
            {tr("{n} manches", { n: opts.rounds })} · {tr(errors === 1 ? "{n} erreur" : "{n} erreurs", { n: errors })}
          </Text>
          <Text style={styles.muted}>{best ? tr("Record : {time}", { time: formatTime(best.timeMs) }) : ""}</Text>
          <Pressable testID="challenge-replay" onPress={start} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
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
  const choices = kind === "degree" ? DEGREE_SCALES : SCALE_CHOICES;
  const degreeLabels = scaleOf(opts.scaleId).intervals.map((i) => i.label);
  const toggleDegree = (l: string) => {
    const has = opts.degrees.includes(l);
    if (has && opts.degrees.length === 1) return;
    setOpts({ ...opts, degrees: has ? opts.degrees.filter((x) => x !== l) : [...opts.degrees, l] });
  };
  const pickScale = (id: string) => {
    // Keep the asked degrees that exist in the new scale (3 ↔ b3 follow the change).
    const labels = scaleOf(id).intervals.map((i) => i.label);
    const nums = new Set(opts.degrees.map((l) => l.replace(/[^0-9]/g, "")));
    const degrees = labels.filter((l) => nums.has(l.replace(/[^0-9]/g, "")));
    setOpts({ ...opts, scaleId: id, degrees: kind === "degree" ? (degrees.length ? degrees : [labels[2]]) : opts.degrees });
  };

  return (
    <View style={styles.screen} testID="find-challenge-setup">
      <StudioBackground />
      {header(tr(TITLES[kind]), onBack, "back")}
      <View style={styles.segment}>
        {(["play", "results"] as const).map((k) => (
          <Pressable key={k} testID={`challenge-tab-${k}`} onPress={() => setTab(k)} style={[styles.segBtn, tab === k && styles.segBtnOn]}>
            <Text style={[styles.segText, tab === k && styles.segTextOn]}>{k === "play" ? tr("Jouer") : tr("Résultats")}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "results" ? (
        <ChallengeResults kind={kind} nameOf={nameOf} bottomPad={bottom + spacing.xl} />
      ) : (
        <ScrollView contentContainerStyle={[styles.setup, { paddingBottom: bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
          <View style={styles.keyRow}>
            {!opts.randomKey ? <KeyButton rootPc={opts.rootPc} nameOf={nameOf} onChange={(pc) => setOpts({ ...opts, rootPc: pc })} testID="challenge-key" /> : null}
            <Chip testID="challenge-random-key" label={tr("Tonalité au hasard")} selected={opts.randomKey} onPress={() => setOpts({ ...opts, randomKey: !opts.randomKey })} />
          </View>

          <SectionLabel>{kind === "degree" ? tr("Tonalité") : tr("Gamme")}</SectionLabel>
          <View style={styles.wrap}>
            {choices.map((id) => (
              <Chip key={id} testID={`challenge-scale-${id}`} label={tr(scaleOf(id).name)} selected={opts.scaleId === id} onPress={() => pickScale(id)} />
            ))}
          </View>

          {kind === "degree" ? (
            <>
              <SectionLabel>{tr("Degrés à trouver (plusieurs possibles)")}</SectionLabel>
              <View style={styles.wrap}>
                {degreeLabels.map((l) => (
                  <Chip key={l} testID={`challenge-degree-${l}`} label={l === "1" ? tr("Tonique (1)") : prettyLabel(l)} selected={opts.degrees.includes(l)} onPress={() => toggleDegree(l)} />
                ))}
              </View>
            </>
          ) : (
            <>
              <SectionLabel>{tr("Ordre")}</SectionLabel>
              <View style={styles.wrap}>
                <Chip testID="challenge-order-free" label={tr("Libre")} selected={opts.order === "free"} onPress={() => setOpts({ ...opts, order: "free" })} />
                <Chip testID="challenge-order-up" label={tr("Montant (grave → aigu)")} selected={opts.order === "up"} onPress={() => setOpts({ ...opts, order: "up" })} />
              </View>
            </>
          )}

          <SectionLabel>{tr("Position")}</SectionLabel>
          <View style={styles.wrap}>
            {[0, 1, 2, 3, 4].map((p) => (
              <Chip key={p} testID={`challenge-pos-${p}`} label={tr("Pos. {n}", { n: p + 1 })} selected={opts.position === p} onPress={() => setOpts({ ...opts, position: p })} />
            ))}
            <Chip testID="challenge-pos-random" label={tr("Au hasard")} selected={opts.position < 0} onPress={() => setOpts({ ...opts, position: -1 })} />
          </View>

          <SectionLabel>{tr("Manches")}</SectionLabel>
          <View style={styles.wrap}>
            {ROUND_CHOICES.map((n) => (
              <Chip key={n} testID={`challenge-rounds-${n}`} label={String(n)} selected={opts.rounds === n} onPress={() => setOpts({ ...opts, rounds: n })} />
            ))}
          </View>

          <SectionLabel>{tr("Répondre")}</SectionLabel>
          <View style={styles.wrap}>
            <Chip testID="challenge-input-both" label={tr("Les deux")} selected={opts.input === "both"} onPress={() => setOpts({ ...opts, input: "both" })} />
            <Chip testID="challenge-input-mic" label={tr("Guitare (micro)")} selected={opts.input === "mic"} onPress={() => setOpts({ ...opts, input: "mic" })} />
            <Chip testID="challenge-input-touch" label={tr("Toucher l’écran")} selected={opts.input === "touch"} onPress={() => setOpts({ ...opts, input: "touch" })} />
          </View>
          {micDenied && opts.input !== "touch" ? <Text style={styles.warn}>{tr("Micro indisponible : réponds en touchant le manche.")}</Text> : null}
          {best ? <Text style={styles.muted}>{tr("Record ({n} manches) : {time}", { n: opts.rounds, time: formatTime(best.timeMs) })}</Text> : null}

          <Pressable testID="challenge-start" onPress={start} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Play size={22} color={colors.onBrandPrimary} weight="fill" />
            <Text style={styles.primaryText}>{tr("Démarrer le challenge")}</Text>
          </Pressable>
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
