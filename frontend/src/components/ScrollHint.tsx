import React, { useCallback, useRef, useState } from "react";
import { ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from "react-native";
import { CaretRight } from "phosphor-react-native";

import { makeStyles, useTheme } from "@/src/theme";

/**
 * A horizontal row that scrolls, with a faint ">" on its right edge while some of it is hidden on the right.
 * The sign is only a hint: it lets touches through (not clickable) and disappears once the row is scrolled to the end.
 */
type Props = {
  children: React.ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function HintScrollRow({ children, testID, style, contentContainerStyle }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const viewW = useRef(0);
  const contentW = useRef(0);
  const x = useRef(0);
  const [more, setMore] = useState(false);
  const update = useCallback(() => {
    const next = contentW.current - x.current - viewW.current > 4;
    setMore((prev) => (prev === next ? prev : next));
  }, []);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    x.current = e.nativeEvent.contentOffset.x;
    update();
  };
  return (
    <View style={[styles.wrap, style]}>
      <ScrollView
        testID={testID}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        onLayout={(e) => {
          viewW.current = e.nativeEvent.layout.width;
          update();
        }}
        onContentSizeChange={(w) => {
          contentW.current = w;
          update();
        }}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {children}
      </ScrollView>
      {more ? (
        <View pointerEvents="none" style={styles.hint} testID={testID ? `${testID}-more` : undefined}>
          <View style={styles.hintFade} />
          <View style={styles.hintSign}>
            <CaretRight size={16} color={colors.onSurface} weight="bold" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { position: "relative" },
  hint: { position: "absolute", top: 0, bottom: 0, right: 0, flexDirection: "row", alignItems: "center" },
  hintFade: { width: 16, alignSelf: "stretch", backgroundColor: "rgba(16,17,20,0.25)" },
  hintSign: {
    alignSelf: "stretch",
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16,17,20,0.55)",
    opacity: 0.75,
  },
}));
