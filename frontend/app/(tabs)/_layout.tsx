import { Tabs } from "expo-router";
import { useSettings } from "@/src/settings";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";
import { Ear, GearSix, Guitar, House, MusicNotes } from "phosphor-react-native";

import { usesNativeTabs } from "@/src/navigation";
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
        <NativeTabs.Trigger name="manche">
          <NativeTabs.Trigger.Icon sf="guitars.fill" />
          <NativeTabs.Trigger.Label>{tr("Explorer")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="doigte">
          <NativeTabs.Trigger.Icon sf="music.note.list" />
          <NativeTabs.Trigger.Label>{tr("S’exercer")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="ear">
          <NativeTabs.Trigger.Icon sf="ear.fill" />
          <NativeTabs.Trigger.Label>{tr("Oreille")}</NativeTabs.Trigger.Label>
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
      <Tabs.Screen
        name="manche"
        options={{
          title: tr("Explorer"),
          tabBarButtonTestID: "tab-fretboard",
          tabBarIcon: ({ color, focused }) => <Guitar color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="doigte"
        options={{
          title: tr("S’exercer"),
          tabBarButtonTestID: "tab-fingering",
          tabBarIcon: ({ color, focused }) => <MusicNotes color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="ear"
        options={{
          title: tr("Oreille"),
          tabBarButtonTestID: "tab-ear",
          tabBarIcon: ({ color, focused }) => <Ear color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
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
