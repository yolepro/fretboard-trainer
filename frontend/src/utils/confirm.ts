import { Alert, Platform } from "react-native";

import { tr } from "@/src/i18n";

/** Asks before a destructive action: the system alert on iOS / Android, the browser's confirm box on the web. */
export function confirmAction(title: string, message: string, okLabel: string, onOk: () => void) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: tr("Annuler"), style: "cancel" },
    { text: okLabel, style: "destructive", onPress: onOk },
  ]);
}
