import React, { useState } from "react";
import { Modal, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { currentGuard, resetTab } from "@/src/tabNav";
import { tr } from "@/src/i18n";

/** Width taken by the landscape navigation at the top right: headers keep this much room on their right. */
export const LANDSCAPE_NAV_W = 5 * 40 + 4 * 4 + 2 * 4 + spacing.md; // 5 tabs: Accueil, Explorer, S’exercer, Défis, Réglages

/**
 * The app's tab bar. Portrait: the usual bar at the bottom (icon + label). Landscape: a compact row of icons at the
 * top right, over the screen, so the whole height is left to the fretboard, the score, the pills and the playback bar.
 */
export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const router = useRouter();
  // FS-36: a challenge in progress is paused and the player confirms before leaving it; `pending` is where to go then.
  const [pending, setPending] = useState<(() => void) | null>(null);

  const items = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const color = focused ? colors.brandPrimary : colors.muted;
    const label = typeof options.title === "string" ? options.title : route.name;
    // Expo Router doesn't always hand the tab bar a `navigation` object (web): fall back on the router, by path.
    const nav = (navigation ?? (descriptors[route.key] as { navigation?: typeof navigation }).navigation) as typeof navigation | undefined;
    // Pressing a tab (even the current one) always opens its first page (FS-36).
    const go = () => {
      resetTab(route.name);
      if (focused) return;
      const event = nav?.emit?.({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (event?.defaultPrevented) return;
      if (nav?.navigate) nav.navigate(route.name, route.params);
      else router.navigate((route.name === "index" ? "/" : `/${route.name}`) as never);
    };
    const onPress = () => {
      const guard = currentGuard();
      if (!guard) return go();
      guard.pause();
      setPending(() => () => {
        guard.quit();
        go();
      });
    };
    const icon = options.tabBarIcon?.({ focused, color, size: landscape ? 20 : 24 });
    return { key: route.key, label, color, focused, onPress, icon, testID: options.tabBarButtonTestID };
  });

  const resume = () => {
    setPending(null);
    currentGuard()?.resume();
  };
  const quit = () => {
    const then = pending;
    setPending(null);
    then?.();
  };
  const confirm = (
    <Modal visible={!!pending} transparent animationType="fade" supportedOrientations={["portrait", "landscape"]} onRequestClose={() => resume()}>
      <View style={styles.backdrop} testID="leave-challenge">
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>{tr("Quitter le défi ?")}</Text>
          <Text style={styles.dialogText}>{tr("La partie est en pause. Si tu la quittes, elle ne sera pas comptée.")}</Text>
          <Pressable testID="leave-challenge-resume" onPress={() => resume()} style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}>
            <Text style={styles.btnPrimaryText}>{tr("Reprendre le défi")}</Text>
          </Pressable>
          <Pressable testID="leave-challenge-quit" onPress={() => quit()} style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}>
            <Text style={styles.btnSecondaryText}>{tr("Quitter le défi")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  if (landscape) {
    return (
      <>
        {confirm}
      <View pointerEvents="box-none" style={[styles.floatWrap, { top: insets.top + spacing.xs, right: insets.right + spacing.md }]}>
        <View style={styles.floatBar} testID="tab-bar-landscape">
          {items.map((it) => (
            <Pressable
              key={it.key}
              testID={it.testID}
              onPress={it.onPress}
              accessibilityRole="tab"
              accessibilityLabel={it.label}
              accessibilityState={{ selected: it.focused }}
              style={({ pressed }) => [styles.floatBtn, it.focused && styles.floatBtnOn, pressed && styles.pressed]}
            >
              {it.icon}
            </Pressable>
          ))}
        </View>
      </View>
      </>
    );
  }

  return (
    <>
      {confirm}
    <View style={[styles.bar, { height: (Platform.OS === "web" ? 64 : 49) + insets.bottom, paddingBottom: insets.bottom }]} testID="tab-bar">
      {items.map((it) => (
        <Pressable
          key={it.key}
          testID={it.testID}
          onPress={it.onPress}
          accessibilityRole="tab"
          accessibilityLabel={it.label}
          accessibilityState={{ selected: it.focused }}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        >
          {it.icon}
          <Text style={[styles.label, { color: it.color }]} numberOfLines={1}>
            {it.label}
          </Text>
        </Pressable>
      ))}
    </View>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  bar: { flexDirection: "row", backgroundColor: c.surfaceSecondary, borderTopWidth: 1, borderTopColor: c.border },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { fontFamily: fonts.display, fontSize: 11 },
  floatWrap: { position: "absolute" },
  floatBar: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  floatBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  floatBtnOn: { backgroundColor: c.surfaceTertiary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  dialog: { width: "100%", maxWidth: 360, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, gap: spacing.sm },
  dialogTitle: { fontFamily: fonts.display, fontSize: 20, fontWeight: "700", color: c.onSurface },
  dialogText: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: c.onSurfaceSecondary, marginBottom: spacing.sm },
  btnPrimary: { height: 50, borderRadius: radius.pill, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onBrandPrimary },
  btnSecondary: { height: 46, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  btnSecondaryText: { fontFamily: fonts.display, fontSize: 15, color: c.onSurface },
}));
