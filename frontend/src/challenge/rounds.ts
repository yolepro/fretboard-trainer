// “Challenges” (S’exercer): find notes on the neck. One round = one zone to fill (a position, or the whole neck).
import { SCALES, TUNING, buildDegreeMap, pcOf, scaleBoxes, type Formula } from "@/src/music/theory";
import { cadenceById, cadenceChords, chordLabel, chordNum, positionCells, type Chord, type ChordStyle } from "@/src/music/cadences";

export type ChallengeKind = "degree" | "scale" | "chord";
export type Order = "free" | "up";
export type InputMode = "both" | "touch" | "mic";

export type ChallengeOptions = {
  rootPc: number;
  randomKey: boolean;
  scaleId: string; // degree kind: the key context (major / minor)
  contextRandom: boolean; // degree kind: major or minor drawn every round
  degrees: string[]; // degree kind: pool of degree NUMBERS ("1".."7"); one per round, mapped to the key (3 → ♭3 in minor)
  scales: string[]; // scale kind: the pool; with several rounds the scale changes every round
  position: number; // 0..4, -1 = random each round, -2 = positions 1→5 in turn
  scope: "position" | "neck"; // neck = the 5 positions at once (no isolated notes beyond them)
  hideTonic: boolean;
  order: Order; // scale kind only
  rounds: number;
  sprintSec: number; // > 0: time trial, as many rounds as possible in this time
  naturalKeys: boolean; // random keys only on natural notes (C D E F G A B, no ♯/♭ tonic)
  input: InputMode;
  // chord kind (Trouve l’accord de la tonalité)
  cadences: string[]; // cadence ids (src/music/cadences.ts)
  chordStyle: ChordStyle; // simple = root in the bass · triads / four = the chord in a position
  cadenceOrder: "order" | "mix"; // the chords one after the other, or drawn at random
};

export const DEFAULT_CHALLENGE: ChallengeOptions = {
  rootPc: 0,
  randomKey: false,
  scaleId: "major",
  contextRandom: false,
  degrees: ["2", "3", "4", "5", "6", "7"],
  scales: ["major", "minor", "pentamin", "dorian", "mixolydian"],
  position: 0,
  scope: "position",
  hideTonic: false,
  order: "free",
  rounds: 5,
  sprintSec: 0,
  naturalKeys: false,
  input: "both",
  cadences: ["rock", "pop4"],
  chordStyle: "triads",
  cadenceOrder: "order",
};

/** Scales offered. Degree challenges: the key context (major / natural minor). */
export const DEGREE_SCALES = ["major", "minor"];
export const SCALE_CHOICES = ["major", "minor", "pentamin", "pentamaj", "blues", "dorian", "mixolydian", "harmonic"];

export const scaleOf = (id: string): Formula => SCALES.find((s) => s.id === id) ?? SCALES[0];
/** The interval label of a degree number in a scale (3 → "b3" in minor). */
export const labelOfNum = (scaleId: string, num: string) => scaleOf(scaleId).intervals.find((i) => String(i.num) === num)?.label ?? num;

export type Cell = { string: number; fret: number; midi: number; label: string; num: number };
export const cellId = (c: { string: number; fret: number }) => `${c.string}-${c.fret}`;

export type Round = {
  rootPc: number;
  position: number; // 0..4 (scope “position”)
  scope: "position" | "neck";
  scaleId: string;
  degrees: string[]; // degree kind: numbers asked in this round
  min: number;
  max: number;
  targets: Cell[]; // what must be found (ascending pitch when the order matters)
  tonics: Cell[]; // degree kind, tonic not asked: shown as landmarks
  /** chord kind: the chord asked, and how many different degrees make the round (one note per degree is enough). */
  chord?: { name: string; roman: string; cadence: string; root: number; quality: string };
  need?: number;
};

export type RoundSetting = { rootPc: number; position: number; scaleId: string; degrees: string[]; chordStep?: number };

/** The chords a chord challenge draws from: the chosen cadences, one after the other. */
export function chordPool(o: ChallengeOptions, rootPc: number): { chord: Chord; cadence: string }[] {
  const ids = o.cadences.length ? o.cadences : DEFAULT_CHALLENGE.cadences;
  return ids.flatMap((id) => {
    const c = cadenceById(id);
    return cadenceChords(c, rootPc, o.chordStyle === "four" ? "four" : "triads").map((chord) => ({ chord, cadence: c.name }));
  });
}

function buildChordRound(o: ChallengeOptions, s: RoundSetting): Round {
  const pool = chordPool(o, s.rootPc);
  const { chord, cadence } = pool[(s.chordStep ?? 0) % pool.length];
  const targets: Cell[] = [];
  let min: number;
  let max: number;
  if (o.chordStyle === "simple") {
    // Débutant: the root of the chord on the low E or A string (frets 0–12).
    min = 0;
    max = 12;
    [5, 4].forEach((string) => {
      for (let fret = 0; fret <= 12; fret++) {
        const midi = TUNING[string] + fret;
        if (pcOf(midi) === chord.root) targets.push({ string, fret, midi, label: "1", num: 1 });
      }
    });
  } else {
    const pos = positionCells(s.rootPc, s.position);
    min = pos.min;
    max = pos.max;
    for (let string = 0; string < 6; string++)
      for (let fret = min; fret <= max; fret++) {
        const midi = TUNING[string] + fret;
        if (chord.pcs.includes(pcOf(midi))) targets.push({ string, fret, midi, label: chordLabel(chord, midi), num: chordNum(chord, midi) });
      }
  }
  targets.sort((a, b) => a.midi - b.midi || a.string - b.string);
  const need = o.chordStyle === "simple" ? 1 : new Set(targets.map((t) => t.label)).size;
  return {
    rootPc: s.rootPc,
    position: s.position,
    scope: "position",
    scaleId: "major",
    degrees: [],
    min,
    max,
    targets,
    tonics: [],
    chord: { name: "", roman: chord.roman, cadence, root: chord.root, quality: chord.quality },
    need,
  };
}

export function buildRound(kind: ChallengeKind, o: ChallengeOptions, s: RoundSetting): Round {
  if (kind === "chord") return buildChordRound(o, s);
  const { rootPc, position, scaleId, degrees } = s;
  const formula = scaleOf(scaleId);
  const boxes = scaleBoxes(rootPc, formula, true);
  const zone = o.scope === "neck" ? boxes : [boxes[position]];
  const degMap = buildDegreeMap(rootPc, formula);
  const keys = new Set<string>();
  zone.forEach((b) => b.cells?.forEach((k) => keys.add(k)));
  const cells: Cell[] = [];
  keys.forEach((key) => {
    const [string, fret] = key.split(":").map(Number);
    const midi = TUNING[string] + fret;
    const iv = degMap.get(pcOf(midi));
    if (iv) cells.push({ string, fret, midi, label: iv.label, num: iv.num });
  });
  cells.sort((a, b) => a.midi - b.midi || a.string - b.string);
  const targets = kind === "degree" ? cells.filter((c) => degrees.includes(String(c.num))) : cells;
  const tonics = kind === "degree" && !o.hideTonic && !degrees.includes("1") ? cells.filter((c) => c.num === 1) : [];
  const min = Math.min(...zone.map((b) => b.min));
  const max = Math.max(...zone.map((b) => b.max));
  return { rootPc, position, scope: o.scope, scaleId, degrees, min, max, targets, tonics };
}

/**
 * Next round. Random key / position / context change every round; degree challenges ask one degree per round,
 * scale challenges pick a scale from the pool — never the same twice in a row.
 */
export function nextSetting(kind: ChallengeKind, o: ChallengeOptions, idx: number, prev?: RoundSetting, bag?: string[], cycleStart = 0): RoundSetting {
  const rnd = (n: number, avoid?: number) => {
    let x = Math.floor(Math.random() * n);
    if (n > 1 && avoid !== undefined && avoid >= 0 && x === avoid) x = (x + 1 + Math.floor(Math.random() * (n - 1))) % n;
    return x;
  };
  const pickOther = <T,>(list: T[], last?: T) => (list.length ? list[rnd(list.length, last === undefined ? undefined : list.indexOf(last))] : undefined);
  const scaleId =
    kind === "scale" ? (pickOther(o.scales, prev?.scaleId) ?? "major") : o.contextRandom ? DEGREE_SCALES[rnd(2)] : o.scaleId;
  const pool = o.degrees.length ? o.degrees : ["3"];
  // A shuffled bag of the pool: every degree comes out once before any comes back (never twice in a row).
  let degree: string | undefined;
  if (kind === "degree" && bag) {
    if (!bag.length) {
      const fresh = [...pool];
      for (let i = fresh.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
      }
      if (fresh.length > 1 && fresh[0] === prev?.degrees[0]) fresh.push(fresh.shift()!);
      bag.push(...fresh);
    }
    degree = bag.shift();
  }
  const degrees = kind === "degree" ? [degree ?? pickOther(pool, prev?.degrees[0])!] : [];
  // Chord challenge: the next chord of the cadences, or one drawn at random (never the same twice in a row).
  let chordStep: number | undefined;
  if (kind === "chord") {
    const n = chordPool(o, o.rootPc).length;
    chordStep = o.cadenceOrder === "order" ? idx % n : rnd(n, prev?.chordStep);
  }
  return {
    chordStep,
    rootPc: o.randomKey
      ? o.naturalKeys
        ? NATURALS[rnd(NATURALS.length, prev ? NATURALS.indexOf(prev.rootPc) : undefined)]
        : rnd(12, prev?.rootPc)
      : o.rootPc,
    position: o.position === -2 ? (cycleStart + idx) % 5 : o.position < 0 ? rnd(5, prev?.position) : o.position,
    scaleId,
    degrees,
  };
}

/** Mistakes allowed in a round before the answer is shown and the game moves on. */
export const mistakesAllowed = (scope: "position" | "neck") => (scope === "neck" ? 5 : 3);

const NATURALS = [0, 2, 4, 5, 7, 9, 11];

export const ROUND_CHOICES: Record<ChallengeKind, number[]> = { degree: [5, 10, 20], scale: [1, 3, 5], chord: [4, 8, 12] };

export const challengeSection = (kind: ChallengeKind) => `find-${kind}`;
/** Records are per variant (level + category, or “custom”) and per length (rounds, or “sprint”). */
export const challengeBestKey = (kind: ChallengeKind, variant: string, length: number | "sprint") => `fretstudio_chbest_${kind}_${variant}_${length}`;
export type ChallengeBest = { timeMs: number; errors: number; at: number; score?: number };

/** Interval label for display: b3 → ♭3, #4 → ♯4. */
export const prettyLabel = (l: string) => l.replace(/^b/, "♭").replace(/^#/, "♯");
