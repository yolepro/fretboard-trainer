import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { makeStyles, useTheme } from "@/src/theme";

const STUDIO =
  "https://images.unsplash.com/photo-1683362249825-77b26dcb1330?crop=entropy&cs=srgb&fm=jpg&q=70&w=900";

export function StudioBackground() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.fill} pointerEvents="none">
      <Image source={{ uri: STUDIO }} style={styles.img} contentFit="cover" transition={300} />
      <LinearGradient colors={[colors.scrimTop, colors.scrimBottom]} locations={[0, 0.55]} style={styles.fill} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  img: { position: "absolute", top: 0, left: 0, right: 0, height: 420, opacity: 0.5 },
}));
