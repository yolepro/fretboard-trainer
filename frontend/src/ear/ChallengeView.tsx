import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { SkipForward, SpeakerHigh, X } from "phosphor-react-native";

import { DEGREE_META, octaveOf, pcOf } from "@/src/music/theory";
import { formatTime, type Question } from "@/src/ear/questions";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export type Feedback = { kind: "correct" | "wrong" | "miss"; text: string } | null;

type Props = {
  sectionLabel: string;
  question: Question;
  index: number;
  count: number;
  results: boolean[];
  elapsedMs: number;
  feedback: Feedback;
  revealed: boolean;
  detected: { midi: number; cents: number } | null;
  micText: string;
  listening: boolean;
  nameOf: (pc: number) => string;
  onReplay: () => void;
  onSkip: () => void;
  onStop: () => void;
};

const DIAL = 250;

export function ChallengeView(p: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const q = p.question;

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (p.listening) pulse.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
    else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [p.listening, pulse]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.12 }] }));

  const degreeColor = q.degree ? colors[DEGREE_META[q.degree].color] : colors.success;
  const accent =
    p.feedback?.kind === "correct" ? degreeColor : p.feedback?.kind ? colors.error : p.listening ? colors.brandPrimary : colors.borderStrong;
  const cents = p.detected ? Math.max(-50, Math.min(50, p.detected.cents)) : 0;
  const inTune = p.detected && Math.abs(p.detected.cents) <= 10;

  return (
    <View style={styles.wrap} testID="challenge-view">
      <View style={styles.topRow}>
        <Text style={styles.section}>{p.sectionLabel}</Text>
        <Text style={styles.chrono} testID="challenge-chrono">{formatTime(p.elapsedMs)}</Text>
        <Pressable testID="challenge-stop-button" onPress={p.onStop} style={styles.stopBtn} hitSlop={6}>
          <X size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.progressRow}>
        <View style={styles.dots}>
          {Array.from({ length: p.count }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < p.results.length && { backgroundColor: p.results[i] ? colors.success : colors.error },
                i === p.index && i >= p.results.length && styles.dotCurrent,
              ]}
            />
          ))}
        </View>
        <Text style={styles.progressText} testID="challenge-progress">
          {Math.min(p.index + 1, p.count)}/{p.count}
        </Text>
      </View>

      <View style={styles.dialWrap}>
        <Animated.View style={[styles.ring, { borderColor: accent }, ringStyle]} />
        <View style={[styles.dial, { borderColor: accent }]} testID="challenge-target">
          <Text style={styles.prompt} numberOfLines={1}>{q.prompt}</Text>
          <Text
            style={[styles.big, q.big.length > 7 && styles.bigLong, p.feedback?.kind === "correct" && { color: degreeColor }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            testID="challenge-target-name"
          >
            {q.hidden && !p.revealed ? "?" : q.big}
          </Text>
          {q.badge ? (
            <View style={[styles.badge, { backgroundColor: degreeColor }]}>
              <Text style={[styles.badgeText, { color: q.degree ? colors[DEGREE_META[q.degree].on] : colors.onSuccess }]}>{q.badge}</Text>
            </View>
          ) : null}
          <Text style={styles.sub} numberOfLines={2} testID="challenge-target-sub">{q.sub}</Text>
          <Text style={styles.detected} testID="detected-note">
            {p.detected ? `Tu joues ${p.nameOf(pcOf(p.detected.midi))}${octaveOf(p.detected.midi)}` : p.micText}
          </Text>
        </View>
      </View>

      <View style={styles.meter} testID="cents-meter">
        <View style={styles.meterTrack} />
        <View style={styles.meterCenter} />
        <View style={[styles.needle, { left: `${50 + cents}%`, backgroundColor: p.detected ? (inTune ? colors.success : colors.warning) : colors.muted }]} />
      </View>

      <View style={[styles.feedback, p.feedback && { borderColor: accent }]} testID="quiz-feedback">
        <Text style={[styles.feedbackText, { color: p.feedback ? accent : colors.muted }]} numberOfLines={2}>
          {p.feedback?.text ?? "Joue la note sur ta guitare"}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable testID="replay-button" onPress={p.onReplay} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
          <SpeakerHigh size={20} color={colors.onSurface} />
          <Text style={styles.actionText}>{q.playMidi !== q.targetMidi ? "Tonique" : "Écouter"}</Text>
        </Pressable>
        <Pressable testID="skip-button" onPress={p.onSkip} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
          <SkipForward size={20} color={colors.onSurface} />
          <Text style={styles.actionText}>Passer</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { flex: 1, paddingHorizontal: spacing.lg },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, height: 48 },
  section: { flex: 1, fontFamily: fonts.display, fontSize: 15, color: c.onSurfaceTertiary },
  chrono: { fontFamily: fonts.display, fontSize: 26, fontWeight: "700", color: c.brandPrimary, fontVariant: ["tabular-nums"] },
  stopBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 28 },
  dots: { flex: 1, flexDirection: "row", gap: 4 },
  dot: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.surfaceTertiary },
  dotCurrent: { backgroundColor: c.brandPrimary },
  progressText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurface, minWidth: 44, textAlign: "right" },
  dialWrap: { height: DIAL + 24, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  ring: { position: "absolute", width: DIAL, height: DIAL, borderRadius: DIAL / 2, borderWidth: 3 },
  dial: {
    width: DIAL,
    height: DIAL,
    borderRadius: DIAL / 2,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceSecondary,
    paddingHorizontal: spacing.lg,
    gap: 2,
  },
  prompt: { fontFamily: fonts.text, fontSize: 14, color: c.onSurfaceTertiary },
  big: { fontFamily: fonts.display, fontSize: 60, fontWeight: "700", color: c.onSurface, textAlign: "center" },
  bigLong: { fontSize: 30 },
  badge: { paddingHorizontal: spacing.md, height: 26, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700" },
  sub: { fontFamily: fonts.display, fontSize: 15, color: c.brandPrimary, textAlign: "center" },
  detected: { fontFamily: fonts.text, fontSize: 12, color: c.muted, marginTop: 4 },
  meter: { height: 24, marginHorizontal: spacing.xl },
  meterTrack: { position: "absolute", top: 10, left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: c.surfaceTertiary },
  meterCenter: { position: "absolute", top: 4, left: "50%", width: 2, marginLeft: -1, height: 16, backgroundColor: c.onSurfaceTertiary },
  needle: { position: "absolute", top: 2, width: 6, marginLeft: -3, height: 20, borderRadius: 3 },
  feedback: {
    minHeight: 52,
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    backgroundColor: c.surfaceSecondary,
  },
  feedbackText: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: c.surfaceTertiary,
  },
  actionText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurface },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
}));
