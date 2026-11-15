import { TUNING, cellKey, pcOf, type BoxWindow, type FretLoc, type Formula, type PathStep } from "@/src/music/theory";

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

/** Highest tempo (beats per minute, quarter notes) for an exercise: its fastest notes stay playable. */
export function maxBpmFor(id: ExerciseId): number {
  const def = EXERCISES.find((e) => e.id === id) ?? EXERCISES[0];
  return Math.min(MAX_BPM, Math.floor(60000 / (def.perBeat * MIN_NOTE_MS)));
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
