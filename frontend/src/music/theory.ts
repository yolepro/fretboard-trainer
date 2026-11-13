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
 * With `fillGaps` (scales only), each window is widened just enough that the visible notes form an unbroken run of
 * the scale (see fillScaleGaps); the pentatonic window alone often leaves out the 4th/7th degrees at its edges.
 */
export function scaleBoxes(rootPc: number, formula: Formula, fillGaps = false): BoxWindow[] {
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
  const rotated = [...sorted.slice(1), sorted[0]];
  return fillGaps ? rotated.map((b) => fillScaleGaps(rootPc, formula, b)) : rotated;
}

/**
 * Widens a window until the scale notes it shows are consecutive: going up in pitch from the lowest to the
 * highest visible note, no scale note may be skipped (e.g. C major Pos. 2 at frets 5–8 jumped from A3 to C4;
 * B3 sits on fret 4 of the G string, so the window becomes 4–8).
 * A missing note is taken at the place closest to the window; when it is equally close on both sides,
 * the window grows to the left (lower frets).
 */
function fillScaleGaps(rootPc: number, formula: Formula, box: BoxWindow): BoxWindow {
  const pcs = new Set(formula.intervals.map((i) => pcOf(rootPc + i.semi)));
  let { min, max } = box;
  for (let guard = 0; guard < 12; guard++) {
    const seen = new Set<number>();
    TUNING.forEach((open) => {
      for (let f = min; f <= max; f++) if (pcs.has(pcOf(open + f))) seen.add(open + f);
    });
    if (seen.size < 2) break;
    const pitches = [...seen].sort((a, b) => a - b);
    let missing: number | null = null;
    for (let m = pitches[0] + 1; m < pitches[pitches.length - 1]; m++) {
      if (pcs.has(pcOf(m)) && !seen.has(m)) {
        missing = m;
        break;
      }
    }
    if (missing === null) break;
    const target = missing;
    const frets = TUNING.map((open) => target - open).filter((f) => f >= 0 && f <= FRET_COUNT);
    if (!frets.length) break;
    const away = (f: number) => (f < min ? min - f : f > max ? f - max : 0);
    frets.sort((a, b) => away(a) - away(b) || a - b);
    min = Math.min(min, frets[0]);
    max = Math.max(max, frets[0]);
  }
  return { min, max };
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
 * - The path starts on the lowest root of the position and climbs to the root one octave higher (scales),
 *   or through the chord tones.
 * - With a position selected, notes are taken inside its fret window; otherwise anywhere on the neck.
 *   If the window is cut short by the end of the neck, only the displayed notes are played.
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

  // Start on the lowest-pitched root inside the position (or on the whole neck when no position is selected).
  // Roots that only exist outside the position come last, still lowest first.
  const outside = (m: number) => {
    const l = pick(m);
    return l && inWindow(l.fret) ? 0 : 1;
  };
  roots.sort((a, b) => outside(a) - outside(b) || a - b);

  // With a position selected: if the whole path (root → octave above) fits inside the window, play it.
  // Otherwise the window is cut short by the end of the neck (e.g. the 2/2 version of the highest position):
  // play only the notes that are displayed, from the lowest root of the window upward.
  if (range && roots.length && outside(roots[0]) === 0) {
    const start = roots[0];
    const full = semis.map((s) => ({ midi: start + s, loc: pick(start + s) }));
    if (full.every((s) => s.loc && inWindow(s.loc.fret))) return full;
    const shown: PathStep[] = [];
    for (const s of semis) {
      const loc = pick(start + s);
      if (!loc || !inWindow(loc.fret)) break;
      shown.push({ midi: start + s, loc });
    }
    return shown;
  }

  let fallback: PathStep[] | null = null;
  for (const start of roots) {
    const steps = semis.map((s) => ({ midi: start + s, loc: pick(start + s) }));
    if (steps.every((s) => s.loc)) return steps;
    if (!fallback) fallback = steps;
  }
  return fallback ?? [];
}
