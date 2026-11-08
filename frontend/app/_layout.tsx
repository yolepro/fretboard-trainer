import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { SettingsProvider } from "@/src/settings";
import { useTheme } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const { colors } = useTheme();
  const [loaded] = useFonts({
    SpaceGrotesk: require("../assets/fonts/SpaceGrotesk.ttf"),
    DMSans: require("../assets/fonts/DMSans.ttf"),
  });

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.surface }]}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <SettingsProvider>
              <StatusBar style="light" />
              {loaded ? (
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
              ) : (
                <View style={styles.root} />
              )}
            </SettingsProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
