import React, { type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "phosphor-react-native";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

/**
 * The bottom sheet shared by every settings popup (Gamme / Exercice menu, Tempo et lecture): same frame (see-through,
 * like the key wheel), same handle, same header (title + round close button) and the same left edge for every block
 * (SectionLabel, ChipRow, hints and cards all use the `spacing.lg` gutter).
 */
type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testID?: string;
  /** Keep the sheet at its full height whatever its content: switching tabs inside it doesn't move its top. */
  fullHeight?: boolean;
};

export function Sheet({ visible, onClose, title, children, testID, fullHeight = false }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} testID={`${testID ?? "sheet"}-backdrop`} />
        <View testID={testID} style={[styles.sheet, fullHeight ? { height: height * 0.88 } : null, { maxHeight: height * 0.88, paddingLeft: insets.left, paddingRight: insets.right }]}>
          <View style={styles.tint} />
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Pressable testID={`${testID ?? "sheet"}-close`} onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <X size={20} color={colors.onSurface} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** A block of content aligned on the sheet gutter (cards, rows, hints). */
export function SheetBlock({ children, style }: { children: ReactNode; style?: object }) {
  const styles = useStyles();
  return <View style={[styles.block, style]}>{children}</View>;
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10,11,14,0.30)" },
  backdropTap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    overflow: "hidden",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  // See-through frame, exactly like the key wheel: the screen behind stays visible (no blur).
  tint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(28,30,36,0.80)" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, alignSelf: "center", marginTop: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 20, fontWeight: "700", color: c.onSurface },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceTertiary },
  scroll: { flexShrink: 1 },
  block: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
}));
