import React from "react";

import { Chip, ChipRow } from "@/src/components/Chip";
import type { BoxWindow } from "@/src/music/theory";

type Props = {
  boxes: BoxWindow[];
  selected: number | null;
  onChange: (i: number | null) => void;
  prefix?: string;
};

export function PositionChips({ boxes, selected, onChange, prefix = "position" }: Props) {
  return (
    <ChipRow testID={`${prefix}-selector`}>
      <Chip testID={`${prefix}-all`} label="Tout le manche" selected={selected === null} onPress={() => onChange(null)} />
      {boxes.map((b, i) => (
        <Chip
          key={i}
          testID={`${prefix}-${i + 1}`}
          label={`Pos. ${i + 1} · ${b.min}–${b.max}`}
          selected={selected === i}
          onPress={() => onChange(i)}
        />
      ))}
    </ChipRow>
  );
}
