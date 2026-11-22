import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { FamilyTitle, GameCard, OptionSheet, Segment, type OptionSheetDef, type Pill } from "@/src/components/GameCard";
import { EAR_FAMILIES, EAR_GAMES, countsOf, type EarGame, type EarSetting } from "@/src/ear/games";
import { LEVEL_LABELS, bestKey, formatTime, intervalName, intervalsForLevel, scaleIntervals, type Best, type Options, type Section } from "@/src/ear/questions";
import { SCALES, STRING_LABELS } from "@/src/music/theory";
import { useResultsVersion } from "@/src/results";
import { storage } from "@/src/utils/storage";
import { tr } from "@/src/i18n";
import { fonts, makeStyles, radius, spacing } from "@/src/theme";

/** Record key of an Oreille game (micro: per game id; Accords: per chord set). */
export const earBestKey = (g: EarGame, count: number) =>
  g.family === "chords" ? `${bestKey("chords", count)}_${g.id}` : bestKey(g.id as Section, count);

type Props = {
  openId: string | null;
  onOpen: (id: string | null) => void;
  optsOf: (g: EarGame) => Options; // micro games: the settings kept for each game
  setOptsOf: (g: EarGame, o: Options) => void;
  countOf: (g: EarGame) => number;
  setCountOf: (g: EarGame, n: number) => void;
  onStart: (g: EarGame) => void;
  perm: "unknown" | "granted" | "ask" | "blocked";
  error: string | null;
  bottomPad: number;
};

/** Oreille: every game on one list, the same cards as S’exercer › Challenges. */
export function EarLibrary({ openId, onOpen, optsOf, setOptsOf, countOf, setCountOf, onStart, perm, error, bottomPad }: Props) {
  const styles = useStyles();
  // The open sheet (game + setting); its choices are rebuilt from the current settings at every render.
  const [sheet, setSheet] = useState<{ game: EarGame; id: EarSetting } | null>(null);
  const [bests, setBests] = useState<Record<string, Best | null>>({});
  const resultsV = useResultsVersion();
  const open = EAR_GAMES.find((g) => g.id === openId) ?? null;
  const openCount = open ? countOf(open) : 0;

  // The record of the open game, for its current length.
  useEffect(() => {
    if (!open) return;
    const key = earBestKey(open, openCount);
    storage.getItem(key, null).then((v) => {
      let b: Best | null = null;
      try {
        b = typeof v === "string" ? (JSON.parse(v) as Best) : null;
      } catch {
        b = null;
      }
      setBests((m) => ({ ...m, [key]: b }));
    });
  }, [open, openCount, resultsV]);

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
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + spacing.xl }]} showsVerticalScrollIndicator={false} testID="ear-library">
        {EAR_FAMILIES.map((fam) => (
          <View key={fam.id} style={styles.family}>
            <FamilyTitle title={tr(fam.title)} lead={tr(fam.lead)} />
            {EAR_GAMES.filter((g) => g.family === fam.id).map((g) => {
              const on = g.id === openId;
              const n = countOf(g);
              const best = on ? bests[earBestKey(g, n)] : null;
              const mic = g.family === "mic";
              const o = mic ? optsOf(g) : null;
              const pills: Pill[] = o ? (g.edit ?? []).map((id) => ({ id, label: pillLabel(o, id), onPress: () => setSheet({ game: g, id }) })) : [];
              return (
                <GameCard
                  key={g.id}
                  testID={`ear-game-${g.id}`}
                  name={tr(g.name)}
                  meta={tr(g.meta)}
                  open={on}
                  onToggle={() => onOpen(on ? null : g.id)}
                  pills={pills}
                  countLabel={mic ? tr("Notes") : tr("Accords")}
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
                  startLabel={tr("Démarrer · {name}", { name: tr(g.name) })}
                  onStart={() => onStart(g)}
                />
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
  small: { fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceTertiary, lineHeight: 16 },
  note: { fontFamily: fonts.text, fontSize: 12, color: c.muted },
  error: { fontFamily: fonts.text, fontSize: 12, color: c.error },
  permCard: { padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceSecondary },
  permTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onSurface },
  permText: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, marginTop: 4 },
  permBtn: { marginTop: spacing.sm, height: 44, borderRadius: radius.pill, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  permBtnText: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700", color: c.onBrandPrimary },
}));
