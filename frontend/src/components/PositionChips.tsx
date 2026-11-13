import React from "react";

import { Chip, ChipRow } from "@/src/components/Chip";
import { boxVariant, type BoxWindow } from "@/src/music/theory";

type Props = {
  boxes: BoxWindow[];
  selected: number | null;
  /** Per-position variant: 0 = 1/2 (low), 1 = 2/2 (octave +12). Missing entries mean 0. */
  variants?: number[];
  /** Tapping a position selects it; tapping the selected one again switches its variant (handled by the parent). */
  onChange: (i: number | null) => void;
  prefix?: string;
};

export function PositionChips({ boxes, selected, variants = [], onChange, prefix = "position" }: Props) {
  return (
    <ChipRow testID={`${prefix}-selector`}>
      <Chip testID={`${prefix}-all`} label="Tout le manche" selected={selected === null} onPress={() => onChange(null)} />
      {boxes.map((box, i) => {
        const variant = variants[i] ?? 0;
        const b = boxVariant(box, variant);
        return (
          <Chip
            key={i}
            testID={`${prefix}-${i + 1}`}
            label={`Pos. ${i + 1} · ${b.min}–${b.max} · ${variant + 1}/2`}
            selected={selected === i}
            onPress={() => onChange(i)}
          />
        );
      })}
    </ChipRow>
  );
}
