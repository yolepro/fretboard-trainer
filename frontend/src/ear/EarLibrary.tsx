import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { HandPointing, Microphone } from "phosphor-react-native";

import { Chip } from "@/src/components/Chip";
import { FamilyTitle, GameCard, GameLink, OptionSheet, Segment, type OptionSheetDef, type Pill } from "@/src/components/GameCard";
import { DEFI_FAMILIES, EAR_GAMES, countsOf, type ChordLevel, type EarGame, type EarSetting } from "@/src/ear/games";
import { LEVEL_LABELS, bestKey, formatTime, intervalName, intervalsForLevel, scaleIntervals, type Best, type Options, type Section } from "@/src/ear/questions";
import { SCALES, STRING_LABELS } from "@/src/music/theory";
import { useResultsVersion } from "@/src/results";
import { storage } from "@/src/utils/storage";
import { tr } from "@/src/i18n";
import { useRevealOnOpen } from "@/src/components/useRevealOnOpen";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

/** Record key of a Défis game (micro: per game id; Accords: per level). */
export const earBestKey = (g: EarGame, count: number, levelId?: string) =>
  g.levels ? `${bestKey(g.section ?? "chords", count)}_${levelId ?? g.levels[0]?.id}` : bestKey(g.id as Section, count);

/** How the player answers: micro, touch, or both (small icons on the card). */
function InputIcons({ input }: { input: EarGame["input"] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.inputs} accessibilityLabel={input.length > 1 ? tr("Micro ou toucher") : input[0] === "mic" ? tr("Micro") : tr("Toucher")}>
      {input.includes("mic") ? (
        <View style={styles.inputIcon}>
          <Microphone size={13} color={colors.onSurfaceTertiary} weight="bold" />
        </View>
      ) : null}
      {input.includes("touch") ? (
        <View style={styles.inputIcon}>
          <HandPointing size={13} color={colors.onSurfaceTertiary} weight="bold" />
        </View>
      ) : null}
    </View>
  );
}

type Props = {
  openId: string | null;
  onOpen: (id: string | null) => void;
  optsOf: (g: EarGame) => Options; // micro games: the settings kept for each game
  setOptsOf: (g: EarGame, o: Options) => void;
  countOf: (g: EarGame) => number;
  setCountOf: (g: EarGame, n: number) => void;
  onStart: (g: EarGame) => void;
  onChallenge: (c: "degree" | "scale" | "chord") => void; // Trouve le degré / Trouve la gamme: their own screen
  levelOf: (g: EarGame) => ChordLevel; // quizzes (Reconnais l’accord, l’intervalle): the level chosen
  setLevelOf: (g: EarGame, l: ChordLevel) => void;
  perm: "unknown" | "granted" | "ask" | "blocked";
  error: string | null;
  bottomPad: number;
};

/** Défis: every game on one list, in two families (src/ear/games.ts). */
export function EarLibrary({ openId, onOpen, optsOf, setOptsOf, countOf, setCountOf, onStart, onChallenge, levelOf, setLevelOf, perm, error, bottomPad }: Props) {
  const styles = useStyles();
  // The open sheet (game + setting); its choices are rebuilt from the current settings at every render.
  const [sheet, setSheet] = useState<{ game: EarGame; id: EarSetting } | null>(null);
  const [bests, setBests] = useState<Record<string, Best | null>>({});
  const resultsV = useResultsVersion();
  const open = EAR_GAMES.find((g) => g.id === openId) ?? null;
  const reveal = useRevealOnOpen(openId); // the card that unfolds scrolls into view
  const openCount = open ? countOf(open) : 0;

  // The record of the open game, for its current length.
  useEffect(() => {
    if (!open) return;
    const key = earBestKey(open, openCount, levelOf(open).id);
    storage.getItem(key, null).then((v) => {
      let b: Best | null = null;
      try {
        b = typeof v === "string" ? (JSON.parse(v) as Best) : null;
      } catch {
        b = null;
      }
      setBests((m) => ({ ...m, [key]: b }));
    });
  }, [open, openCount, resultsV, open ? levelOf(open).id : ""]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The sheet of one setting of a micro game. */
  const sheetOf = (g: EarGame, id: EarSetting): OptionSheetDef => {
    const o = optsOf(g);
    const set = (next: Options) => setOptsOf(g, next);
    if (id === "strings") {
      return {
        title: tr("Cordes"),
        hint: tr("Les cordes sur lesquelles les notes sont demandées."),
        multi: true,
        options: [5, 4, 3, 2, 1, 0].map((s) => ({ id: String(s), label: `${s + 1} · ${STRING_LABELS[s]}`, selected: o.strings.includes(s) })),
        onPick: (v) => {
          const s = Number(v);
          const has = o.strings.includes(s);
          if (has && o.strings.length === 1) return;
          set({ ...o, strings: has ? o.strings.filter((x) => x !== s) : [...o.strings, s] });
        },
      };
    }
    if (id === "scale") {
      return {
        title: tr("Gamme"),
        options: SCALES.filter((s) => !s.special).map((s) => ({ id: s.id, label: tr(s.name), selected: o.scaleId === s.id })),
        onPick: (v) => set({ ...o, scaleId: v, intervals: intervalsForLevel(v, o.level) }),
      };
    }
    if (id === "level") {
      return {
        title: tr("Difficulté"),
        hint: tr("Choisit les intervalles en jeu, du plus simple (la quinte) à tous."),
        options: LEVEL_LABELS.map((l, i) => ({ id: String(i + 1), label: tr(l), selected: o.level === i + 1 })),
        onPick: (v) => set({ ...o, level: Number(v), intervals: intervalsForLevel(o.scaleId, Number(v)) }),
      };
    }
    return {
      title: tr("Intervalles en jeu"),
      multi: true,
      options: scaleIntervals(o.scaleId).map((iv) => ({ id: iv.label, label: `${intervalName(iv.label)} (${iv.label})`, selected: o.intervals.includes(iv.label) })),
      onPick: (v) => {
        const has = o.intervals.includes(v);
        if (has && o.intervals.length === 1) return;
        set({ ...o, intervals: has ? o.intervals.filter((x) => x !== v) : [...o.intervals, v] });
      },
    };
  };
  const pillLabel = (o: Options, id: EarSetting) =>
    id === "strings"
      ? tr("Cordes {list}", { list: [...o.strings].sort((a, b) => b - a).map((s) => s + 1).join(" · ") })
      : id === "scale"
        ? tr(SCALES.find((s) => s.id === o.scaleId)?.name ?? "")
        : id === "level"
          ? tr("Difficulté {l}", { l: tr(LEVEL_LABELS[o.level - 1] ?? "") })
          : tr("Intervalles : {list}", { list: o.intervals.join(", ") });

  const micNote =
    perm === "blocked" ? (
      <View style={styles.permCard} testID="mic-blocked-card">
        <Text style={styles.permTitle}>{tr("Micro bloqué")}</Text>
        <Text style={styles.permText}>{tr("Autorise le micro dans les réglages pour que l’app entende ta guitare.")}</Text>
        {Platform.OS !== "web" ? (
          <Pressable testID="open-settings-button" onPress={() => Linking.openSettings()} style={styles.permBtn}>
            <Text style={styles.permBtnText}>{tr("Ouvrir les réglages")}</Text>
          </Pressable>
        ) : null}
      </View>
    ) : (
      <>
        {perm !== "granted" ? <Text style={styles.note}>{tr("Le micro analyse ta guitare directement sur l’appareil. Rien n’est enregistré.")}</Text> : null}
        {error && error !== "denied" ? <Text style={styles.error}>{tr("Micro indisponible : {error}", { error })}</Text> : null}
      </>
    );

  return (
    <>
      <ScrollView {...reveal.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad + spacing.xl }]} showsVerticalScrollIndicator={false} testID="ear-library">
        {DEFI_FAMILIES.map((fam) => (
          <View key={fam.id} style={styles.family} onLayout={reveal.at(`fam:${fam.id}`)}>
            <FamilyTitle title={tr(fam.title)} lead={tr(fam.lead)} />
            {EAR_GAMES.filter((g) => g.family === fam.id).map((g) => {
              if (g.kind === "challenge") {
                return (
                  <GameLink
                    key={g.id}
                    testID={`defi-${g.id}`}
                    name={tr(g.name)}
                    meta={tr(g.meta)}
                    aside={<InputIcons input={g.input} />}
                    onPress={() => onChallenge(g.challenge ?? "degree")}
                  />
                );
              }
              const on = g.id === openId;
              const n = countOf(g);
              const lv = g.levels ? levelOf(g) : null;
              const best = on ? bests[earBestKey(g, n, lv?.id)] : null;
              const mic = g.kind === "mic";
              const o = mic ? optsOf(g) : null;
              const pills: Pill[] = o ? (g.edit ?? []).map((id) => ({ id, label: pillLabel(o, id), onPress: () => setSheet({ game: g, id }) })) : [];
              return (
                <View key={g.id} onLayout={reveal.at(g.id, `fam:${fam.id}`)}>
                <GameCard
                  testID={`ear-game-${g.id}`}
                  name={tr(g.name)}
                  meta={tr(g.meta)}
                  aside={<InputIcons input={g.input} />}
                  open={on}
                  onToggle={() => onOpen(on ? null : g.id)}
                  pills={pills}
                  countLabel={mic ? tr("Notes") : g.kind === "intervals" ? tr("Intervalles") : tr("Accords")}
                  counts={countsOf(g)}
                  count={n}
                  onCount={(c) => setCountOf(g, c)}
                  extra={
                    o ? (
                      <>
                        <Segment
                          testID="ear-pick"
                          value={o.weak ? "weak" : "random"}
                          options={[
                            { id: "random", label: tr("Au hasard") },
                            { id: "weak", label: tr("Mes points faibles") },
                          ]}
                          onChange={(v) => setOptsOf(g, { ...o, weak: v === "weak" })}
                        />
                        {o.weak ? (
                          <Text style={styles.small}>
                            {tr("7 notes sur 10 parmi tes points faibles (lentes, ratées, peu ou pas encore demandées), les autres parmi celles que tu connais. Une note en sort après 3 bonnes réponses rapides d’affilée.")}
                          </Text>
                        ) : null}
                      </>
                    ) : g.levels && lv ? (
                      <>
                        <View style={styles.levels} testID={`${g.id}-level`}>
                          {g.levels.map((l) => (
                            <Chip key={l.id} testID={`${g.kind === "chords" ? "chord" : g.id}-level-${l.id}`} label={tr(l.name)} selected={l.id === lv.id} onPress={() => setLevelOf(g, l)} />
                          ))}
                        </View>
                        <Text style={styles.small}>{tr(lv.meta)}</Text>
                      </>
                    ) : null
                  }
                  record={
                    best
                      ? mic
                        ? tr(best.score > 1 ? "Record : {n} notes en {time}" : "Record : {n} note en {time}", { n: best.score, time: formatTime(best.timeMs) })
                        : tr("Record : {score}/{n} en {time}", { score: best.score, n, time: formatTime(best.timeMs) })
                      : null
                  }
                  warning={mic ? micNote : null}
                  startTestID={`ear-start-${g.id}`}
                  startLabel={tr("Démarrer · {name}", { name: lv ? tr(lv.name) : tr(g.name) })}
                  onStart={() => onStart(g)}
                />
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
      <OptionSheet def={sheet ? sheetOf(sheet.game, sheet.id) : null} onClose={() => setSheet(null)} />
    </>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  family: { gap: spacing.sm },
  levels: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  inputs: { flexDirection: "row", gap: 4, flexShrink: 0 },
  inputIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  small: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary, lineHeight: 16 },
  note: { fontFamily: fonts.text, fontSize: 12, color: c.muted },
  error: { fontFamily: fonts.text, fontSize: 12, color: c.error },
  permCard: { padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceSecondary },
  permTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onSurface },
  permText: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, marginTop: 4 },
  permBtn: { marginTop: spacing.sm, height: 44, borderRadius: radius.pill, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  permBtnText: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700", color: c.onBrandPrimary },
}));
