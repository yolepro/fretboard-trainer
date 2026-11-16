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
  const down = up
    .slice(0, -1)
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

/** Sets of adjacent strings an exercise can use: as many strings as notes per group (low string first). */
export function stringSetsFor(id: ExerciseId): StringSet[] {
  const def = EXERCISES.find((e) => e.id === id) ?? EXERCISES[0];
  const k = def.offsets.length;
  const sets: StringSet[] = [];
  for (let low = TUNING.length - 1; low - (k - 1) >= 0; low--) {
    sets.push({ low, strings: Array.from({ length: k }, (_, j) => low - j) });
  }
  return sets;
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
 * neck allows. The way down mirrors the way up (groups reversed, each played backwards, top group once).
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
  // Notes of the group starting at ladder index i, one per string. A note that would fall below the open string
  // (or below the previous note) goes up an octave, so the lowest groups (e.g. E-F# on the low E string) exist too.
  const placeGroup = (i: number): { midi: number; fret: number }[] | null => {
    const out: { midi: number; fret: number }[] = [];
    let prev = -Infinity;
    for (let j = 0; j < def.offsets.length; j++) {
      let p = ladder[i + def.offsets[j]];
      if (p === undefined) return null;
      const open = TUNING[set.strings[j]];
      if (j === 0 && p < open) return null; // the first note is never moved: the route starts on the lowest such note
      while (p < open || p <= prev) p += 12;
      const fret = p - open;
      if (fret > FRET_COUNT) return null;
      out.push({ midi: p, fret });
      prev = p;
    }
    return out;
  };
  const fretsOf = (i: number) => placeGroup(i);
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
    up.push(frets.map((n, j) => ({ midi: n.midi, loc: { string: set.strings[j], fret: n.fret } })));
  }
  const down = up
    .slice(0, -1)
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
