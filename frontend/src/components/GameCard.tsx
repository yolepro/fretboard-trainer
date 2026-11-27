import React, { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { CaretRight, Play } from "phosphor-react-native";

import { Chip } from "@/src/components/Chip";
import { Sheet } from "@/src/components/Sheet";
import { Unfold } from "@/src/components/Unfold";
import { tr } from "@/src/i18n";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

/**
 * The one way to choose a game, everywhere (Oreille, Challenges, Accords): a card with the game's name and what it
 * trains; tapping it unfolds its settings (pastilles), its length, its record and the Start button.
 * A pastille with `onPress` is a setting the player can change (one sheet = one setting); without, it only says
 * what the game sets.
 */
export type Pill = { id: string; label: string; random?: boolean; onPress?: () => void };

type Props = {
  testID?: string;
  name: string;
  meta?: string;
  badges?: ReactNode; // before the name (degree badges…)
  aside?: ReactNode; // after the name (how the player answers…)
  open: boolean;
  onToggle?: () => void; // none: the card stays open (a screen with a single game)
  pills?: Pill[];
  countLabel?: string;
  counts?: number[];
  count?: number;
  onCount?: (n: number) => void;
  extra?: ReactNode; // more controls under the length (Au hasard / Mes points faibles…)
  record?: string | null;
  warning?: ReactNode;
  startLabel: string;
  onStart: () => void;
  startTestID?: string;
};

export function GameCard({
  testID,
  name,
  meta,
  badges,
  aside,
  open,
  onToggle,
  pills,
  countLabel,
  counts,
  count,
  onCount,
  extra,
  record,
  warning,
  startLabel,
  onStart,
  startTestID,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.card, open && styles.cardOn]} testID={testID}>
      <Pressable
        testID={testID ? `${testID}-head` : undefined}
        onPress={onToggle}
        disabled={!onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        {badges ? <View style={styles.badges}>{badges}</View> : null}
        <View style={styles.headText}>
          <Text style={styles.name}>{name}</Text>
          {meta ? <Text style={styles.muted}>{meta}</Text> : null}
        </View>
        {aside}
      </Pressable>
      <Unfold open={open}>
        <View style={styles.body}>
          {pills?.length ? (
            <View style={styles.pills}>
              {pills.map((p) => (
                <Pressable
                  key={p.id}
                  testID={`pill-${p.id}`}
                  disabled={!p.onPress}
                  onPress={p.onPress}
                  style={({ pressed }) => [styles.pill, p.onPress && styles.pillEdit, p.random && styles.pillRandom, pressed && styles.pressed]}
                >
                  <Text style={[styles.pillText, (p.onPress || p.random) && styles.pillTextEdit]} numberOfLines={1}>
                    {p.label}
                  </Text>
                  {p.onPress ? <CaretRight size={12} color={colors.brandPrimary} weight="bold" /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          {counts && onCount ? (
            <View style={styles.row}>
              {countLabel ? <Text style={styles.rowLabel}>{countLabel}</Text> : null}
              {counts.map((n) => (
                <Chip key={n} testID={`count-${n}`} label={String(n)} selected={count === n} onPress={() => onCount(n)} />
              ))}
            </View>
          ) : null}
          {extra}
          {record ? <Text style={styles.muted}>{record}</Text> : null}
          {warning}
          <Pressable testID={startTestID} onPress={onStart} style={({ pressed }) => [styles.start, pressed && styles.pressed]}>
            <Play size={22} color={colors.onBrandPrimary} weight="fill" />
            <Text style={styles.startText} numberOfLines={1}>
              {startLabel}
            </Text>
          </Pressable>
        </View>
      </Unfold>
    </View>
  );
}

/** A game that opens its own screen (its levels, records, results): same card, with an arrow. */
export function GameLink({
  testID,
  name,
  meta,
  aside,
  onPress,
  disabled,
}: {
  testID?: string;
  name: string;
  meta?: string;
  aside?: ReactNode;
  onPress: () => void;
  disabled?: string; // a reason: the game is shown greyed out, with this label, and cannot be opened
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!!disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.card, styles.head, !!disabled && styles.disabled, pressed && styles.pressed]}
    >
      <View style={styles.headText}>
        <Text style={styles.name}>{name}</Text>
        {meta ? <Text style={styles.muted}>{meta}</Text> : null}
      </View>
      {disabled ? <Text style={styles.disabledTag}>{disabled}</Text> : aside}
      {disabled ? null : <CaretRight size={16} color={colors.onSurfaceTertiary} weight="bold" />}
    </Pressable>
  );
}

/** Two-way choice inside a card (Au hasard / Mes points faibles…). */
export function Segment<T extends string>({ value, options, onChange, testID }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.segment} testID={testID}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} testID={testID ? `${testID}-${o.id}` : undefined} onPress={() => onChange(o.id)} style={[styles.segBtn, on && styles.segBtnOn]}>
            <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One setting = one sheet: its choices, applied at once (a single choice closes the sheet). */
export type OptionSheetDef = {
  title: string;
  hint?: string;
  multi?: boolean;
  options: { id: string; label: string; selected: boolean }[];
  onPick: (id: string) => void;
};

export function OptionSheet({ def, onClose }: { def: OptionSheetDef | null; onClose: () => void }) {
  const styles = useStyles();
  return (
    <Sheet visible={!!def} onClose={onClose} title={def?.title ?? ""} testID="option-sheet">
      {def ? (
        <View style={styles.sheetBody}>
          {def.hint ? <Text style={styles.muted}>{def.hint}</Text> : null}
          <View style={styles.sheetChoices}>
            {def.options.map((o) => (
              <Chip
                key={o.id}
                testID={`option-${o.id}`}
                label={o.label}
                selected={o.selected}
                onPress={() => {
                  def.onPick(o.id);
                  if (!def.multi) onClose();
                }}
              />
            ))}
          </View>
          {def.multi ? (
            <Pressable testID="option-sheet-ok" onPress={onClose} style={({ pressed }) => [styles.ok, pressed && styles.pressed]}>
              <Text style={styles.okText}>{tr("OK")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

/** A family of games: small-caps title + a plain explanation (never in a frame). */
export function FamilyTitle({ title, lead }: { title: string; lead?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.family}>
      <Text style={styles.familyTitle}>{title}</Text>
      {lead ? <Text style={styles.muted}>{lead}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  disabled: { opacity: 0.55 },
  disabledTag: { fontFamily: fonts.text, fontSize: 10, fontWeight: "600", letterSpacing: 0.4, color: c.onSurfaceTertiary, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, overflow: "hidden" },
  card: { borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: "rgba(28,30,36,0.80)" },
  cardOn: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  badges: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 60 },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 16, fontWeight: "700", color: c.onSurface },
  muted: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, lineHeight: 18 },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { height: 30, maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary },
  pillEdit: { borderWidth: 1, borderColor: c.brandPrimary },
  pillRandom: { borderWidth: 1, borderColor: c.brandPrimary },
  pillText: { flexShrink: 1, fontFamily: fonts.text, fontSize: 12, color: c.onSurfaceSecondary },
  pillTextEdit: { color: c.brandPrimary },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  rowLabel: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary, marginRight: 4 },
  start: { marginTop: spacing.xs, height: 56, borderRadius: radius.pill, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  startText: { flexShrink: 1, fontFamily: fonts.display, fontSize: 17, fontWeight: "700", color: c.onBrandPrimary },
  pressed: { opacity: 0.85 },
  segment: { flexDirection: "row", padding: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  segBtn: { flex: 1, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  segBtnOn: { backgroundColor: c.surfaceTertiary },
  segText: { fontFamily: fonts.text, fontSize: 13, color: c.onSurfaceTertiary },
  segTextOn: { color: c.onSurface, fontWeight: "700" },
  sheetBody: { paddingHorizontal: spacing.lg, gap: spacing.md },
  sheetChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  ok: { height: 48, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  okText: { fontFamily: fonts.display, fontSize: 15, fontWeight: "700", color: c.onSurface },
  family: { gap: 4, paddingTop: spacing.sm, paddingBottom: 2 },
  familyTitle: { fontFamily: fonts.text, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "600", color: c.onSurfaceTertiary },
}));
