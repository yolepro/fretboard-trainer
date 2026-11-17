import { FRET_COUNT, TUNING, cellKey, pcOf, type BoxWindow, type FretLoc, type Formula, type PathStep } from "@/src/music/theory";

export type ExerciseId = "scale" | "thirds" | "triads" | "sevenths";

export type ExerciseDef = {
  id: ExerciseId;
  name: string;
  /** Scale steps (0 = first note of the group) stacked on each degree of the position. */
  offsets: number[];
  /** Notes played per beat (quarter note): the group size, so one group = one beat in the score. */
  perBeat: number;
  description: string;
};

export const EXERCISES: ExerciseDef[] = [
  { id: "scale", name: "Gamme", offsets: [0], perBeat: 2, description: "Toutes les notes de la position, de la plus grave à la plus aiguë, puis retour (2 notes par temps)." },
  { id: "thirds", name: "Tierces", offsets: [0, 2], perBeat: 2, description: "1-3, 2-4, 3-5… en montant, puis retour en descendant (2 notes par temps)." },
  { id: "triads", name: "Triades", offsets: [0, 2, 4], perBeat: 3, description: "1-3-5, 2-4-6, 3-5-7… (arpèges de triades sur chaque degré), en triolets : 3 notes par temps." },
  { id: "sevenths", name: "Triades 7e", offsets: [0, 2, 4, 6], perBeat: 4, description: "1-3-5-7, 2-4-6-8… (arpèges de septième sur chaque degré), en doubles croches : 4 notes par temps." },
];

/** Which exercises make sense for a scale: stacked thirds need a 7-note scale for triads / sevenths. */
export function exerciseAllowed(id: ExerciseId, formula: Formula): boolean {
  if (id === "scale") return true;
  if (formula.special) return false;
  if (id === "thirds") return true;
  return formula.intervals.length === 7;
}

/**
 * The notes of a position as a ladder: every distinct pitch shown, lowest first. The ladder stops at the first
 * scale note that is missing (e.g. a position cut by the end of the neck), so consecutive entries are always
 * consecutive degrees of the scale.
 */
/**
 * Every note of the formula lit in a window, from the lowest to the highest (one entry per pitch). Unlike the ladder
 * below, a missing note in the middle doesn't stop the list: used for chords, whose positions can have gaps.
 */
export function windowNotes(rootPc: number, formula: Formula, window: BoxWindow): PathStep[] {
  const pcs = new Set(formula.intervals.map((i) => pcOf(rootPc + i.semi)));
  const byPitch = new Map<number, FretLoc>();
  TUNING.forEach((open, string) => {
    for (let fret = Math.max(0, window.min); fret <= Math.min(FRET_COUNT, window.max); fret++) {
      const midi = open + fret;
      if (!pcs.has(pcOf(midi))) continue;
      if (window.cells && !window.cells.has(cellKey(string, fret))) continue;
      const prev = byPitch.get(midi);
      if (!prev || string > prev.string) byPitch.set(midi, { string, fret });
    }
  });
  return [...byPitch.entries()].sort((a, b) => a[0] - b[0]).map(([midi, loc]) => ({ midi, loc }));
}

export function positionLadder(rootPc: number, formula: Formula, window: BoxWindow): PathStep[] {
  const pcs = new Set(formula.intervals.map((i) => pcOf(rootPc + i.semi)));
  const byPitch = new Map<number, FretLoc>();
  TUNING.forEach((open, string) => {
    for (let fret = window.min; fret <= window.max; fret++) {
      const midi = open + fret;
      if (!pcs.has(pcOf(midi))) continue;
      if (window.cells && !window.cells.has(cellKey(string, fret))) continue;
      const prev = byPitch.get(midi);
      // Same pitch on two strings (windows without exact cells): keep the lowest-pitched string.
      if (!prev || string > prev.string) byPitch.set(midi, { string, fret });
    }
  });
  const sorted = [...byPitch.entries()].sort((a, b) => a[0] - b[0]).map(([midi, loc]) => ({ midi, loc }));
  const out: PathStep[] = [];
  for (const step of sorted) {
    if (out.length) {
      let next = out[out.length - 1].midi + 1;
      while (!pcs.has(pcOf(next))) next++;
      if (next !== step.midi) break;
    }
    out.push(step);
  }
  return out;
}

/** Fastest note allowed (ms): below this the samples blur and the display can't follow. */
const MIN_NOTE_MS = 110;
export const MAX_BPM = 200;
export const MIN_BPM = 30;

/**
 * Pulse of an exercise. Normal pace: quarter-note pulse, a group per pulse (4/4). Slow pace: a group lasts 2 quarter
 * notes; the triplets are then felt on the half note (2/2: 3 notes per pulse), the others stay on the quarter note.
 */
export function pulseOf(id: ExerciseId, slow = false): { half: boolean; barPulses: number; notesPerPulse: number } {
  const def = EXERCISES.find((e) => e.id === id) ?? EXERCISES[0];
  if (!slow) return { half: false, barPulses: 4, notesPerPulse: def.perBeat };
  if (def.perBeat === 3) return { half: true, barPulses: 2, notesPerPulse: 3 };
  return { half: false, barPulses: 4, notesPerPulse: def.perBeat / 2 };
}

/** Highest tempo (pulses per minute) for an exercise: its fastest notes stay playable. */
export function maxBpmFor(id: ExerciseId, slow = false): number {
  return Math.min(MAX_BPM, Math.floor(60000 / (pulseOf(id, slow).notesPerPulse * MIN_NOTE_MS)));
}

/**
 * The full exercise as a list of groups (one group = one beat): up through the position, then back down.
 * The descent is the same groups in reverse order, each played backwards, starting just below the top group
 * (so the top group is played once and the groups stay aligned on the beat).
 * `startOnRoot` starts (and ends) on the lowest root of the position instead of its lowest note.
 */
export function buildExerciseGroups(
  ladderIn: PathStep[],
  id: ExerciseId,
  rootPc: number,
  startOnRoot: boolean,
): PathStep[][] {
  const def = EXERCISES.find((e) => e.id === id) ?? EXERCISES[0];
  let ladder = ladderIn;
  if (startOnRoot) {
    const r = ladder.findIndex((s) => pcOf(s.midi) === pcOf(rootPc));
    if (r > 0) ladder = ladder.slice(r);
  }
  const span = def.offsets[def.offsets.length - 1];
  const up: PathStep[][] = [];
  for (let i = 0; i + span < ladder.length; i++) up.push(def.offsets.map((o) => ladder[i + o]));
  if (!up.length) return [];
  // Exact mirror of the way up: every group, the top one included, played backwards.
  const down = [...up]
    .reverse()
    .map((g) => [...g].reverse());
  return [...up, ...down];
}

/** Flat list of the notes of the exercise (see buildExerciseGroups). */
export function buildExercise(ladder: PathStep[], id: ExerciseId, rootPc: number, startOnRoot: boolean): PathStep[] {
  return buildExerciseGroups(ladder, id, rootPc, startOnRoot).flat();
}

// ---------------------------------------------------------------------------------------------------------------
// Horizontal exercises: the chord groups are played on a fixed set of adjacent strings, climbing the neck.
// ---------------------------------------------------------------------------------------------------------------

export type StringSet = { low: number; strings: number[] };

/** How many strings a group can be spread over: one note per string, or fewer strings (2 notes on some). */
export function stringCountsFor(id: ExerciseId): number[] {
  const n = (EXERCISES.find((e) => e.id === id) ?? EXERCISES[0]).offsets.length;
  return n <= 2 ? [n] : Array.from({ length: n - 1 }, (_, i) => i + 2); // triads: 2, 3 — sevenths: 2, 3, 4
}

/** Sets of `count` adjacent strings (low string first); by default as many strings as notes per group. */
export function stringSetsFor(id: ExerciseId, count?: number): StringSet[] {
  const def = EXERCISES.find((e) => e.id === id) ?? EXERCISES[0];
  const k = Math.max(1, Math.min(count ?? def.offsets.length, def.offsets.length));
  const sets: StringSet[] = [];
  for (let low = TUNING.length - 1; low - (k - 1) >= 0; low--) {
    sets.push({ low, strings: Array.from({ length: k }, (_, j) => low - j) });
  }
  return sets;
}

/** Ways to share n notes over k strings, low string first, at least one note per string (e.g. 3 over 2: [1,2], [2,1]). */
function distributions(n: number, k: number): number[][] {
  if (k === 1) return [[n]];
  const out: number[][] = [];
  for (let first = 1; first <= n - (k - 1); first++) distributions(n - first, k - 1).forEach((rest) => out.push([first, ...rest]));
  return out;
}

export type Extent = "octave" | "two" | "all";
export const EXTENTS: { id: Extent; name: string }[] = [
  { id: "octave", name: "1 octave" },
  { id: "two", name: "2 octaves" },
  { id: "all", name: "Tout le manche" },
];

/** The scale degrees (as semitones above the root, ascending), used to pick the first chord. */
export function scaleDegreesSemis(formula: Formula): number[] {
  return [...new Set(formula.intervals.map((i) => ((i.semi % 12) + 12) % 12))].sort((a, b) => a - b);
}

/**
 * Chord groups climbing the neck on one set of strings: each group stacks scale thirds (per the exercise), the 1st
 * note on the lowest string, the next ones on the strings above. The first group is the LOWEST one on these strings
 * that starts on the chosen scale degree; then the next degrees follow, one octave, two octaves or as far as the
 * neck allows. The way down mirrors the way up (groups reversed, each played backwards, top group included).
 */
export function buildHorizontalGroups(
  rootPc: number,
  formula: Formula,
  id: ExerciseId,
  set: StringSet,
  startDegree: number,
  extent: Extent,
): PathStep[][] {
  const def = EXERCISES.find((e) => e.id === id) ?? EXERCISES[0];
  const semis = scaleDegreesSemis(formula);
  const pcs = new Set(semis.map((x) => pcOf(rootPc + x)));
  const lowest = TUNING[TUNING.length - 1];
  const highest = TUNING[0] + FRET_COUNT;
  const ladder: number[] = [];
  for (let m = lowest; m <= highest; m++) if (pcs.has(pcOf(m))) ladder.push(m);
  // Notes of the group starting at ladder index i. `dist` says how many notes each string takes (low string first).
  // A group only exists when every note is really on its string (fret 0 to the last fret): no note moved to another
  // octave, so no orphan note at either end of the neck.
  const place = (i: number, dist: number[]): { midi: number; fret: number; string: number }[] | null => {
    const out: { midi: number; fret: number; string: number }[] = [];
    let j = 0;
    for (let k = 0; k < dist.length; k++) {
      for (let c = 0; c < dist[k]; c++, j++) {
        const p = ladder[i + def.offsets[j]];
        if (p === undefined) return null;
        const fret = p - TUNING[set.strings[k]];
        if (fret < 0 || fret > FRET_COUNT) return null;
        out.push({ midi: p, fret, string: set.strings[k] });
      }
    }
    return out;
  };
  // With fewer strings than notes, keep the sharing that is the easiest to finger over the whole neck:
  // the smallest stretch (widest group), then the smallest average stretch, then the most groups.
  const dists = distributions(def.offsets.length, set.strings.length);
  let dist = dists[0];
  if (dists.length > 1) {
    let bestKey: number[] | null = null;
    for (const d of dists) {
      let count = 0;
      let maxSpan = 0;
      let sum = 0;
      for (let i = 0; i < ladder.length; i++) {
        const g = place(i, d);
        if (!g) continue;
        const frets = g.map((x) => x.fret);
        const span = Math.max(...frets) - Math.min(...frets);
        count++;
        maxSpan = Math.max(maxSpan, span);
        sum += span;
      }
      if (!count) continue;
      const key = [maxSpan, sum / count, -count];
      if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
        bestKey = key;
        dist = d;
      }
    }
  }
  const fretsOf = (i: number) => place(i, dist);
  const targetPc = pcOf(rootPc + semis[Math.max(0, Math.min(startDegree, semis.length - 1))]);
  let i0 = -1;
  for (let i = 0; i < ladder.length; i++) {
    // startDegree < 0: the lowest group on these strings, whatever its first note ("whole neck").
    if ((startDegree < 0 || pcOf(ladder[i]) === targetPc) && fretsOf(i)) {
      i0 = i;
      break;
    }
  }
  if (i0 < 0) return [];
  const m = semis.length;
  const max = extent === "octave" ? m + 1 : extent === "two" ? 2 * m + 1 : Infinity;
  const up: PathStep[][] = [];
  for (let n = 0, i = i0; n < max; n++, i++) {
    const frets = fretsOf(i);
    if (!frets) break;
    up.push(frets.map((n) => ({ midi: n.midi, loc: { string: n.string, fret: n.fret } })));
  }
  // Exact mirror of the way up: every group, the top one included, played backwards.
  const down = [...up]
    .reverse()
    .map((g) => [...g].reverse());
  return [...up, ...down];
}

/** What the fretboard lights up for a horizontal route: exactly the notes played, no tinted columns. */
export function routeWindow(groups: PathStep[][], extraCells?: Set<string>): BoxWindow {
  const cells = new Set<string>(extraCells);
  let min = Infinity;
  let max = -Infinity;
  groups.flat().forEach((st) => {
    if (!st.loc) return;
    cells.add(cellKey(st.loc.string, st.loc.fret));
    min = Math.min(min, st.loc.fret);
    max = Math.max(max, st.loc.fret);
  });
  if (!cells.size) return { min: 0, max: 0, cells, noColumns: true };
  extraCells?.forEach((k) => {
    const f = Number(k.split(":")[1]);
    min = Math.min(min, f);
    max = Math.max(max, f);
  });
  return { min, max, cells, noColumns: true };
}

/**
 * Default tempo (BPM, quarter note). Normal pace (a group per beat): eighths 80, triplets 60, sixteenths 50.
 * Slow pace (a group over 2 beats, notes twice as long): 110 / 85 / 70, i.e. about 30 % slower than normal.
 */
export function defaultBpmFor(id: ExerciseId, slow = false): number {
  const per = (EXERCISES.find((e) => e.id === id) ?? EXERCISES[0]).perBeat;
  if (slow) return per >= 4 ? 70 : per === 3 ? 42 : 110; // slow triplets: 42 to the half note (= 84 to the quarter)
  return per >= 4 ? 50 : per === 3 ? 60 : 80;
}

/** Every note of the scale on the given strings, over the whole neck. */
export function scaleCellsOnStrings(rootPc: number, formula: Formula, set: StringSet): Set<string> {
  const pcs = new Set(scaleDegreesSemis(formula).map((x) => pcOf(rootPc + x)));
  const cells = new Set<string>();
  for (const s of set.strings) for (let f = 0; f <= FRET_COUNT; f++) if (pcs.has(pcOf(TUNING[s] + f))) cells.add(cellKey(s, f));
  return cells;
}
