import React from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StudioBackground } from "@/src/components/StudioBackground";
import { usesNativeTabs } from "@/src/navigation";
import { APP_VERSION } from "@/src/version";
import { fonts, makeStyles, spacing } from "@/src/theme";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { width, height } = useWindowDimensions();
  const logoSize = Math.min(width, height) * 0.62;

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: usesNativeTabs ? insets.bottom : 0, paddingLeft: insets.left, paddingRight: insets.right }]}
      testID="home-screen"
    >
      <StudioBackground />
      <View style={styles.center}>
        <Image
          source={require("@/assets/images/logo.png")}
          style={{ width: logoSize, height: logoSize }}
          contentFit="contain"
          testID="home-logo"
        />
        <Text style={styles.version} testID="app-version">
          Version {APP_VERSION}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  version: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 2, color: c.onSurfaceTertiary },
}));
