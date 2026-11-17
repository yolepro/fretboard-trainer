import React, { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Check } from "phosphor-react-native";

import { Sheet } from "@/src/components/Sheet";

import { Chip, ChipRow, SectionLabel } from "@/src/components/Chip";
import { PositionChips } from "@/src/components/PositionChips";
import { CHORDS, DEGREE_META, SCALES, degreeKeyFromNum, type BoxWindow, type Formula } from "@/src/music/theory";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { tr } from "@/src/i18n";

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
  /** Scales only: hides the Gammes / Accords switch. */
  scalesOnly?: boolean;
  /** Hides the "Tout le manche" position chip (a position is always selected). */
  hideAllPosition?: boolean;
  /** Sheet title (default: "Choisir une gamme" / "Choisir un accord"). */
  title?: string;
  /** Section-specific controls shown first / right after the labels, before the long list of scales. */
  top?: ReactNode;
  extra?: ReactNode;
  /** Extra chips appended to the "Étiquettes" row. */
  labelExtra?: ReactNode;
  /** Hide the list of scales / chords (a section that only needs the other filters). */
  hideList?: boolean;
  /** Hide the "Étiquettes" row (shown elsewhere). */
  hideLabels?: boolean;
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
  scalesOnly = false,
  hideAllPosition = false,
  title,
  top,
  extra,
  labelExtra,
  hideList = false,
  hideLabels = false,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const groups = groupBy(mode === "scale" ? SCALES : CHORDS);

  return (
    <Sheet visible={visible} onClose={onClose} title={title ?? (mode === "scale" ? tr("Choisir une gamme") : tr("Choisir un accord"))} testID="scale-picker" fullHeight>
          {top}
          {scalesOnly ? null : (
            <View style={styles.segment}>
              {(["scale", "chord"] as PickerMode[]).map((m) => (
                <Pressable key={m} testID={`picker-mode-${m}`} onPress={() => onModeChange(m)} style={[styles.segBtn, mode === m && styles.segBtnActive]}>
                  <Text style={[styles.segText, mode === m && styles.segTextActive]}>{m === "scale" ? tr("Gammes") : tr("Accords / Triades")}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {positions.length > 0 ? (
            <>
              <SectionLabel>{tr("Position")}</SectionLabel>
              <PositionChips boxes={positions} selected={selectedPosition} variants={positionVariants} onChange={onPositionChange} prefix="picker-position" hideAll={hideAllPosition} />
            </>
          ) : null}

          {extra}

          {hideLabels ? null : (
            <>
          <SectionLabel>{tr("Étiquettes")}</SectionLabel>
          <ChipRow testID="picker-label-selector">
            <Chip testID="picker-label-note" label={tr("Noms des notes")} selected={labelMode === "note"} onPress={() => onLabelModeChange("note")} />
            <Chip testID="picker-label-degree" label={tr("Degrés")} selected={labelMode === "degree"} onPress={() => onLabelModeChange("degree")} />
            {labelExtra}
          </ChipRow>
            </>
          )}


          <View style={styles.listContent}>
            {(hideList ? [] : groups).map((g) => (
              <View key={g.title}>
                <Text style={styles.groupTitle}>{tr(g.title)}</Text>
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
                          {tr(f.name)}
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
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  segment: { flexDirection: "row", marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: 4, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary },
  segBtn: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segBtnActive: { backgroundColor: c.brandPrimary },
  segText: { fontFamily: fonts.display, fontSize: 14, color: c.onSurfaceTertiary },
  segTextActive: { color: c.onBrandPrimary, fontWeight: "700" },
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
