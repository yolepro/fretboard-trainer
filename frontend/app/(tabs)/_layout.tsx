import { Tabs } from "expo-router";
import { useSettings } from "@/src/settings";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";
import { BookOpen, GearSix, House, Trophy } from "phosphor-react-native";

import { usesNativeTabs } from "@/src/navigation";
import { AppTabBar } from "@/src/components/AppTabBar";
import { fonts, useTheme } from "@/src/theme";
import { tr } from "@/src/i18n";

export default function TabsLayout() {
  const { colors } = useTheme();
  useSettings(); // re-render the tab titles when the language changes

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="house.fill" />
          <NativeTabs.Trigger.Label>{tr("Accueil")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="doigte">
          <NativeTabs.Trigger.Icon sf="book.fill" />
          <NativeTabs.Trigger.Label>{tr("Apprendre")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="ear">
          <NativeTabs.Trigger.Icon sf="trophy.fill" />
          <NativeTabs.Trigger.Label>{tr("Défis")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
          <NativeTabs.Trigger.Label>{tr("Réglages")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.display, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: tr("Accueil"),
          tabBarButtonTestID: "tab-home",
          tabBarIcon: ({ color, focused }) => <House color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
      {/* Apprendre (Explorer + S’exercer) and Défis; the route names stay as they were. */}
      <Tabs.Screen
        name="doigte"
        options={{
          title: tr("Apprendre"),
          tabBarButtonTestID: "tab-learn",
          tabBarIcon: ({ color, focused }) => <BookOpen color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="ear"
        options={{
          title: tr("Défis"),
          tabBarButtonTestID: "tab-defis",
          tabBarIcon: ({ color, focused }) => <Trophy color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: tr("Réglages"),
          tabBarButtonTestID: "tab-settings",
          tabBarIcon: ({ color, focused }) => <GearSix color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
    </Tabs>
  );
}
