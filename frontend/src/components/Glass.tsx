import React from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";

import { makeStyles, radius } from "@/src/theme";

export function Glass({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const styles = useStyles();
  return (
    <View testID={testID} style={[styles.wrap, style]}>
      {Platform.OS !== "android" ? <BlurView intensity={40} tint="dark" style={styles.blur} /> : null}
      <View style={styles.tint} />
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: c.border },
  blur: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  tint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.glass },
}));
