import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { makeStyles, useTheme } from "@/src/theme";

// Black & white photo of a music studio (assets/images/studio.jpg, 1408×768).
const STUDIO = require("../../assets/images/studio.jpg");

export function StudioBackground() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.fill} pointerEvents="none">
      <Image source={STUDIO} style={styles.img} contentFit="cover" contentPosition={{ left: "35%", top: 0 }} transition={300} />
      <LinearGradient colors={[colors.scrimTop, colors.scrimBottom]} locations={[0, 0.55]} style={styles.fill} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  img: { position: "absolute", top: 0, left: 0, right: 0, height: 420, opacity: 0.5 },
}));
