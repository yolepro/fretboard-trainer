import React from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "phosphor-react-native";

import { Chip, ChipRow, SectionLabel } from "@/src/components/Chip";
import { PositionChips } from "@/src/components/PositionChips";
import { CHORDS, DEGREE_META, SCALES, degreeKeyFromNum, type BoxWindow, type Formula } from "@/src/music/theory";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export type PickerMode = "scale" | "chord";

type Props = {
  visible: boolean;
  onClose: () => void;
  mode: PickerMode;
  onModeChange: (m: PickerMode) => void;
  rootPc: number;
  onRootChange: (pc: number) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  nameOf: (pc: number) => string;
  positions: BoxWindow[];
  selectedPosition: number | null;
  positionVariants?: number[];
  onPositionChange: (i: number | null) => void;
  labelMode: "note" | "degree";
  onLabelModeChange: (m: "note" | "degree") => void;
};

function groupBy(list: Formula[]) {
  const groups: { title: string; items: Formula[] }[] = [];
  list.forEach((f) => {
    const g = groups.find((x) => x.title === f.group);
    if (g) g.items.push(f);
    else groups.push({ title: f.group, items: [f] });
  });
  return groups;
}

export function ScalePicker({
  visible,
  onClose,
  mode,
  onModeChange,
  rootPc,
  onRootChange,
  selectedId,
  onSelect,
  nameOf,
  positions,
  selectedPosition,
  positionVariants,
  onPositionChange,
  labelMode,
  onLabelModeChange,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const groups = groupBy(mode === "scale" ? SCALES : CHORDS);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} testID="scale-picker-backdrop" />
        <View
          testID="scale-picker-sheet"
          style={[
            styles.sheet,
            { maxHeight: height * 0.88, paddingBottom: insets.bottom + spacing.md, paddingLeft: insets.left, paddingRight: insets.right },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{mode === "scale" ? "Choisir une gamme" : "Choisir un accord"}</Text>
            <Pressable testID="scale-picker-close" onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <X size={20} color={colors.onSurface} />
            </Pressable>
          </View>

          <ScrollView
            testID="scale-picker-scroll"
            style={styles.list}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
          <View style={styles.segment}>
            {(["scale", "chord"] as PickerMode[]).map((m) => (
              <Pressable key={m} testID={`picker-mode-${m}`} onPress={() => onModeChange(m)} style={[styles.segBtn, mode === m && styles.segBtnActive]}>
                <Text style={[styles.segText, mode === m && styles.segTextActive]}>{m === "scale" ? "Gammes" : "Accords / Triades"}</Text>
              </Pressable>
            ))}
          </View>

          <SectionLabel>Tonalité</SectionLabel>
          <ChipRow testID="picker-root-selector">
            {Array.from({ length: 12 }, (_, pc) => (
              <Chip key={pc} testID={`picker-root-${pc}`} label={nameOf(pc)} selected={rootPc === pc} onPress={() => onRootChange(pc)} />
            ))}
          </ChipRow>

          {positions.length > 0 ? (
            <>
              <SectionLabel>Position</SectionLabel>
              <PositionChips boxes={positions} selected={selectedPosition} variants={positionVariants} onChange={onPositionChange} prefix="picker-position" />
            </>
          ) : null}

          <SectionLabel>Étiquettes</SectionLabel>
          <ChipRow testID="picker-label-selector">
            <Chip testID="picker-label-note" label="Noms des notes" selected={labelMode === "note"} onPress={() => onLabelModeChange("note")} />
            <Chip testID="picker-label-degree" label="Degrés" selected={labelMode === "degree"} onPress={() => onLabelModeChange("degree")} />
          </ChipRow>

          <View style={styles.listContent}>
            {groups.map((g) => (
              <View key={g.title}>
                <Text style={styles.groupTitle}>{g.title}</Text>
                {g.items.map((f) => {
                  const selected = f.id === selectedId;
                  return (
                    <Pressable
                      key={f.id}
                      testID={`picker-item-${f.id}`}
                      onPress={() => {
                        onSelect(f.id);
                        onClose();
                      }}
                      style={({ pressed }) => [styles.item, selected && styles.itemSelected, pressed && styles.pressed]}
                    >
                      <View style={styles.itemText}>
                        <Text style={[styles.itemName, selected && styles.itemNameSelected]}>
                          {mode === "chord" ? `${nameOf(rootPc)}${f.symbol} · ` : `${nameOf(rootPc)} `}
                          {f.name}
                        </Text>
                        <View style={styles.ivRow}>
                          {f.intervals.map((i) => {
                            const k = degreeKeyFromNum(i.num);
                            return (
                              <Text key={`${i.semi}-${i.label}`} style={[styles.ivLabel, { color: colors[DEGREE_META[k].color] }]}>
                                {i.label}
                              </Text>
                            );
                          })}
                        </View>
                      </View>
                      {selected ? <Check size={20} color={colors.brandPrimary} weight="bold" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: c.scrimTop },
  backdropTap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: c.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, alignSelf: "center", marginTop: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 20, fontWeight: "700", color: c.onSurface },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceTertiary },
  segment: { flexDirection: "row", marginHorizontal: spacing.lg, padding: 4, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary },
  segBtn: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segBtnActive: { backgroundColor: c.brandPrimary },
  segText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurfaceTertiary },
  segTextActive: { color: c.onBrandPrimary, fontWeight: "700" },
  list: { flexShrink: 1 },
  scrollContent: { paddingBottom: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  groupTitle: {
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: c.muted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
    marginBottom: spacing.sm,
  },
  itemSelected: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  pressed: { opacity: 0.85 },
  itemText: { flex: 1 },
  itemName: { fontFamily: fonts.text, fontSize: 15, fontWeight: "600", color: c.onSurfaceSecondary },
  itemNameSelected: { color: c.onBrandTertiary },
  ivRow: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
  ivLabel: { fontFamily: fonts.display, fontSize: 12, fontWeight: "700" },
}));
