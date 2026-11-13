import React from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Play, Trophy } from "phosphor-react-native";

import { Chip, ChipRow, SectionLabel } from "@/src/components/Chip";
import { SCALES, STRING_LABELS } from "@/src/music/theory";
import {
  LEVEL_LABELS,
  SECTIONS,
  formatTime,
  intervalName,
  intervalsForLevel,
  scaleIntervals,
  type Best,
  type Options,
  type Section,
} from "@/src/ear/questions";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Props = {
  section: Section;
  onSection: (s: Section) => void;
  opts: Options;
  setOpts: (o: Options) => void;
  best: Best | null;
  onStart: () => void;
  perm: "unknown" | "granted" | "ask" | "blocked";
  error: string | null;
  bottomPad: number;
};

const COUNTS = [5, 10, 20];

export function SetupPanel({ section, onSection, opts, setOpts, best, onStart, perm, error, bottomPad }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const meta = SECTIONS.find((s) => s.id === section)!;

  const toggleString = (s: number) => {
    const has = opts.strings.includes(s);
    if (has && opts.strings.length === 1) return;
    setOpts({ ...opts, strings: has ? opts.strings.filter((x) => x !== s) : [...opts.strings, s] });
  };
  const toggleInterval = (label: string) => {
    const has = opts.intervals.includes(label);
    if (has && opts.intervals.length === 1) return;
    setOpts({ ...opts, intervals: has ? opts.intervals.filter((x) => x !== label) : [...opts.intervals, label] });
  };

  return (
    <View style={styles.flex}>
      <ChipRow testID="ear-section-selector">
        {SECTIONS.map((s) => (
          <Chip key={s.id} testID={`ear-section-${s.id}`} label={s.label} selected={section === s.id} onPress={() => onSection(s.id)} />
        ))}
      </ChipRow>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + spacing.xl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard} testID="ear-section-intro">
          <Text style={styles.introTitle}>{meta.label}</Text>
          <Text style={styles.introText}>{meta.desc}</Text>
          <Text style={styles.introText}>Chrono global · 2 chances par note</Text>
          <View style={styles.bestRow} testID="ear-best">
            <Trophy size={16} color={colors.degree7th} weight="fill" />
            <Text style={styles.bestText}>
              {best ? `Record : ${best.score} note${best.score > 1 ? "s" : ""} en ${formatTime(best.timeMs)}` : "Pas encore de record"}
            </Text>
          </View>
        </View>

        <SectionLabel>Nombre de notes</SectionLabel>
        <View style={styles.wrapRow}>
          {COUNTS.map((n) => (
            <Chip key={n} testID={`ear-count-${n}`} label={`${n} notes`} selected={opts.count === n} onPress={() => setOpts({ ...opts, count: n })} />
          ))}
        </View>

        {section === "board" ? (
          <>
            <SectionLabel>Cordes</SectionLabel>
            <View style={styles.wrapRow}>
              {[5, 4, 3, 2, 1, 0].map((s) => (
                <Chip key={s} testID={`ear-string-${s}`} label={`${s + 1} · ${STRING_LABELS[s]}`} selected={opts.strings.includes(s)} onPress={() => toggleString(s)} />
              ))}
            </View>
          </>
        ) : null}

        {section === "interval" ? (
          <>
            <SectionLabel>Gamme</SectionLabel>
            <ChipRow testID="ear-scale-selector">
              {SCALES.map((s) => (
                <Chip
                  key={s.id}
                  testID={`ear-scale-${s.id}`}
                  label={s.name}
                  selected={opts.scaleId === s.id}
                  onPress={() => setOpts({ ...opts, scaleId: s.id, intervals: intervalsForLevel(s.id, opts.level) })}
                />
              ))}
            </ChipRow>
            <SectionLabel>Difficulté</SectionLabel>
            <View style={styles.wrapRow}>
              {LEVEL_LABELS.map((l, i) => (
                <Chip
                  key={l}
                  testID={`ear-level-${i + 1}`}
                  label={l}
                  selected={opts.level === i + 1}
                  onPress={() => setOpts({ ...opts, level: i + 1, intervals: intervalsForLevel(opts.scaleId, i + 1) })}
                />
              ))}
            </View>
            <SectionLabel>Intervalles en jeu</SectionLabel>
            <View style={styles.wrapRow}>
              {scaleIntervals(opts.scaleId).map((iv) => (
                <Chip
                  key={iv.label}
                  testID={`ear-interval-${iv.label}`}
                  label={`${intervalName(iv.label)} (${iv.label})`}
                  selected={opts.intervals.includes(iv.label)}
                  onPress={() => toggleInterval(iv.label)}
                />
              ))}
            </View>
          </>
        ) : null}

        {perm === "blocked" ? (
          <View style={styles.permCard} testID="mic-blocked-card">
            <Text style={styles.permTitle}>Micro bloqué</Text>
            <Text style={styles.permText}>Autorise le micro dans les réglages pour que l’app entende ta guitare.</Text>
            {Platform.OS !== "web" ? (
              <Pressable testID="open-settings-button" onPress={() => Linking.openSettings()} style={styles.permBtn}>
                <Text style={styles.permBtnText}>Ouvrir les réglages</Text>
              </Pressable>
            ) : null}
          </View>
        ) : perm !== "granted" ? (
          <Text style={styles.note} testID="mic-permission-note">
            Le micro analyse ta guitare directement sur l’appareil. Rien n’est enregistré.
          </Text>
        ) : null}
        {error && error !== "denied" ? (
          <Text style={styles.error} testID="mic-error">Micro indisponible : {error}</Text>
        ) : null}

        <Pressable testID="start-challenge-button" onPress={onStart} style={({ pressed }) => [styles.startBtn, pressed && styles.pressed]}>
          <Play size={22} color={colors.onBrandPrimary} weight="fill" />
          <Text style={styles.startText}>Démarrer le challenge</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  content: { paddingTop: spacing.xs },
  introCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    gap: 4,
  },
  introTitle: { fontFamily: fonts.display, fontSize: 22, fontWeight: "700", color: c.onSurface },
  introText: { fontFamily: fonts.text, fontSize: 14, color: c.onSurfaceTertiary },
  bestRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  bestText: { fontFamily: fonts.display, fontSize: 13, color: c.onSurfaceSecondary },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  permCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.brandTertiary },
  permTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onBrandTertiary },
  permText: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, marginTop: 4 },
  permBtn: { marginTop: spacing.sm, height: 44, borderRadius: radius.pill, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  permBtnText: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700", color: c.onBrandPrimary },
  note: { fontFamily: fonts.text, fontSize: 12, color: c.muted, marginHorizontal: spacing.lg, marginTop: spacing.md },
  error: { fontFamily: fonts.text, fontSize: 12, color: c.error, marginHorizontal: spacing.lg, marginTop: spacing.sm },
  startBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: c.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  startText: { fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onBrandPrimary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
}));
