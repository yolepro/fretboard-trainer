import React from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass } from "@/src/components/Glass";
import { StudioBackground } from "@/src/components/StudioBackground";
import { usesNativeTabs } from "@/src/navigation";
import { APP_VERSION } from "@/src/version";
import { fonts, makeStyles, spacing } from "@/src/theme";

const FEATURES = [
  {
    title: "Manche",
    text: "Visualisez gammes, modes, pentatoniques, blues et accords sur tout le manche. 5 positions fixes dans toutes les tonalités (et leur version 2/2), notes colorées par degré, écoute de la gamme avec partition et tablature.",
  },
  {
    title: "Doigté",
    text: "Exercez-vous sur une position ou en mode horizontal (mêmes cordes, on remonte le manche) : gamme complète, tierces, triades (1-3-5) et triades de septième (1-3-5-7), en montée et descente, avec partition + tablature synchronisées, BPM à la noire, décompte, métronome et boucle.",
  },
  {
    title: "Oreille",
    text: "Entraînez-vous avec votre guitare : jouer la note demandée sur une corde, écouter et rejouer, degrés d’accord, intervalles. Détection par micro.",
  },
  {
    title: "Réglages",
    text: "Notation (Do Ré Mi / C D E), dièses ou bémols, 5 styles de manche, étiquettes, volume et diapason.",
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
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
          Version {APP_VERSION}
        </Text>
        <Text style={styles.tagline}>Maîtrisez votre manche de guitare</Text>
        <Glass style={styles.card} testID="home-description">
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
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
