import React from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass } from "@/src/components/Glass";
import { StudioBackground } from "@/src/components/StudioBackground";
import { usesNativeTabs } from "@/src/navigation";
import { useSettings } from "@/src/settings";
import { APP_VERSION } from "@/src/version";
import { fonts, makeStyles, spacing } from "@/src/theme";
import { tr } from "@/src/i18n";

const FEATURES = [
  {
    title: "Explorer",
    text: "Visualisez gammes, modes, pentatoniques, blues et accords sur tout le manche. 5 positions fixes dans toutes les tonalités (et leur version 2/2), notes colorées par degré, écoute de la gamme avec partition et tablature.",
  },
  {
    title: "S’exercer",
    text: "Exercez-vous sur une position ou en mode horizontal (mêmes cordes, on remonte le manche) : gamme complète, tierces, triades (1-3-5) et triades de septième (1-3-5-7), en montée et descente, avec partition + tablature synchronisées, tempo réglable, débit lent ou normal, décompte, métronome et boucle. Arpèges 4 sons (∆, 7, m7, Ø) en 5 schémas, sur une position ou en enchaînant deux schémas le long du manche. Paires de triades (IV et V de la tonalité) à travers les renversements, dans les 5 positions.",
  },
  {
    title: "Oreille",
    text: "Entraînez-vous avec votre guitare : jouer la note demandée sur une corde, écouter et rejouer, degrés d’accord, intervalles. Détection par micro.",
  },
  {
    title: "Réglages",
    text: "Langue (français / anglais), notation (Do Ré Mi / C D E), dièses ou bémols, 5 styles de manche, nombre de cases (20 à 24), étiquettes, volume et diapason.",
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  useSettings(); // re-render when the language changes
  const { width, height } = useWindowDimensions();
  const logoSize = Math.min(width, height) * 0.5;

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: usesNativeTabs ? insets.bottom : 0, paddingLeft: insets.left, paddingRight: insets.right }]}
      testID="home-screen"
    >
      <StudioBackground />
      <ScrollView contentContainerStyle={styles.center} showsVerticalScrollIndicator={false}>
        <Image
          source={require("@/assets/images/logo.png")}
          style={{ width: logoSize, height: logoSize }}
          contentFit="contain"
          testID="home-logo"
        />
        <Text style={styles.version} testID="app-version">
          {tr("Version")} {APP_VERSION}
        </Text>
        <Text style={styles.tagline}>{tr("Maîtrisez votre manche de guitare")}</Text>
        <Glass style={styles.card} testID="home-description">
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <Text style={styles.featureTitle}>{tr(f.title)}</Text>
              <Text style={styles.featureText}>{tr(f.text)}</Text>
            </View>
          ))}
        </Glass>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg },
  tagline: { fontFamily: fonts.display, fontSize: 18, fontWeight: "700", color: c.onSurface, textAlign: "center" },
  card: { alignSelf: "center", width: "100%", maxWidth: 560, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md },
  feature: { gap: 2, alignItems: "flex-start" },
  featureTitle: { fontFamily: fonts.display, fontSize: 14, fontWeight: "700", color: c.brandPrimary, textAlign: "left" },
  featureText: { fontFamily: fonts.text, fontSize: 13, lineHeight: 18, color: c.onSurfaceSecondary, textAlign: "left" },
  version: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 2, color: c.onSurfaceTertiary, textAlign: "center" },
}));
