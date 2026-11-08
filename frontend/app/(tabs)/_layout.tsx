import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";
import { Ear, GearSix, Guitar } from "phosphor-react-native";

import { usesNativeTabs } from "@/src/navigation";
import { fonts, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="guitars.fill" />
          <NativeTabs.Trigger.Label>Manche</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="ear">
          <NativeTabs.Trigger.Icon sf="ear.fill" />
          <NativeTabs.Trigger.Label>Oreille</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
          <NativeTabs.Trigger.Label>Réglages</NativeTabs.Trigger.Label>
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
          title: "Manche",
          tabBarButtonTestID: "tab-fretboard",
          tabBarIcon: ({ color, focused }) => <Guitar color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="ear"
        options={{
          title: "Oreille",
          tabBarButtonTestID: "tab-ear",
          tabBarIcon: ({ color, focused }) => <Ear color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Réglages",
          tabBarButtonTestID: "tab-settings",
          tabBarIcon: ({ color, focused }) => <GearSix color={color as string} size={24} weight={focused ? "fill" : "regular"} />,
        }}
      />
    </Tabs>
  );
}
