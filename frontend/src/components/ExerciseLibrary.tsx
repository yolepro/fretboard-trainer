import React, { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretRight, MusicNotes, Trophy } from "phosphor-react-native";
import { useRouter } from "expo-router";

import { LANDSCAPE_NAV_W } from "@/src/components/AppTabBar";
import { Chip, ChipRow } from "@/src/components/Chip";
import { StudioBackground } from "@/src/components/StudioBackground";
import { tr } from "@/src/i18n";
import type { ExerciseId } from "@/src/music/exercises";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

/** What a card opens: the subject, the exercise and its mode, as the exercise screen understands them. */
export type ExercisePreset = {
  id: string;
  family: Family;
  name: string;
  meta: string;
  subject: "scale" | "arp" | "pairs" | "cadence";
  exerciseId?: ExerciseId;
  horizontal: boolean;
  arpKind?: "shapes" | "twoStrings";
};

type Family = "Gammes" | "Arpèges" | "Triades" | "Accords";
const FAMILIES: Family[] = ["Gammes", "Arpèges", "Triades", "Accords"];
const LEADS: Record<Family, string> = {
  Gammes: "La gamme en position ou le long du manche, note à note ou par intervalles.",
  Arpèges: "Les arpèges à 4 sons, leurs schémas et leurs enchaînements.",
  Triades: "Deux triades voisines de la tonalité, en alternance.",
  Accords: "Les accords d’une cadence, en accords simples ou sans changer de position.",
};

/** S’exercer: one card per exercise, grouped by family. Edit names here. */
export const PRESETS: ExercisePreset[] = [
  { id: "scale", family: "Gammes", name: "Montée & descente de gamme", meta: "Sur une position · toutes les gammes", subject: "scale", exerciseId: "scale", horizontal: false },
  { id: "thirds", family: "Gammes", name: "Gamme par tierces", meta: "Sur une position", subject: "scale", exerciseId: "thirds", horizontal: false },
  { id: "thirds-h", family: "Gammes", name: "Gamme par tierces horizontales", meta: "Sur 2 cordes, le long du manche", subject: "scale", exerciseId: "thirds", horizontal: true },
  { id: "triads", family: "Gammes", name: "Gamme par triades diatoniques", meta: "Sur une position · 1-3-5 sur chaque degré", subject: "scale", exerciseId: "triads", horizontal: false },
  { id: "triads-h", family: "Gammes", name: "Gamme par triades horizontales", meta: "Sur 2 ou 3 cordes, le long du manche", subject: "scale", exerciseId: "triads", horizontal: true },
  { id: "sevenths", family: "Gammes", name: "Gamme par arpèges 7e diatoniques", meta: "Sur une position · 1-3-5-7 sur chaque degré", subject: "scale", exerciseId: "sevenths", horizontal: false },
  { id: "sevenths-h", family: "Gammes", name: "Gamme par arpèges 7e horizontaux", meta: "Sur 2 à 4 cordes, le long du manche", subject: "scale", exerciseId: "sevenths", horizontal: true },
  { id: "arp", family: "Arpèges", name: "Arpèges à 4 sons", meta: "5 schémas · ∆7, 7, m7, Ø", subject: "arp", horizontal: false, arpKind: "shapes" },
  { id: "arp-h", family: "Arpèges", name: "Enchaînement d’arpèges", meta: "D’un schéma au voisin, vers la caisse ou le sillet", subject: "arp", horizontal: true, arpKind: "shapes" },
  { id: "arp-2", family: "Arpèges", name: "Triades sur 2 cordes", meta: "Mi-La, Ré-Sol, Si-Mi · avec ou sans la 7e", subject: "arp", horizontal: true, arpKind: "twoStrings" },
  { id: "pairs", family: "Triades", name: "Paires de triades", meta: "IV et V de la tonalité · Up, Down, Alterné", subject: "pairs", horizontal: false },
  { id: "cadences", family: "Accords", name: "Cadences", meta: "Les bases du rock, Pop 4 accords, II–V–I… · accords simples ou dans la position", subject: "cadence", horizontal: false },
];

type Props = { currentId: string | null; onPick: (p: ExercisePreset) => void };

export function ExerciseLibrary({ currentId, onPick }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [filter, setFilter] = useState<Family | null>(null);
  const families = filter ? [filter] : FAMILIES;
  const bottom = usesNativeTabs || landscape ? insets.bottom : 0;
  const router = useRouter();

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="exercise-library">
      <StudioBackground />
      <View style={[styles.header, { paddingTop: insets.top + (landscape ? spacing.xs : spacing.lg) }, landscape && { paddingRight: LANDSCAPE_NAV_W + spacing.md }]}>
        <Text style={styles.title}>{tr("S’exercer")}</Text>
      </View>
      <ChipRow testID="library-filters">
        <Chip testID="library-filter-all" label={tr("Tout")} selected={filter === null} onPress={() => setFilter(null)} />
        {FAMILIES.map((f) => (
          <Chip key={f} testID={`library-filter-${f}`} label={tr(f)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ChipRow>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {families.map((fam) => (
          <View key={fam} style={styles.section}>
            <Text style={styles.sectionTitle}>{tr(fam)}</Text>
            <Text style={styles.lead}>{tr(LEADS[fam])}</Text>
            <View style={[styles.cards, landscape && styles.cardsWide]}>
              {PRESETS.filter((p) => p.family === fam).map((p) => (
                <Pressable
                  key={p.id}
                  testID={`library-card-${p.id}`}
                  onPress={() => onPick(p)}
                  style={({ pressed }) => [styles.card, landscape && styles.cardWide, p.id === currentId && styles.cardCurrent, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <View style={styles.cardIcon}>
                    <MusicNotes size={18} color={colors.onSurfaceSecondary} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {tr(p.name)}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {tr(p.meta)}
                    </Text>
                  </View>
                  <CaretRight size={18} color={colors.onSurfaceTertiary} weight="bold" />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        {/* Scores and records live in Défis. */}
        <Pressable testID="library-to-defis" onPress={() => router.navigate("/ear" as never)} style={({ pressed }) => [styles.toDefis, pressed && styles.pressed]} accessibilityRole="button">
          <Trophy size={20} color={colors.brandPrimary} weight="duotone" />
          <View style={styles.cardText}>
            <Text style={styles.toDefisTitle}>{tr("Envie de te mesurer ?")}</Text>
            <Text style={styles.cardMeta} numberOfLines={2}>
              {tr("Chrono et records : Trouve le degré, Reconnais l’accord… sont dans Défis.")}
            </Text>
          </View>
          <CaretRight size={18} color={colors.brandPrimary} weight="bold" />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs, minHeight: 48, justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: 26, fontWeight: "700", color: c.onSurface },
  list: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingTop: spacing.sm },
  section: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.text, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "600", color: c.onSurfaceTertiary },
  lead: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, lineHeight: 18, marginTop: -2 },
  cards: { gap: spacing.sm },
  cardIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  toDefis: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 60, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: c.brandPrimary },
  toDefisTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.brandPrimary },
  cardsWide: { flexDirection: "row", flexWrap: "wrap" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: "rgba(28,30,36,0.80)",
  },
  cardWide: { width: "48.5%" },
  cardCurrent: { borderColor: c.brandPrimary },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  cardName: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface },
  cardMeta: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
}));
