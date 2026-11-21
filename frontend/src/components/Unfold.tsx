import React from "react";
import { Animated, Easing } from "react-native";
/** Unfolds its content (height + fade) when `open` turns true, folds it back when false. */
export function Unfold({ open, children }: { open: boolean; children: React.ReactNode }) {
  const v = React.useRef(new Animated.Value(open ? 1 : 0)).current;
  const [shown, setShown] = React.useState(open);
  React.useEffect(() => {
    if (open) setShown(true);
    Animated.timing(v, { toValue: open ? 1 : 0, duration: open ? 260 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
      if (finished && !open) setShown(false);
    });
  }, [open, v]);
  if (!shown) return null;
  return (
    <Animated.View
      style={{
        overflow: "hidden",
        opacity: v,
        maxHeight: v.interpolate({ inputRange: [0, 1], outputRange: [0, 600] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
