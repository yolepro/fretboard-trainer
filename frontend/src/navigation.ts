import { Platform } from "react-native";

/**
 * iOS 26 native tab bar: off. The app draws its own tab bar everywhere (AppTabBar), which moves to the top right in
 * landscape to leave the whole height to the fretboard — the native bar can't move. Set back to the line below to
 * use the native bar again in portrait-only setups.
 *   Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26
 */
export const usesNativeTabs: boolean = false && Platform.OS === "ios";
