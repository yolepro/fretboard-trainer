import { pcOf, type Formula, type PathStep } from "@/src/music/theory";
import type { ExerciseId } from "@/src/music/exercises";

/** Pure model of the score: spelled notes, beats (groups) and 4-beat bars. No drawing here. */

const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const LETTERS_EN = ["C", "D", "E", "F", "G", "A", "B"];
const LETTERS_LATIN = ["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si"];

type Spelled = { letter: number; acc: number };

const ROOT_SHARP: Spelled[] = [
  { letter: 0, acc: 0 }, { letter: 0, acc: 1 }, { letter: 1, acc: 0 }, { letter: 1, acc: 1 },
  { letter: 2, acc: 0 }, { letter: 3, acc: 0 }, { letter: 3, acc: 1 }, { letter: 4, acc: 0 },
  { letter: 4, acc: 1 }, { letter: 5, acc: 0 }, { letter: 5, acc: 1 }, { letter: 6, acc: 0 },
];
const ROOT_FLAT: Spelled[] = [
  { letter: 0, acc: 0 }, { letter: 1, acc: -1 }, { letter: 1, acc: 0 }, { letter: 2, acc: -1 },
  { letter: 2, acc: 0 }, { letter: 3, acc: 0 }, { letter: 4, acc: -1 }, { letter: 4, acc: 0 },
  { letter: 5, acc: -1 }, { letter: 5, acc: 0 }, { letter: 6, acc: -1 }, { letter: 6, acc: 0 },
];

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const accOf = (pc: number, letter: number) => {
  const d = mod12(pc - NATURAL_PC[letter]);
  return d > 6 ? d - 12 : d;
};

/**
 * Spells every note of a scale / chord from its interval labels (3, b3, #4, 9…): the letter follows the degree
 * number, the accidental follows the semitones. The root is spelled with sharps or flats, whichever needs the fewest
 * accidentals overall (D# major becomes Eb major instead of needing double sharps); `pref` wins a tie.
 */
export function spellFormula(rootPc: number, formula: Formula, pref: "sharp" | "flat"): Map<number, Spelled> {
  const order = pref === "sharp" ? [ROOT_SHARP, ROOT_FLAT] : [ROOT_FLAT, ROOT_SHARP];
  let best: { map: Map<number, Spelled>; cost: number } | null = null;
  for (const table of order) {
    const root = table[pcOf(rootPc)];
    const map = new Map<number, Spelled>();
    let cost = 0;
    for (const iv of formula.intervals) {
      const digit = parseInt(iv.label.replace(/\D/g, ""), 10) || iv.num;
      const letter = (root.letter + digit - 1) % 7;
      const pc = mod12(rootPc + iv.semi);
      if (map.has(pc)) continue;
      const acc = accOf(pc, letter);
      map.set(pc, { letter, acc });
      cost += Math.abs(acc) > 1 ? 10 : Math.abs(acc);
    }
    if (!best || cost < best.cost) best = { map, cost };
  }
  return best!.map;
}

export type KeySignature = { kind: "sharp" | "flat" | null; count: number };
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F

/** A classical key signature when the scale is 7-note and its accidentals are a prefix of the sharp / flat order. */
export function keySignatureOf(spelled: Map<number, Spelled>, noteCount: number): { sig: KeySignature; keyAcc: number[] } {
  const keyAcc = [0, 0, 0, 0, 0, 0, 0];
  const none = { sig: { kind: null, count: 0 } as KeySignature, keyAcc };
  if (noteCount !== 7 || spelled.size !== 7) return none;
  const byLetter = new Map<number, number>();
  for (const s of spelled.values()) {
    if (byLetter.has(s.letter)) return none;
    byLetter.set(s.letter, s.acc);
  }
  const accs = [...byLetter.values()];
  if (accs.some((a) => Math.abs(a) > 1)) return none;
  const sharps = [...byLetter.entries()].filter(([, a]) => a === 1).map(([l]) => l);
  const flats = [...byLetter.entries()].filter(([, a]) => a === -1).map(([l]) => l);
  if (sharps.length && flats.length) return none;
  if (!sharps.length && !flats.length) return none;
  const order = sharps.length ? SHARP_ORDER : FLAT_ORDER;
  const altered = sharps.length ? sharps : flats;
  const prefix = order.slice(0, altered.length);
  if (!altered.every((l) => prefix.includes(l))) return none;
  const sign = sharps.length ? 1 : -1;
  prefix.forEach((l) => (keyAcc[l] = sign));
  return { sig: { kind: sharps.length ? "sharp" : "flat", count: altered.length }, keyAcc };
}

export type ScoreEvent = {
  index: number;
  midi: number;
  string: number;
  fret: number;
  /** Diatonic step of the WRITTEN note (guitar is written an octave above its sound): C4 = 28, bottom line E4 = 30. */
  step: number;
  /** Accidental to print before the note ("♯", "♭", "♮"…), or null. */
  accidental: string | null;
  group: number;
  bar: number;
};

export type ScoreGroup = { start: number; end: number; label: string | null };

export type ScoreModel = {
  events: ScoreEvent[];
  groups: ScoreGroup[];
  perBeat: number;
  /** Slow pace: a group lasts 2 beats (quarter notes, quarter-note triplets, eighth notes): 2 groups per bar. */
  slow: boolean;
  groupsPerBar: number;
  /** Time signature: 4/4, or 2/2 when the pulse is the half note (slow triplets). */
  timeSig: [number, number];
  keySig: KeySignature;
  /** Pitch letters of the key signature accidentals in drawing order (for the layout). */
  barCount: number;
};

const accGlyph = (acc: number) => (acc === 0 ? "♮" : acc === 1 ? "♯" : acc === -1 ? "♭" : acc > 0 ? "♯♯" : "♭♭");

export function noteName(sp: Spelled, notation: "english" | "latin") {
  const base = (notation === "latin" ? LETTERS_LATIN : LETTERS_EN)[sp.letter];
  return base + (sp.acc > 0 ? "#".repeat(sp.acc) : sp.acc < 0 ? "b".repeat(-sp.acc) : "");
}

const TRIAD_Q: Record<string, string> = { "4,7": "", "3,7": "m", "3,6": "dim", "4,8": "aug" };
const SEVENTH_Q: Record<string, string> = {
  "4,7,11": "maj7",
  "4,7,10": "7",
  "3,7,10": "m7",
  "3,6,10": "m7b5",
  "3,6,9": "dim7",
  "3,7,11": "m(maj7)",
  "4,8,10": "7#5",
  "4,8,11": "maj7#5",
};

function groupLabel(
  kind: ExerciseId | "path",
  notes: PathStep[],
  perBeat: number,
  spelled: Map<number, Spelled>,
  notation: "english" | "latin",
): string | null {
  if (notes.length < 2) return null;
  const midis = notes.map((n) => n.midi);
  // Thirds exercise: no symbol (the pairs are not chords).
  if ((kind === "triads" && notes.length === 3) || (kind === "sevenths" && notes.length === 4)) {
    // The chord root is the note from which the other notes stack as a known chord: works for inversions too
    // (G C E → C), the lowest note first so root positions keep their usual reading.
    const sorted = [...midis].sort((x, y) => x - y);
    for (const cand of sorted) {
      const rel = [...new Set(midis.map((m) => mod12(m - cand)))].filter((x) => x !== 0).sort((x, y) => x - y);
      const q = (kind === "triads" ? TRIAD_Q : SEVENTH_Q)[rel.join(",")];
      const sp = spelled.get(pcOf(cand));
      if (q !== undefined && sp) return noteName(sp, notation) + q;
    }
    return null;
  }
  return null;
}

export type ScoreInput = {
  steps: PathStep[];
  kind: ExerciseId | "path";
  perBeat: number;
  slow?: boolean;
  rootPc: number;
  formula: Formula;
  accidental: "sharp" | "flat";
  notation: "english" | "latin";
};

export function buildScoreModel(inp: ScoreInput): ScoreModel {
  const spelled = spellFormula(inp.rootPc, inp.formula, inp.accidental);
  const { sig, keyAcc } = keySignatureOf(spelled, inp.formula.intervals.length);
  const events: ScoreEvent[] = [];
  const groups: ScoreGroup[] = [];
  let state = new Map<number, number>(); // step -> accidental currently in force in the bar
  let bar = 0;
  const groupsPerBar = inp.slow ? 2 : 4;

  inp.steps.forEach((st, i) => {
    const group = Math.floor(i / inp.perBeat);
    const newBar = Math.floor(group / groupsPerBar);
    if (newBar !== bar) {
      bar = newBar;
      state = new Map();
    }
    const pc = pcOf(st.midi);
    const sp: Spelled =
      spelled.get(pc) ?? (inp.accidental === "flat" ? ROOT_FLAT : ROOT_SHARP)[pc];
    const written = st.midi + 12;
    const natural = written - sp.acc;
    const octave = Math.floor(natural / 12) - 1;
    const step = octave * 7 + sp.letter;
    const inForce = state.has(step) ? state.get(step)! : keyAcc[sp.letter];
    const accidental = sp.acc !== inForce ? accGlyph(sp.acc) : null;
    state.set(step, sp.acc);
    events.push({
      index: i,
      midi: st.midi,
      string: st.loc ? st.loc.string : 0,
      fret: st.loc ? st.loc.fret : 0,
      step,
      accidental,
      group,
      bar,
    });
  });

  const groupCount = Math.ceil(inp.steps.length / inp.perBeat);
  for (let g = 0; g < groupCount; g++) {
    const start = g * inp.perBeat;
    const end = Math.min(inp.steps.length, start + inp.perBeat) - 1;
    groups.push({ start, end, label: groupLabel(inp.kind, inp.steps.slice(start, end + 1), inp.perBeat, spelled, inp.notation) });
  }
  return { events, groups, perBeat: inp.perBeat, slow: !!inp.slow, groupsPerBar, timeSig: inp.slow && inp.perBeat === 3 ? [2, 2] : [4, 4], keySig: sig, barCount: Math.ceil(groupCount / groupsPerBar) };
}
