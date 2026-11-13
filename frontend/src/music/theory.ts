import type { ThemeColors } from "@/src/theme";

export type DegreeKey = "root" | "third" | "fifth" | "seventh" | "ninth" | "eleventh" | "thirteenth";

export const DEGREE_ORDER: DegreeKey[] = ["root", "third", "fifth", "seventh", "ninth", "eleventh", "thirteenth"];

export const DEGREE_META: Record<
  DegreeKey,
  { label: string; name: string; color: keyof ThemeColors; on: keyof ThemeColors }
> = {
  root: { label: "Tonique", name: "tonique", color: "degreeRoot", on: "onDegreeRoot" },
  third: { label: "3ce", name: "tierce", color: "degree3rd", on: "onDegree3rd" },
  fifth: { label: "5te", name: "quinte", color: "degree5th", on: "onDegree5th" },
  seventh: { label: "7e", name: "septième", color: "degree7th", on: "onDegree7th" },
  ninth: { label: "9e", name: "neuvième", color: "degree9th", on: "onDegree9th" },
  eleventh: { label: "11e", name: "onzième", color: "degree11th", on: "onDegree11th" },
  thirteenth: { label: "13e", name: "treizième", color: "degree13th", on: "onDegree13th" },
};

export function degreeKeyFromNum(n: number): DegreeKey {
  switch (n) {
    case 1:
      return "root";
    case 3:
      return "third";
    case 5:
      return "fifth";
    case 7:
      return "seventh";
    case 2:
    case 9:
      return "ninth";
    case 4:
    case 11:
      return "eleventh";
    default:
      return "thirteenth";
  }
}

export type IntervalDef = { semi: number; num: number; label: string };
export type Formula = { id: string; name: string; symbol: string; group: string; intervals: IntervalDef[] };

const iv = (semi: number, num: number, label: string): IntervalDef => ({ semi, num, label });

export const SCALES: Formula[] = [
  { id: "major", name: "Majeure", symbol: "maj", group: "Diatonique", intervals: [iv(0, 1, "1"), iv(2, 2, "2"), iv(4, 3, "3"), iv(5, 4, "4"), iv(7, 5, "5"), iv(9, 6, "6"), iv(11, 7, "7")] },
  { id: "minor", name: "Mineure naturelle", symbol: "m", group: "Diatonique", intervals: [iv(0, 1, "1"), iv(2, 2, "2"), iv(3, 3, "b3"), iv(5, 4, "4"), iv(7, 5, "5"), iv(8, 6, "b6"), iv(10, 7, "b7")] },
  { id: "harmonic", name: "Mineure harmonique", symbol: "m harm", group: "Mineures", intervals: [iv(0, 1, "1"), iv(2, 2, "2"), iv(3, 3, "b3"), iv(5, 4, "4"), iv(7, 5, "5"), iv(8, 6, "b6"), iv(11, 7, "7")] },
  { id: "melodic", name: "Mineure mélodique", symbol: "m mél", group: "Mineures", intervals: [iv(0, 1, "1"), iv(2, 2, "2"), iv(3, 3, "b3"), iv(5, 4, "4"), iv(7, 5, "5"), iv(9, 6, "6"), iv(11, 7, "7")] },
  { id: "pentamaj", name: "Pentatonique majeure", symbol: "penta", group: "Pentatoniques", intervals: [iv(0, 1, "1"), iv(2, 2, "2"), iv(4, 3, "3"), iv(7, 5, "5"), iv(9, 6, "6")] },
  { id: "pentamin", name: "Pentatonique mineure", symbol: "m penta", group: "Pentatoniques", intervals: [iv(0, 1, "1"), iv(3, 3, "b3"), iv(5, 4, "4"), iv(7, 5, "5"), iv(10, 7, "b7")] },
  { id: "blues", name: "Blues", symbol: "blues", group: "Pentatoniques", intervals: [iv(0, 1, "1"), iv(3, 3, "b3"), iv(5, 4, "4"), iv(6, 5, "b5"), iv(7, 5, "5"), iv(10, 7, "b7")] },
  { id: "dorian", name: "Dorien", symbol: "dor", group: "Modes", intervals: [iv(0, 1, "1"), iv(2, 2, "2"), iv(3, 3, "b3"), iv(5, 4, "4"), iv(7, 5, "5"), iv(9, 6, "6"), iv(10, 7, "b7")] },
  { id: "phrygian", name: "Phrygien", symbol: "phr", group: "Modes", intervals: [iv(0, 1, "1"), iv(1, 2, "b2"), iv(3, 3, "b3"), iv(5, 4, "4"), iv(7, 5, "5"), iv(8, 6, "b6"), iv(10, 7, "b7")] },
  { id: "lydian", name: "Lydien", symbol: "lyd", group: "Modes", intervals: [iv(0, 1, "1"), iv(2, 2, "2"), iv(4, 3, "3"), iv(6, 4, "#4"), iv(7, 5, "5"), iv(9, 6, "6"), iv(11, 7, "7")] },
  { id: "mixolydian", name: "Mixolydien", symbol: "mixo", group: "Modes", intervals: [iv(0, 1, "1"), iv(2, 2, "2"), iv(4, 3, "3"), iv(5, 4, "4"), iv(7, 5, "5"), iv(9, 6, "6"), iv(10, 7, "b7")] },
  { id: "locrian", name: "Locrien", symbol: "loc", group: "Modes", intervals: [iv(0, 1, "1"), iv(1, 2, "b2"), iv(3, 3, "b3"), iv(5, 4, "4"), iv(6, 5, "b5"), iv(8, 6, "b6"), iv(10, 7, "b7")] },
];

export const CHORDS: Formula[] = [
  { id: "maj", name: "Majeur", symbol: "", group: "Triades", intervals: [iv(0, 1, "1"), iv(4, 3, "3"), iv(7, 5, "5")] },
  { id: "min", name: "Mineur", symbol: "m", group: "Triades", intervals: [iv(0, 1, "1"), iv(3, 3, "b3"), iv(7, 5, "5")] },
  { id: "dim", name: "Diminué", symbol: "dim", group: "Triades", intervals: [iv(0, 1, "1"), iv(3, 3, "b3"), iv(6, 5, "b5")] },
  { id: "aug", name: "Augmenté", symbol: "aug", group: "Triades", intervals: [iv(0, 1, "1"), iv(4, 3, "3"), iv(8, 5, "#5")] },
  { id: "sus2", name: "Sus2", symbol: "sus2", group: "Triades", intervals: [iv(0, 1, "1"), iv(2, 2, "2"), iv(7, 5, "5")] },
  { id: "sus4", name: "Sus4", symbol: "sus4", group: "Triades", intervals: [iv(0, 1, "1"), iv(5, 4, "4"), iv(7, 5, "5")] },
  { id: "dom7", name: "Septième", symbol: "7", group: "Septièmes", intervals: [iv(0, 1, "1"), iv(4, 3, "3"), iv(7, 5, "5"), iv(10, 7, "b7")] },
  { id: "maj7", name: "Majeur 7", symbol: "maj7", group: "Septièmes", intervals: [iv(0, 1, "1"), iv(4, 3, "3"), iv(7, 5, "5"), iv(11, 7, "7")] },
  { id: "m7", name: "Mineur 7", symbol: "m7", group: "Septièmes", intervals: [iv(0, 1, "1"), iv(3, 3, "b3"), iv(7, 5, "5"), iv(10, 7, "b7")] },
  { id: "m7b5", name: "Demi-diminué", symbol: "m7b5", group: "Septièmes", intervals: [iv(0, 1, "1"), iv(3, 3, "b3"), iv(6, 5, "b5"), iv(10, 7, "b7")] },
  { id: "dim7", name: "Diminué 7", symbol: "dim7", group: "Septièmes", intervals: [iv(0, 1, "1"), iv(3, 3, "b3"), iv(6, 5, "b5"), iv(9, 7, "bb7")] },
  { id: "six", name: "Sixte", symbol: "6", group: "Étendus", intervals: [iv(0, 1, "1"), iv(4, 3, "3"), iv(7, 5, "5"), iv(9, 13, "6")] },
  { id: "m6", name: "Mineur 6", symbol: "m6", group: "Étendus", intervals: [iv(0, 1, "1"), iv(3, 3, "b3"), iv(7, 5, "5"), iv(9, 13, "6")] },
  { id: "add9", name: "Add9", symbol: "add9", group: "Étendus", intervals: [iv(0, 1, "1"), iv(4, 3, "3"), iv(7, 5, "5"), iv(14, 9, "9")] },
  { id: "dom9", name: "Neuvième", symbol: "9", group: "Étendus", intervals: [iv(0, 1, "1"), iv(4, 3, "3"), iv(7, 5, "5"), iv(10, 7, "b7"), iv(14, 9, "9")] },
  { id: "maj9", name: "Majeur 9", symbol: "maj9", group: "Étendus", intervals: [iv(0, 1, "1"), iv(4, 3, "3"), iv(7, 5, "5"), iv(11, 7, "7"), iv(14, 9, "9")] },
  { id: "m9", name: "Mineur 9", symbol: "m9", group: "Étendus", intervals: [iv(0, 1, "1"), iv(3, 3, "b3"), iv(7, 5, "5"), iv(10, 7, "b7"), iv(14, 9, "9")] },
  { id: "dom11", name: "Onzième", symbol: "11", group: "Étendus", intervals: [iv(0, 1, "1"), iv(4, 3, "3"), iv(7, 5, "5"), iv(10, 7, "b7"), iv(14, 9, "9"), iv(17, 11, "11")] },
  { id: "m11", name: "Mineur 11", symbol: "m11", group: "Étendus", intervals: [iv(0, 1, "1"), iv(3, 3, "b3"), iv(7, 5, "5"), iv(10, 7, "b7"), iv(14, 9, "9"), iv(17, 11, "11")] },
  { id: "dom13", name: "Treizième", symbol: "13", group: "Étendus", intervals: [iv(0, 1, "1"), iv(4, 3, "3"), iv(7, 5, "5"), iv(10, 7, "b7"), iv(14, 9, "9"), iv(21, 13, "13")] },
];

export type Notation = "english" | "latin";
export type Accidental = "sharp" | "flat";

const NAMES: Record<Notation, Record<Accidental, string[]>> = {
  english: {
    sharp: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
    flat: ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"],
  },
  latin: {
    sharp: ["Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"],
    flat: ["Do", "Réb", "Ré", "Mib", "Mi", "Fa", "Solb", "Sol", "Lab", "La", "Sib", "Si"],
  },
};

export const pcOf = (midi: number) => ((midi % 12) + 12) % 12;
export const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;
export const noteName = (pc: number, notation: Notation, acc: Accidental) => NAMES[notation][acc][pcOf(pc)];
export const midiToFreq = (midi: number, a4 = 440) => a4 * Math.pow(2, (midi - 69) / 12);
export const freqToMidiFloat = (freq: number, a4 = 440) => 69 + 12 * Math.log2(freq / a4);

// Standard tuning, displayed top (high e) to bottom (low E)
export const TUNING = [64, 59, 55, 50, 45, 40];
export const STRING_LABELS = ["e", "B", "G", "D", "A", "E"];
export const FRET_COUNT = 24;
export const SINGLE_MARKERS = [3, 5, 7, 9, 15, 17, 19, 21];
export const DOUBLE_MARKERS = [12, 24];
export const OCTAVES = [2, 3, 4, 5, 6];

export function buildDegreeMap(rootPc: number, formula: Formula): Map<number, IntervalDef> {
  const map = new Map<number, IntervalDef>();
  formula.intervals.forEach((i) => {
    const pc = pcOf(rootPc + i.semi);
    if (!map.has(pc)) map.set(pc, i);
  });
  return map;
}

export function formulaDegrees(formula: Formula): DegreeKey[] {
  const set = new Set(formula.intervals.map((i) => degreeKeyFromNum(i.num)));
  return DEGREE_ORDER.filter((d) => set.has(d));
}

// ---- Scale boxes (5 positions) ----
export type BoxWindow = { min: number; max: number };

/**
 * 5 positions derived from the parent pentatonic (major if the formula has a major 3rd, else minor).
 * Each box chains 2 pentatonic notes per string from low E to high e, starting on a pentatonic note
 * of the low E string. Boxes are folded into frets 0–12 when possible and sorted by fret, then the list is
 * rotated by one: the second box by fret is Pos. 1 and the lowest box becomes Pos. 5.
 * Every note of the selected scale/chord inside the box's fret window [min, max] is shown.
 * Each box also exists one octave higher (see boxVariant): variant 0 = 1/2 (as computed), variant 1 = 2/2 (+12 frets).
 */
export function scaleBoxes(rootPc: number, formula: Formula): BoxWindow[] {
  const semis = new Set(formula.intervals.map((i) => pcOf(i.semi)));
  const penta = semis.has(4) ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10];
  const pcs = new Set(penta.map((s) => pcOf(rootPc + s)));
  const nextAbove = (m: number) => {
    let x = m + 1;
    while (!pcs.has(pcOf(x))) x++;
    return x;
  };
  const rootFret = pcOf(rootPc - 4);
  const sorted = penta.map((s) => {
    let current = TUNING[5] + rootFret + s;
    let min = Infinity;
    let max = -Infinity;
    for (let str = 5; str >= 0; str--) {
      for (let n = 0; n < 2; n++) {
        if (!(str === 5 && n === 0)) current = nextAbove(current);
        const fret = current - TUNING[str];
        min = Math.min(min, fret);
        max = Math.max(max, fret);
      }
    }
    while (min < 0) {
      min += 12;
      max += 12;
    }
    while (min - 12 >= 0) {
      min -= 12;
      max -= 12;
    }
    return { min, max: Math.min(max, FRET_COUNT) };
  }).sort((a, b) => a.min - b.min);
  // Shift by one: the former Pos. 2 becomes Pos. 1, the former Pos. 1 goes last.
  return [...sorted.slice(1), sorted[0]];
}

/** Homologous position: variant 0 = the box as computed (1/2), variant 1 = same box 12 frets higher (2/2). */
export function boxVariant(box: BoxWindow, variant: number): BoxWindow {
  if (variant !== 1) return box;
  return { min: box.min + 12, max: Math.min(box.max + 12, FRET_COUNT) };
}

// ---- Listening path ----
export type FretLoc = { string: number; fret: number };
export type PathStep = { midi: number; loc: FretLoc | null };

/** Every place on the neck where `midi` sounds. */
function locationsOf(midi: number): FretLoc[] {
  const out: FretLoc[] = [];
  TUNING.forEach((open, string) => {
    const fret = midi - open;
    if (fret >= 0 && fret <= FRET_COUNT) out.push({ string, fret });
  });
  return out;
}

/**
 * Notes played by "Écouter", each with the single place on the neck that is highlighted while it sounds.
 * - The path starts on the root and climbs to the root one octave higher (scales), or through the chord tones.
 * - With a position selected, notes are taken inside its fret window; otherwise anywhere on the neck.
 * - When a pitch exists in several places, the one closest to the leftmost fret of the position wins
 *   (closest to fret 1 when no position is selected).
 */
export function playbackPath(rootPc: number, formula: Formula, isScale: boolean, range: BoxWindow | null): PathStep[] {
  const semis = formula.intervals.map((i) => i.semi).sort((a, b) => a - b);
  if (isScale) semis.push(12);
  const anchor = range ? range.min : 1;
  const inWindow = (f: number) => !range || (f >= range.min && f <= range.max);
  const dist = (l: FretLoc) => Math.abs(l.fret - anchor);

  const pick = (midi: number): FretLoc | null => {
    const all = locationsOf(midi);
    const inside = all.filter((l) => inWindow(l.fret));
    const pool = inside.length ? inside : all;
    if (!pool.length) return null;
    return [...pool].sort((a, b) => dist(a) - dist(b) || a.fret - b.fret)[0];
  };

  const lowest = TUNING[TUNING.length - 1];
  const highest = TUNING[0] + FRET_COUNT;
  const roots: number[] = [];
  for (let m = lowest; m <= highest; m++) if (pcOf(m) === pcOf(rootPc)) roots.push(m);

  const rank = (m: number) => {
    const l = pick(m);
    return [l && inWindow(l.fret) ? 0 : 1, l ? dist(l) : 99, m];
  };
  roots.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
  });

  let fallback: PathStep[] | null = null;
  for (const start of roots) {
    const steps = semis.map((s) => ({ midi: start + s, loc: pick(start + s) }));
    if (steps.every((s) => s.loc)) return steps;
    if (!fallback) fallback = steps;
  }
  return fallback ?? [];
}
