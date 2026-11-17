import { SCALES, pcOf, type BoxWindow, type Formula, type IntervalDef, type PathStep } from "@/src/music/theory";
import { positionLadder } from "@/src/music/exercises";

/**
 * Triad pairs: the two major triads on the 4th and 5th degrees of a major key (G → C & D). Together they give the
 * major scale without its third (hexatonic: G A C D E F#); the same pair also serves the melodic minor of the key.
 * The exercise goes through a scale position: every note of the pair in the position starts a triad (the triad that
 * owns the note, with its next two notes), climbing through the inversions (C 2nd inv., D 2nd inv., C root…), then
 * comes back down as the exact mirror. Played in triplets: one triad per beat.
 */
export type PairStyle = "up" | "down" | "alt";
export const PAIR_STYLES: { id: PairStyle; name: string }[] = [
  { id: "up", name: "Up (grave → aigu)" },
  { id: "down", name: "Down (aigu → grave)" },
  { id: "alt", name: "Alterné" },
];

export const MAJOR = SCALES.find((s) => s.id === "major")!;

const iv = (semi: number, num: number, label: string): IntervalDef => ({ semi, num, label });

/**
 * What the fretboard shows: the 6 notes of the pair, the first triad (IV) colored like roots, the second (V) like
 * thirds; labels = degrees of the key (4 6 1 / 5 7 2).
 */
export const PAIR_FORMULA: Formula = {
  id: "triadPair",
  name: "Paires de triades",
  symbol: "IV-V",
  group: "Paires",
  intervals: [iv(5, 1, "4"), iv(9, 1, "6"), iv(0, 1, "1"), iv(7, 3, "5"), iv(11, 3, "7"), iv(2, 3, "2")],
};

/** Root pitch classes of the two triads of the pair for a key. */
export const pairRoots = (keyPc: number): [number, number] => [pcOf(keyPc + 5), pcOf(keyPc + 7)];

export type PairTriad = { first: boolean; rootPc: number; inversion: 0 | 1 | 2; notes: PathStep[] };

/** The triads of the pair through a position, from the lowest to the highest (each listed from its lowest note). */
export function pairTriads(keyPc: number, window: BoxWindow): PairTriad[] {
  const [a, b] = pairRoots(keyPc);
  const chordA = [a, pcOf(a + 4), pcOf(a + 7)];
  const chordB = [b, pcOf(b + 4), pcOf(b + 7)];
  const hex: Formula = { ...MAJOR, intervals: [0, 2, 5, 7, 9, 11].map((s) => iv(s, 1, "")) };
  const ladder = positionLadder(keyPc, hex, window);
  const out: PairTriad[] = [];
  for (let i = 0; i < ladder.length; i++) {
    const pc = pcOf(ladder[i].midi);
    const first = chordA.includes(pc);
    const chord = first ? chordA : chordB;
    const notes = [ladder[i]];
    for (let j = i + 1; j < ladder.length && notes.length < 3; j++) if (chord.includes(pcOf(ladder[j].midi))) notes.push(ladder[j]);
    if (notes.length < 3) break;
    out.push({ first, rootPc: chord[0], inversion: pc === chord[0] ? 0 : pc === chord[1] ? 1 : 2, notes });
  }
  return out;
}

/** The whole exercise: the triads up (in the chosen direction), then the exact mirror down. */
export function pairSequence(keyPc: number, window: BoxWindow, style: PairStyle): PathStep[] {
  const up = pairTriads(keyPc, window).map((t, k) => (style === "down" || (style === "alt" && k % 2 === 1) ? [...t.notes].reverse() : t.notes));
  const down = [...up].reverse().map((g) => [...g].reverse());
  return [...up, ...down].flat();
}
