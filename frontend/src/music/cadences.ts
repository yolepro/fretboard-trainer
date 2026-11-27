// Cadences (S’exercer › Cadences, Défis › Trouve l’accord de la tonalité): the chord progressions, the chords of a
// cadence in a key, and how they are played on the neck. Edit CADENCES to add or rename a cadence.
import { SCALES, TUNING, pcOf, scaleBoxes } from "@/src/music/theory";

/** Chord qualities: intervals from the root. */
export const QUALITIES: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "°": [0, 3, 6],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  "∆7": [0, 4, 7, 11],
  ø: [0, 3, 6, 10],
};
const DEGREE_LABEL: Record<number, string> = { 0: "1", 3: "b3", 4: "3", 6: "b5", 7: "5", 10: "b7", 11: "7" };
const DEGREE_NUM: Record<number, number> = { 0: 1, 3: 3, 4: 3, 6: 5, 7: 5, 10: 7, 11: 7 };

/** One chord of a cadence: semitones above the MAJOR tonic, triad quality, 4-note quality, roman numeral. */
type Step = [number, string, string, string];
export type Cadence = { id: string; name: string; roman: string; meta: string; minor?: boolean; steps: Step[] };
export type CadenceGroup = { id: string; name: string; items: Cadence[] };

export const CADENCES: CadenceGroup[] = [
  {
    id: "pop",
    name: "Pop & rock",
    items: [
      { id: "rock", name: "Les bases du rock", roman: "I – IV – V – I", meta: "Toutes les chansons à 3 accords", steps: [[0, "", "∆7", "I"], [5, "", "∆7", "IV"], [7, "", "7", "V"], [0, "", "∆7", "I"]] },
      { id: "pop4", name: "Pop 4 accords", roman: "I – V – vi – IV", meta: "Let It Be, la pop d’aujourd’hui", steps: [[0, "", "∆7", "I"], [7, "", "7", "V"], [9, "m", "m7", "vi"], [5, "", "∆7", "IV"]] },
      { id: "fifties", name: "Années 50", roman: "I – vi – IV – V", meta: "Doo-wop, Stand By Me", steps: [[0, "", "∆7", "I"], [9, "m", "m7", "vi"], [5, "", "∆7", "IV"], [7, "", "7", "V"]] },
      { id: "popmin", name: "Pop mineure", roman: "vi – IV – I – V", meta: "La même suite, vue depuis le vi", steps: [[9, "m", "m7", "vi"], [5, "", "∆7", "IV"], [0, "", "∆7", "I"], [7, "", "7", "V"]] },
    ],
  },
  {
    id: "jazz",
    name: "Jazz",
    items: [
      { id: "251", name: "II–V–I", roman: "ii – V – I", meta: "La cadence du jazz", steps: [[2, "m", "m7", "ii"], [7, "", "7", "V"], [0, "", "∆7", "I"]] },
      { id: "turn", name: "Turnaround", roman: "I – vi – ii – V", meta: "La fin de grille qui relance le morceau", steps: [[0, "", "∆7", "I"], [9, "m", "m7", "vi"], [2, "m", "m7", "ii"], [7, "", "7", "V"]] },
      { id: "cycle", name: "Cycle des quintes", roman: "iii – vi – ii – V – I", meta: "Autumn Leaves, Fly Me to the Moon", steps: [[4, "m", "m7", "iii"], [9, "m", "m7", "vi"], [2, "m", "m7", "ii"], [7, "", "7", "V"], [0, "", "∆7", "I"]] },
    ],
  },
  {
    id: "minor",
    name: "Mineur",
    items: [
      { id: "andalusian", name: "Cadence andalouse", roman: "i – ♭VII – ♭VI – V", meta: "Flamenco, Hit the Road Jack", minor: true, steps: [[9, "m", "m7", "i"], [7, "", "7", "♭VII"], [5, "", "∆7", "♭VI"], [4, "", "7", "V"]] },
      { id: "natmin", name: "Mineur naturel", roman: "i – iv – v – i", meta: "Rock et folk en mineur", minor: true, steps: [[9, "m", "m7", "i"], [2, "m", "m7", "iv"], [4, "m", "m7", "v"], [9, "m", "m7", "i"]] },
      { id: "251min", name: "II–V–I mineur", roman: "iiø – V – i", meta: "Les standards en mineur", minor: true, steps: [[11, "°", "ø", "iiø"], [4, "", "7", "V"], [9, "m", "m7", "i"]] },
    ],
  },
  {
    id: "blues",
    name: "Blues",
    items: [
      { id: "blues", name: "Blues 12 mesures", roman: "I7 – IV7 – V7", meta: "La grille de blues", steps: [[0, "7", "7", "I7"], [5, "7", "7", "IV7"], [0, "7", "7", "I7"], [7, "7", "7", "V7"], [5, "7", "7", "IV7"], [0, "7", "7", "I7"]] },
    ],
  },
];
export const ALL_CADENCES = CADENCES.flatMap((g) => g.items);
export const cadenceById = (id: string) => ALL_CADENCES.find((c) => c.id === id) ?? ALL_CADENCES[0];

/** How a cadence is played: simple shapes (root in the bass), triads in a position, 4-note chords in a position. */
export type ChordStyle = "simple" | "triads" | "four";
export const CHORD_STYLES: { id: ChordStyle; name: string; meta: string }[] = [
  { id: "simple", name: "Accords simples", meta: "Fondamentale à la basse, sur la corde de Mi ou de La : la main se déplace d’un accord à l’autre." },
  { id: "triads", name: "Triades en position", meta: "Sans changer de position : chaque accord sur 3 cordes voisines, dans le renversement qui tombe sous la main." },
  { id: "four", name: "Accords à 4 sons en position", meta: "Sans changer de position : toutes les notes de l’accord à 4 sons (∆7, m7, 7, ø) dans la position." },
];

export type Chord = { root: number; quality: string; roman: string; pcs: number[] };
export function cadenceChords(c: Cadence, keyPc: number, style: ChordStyle): Chord[] {
  return c.steps.map(([semi, tri, four, roman]) => {
    const root = pcOf(keyPc + semi);
    const quality = style === "four" ? four : tri;
    return { root, quality, roman, pcs: QUALITIES[quality].map((i) => pcOf(root + i)) };
  });
}
export const chordLabel = (ch: Chord, pc: number) => DEGREE_LABEL[pcOf(pc - ch.root)] ?? "?";
export const chordNum = (ch: Chord, pc: number) => DEGREE_NUM[pcOf(pc - ch.root)] ?? 1;

/** A note on the neck: Fretboard strings (0 = high e). */
export type ChordNote = { string: number; fret: number; label: string };
export type ChordVoicing = { notes: ChordNote[]; muted: number[]; min: number; max: number };

const MAJOR = SCALES.find((s) => s.id === "major") ?? SCALES[0];
/** The cells (string:fret) of a scale position of the major key. */
export const positionCells = (keyPc: number, position: number) => {
  const box = scaleBoxes(keyPc, MAJOR, true)[position];
  return { cells: box.cells ?? new Set<string>(), min: box.min, max: box.max };
};

// Movable shapes, strings 6 → 1 (null = not played): E shape (root on string 6), A shape (root on string 5).
const SHAPES: Record<"E" | "A", Record<string, (number | null)[]>> = {
  E: { "": [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], "7": [0, 2, 0, 1, 0, 0] },
  A: { "": [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], "7": [null, 0, 2, 0, 2, 0], "°": [null, 0, 1, 2, 1, null] },
};

export function voicingOf(ch: Chord, style: ChordStyle, keyPc: number, position: number): ChordVoicing {
  if (style === "simple") {
    const rE = pcOf(ch.root - 4);
    const rA = pcOf(ch.root - 9);
    const useA = !SHAPES.E[ch.quality] || rA < rE;
    const shape = (useA ? SHAPES.A : SHAPES.E)[ch.quality] ?? SHAPES.A[""];
    const r = useA ? rA : rE;
    const notes: ChordNote[] = [];
    const muted: number[] = [];
    shape.forEach((o, i) => {
      const string = 5 - i; // shape index 0 = low E = Fretboard string 5
      if (o === null) return muted.push(string);
      const fret = o + r;
      notes.push({ string, fret, label: chordLabel(ch, TUNING[string] + fret) });
    });
    const frets = notes.map((n) => n.fret);
    return { notes, muted, min: Math.min(...frets), max: Math.max(...frets) };
  }
  const pos = positionCells(keyPc, position);
  const inPos: ChordNote[] = [];
  // Every fret of the position's span: chords can hold notes outside the key (V of a minor key, blues 7ths).
  for (let string = 0; string < 6; string++)
    for (let fret = pos.min; fret <= pos.max; fret++) {
      const pc = pcOf(TUNING[string] + fret);
      if (ch.pcs.includes(pc)) inPos.push({ string, fret, label: chordLabel(ch, pc) });
    }
  if (style === "four") return { notes: inPos, muted: [], min: pos.min, max: pos.max };
  // Triads: the closest voicing on 3 neighbouring strings of the position (high strings first).
  for (const set of [[2, 1, 0], [3, 2, 1], [4, 3, 2], [5, 4, 3]]) {
    const opts = set.map((s) => inPos.filter((n) => n.string === s));
    let best: { score: number; notes: ChordNote[] } | null = null;
    for (const a of opts[0]) for (const b of opts[1]) for (const c of opts[2]) {
      const pcs = new Set([a, b, c].map((n) => pcOf(TUNING[n.string] + n.fret)));
      if (pcs.size < 3) continue;
      const fr = [a.fret, b.fret, c.fret];
      const score = Math.max(...fr) - Math.min(...fr);
      if (!best || score < best.score) best = { score, notes: [a, b, c] };
    }
    if (best) return { notes: best.notes, muted: [], min: pos.min, max: pos.max };
  }
  return { notes: inPos, muted: [], min: pos.min, max: pos.max };
}
