// “Challenges” (S’exercer): find notes on the neck. One round = one position to fill.
import { SCALES, TUNING, buildDegreeMap, pcOf, scaleBoxes, type Formula } from "@/src/music/theory";

export type ChallengeKind = "degree" | "scale";
export type Order = "free" | "up";
export type InputMode = "both" | "touch" | "mic";

export type ChallengeOptions = {
  rootPc: number;
  randomKey: boolean;
  scaleId: string; // degree kind: the key context (major / minor)
  degrees: string[]; // degree kind: the pool of interval labels, e.g. ["2", "3", "5", "7"]
  degreeMode: "mix" | "all"; // mix: one degree per round, changing every round · all: every pooled degree at once
  scales: string[]; // scale kind: the pool; with several rounds the scale changes every round
  position: number; // 0..4, or -1 = random each round
  order: Order; // scale kind only
  rounds: number;
  input: InputMode;
};

export const DEFAULT_CHALLENGE: ChallengeOptions = {
  rootPc: 0,
  randomKey: false,
  scaleId: "major",
  degrees: ["2", "3", "4", "5", "6", "7"],
  degreeMode: "mix",
  scales: ["major", "minor", "pentamin", "dorian", "mixolydian"],
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
  scaleId: string;
  degrees: string[]; // degree kind: asked in this round
  min: number;
  max: number;
  targets: Cell[]; // what must be found (ascending pitch when the order matters)
  tonics: Cell[]; // degree kind, tonic not asked: shown as landmarks
};

export function buildRound(kind: ChallengeKind, s: RoundSetting): Round {
  const { rootPc, position, scaleId, degrees } = s;
  const formula = scaleOf(scaleId);
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
  const targets = kind === "degree" ? cells.filter((c) => degrees.includes(c.label)) : cells;
  const tonics = kind === "degree" && !degrees.includes("1") ? cells.filter((c) => c.label === "1") : [];
  return { rootPc, position, scaleId, degrees, min: box.min, max: box.max, targets, tonics };
}

export type RoundSetting = { rootPc: number; position: number; scaleId: string; degrees: string[] };

/**
 * Next round. Random key / position change every round; degree challenges in “mix” ask one degree per round,
 * scale challenges pick a scale from the pool — never the same twice in a row.
 */
export function nextSetting(kind: ChallengeKind, o: ChallengeOptions, prev?: RoundSetting): RoundSetting {
  const rnd = (n: number, avoid?: number) => {
    let x = Math.floor(Math.random() * n);
    if (n > 1 && x === avoid) x = (x + 1 + Math.floor(Math.random() * (n - 1))) % n;
    return x;
  };
  const pickOther = <T,>(list: T[], last?: T) => (list.length ? list[rnd(list.length, last === undefined ? undefined : list.indexOf(last))] : undefined);
  const scaleId = kind === "scale" ? (pickOther(o.scales, prev?.scaleId) ?? "major") : o.scaleId;
  const pool = o.degrees.length ? o.degrees : ["3"];
  const degrees = kind === "degree" && o.degreeMode === "mix" ? [pickOther(pool, prev?.degrees.length === 1 ? prev.degrees[0] : undefined)!] : pool;
  return {
    rootPc: o.randomKey ? rnd(12, prev?.rootPc) : o.rootPc,
    position: o.position < 0 ? rnd(5, prev?.position) : o.position,
    scaleId,
    degrees,
  };
}

export const ROUND_CHOICES: Record<ChallengeKind, number[]> = { degree: [5, 10, 20], scale: [1, 3, 5] };

export const challengeSection = (kind: ChallengeKind) => `find-${kind}`;
export const challengeBestKey = (kind: ChallengeKind, rounds: number) => `fretstudio_chbest_${kind}_${rounds}`;
export type ChallengeBest = { timeMs: number; errors: number; at: number };

/** Interval label for display: b3 → ♭3, #4 → ♯4. */
export const prettyLabel = (l: string) => l.replace(/^b/, "♭").replace(/^#/, "♯");
