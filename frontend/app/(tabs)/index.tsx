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
    text: "Les accords : la bible pour construire n’importe quel accord, et les formes à jouer (accords ouverts, barrés, power chords, système CAGED) avec les doigts. L’harmonie : les 7 degrés d’une tonalité, leur fonction et les accords qui se remplacent. Puis les gammes et modes sur tout le manche, 5 positions dans toutes les tonalités, avec partition et écoute.",
  },
  {
    title: "S’exercer",
    text: "Gammes par tierces, triades ou arpèges, sur une position ou le long du manche, arpèges à 4 sons, paires de triades, avec partition, tempo, métronome et boucle.",
  },
  {
    title: "Défis",
    text: "Mesure-toi au chrono. Connaître le manche : trouve la note, le degré, la gamme, le degré de l’accord. Entraîner l’oreille : rejoue la note ou l’intervalle, reconnais l’accord. Records, résultats et points faibles.",
  },
  {
    title: "Réglages",
    text: "Langue (français / anglais), notation (Do Ré Mi / C D E), dièses ou bémols, 5 styles de manche, nombre de cases (20 à 24), étiquettes, volume, diapason, test du micro, tes résultats.",
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
