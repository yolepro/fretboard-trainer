// “Challenges” (S’exercer): find notes on the neck. One round = one position to fill.
import { SCALES, TUNING, buildDegreeMap, pcOf, scaleBoxes, type Formula } from "@/src/music/theory";

export type ChallengeKind = "degree" | "scale";
export type Order = "free" | "up";
export type InputMode = "both" | "touch" | "mic";

export type ChallengeOptions = {
  rootPc: number;
  randomKey: boolean;
  scaleId: string;
  degrees: string[]; // interval labels to find (degree kind), e.g. ["3"], ["3", "7"]
  position: number; // 0..4, or -1 = random each round
  order: Order; // scale kind only
  rounds: number;
  input: InputMode;
};

export const DEFAULT_CHALLENGE: ChallengeOptions = {
  rootPc: 0,
  randomKey: false,
  scaleId: "major",
  degrees: ["3"],
  position: 0,
  order: "free",
  rounds: 5,
  input: "both",
};

/** Scales offered. Degree challenges: the key context (major / natural minor). */
export const DEGREE_SCALES = ["major", "minor"];
export const SCALE_CHOICES = ["major", "minor", "pentamin", "pentamaj", "blues", "dorian", "mixolydian", "harmonic"];

export const scaleOf = (id: string): Formula => SCALES.find((s) => s.id === id) ?? SCALES[0];

export type Cell = { string: number; fret: number; midi: number; label: string; num: number };
export const cellId = (c: { string: number; fret: number }) => `${c.string}-${c.fret}`;

export type Round = {
  rootPc: number;
  position: number; // 0..4
  min: number;
  max: number;
  targets: Cell[]; // what must be found (ascending pitch when the order matters)
  tonics: Cell[]; // degree kind, tonic not asked: shown as landmarks
};

export function buildRound(kind: ChallengeKind, o: ChallengeOptions, rootPc: number, position: number): Round {
  const formula = scaleOf(o.scaleId);
  const box = scaleBoxes(rootPc, formula, true)[position];
  const degMap = buildDegreeMap(rootPc, formula);
  const cells: Cell[] = [];
  box.cells?.forEach((key) => {
    const [string, fret] = key.split(":").map(Number);
    const midi = TUNING[string] + fret;
    const iv = degMap.get(pcOf(midi));
    if (iv) cells.push({ string, fret, midi, label: iv.label, num: iv.num });
  });
  cells.sort((a, b) => a.midi - b.midi);
  const targets = kind === "degree" ? cells.filter((c) => o.degrees.includes(c.label)) : cells;
  const tonics = kind === "degree" && !o.degrees.includes("1") ? cells.filter((c) => c.label === "1") : [];
  return { rootPc, position, min: box.min, max: box.max, targets, tonics };
}

/** Next round's key and position (random ones change every round, never twice the same in a row). */
export function nextSetting(o: ChallengeOptions, prev?: { rootPc: number; position: number }) {
  const rnd = (n: number, avoid?: number) => {
    let x = Math.floor(Math.random() * n);
    if (n > 1 && x === avoid) x = (x + 1 + Math.floor(Math.random() * (n - 1))) % n;
    return x;
  };
  return {
    rootPc: o.randomKey ? rnd(12, prev?.rootPc) : o.rootPc,
    position: o.position < 0 ? rnd(5, prev?.position) : o.position,
  };
}

export const challengeSection = (kind: ChallengeKind) => `find-${kind}`;
export const challengeBestKey = (kind: ChallengeKind, rounds: number) => `fretstudio_chbest_${kind}_${rounds}`;
export type ChallengeBest = { timeMs: number; errors: number; at: number };

/** Interval label for display: b3 → ♭3, #4 → ♯4. */
export const prettyLabel = (l: string) => l.replace(/^b/, "♭").replace(/^#/, "♯");
