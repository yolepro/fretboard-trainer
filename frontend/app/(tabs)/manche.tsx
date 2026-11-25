import React, { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookOpen, CaretRight, Eye, HandPointing } from "phosphor-react-native";

import { Chip, ChipRow } from "@/src/components/Chip";
import { LANDSCAPE_NAV_W } from "@/src/components/AppTabBar";
import { StudioBackground } from "@/src/components/StudioBackground";
import { ExplorerScreen, type ExploreMode } from "@/src/screens/ExplorerScreen";
import { ChordShapeScreen, type ShapeKind } from "@/src/screens/ChordShapeScreen";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { tr } from "@/src/i18n";

type Filter = "all" | "scales" | "chords";
type Item = { id: string; name: string; meta: string; open?: { explore: ExploreMode } | { shape: ShapeKind }; bible?: boolean; soon?: boolean };
type Group = { id: string; filter: Exclude<Filter, "all">; title: string; lead: string; items: Item[] };

/** Explorer: the families and their cards. Edit names here. */
const GROUPS: Group[] = [
  {
    id: "bible",
    filter: "chords",
    title: "La bible des accords",
    lead: "Construis n’importe quel accord sur n’importe quelle note et vois toutes ses notes sur le manche.",
    items: [{ id: "chords", name: "Les accords", meta: "Triades, sus, septièmes, 6, 9, 11, 13 · partition et écoute", open: { explore: "chord" }, bible: true }],
  },
  {
    id: "shapes",
    filter: "chords",
    title: "Les formes à jouer",
    lead: "Les doigtés tels qu’on les joue : doigts, barré, cordes à vide et étouffées, joué en arpège puis plaqué.",
    items: [
      { id: "open", name: "Accords ouverts", meta: "C, A, G, E, D, F, B, Am, Em, Dm, Fm, Bm et leurs 7 · cases 0 à 5 (F, B, Fm et Bm se jouent barrés : pas de forme ouverte)", open: { shape: "open" } },
      { id: "barre", name: "Accords barrés", meta: "Forme de Mi, forme de La · majeur, mineur, 7, m7, maj7", open: { shape: "barre" } },
      { id: "power", name: "Power chords", meta: "1-5 et 1-5-8 · fondamentale sur Mi, La ou Ré", open: { shape: "power" } },
      { id: "caged", name: "Système CAGED", meta: "Les 5 formes d’un accord le long du manche", open: { shape: "caged" } },
      { id: "three", name: "Accords à 3 sons", meta: "Triades sur 3 cordes · 3 renversements", soon: true },
      { id: "four", name: "Accords à 4 sons", meta: "Septièmes en Drop 2 et Drop 3 · 4 renversements", soon: true },
    ],
  },
  {
    id: "scales",
    filter: "scales",
    title: "Gammes",
    lead: "Les notes d’une gamme sur tout le manche, position par position, avec la partition et l’écoute.",
    items: [{ id: "scales", name: "Les gammes", meta: "Majeure, mineures, modes, pentatoniques, blues · 5 positions", open: { explore: "scale" } }],
  },
];
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "chords", label: "Accords" },
  { id: "scales", label: "Gammes" },
];

export default function ExplorerTab() {
  useSettings(); // re-render when the language changes
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<Item["open"] | null>(null);
  const back = () => setView(null);

  if (view && "explore" in view) return <ExplorerScreen key={view.explore} initialMode={view.explore} onBack={back} />;
  if (view && "shape" in view) return <ChordShapeScreen key={view.shape} kind={view.shape} onBack={back} />;

  const groups = filter === "all" ? GROUPS : GROUPS.filter((g) => g.filter === filter);
  const bottom = usesNativeTabs || landscape ? insets.bottom : 0;

  return (
    <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]} testID="explorer-library">
      <StudioBackground />
      <View style={[styles.header, { paddingTop: insets.top + (landscape ? spacing.xs : spacing.lg) }, landscape && { paddingRight: LANDSCAPE_NAV_W + spacing.md }]}>
        <Text style={styles.title}>{tr("Explorer")}</Text>
      </View>
      <ChipRow testID="explorer-filters">
        {FILTERS.map((f) => (
          <Chip key={f.id} testID={`explorer-filter-${f.id}`} label={tr(f.label)} selected={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </ChipRow>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {groups.map((g) => (
          <View key={g.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{tr(g.title)}</Text>
            <Text style={styles.lead}>{tr(g.lead)}</Text>
            <View style={[styles.cards, landscape && styles.cardsWide]}>
              {g.items.map((it) => (
                <Pressable
                  key={it.id}
                  testID={`explorer-card-${it.id}`}
                  disabled={!it.open}
                  onPress={() => it.open && setView(it.open)}
                  style={({ pressed }) => [styles.card, landscape && styles.cardWide, it.bible && styles.cardBible, it.soon && styles.cardSoon, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <View style={[styles.cardIcon, it.bible && styles.cardIconBible]}>
                    {g.id === "scales" ? (
                      <Eye size={18} color={colors.brandSecondary} weight="bold" />
                    ) : it.bible ? (
                      <BookOpen size={18} color={colors.brandPrimary} weight="bold" />
                    ) : (
                      <HandPointing size={18} color={colors.onSurfaceSecondary} />
                    )}
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {tr(it.name)}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={3}>
                      {tr(it.meta)}
                    </Text>
                  </View>
                  {it.soon ? <Text style={styles.soon}>{tr("ÉTAPE 2")}</Text> : <CaretRight size={18} color={colors.onSurfaceTertiary} weight="bold" />}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
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
  cardBible: { borderColor: "#5C4518", backgroundColor: "#2A2215" },
  cardSoon: { opacity: 0.6 },
  cardIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardIconBible: { backgroundColor: "rgba(245,158,11,0.16)" },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  cardName: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface },
  cardMeta: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  soon: { fontFamily: fonts.text, fontSize: 10, fontWeight: "600", letterSpacing: 0.4, color: c.onSurfaceTertiary, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, overflow: "hidden" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
}));
