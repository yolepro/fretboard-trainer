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
/** `special`: symmetric / non-heptatonic scale — no position boxes (full neck only) and not used in ear training. */
export type Formula = { id: string; name: string; symbol: string; group: string; intervals: IntervalDef[]; special?: boolean };

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
  { id: "chromatic", name: "Chromatique", symbol: "chrom", group: "Spéciales", special: true, intervals: [iv(0, 1, "1"), iv(1, 2, "b2"), iv(2, 2, "2"), iv(3, 3, "b3"), iv(4, 3, "3"), iv(5, 4, "4"), iv(6, 5, "b5"), iv(7, 5, "5"), iv(8, 6, "b6"), iv(9, 6, "6"), iv(10, 7, "b7"), iv(11, 7, "7")] },
  { id: "wholetone", name: "Tons entiers", symbol: "tons", group: "Spéciales", special: true, intervals: [iv(0, 1, "1"), iv(2, 2, "2"), iv(4, 3, "3"), iv(6, 4, "#4"), iv(8, 5, "#5"), iv(10, 7, "b7")] },
  { id: "halfwhole", name: "Demi-ton / ton", symbol: "½-1", group: "Spéciales", special: true, intervals: [iv(0, 1, "1"), iv(1, 2, "b2"), iv(3, 3, "b3"), iv(4, 3, "3"), iv(6, 5, "#4"), iv(7, 5, "5"), iv(9, 6, "6"), iv(10, 7, "b7")] },
  { id: "wholehalf", name: "Ton / demi-ton", symbol: "1-½", group: "Spéciales", special: true, intervals: [iv(0, 1, "1"), iv(2, 2, "2"), iv(3, 3, "b3"), iv(5, 4, "4"), iv(6, 5, "b5"), iv(8, 6, "b6"), iv(9, 6, "6"), iv(11, 7, "7")] },
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
/**
 * A position. `min`/`max` are the first and last fret it uses. For scales, `cells` lists exactly which
 * notes belong to it ("string:fret" keys); without `cells` (chords) every note inside [min, max] belongs to it.
 */
export type BoxWindow = { min: number; max: number; cells?: Set<string>; second?: BoxWindow };

export const cellKey = (string: number, fret: number) => `${string}:${fret}`;

/**
 * Positions of the special scales: fixed-width fret windows anchored on the root (first window starts at the root
 * fret of the low E string), identical in every key. Every scale note inside the window belongs to the position.
 * The window is then completed note by note like any scale position (no missing note; ties extend to the right).
 *   chromatic: 3 windows of 4 frets (root, +4, +8) · whole tone: 3 windows of 5 frets (root, +4, +8)
 *   diminished (both): 4 windows of 4 frets (root, +3, +6, +9) — the same fingering moved by minor thirds.
 */
const SPECIAL_LAYOUT: Record<string, { width: number; starts: number[] }> = {
  chromatic: { width: 4, starts: [0, 4, 8] },
  wholetone: { width: 5, starts: [0, 4, 8] },
  halfwhole: { width: 4, starts: [0, 3, 6, 9] },
  wholehalf: { width: 4, starts: [0, 3, 6, 9] },
};

function specialWindows(rootFretVirtual: number, id: string): BoxWindow[] {
  const layout = SPECIAL_LAYOUT[id] ?? { width: 4, starts: [0, 4, 8] };
  return layout.starts.map((start) => ({ min: rootFretVirtual + start, max: rootFretVirtual + start + layout.width - 1 }));
}

/**
 * 5 positions derived from the parent pentatonic (major if the formula has a major 3rd, else minor).
 * Each box chains 2 pentatonic notes per string from low E to high e, starting on a pentatonic note
 * of the low E string. Numbering is anchored on the root: Pos. 1 is the box whose first low-E note is the root
 * (the major scale then shows the root as 2nd note of string 6: G = frets 2–5, C = 7–10), Pos. 2–5 follow in
 * pentatonic order. Each position has the same shape in every key; it starts within frets 0–11.
 * Every note of the selected scale/chord inside the box's fret window [min, max] is shown.
 * Each box also exists one octave higher (see boxVariant): variant 0 = 1/2 (as computed), variant 1 = 2/2 (+12 frets).
 * With `fillGaps` (scales only), each box becomes an exact set of notes (see buildScalePosition): read string by
 * string, from low E to high e, the notes follow the scale with no gap and no note repeated.
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
  // Every shape is built once in a "virtual" frame placed 12 frets above the real root fret (so the nut never
  // interferes), then shifted back down: the shape of a position is therefore identical in all 12 keys.
  const rootFret = pcOf(rootPc - 4);
  const SHIFT = 12;
  const windows: BoxWindow[] = formula.special
    ? specialWindows(rootFret + SHIFT, formula.id)
    : penta.map((s) => {
    let current = TUNING[5] + rootFret + SHIFT + s;
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
    return { min, max };
  });
  return windows.map(({ min, max }) => {
    const raw: BoxWindow = fillGaps || formula.special ? buildScalePosition(rootPc, formula, { min, max }) : { min, max };
    // Back to the real neck: shift down, then fold so the position starts within frets 0–11.
    let delta = -SHIFT;
    while (raw.min + delta < 0) delta += 12;
    while (raw.min + delta >= 12) delta -= 12;
    if (!raw.cells) return { min: raw.min + delta, max: Math.min(raw.max + delta, FRET_COUNT) };
    const shifted = (d: number) => {
      const cells = new Map<string, number>();
      raw.cells!.forEach((key) => {
        const [string, fret] = key.split(":").map(Number);
        const f = fret + d;
        if (f >= 0 && f <= FRET_COUNT) cells.set(cellKey(string, f), TUNING[string] + f);
      });
      return cells;
    };
    const toBox = (cells: Map<string, number>): BoxWindow => {
      const frets = [...cells.keys()].map(fretOfKey);
      return { min: Math.min(...frets), max: Math.max(...frets), cells: new Set(cells.keys()) };
    };
    const first = shifted(delta);
    const up = shifted(delta + 12);
    // 2/2 = same shape one octave higher; if the end of the neck would cut it, the octave below is used instead
    // when it can be completed (a note falling before the nut is re-placed at the smallest gap).
    let second: Map<string, number> = up;
    if (up.size < first.size) {
      const down = shifted(delta - 12);
      const pcs = new Set(formula.intervals.map((i) => pcOf(rootPc + i.semi)));
      fillMissingNotes(down, pcs, 0, FRET_COUNT, !!formula.special);
      if (down.size >= first.size && new Set(down.values()).size === new Set(first.values()).size) second = down;
    }
    return { ...toBox(first), second: second.size ? toBox(second) : undefined };
  });
}

const fretOfKey = (k: string) => Number(k.split(":")[1]);

/**
 * Gap filling shared by the 1/2 build and the lower 2/2 form: going up in pitch, every missing scale note is added
 * on its own at the place closest to the notes already there (smaller gaps first). Ties: the fret column holding
 * fewer scale notes, then the lower fret. Only frets in [lo, hi] are allowed.
 */
function fillMissingNotes(cells: Map<string, number>, pcs: Set<number>, lo: number, hi: number, preferHigh = false) {
  const span = () => {
    const frets = [...cells.keys()].map(fretOfKey);
    return { min: Math.min(...frets), max: Math.max(...frets) };
  };
  const columnSize = (fret: number) => TUNING.filter((open) => pcs.has(pcOf(open + fret))).length;
  for (let guard = 0; guard < 12 && cells.size > 1; guard++) {
    const seen = new Set(cells.values());
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
    const { min, max } = span();
    const places = TUNING.map((open, string) => ({ string, fret: target - open })).filter(
      (l) => l.fret >= lo && l.fret <= hi,
    );
    if (!places.length) break;
    const away = (f: number) => (f < min ? min - f : f > max ? f - max : 0);
    places.sort(
      (x, y) =>
        away(x.fret) - away(y.fret) ||
        (preferHigh ? y.fret - x.fret : columnSize(x.fret) - columnSize(y.fret) || x.fret - y.fret),
    );
    cells.set(cellKey(places[0].string, places[0].fret), target);
  }
}


/**
 * Builds the exact set of notes of a scale position from its pentatonic box.
 * 1. Core: every scale note inside the box's fret window.
 * 2. The same note may not appear twice (e.g. B on the G string and on the open B string): it is kept at the
 *    end of the lower string and removed from the start of the next one.
 * 3. Gaps: going up in pitch from the lowest to the highest note, no scale note may be skipped. Each missing note
 *    is added on its own (never a whole fret column), at the place closest to the box. When two places are equally
 *    close, the one whose fret column holds fewer scale notes wins, then the lower fret.
 *    Example, C major Pos. 2 (frets 5–8): B3 is added on the G string at fret 4; G major Pos. 4 (frets 9–12):
 *    C5 is added on the B string at fret 13, so fret 8 never appears.
 */
function buildScalePosition(rootPc: number, formula: Formula, raw: BoxWindow): BoxWindow {
  const pcs = new Set(formula.intervals.map((i) => pcOf(rootPc + i.semi)));
  const cells = new Map<string, number>(); // "string:fret" -> midi
  TUNING.forEach((open, string) => {
    for (let fret = raw.min; fret <= raw.max; fret++) {
      if (pcs.has(pcOf(open + fret))) cells.set(cellKey(string, fret), open + fret);
    }
  });

  // 2. Same pitch on two strings: keep the lowest-pitched string (highest index), drop the others.
  const byPitch = new Map<number, string[]>();
  cells.forEach((midi, key) => byPitch.set(midi, [...(byPitch.get(midi) ?? []), key]));
  byPitch.forEach((keys) => {
    if (keys.length < 2) return;
    const stringOf = (k: string) => Number(k.split(":")[0]);
    const keep = [...keys].sort((a, b) => stringOf(b) - stringOf(a))[0];
    keys.forEach((k) => k !== keep && cells.delete(k));
  });

  fillMissingNotes(cells, pcs, -12, FRET_COUNT + 24, !!formula.special);

  if (!cells.size) return raw;
  const frets = [...cells.keys()].map(fretOfKey);
  return { min: Math.min(...frets), max: Math.max(...frets), cells: new Set(cells.keys()) };
}

/** Homologous position: variant 0 = the box as computed (1/2), variant 1 = same box 12 frets higher (2/2). */
export function boxVariant(box: BoxWindow, variant: number): BoxWindow {
  if (variant !== 1) return box;
  if (box.second) return box.second;
  if (!box.cells) return { min: box.min + 12, max: Math.min(box.max + 12, FRET_COUNT) };
  const cells = new Set<string>();
  let min = Infinity;
  let max = -Infinity;
  box.cells.forEach((key) => {
    const [string, fret] = key.split(":").map(Number);
    const shifted = fret + 12;
    if (shifted > FRET_COUNT) return; // the neck stops at fret 24
    cells.add(cellKey(string, shifted));
    min = Math.min(min, shifted);
    max = Math.max(max, shifted);
  });
  if (!cells.size) return { min: Math.min(box.min + 12, FRET_COUNT), max: FRET_COUNT, cells };
  return { min, max, cells };
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
  if (formula.special && range) {
    // Special scales: play every displayed note of the window, from the lowest to the highest pitch.
    const pcs = new Set(formula.intervals.map((i) => pcOf(rootPc + i.semi)));
    const byPitch = new Map<number, FretLoc>();
    TUNING.forEach((open, string) => {
      for (let fret = range.min; fret <= range.max; fret++) {
        const midi = open + fret;
        if (!pcs.has(pcOf(midi)) || (range.cells && !range.cells.has(cellKey(string, fret)))) continue;
        const prev = byPitch.get(midi);
        if (!prev || Math.abs(fret - anchor) < Math.abs(prev.fret - anchor)) byPitch.set(midi, { string, fret });
      }
    });
    return [...byPitch.entries()].sort((a, b) => a[0] - b[0]).map(([midi, loc]) => ({ midi, loc }));
  }
  const inWindow = (l: FretLoc) =>
    !range || (range.cells ? range.cells.has(cellKey(l.string, l.fret)) : l.fret >= range.min && l.fret <= range.max);
  const dist = (l: FretLoc) => Math.abs(l.fret - anchor);

  const pick = (midi: number): FretLoc | null => {
    const all = locationsOf(midi);
    const inside = all.filter((l) => inWindow(l));
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
    return l && inWindow(l) ? 0 : 1;
  };
  roots.sort((a, b) => outside(a) - outside(b) || a - b);

  // With a position selected: if the whole path (root → octave above) fits inside the window, play it.
  // Otherwise the window is cut short by the end of the neck (e.g. the 2/2 version of the highest position):
  // play only the notes that are displayed, from the lowest root of the window upward.
  if (range && roots.length && outside(roots[0]) === 0) {
    const start = roots[0];
    const full = semis.map((s) => ({ midi: start + s, loc: pick(start + s) }));
    if (full.every((s) => s.loc && inWindow(s.loc))) return full;
    const shown: PathStep[] = [];
    for (const s of semis) {
      const loc = pick(start + s);
      if (!loc || !inWindow(loc)) break;
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
