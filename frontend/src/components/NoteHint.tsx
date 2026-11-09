import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Lightbulb } from "phosphor-react-native";

import { Fretboard, fitScale } from "@/src/components/Fretboard";
import { DEGREE_META, STRING_LABELS, TUNING, octaveOf, pcOf, type DegreeKey, type IntervalDef } from "@/src/music/theory";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const DEGREE_NUM: Record<DegreeKey, number> = { root: 1, third: 3, fifth: 5, seventh: 7, ninth: 9, eleventh: 11, thirteenth: 13 };
const HINT_LAST_FRET = 12;

type Props = {
  targetMidi: number;
  pitchClassOnly: boolean;
  degree?: DegreeKey;
  degreeLabel?: string;
  nameOf: (pc: number) => string;
  width: number;
};

/** Shows where to play the target note: string + fret list and a mini fretboard. */
export function NoteHint({ targetMidi, pitchClassOnly, degree, degreeLabel, nameOf, width }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pc = pcOf(targetMidi);
  const key: DegreeKey = degree ?? "root";

  const positions = useMemo(() => {
    const out: { string: number; fret: number }[] = [];
    TUNING.forEach((open, s) => {
      for (let f = 0; f <= 24; f++) {
        const m = open + f;
        const ok = pitchClassOnly ? pcOf(m) === pc && f <= HINT_LAST_FRET : m === targetMidi;
        if (ok) out.push({ string: s, fret: f });
      }
    });
    const sorted = out.sort((a, b) => a.fret - b.fret);
    const low = sorted.filter((p) => p.fret <= 17);
    return low.length ? low : sorted;
  }, [targetMidi, pitchClassOnly, pc]);

  const degreeMap = useMemo(() => {
    const iv: IntervalDef = { semi: 0, num: DEGREE_NUM[key], label: degreeLabel ?? "1" };
    return new Map<number, IntervalDef>([[pc, iv]]);
  }, [pc, key, degreeLabel]);
  const layers = useMemo(() => new Set<DegreeKey>([key]), [key]);
  const lastFret = Math.max(12, ...positions.map((p) => p.fret));

  return (
    <View style={styles.card} testID="note-hint-card">
      <View style={styles.titleRow}>
        <Lightbulb size={18} color={colors.brandPrimary} weight="fill" />
        <Text style={styles.title}>
          Aide : {nameOf(pc)}
          {pitchClassOnly ? "" : octaveOf(targetMidi)} se joue ici
        </Text>
      </View>
      <View style={styles.list}>
        {positions.slice(0, 6).map((p) => (
          <View key={`${p.string}-${p.fret}`} style={[styles.pos, { borderColor: colors[DEGREE_META[key].color] }]} testID={`hint-pos-s${p.string}-f${p.fret}`}>
            <Text style={styles.posText}>
              Corde {p.string + 1} ({STRING_LABELS[p.string]}) · {p.fret === 0 ? "à vide" : `case ${p.fret}`}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.board}>
        <Fretboard
          degreeMap={degreeMap}
          visibleLayers={layers}
          octave={pitchClassOnly ? null : octaveOf(targetMidi)}
          labelMode="note"
          showNeutral={false}
          nameOf={nameOf}
          onNotePress={() => {}}
          fretScale={fitScale(width - 16, lastFret)}
          rowH={22}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.brandPrimary,
    backgroundColor: c.brandTertiary,
    overflow: "hidden",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onBrandTertiary },
  list: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  pos: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 32, justifyContent: "center", backgroundColor: c.surfaceSecondary },
  posText: { fontFamily: fonts.text, fontSize: 13, color: c.onSurface },
  board: { marginTop: spacing.md, marginHorizontal: -spacing.md },
}));
