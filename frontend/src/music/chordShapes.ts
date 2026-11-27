// Explorer › Les formes à jouer: chord voicings as they are played (frets, fingers, degrees).
// Strings are listed from the low E (6th) to the high e (1st). null = string not played.
// Edit the tables below to add or change a shape.

export const OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // strings 6 → 1

export type Played = { fret: number; finger: number; deg: string } | null;
export type Voicing = {
  name: string; // what the shape is called (“Forme de Mi”, “Forme C”…)
  rootPc: number;
  symbol: string; // "", "m", "7"…
  typeName: string; // "Majeur", "Mineur"…
  strings: Played[]; // 6 → 1
  rootString: number; // 6, 5 or 4
  note?: string; // shown under the chord name (e.g. why an “open” chord is barred)
};

type Row = (number | null)[];
const pc = (m: number) => ((m % 12) + 12) % 12;

/** Builds a voicing from fret / finger / degree rows (null = not played). */
function make(name: string, rootPc: number, symbol: string, typeName: string, rootString: number, frets: Row, fingers: Row, degs: (string | null)[]): Voicing {
  return {
    name,
    rootPc,
    symbol,
    typeName,
    rootString,
    strings: frets.map((f, i) => (f === null ? null : { fret: f, finger: fingers[i] ?? 0, deg: degs[i] ?? "" })),
  };
}

// ---------- Accords ouverts ----------
type OpenDef = { root: number; symbol: string; type: string; frets: Row; fingers: Row; degs: (string | null)[]; note?: string };
const x = null;
export const OPEN_CHORDS: OpenDef[] = [
  { root: 0, symbol: "", type: "Majeur", frets: [x, 3, 2, 0, 1, 0], fingers: [x, 3, 2, 0, 1, 0], degs: [x, "1", "3", "5", "1", "3"] },
  { root: 9, symbol: "", type: "Majeur", frets: [x, 0, 2, 2, 2, 0], fingers: [x, 0, 1, 2, 3, 0], degs: [x, "1", "5", "1", "3", "5"] },
  { root: 7, symbol: "", type: "Majeur", frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], degs: ["1", "3", "5", "1", "3", "1"] },
  { root: 4, symbol: "", type: "Majeur", frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], degs: ["1", "5", "1", "3", "5", "1"] },
  { root: 2, symbol: "", type: "Majeur", frets: [x, x, 0, 2, 3, 2], fingers: [x, x, 0, 1, 3, 2], degs: [x, x, "1", "5", "1", "3"] },
  // F and B have no open shape: they are barred near the nut, so every chord of frets 0 to 5 is here.
  { root: 5, symbol: "", type: "Majeur", frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], degs: ["1", "5", "1", "3", "5", "1"], note: "Barré en case 1 (forme de Mi) : pas de forme ouverte" },
  { root: 11, symbol: "", type: "Majeur", frets: [x, 2, 4, 4, 4, 2], fingers: [x, 1, 3, 3, 3, 1], degs: [x, "1", "5", "1", "3", "5"], note: "Barré en case 2 (forme de La) : pas de forme ouverte" },
  { root: 9, symbol: "m", type: "Mineur", frets: [x, 0, 2, 2, 1, 0], fingers: [x, 0, 2, 3, 1, 0], degs: [x, "1", "5", "1", "♭3", "5"] },
  { root: 4, symbol: "m", type: "Mineur", frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], degs: ["1", "5", "1", "♭3", "5", "1"] },
  { root: 2, symbol: "m", type: "Mineur", frets: [x, x, 0, 2, 3, 1], fingers: [x, x, 0, 2, 3, 1], degs: [x, x, "1", "5", "1", "♭3"] },
  // Fm and Bm have no open shape either: barred near the nut.
  { root: 5, symbol: "m", type: "Mineur", frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], degs: ["1", "5", "1", "♭3", "5", "1"], note: "Barré en case 1 (forme de Mi mineur) : pas de forme ouverte" },
  { root: 11, symbol: "m", type: "Mineur", frets: [x, 2, 4, 4, 3, 2], fingers: [x, 1, 3, 4, 2, 1], degs: [x, "1", "5", "1", "♭3", "5"], note: "Barré en case 2 (forme de La mineur) : pas de forme ouverte" },
  { root: 0, symbol: "7", type: "Septième", frets: [x, 3, 2, 3, 1, 0], fingers: [x, 3, 2, 4, 1, 0], degs: [x, "1", "3", "♭7", "1", "3"] },
  { root: 9, symbol: "7", type: "Septième", frets: [x, 0, 2, 0, 2, 0], fingers: [x, 0, 2, 0, 3, 0], degs: [x, "1", "5", "♭7", "3", "5"] },
  { root: 7, symbol: "7", type: "Septième", frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], degs: ["1", "3", "5", "1", "3", "♭7"] },
  { root: 4, symbol: "7", type: "Septième", frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], degs: ["1", "5", "♭7", "3", "5", "1"] },
  { root: 2, symbol: "7", type: "Septième", frets: [x, x, 0, 2, 1, 2], fingers: [x, x, 0, 2, 1, 3], degs: [x, x, "1", "5", "♭7", "3"] },
  { root: 11, symbol: "7", type: "Septième", frets: [x, 2, 1, 2, 0, 2], fingers: [x, 2, 1, 3, 0, 4], degs: [x, "1", "3", "♭7", "1", "5"] },
  { root: 9, symbol: "m7", type: "Mineur 7", frets: [x, 0, 2, 0, 1, 0], fingers: [x, 0, 2, 0, 1, 0], degs: [x, "1", "5", "♭7", "♭3", "5"] },
  { root: 4, symbol: "m7", type: "Mineur 7", frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0], degs: ["1", "5", "♭7", "♭3", "5", "1"] },
  { root: 2, symbol: "m7", type: "Mineur 7", frets: [x, x, 0, 2, 1, 1], fingers: [x, x, 0, 2, 1, 1], degs: [x, x, "1", "5", "♭7", "♭3"] },
  { root: 0, symbol: "maj7", type: "Majeur 7", frets: [x, 3, 2, 0, 0, 0], fingers: [x, 3, 2, 0, 0, 0], degs: [x, "1", "3", "5", "7", "3"] },
  { root: 9, symbol: "maj7", type: "Majeur 7", frets: [x, 0, 2, 1, 2, 0], fingers: [x, 0, 2, 1, 3, 0], degs: [x, "1", "5", "7", "3", "5"] },
  { root: 2, symbol: "maj7", type: "Majeur 7", frets: [x, x, 0, 2, 2, 2], fingers: [x, x, 0, 1, 1, 1], degs: [x, x, "1", "5", "7", "3"] },
  { root: 5, symbol: "maj7", type: "Majeur 7", frets: [x, x, 3, 2, 1, 0], fingers: [x, x, 3, 2, 1, 0], degs: [x, x, "1", "3", "5", "7"] },
];
export const openVoicing = (i: number): Voicing => {
  const d = OPEN_CHORDS[i];
  return { ...make("Accord ouvert", d.root, d.symbol, d.type, d.frets.findIndex((f) => f !== null) === 0 ? 6 : d.frets[1] !== null ? 5 : 4, d.frets, d.fingers, d.degs), note: d.note };
};

// ---------- Movable shapes: offsets from the root's fret on its string ----------
type Movable = { name: string; rootString: number; frets: Row; fingers: Row; degs: (string | null)[] };
export const CHORD_TYPES = [
  { id: "maj", name: "Majeur", symbol: "" },
  { id: "min", name: "Mineur", symbol: "m" },
  { id: "dom7", name: "Septième", symbol: "7" },
  { id: "m7", name: "Mineur 7", symbol: "m7" },
  { id: "maj7", name: "Majeur 7", symbol: "maj7" },
] as const;
export type ChordTypeId = (typeof CHORD_TYPES)[number]["id"];

export const BARRE_SHAPES: Record<"E" | "A", { name: string; rootString: number; types: Record<ChordTypeId, Omit<Movable, "name" | "rootString">> }> = {
  E: {
    name: "Forme de Mi",
    rootString: 6,
    types: {
      maj: { frets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1], degs: ["1", "5", "1", "3", "5", "1"] },
      min: { frets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1], degs: ["1", "5", "1", "♭3", "5", "1"] },
      dom7: { frets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1], degs: ["1", "5", "♭7", "3", "5", "1"] },
      m7: { frets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1], degs: ["1", "5", "♭7", "♭3", "5", "1"] },
      maj7: { frets: [0, 2, 1, 1, 0, 0], fingers: [1, 4, 2, 3, 1, 1], degs: ["1", "5", "7", "3", "5", "1"] },
    },
  },
  A: {
    name: "Forme de La",
    rootString: 5,
    types: {
      maj: { frets: [x, 0, 2, 2, 2, 0], fingers: [x, 1, 3, 3, 3, 1], degs: [x, "1", "5", "1", "3", "5"] },
      min: { frets: [x, 0, 2, 2, 1, 0], fingers: [x, 1, 3, 4, 2, 1], degs: [x, "1", "5", "1", "♭3", "5"] },
      dom7: { frets: [x, 0, 2, 0, 2, 0], fingers: [x, 1, 3, 1, 4, 1], degs: [x, "1", "5", "♭7", "3", "5"] },
      m7: { frets: [x, 0, 2, 0, 1, 0], fingers: [x, 1, 3, 1, 2, 1], degs: [x, "1", "5", "♭7", "♭3", "5"] },
      maj7: { frets: [x, 0, 2, 1, 2, 0], fingers: [x, 1, 3, 2, 4, 1], degs: [x, "1", "5", "7", "3", "5"] },
    },
  },
};

/** The fret of `rootPc` on a string (6 = low E…), from `min` up. */
const rootFret = (rootPc: number, rootString: number, min = 1) => {
  let f = pc(rootPc - OPEN_MIDI[6 - rootString]);
  while (f < min) f += 12;
  return f;
};

function place(name: string, rootPc: number, typeId: ChordTypeId | "power", typeName: string, symbol: string, m: Omit<Movable, "name">, minRoot = 1): Voicing {
  // The lowest root fret that keeps every note on the neck (no negative fret).
  const lowest = Math.min(...m.frets.filter((f): f is number => f !== null));
  const r = rootFret(rootPc, m.rootString, Math.max(minRoot, -lowest));
  void typeId;
  const frets = m.frets.map((f) => (f === null ? null : f + r));
  let fingers = m.fingers;
  if (frets.some((f) => f === 0)) {
    // Played at the nut: the strings at fret 0 ring open, the other fingers are renumbered from 1.
    const used = [...new Set(m.fingers.filter((g, i): g is number => g !== null && (frets[i] ?? 0) > 0))].sort((a, b) => a - b);
    fingers = m.fingers.map((g, i) => (g === null || frets[i] === null ? null : frets[i] === 0 ? 0 : used.indexOf(g) + 1));
  }
  return make(name, rootPc, symbol, typeName, m.rootString, frets, fingers, m.degs);
}

export function barreVoicing(rootPc: number, typeId: ChordTypeId, shape: "E" | "A"): Voicing {
  const s = BARRE_SHAPES[shape];
  const t = CHORD_TYPES.find((c) => c.id === typeId)!;
  return place(s.name, rootPc, typeId, t.name, t.symbol, { rootString: s.rootString, ...s.types[typeId] });
}

// ---------- Power chords ----------
export const POWER_STRINGS = [6, 5, 4] as const;
export function powerVoicing(rootPc: number, rootString: 6 | 5 | 4, octave: boolean): Voicing {
  const frets: Row = [x, x, x, x, x, x];
  const fingers: Row = [x, x, x, x, x, x];
  const degs: (string | null)[] = [x, x, x, x, x, x];
  const i = 6 - rootString; // index in the 6 → 1 rows
  frets[i] = 0;
  fingers[i] = 1;
  degs[i] = "1";
  frets[i + 1] = 2;
  fingers[i + 1] = 3;
  degs[i + 1] = "5";
  if (octave) {
    frets[i + 2] = rootString === 4 ? 3 : 2; // the B string is tuned a semitone lower
    fingers[i + 2] = 4;
    degs[i + 2] = "1";
  }
  return place(`Fondamentale sur la corde ${rootString}`, rootPc, "power", octave ? "Power chord 1-5-8" : "Power chord 1-5", "5", { rootString, frets, fingers, degs }, 0);
}

// ---------- CAGED ----------
const CAGED_MAJ: Movable[] = [
  { name: "Forme C", rootString: 5, frets: [x, 0, -1, -3, -2, -3], fingers: [x, 4, 3, 1, 2, 1], degs: [x, "1", "3", "5", "1", "3"] },
  { name: "Forme A", rootString: 5, frets: [x, 0, 2, 2, 2, 0], fingers: [x, 1, 3, 3, 3, 1], degs: [x, "1", "5", "1", "3", "5"] },
  { name: "Forme G", rootString: 6, frets: [0, -1, -3, -3, -3, 0], fingers: [3, 2, 1, 1, 1, 4], degs: ["1", "3", "5", "1", "3", "1"] },
  { name: "Forme E", rootString: 6, frets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1], degs: ["1", "5", "1", "3", "5", "1"] },
  { name: "Forme D", rootString: 4, frets: [x, x, 0, 2, 3, 2], fingers: [x, x, 1, 2, 4, 3], degs: [x, x, "1", "5", "1", "3"] },
];
const CAGED_MIN: Movable[] = [
  { name: "Forme C", rootString: 5, frets: [x, 0, -2, -3, -2, x], fingers: [x, 4, 2, 1, 3, x], degs: [x, "1", "♭3", "5", "1", x] },
  { name: "Forme A", rootString: 5, frets: [x, 0, 2, 2, 1, 0], fingers: [x, 1, 3, 4, 2, 1], degs: [x, "1", "5", "1", "♭3", "5"] },
  { name: "Forme G", rootString: 6, frets: [0, -2, -3, -3, 0, 0], fingers: [3, 1, 1, 1, 4, 4], degs: ["1", "♭3", "5", "1", "5", "1"] },
  { name: "Forme E", rootString: 6, frets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1], degs: ["1", "5", "1", "♭3", "5", "1"] },
  { name: "Forme D", rootString: 4, frets: [x, x, 0, 2, 3, 1], fingers: [x, x, 1, 3, 4, 2], degs: [x, x, "1", "5", "1", "♭3"] },
];

/** The 5 CAGED shapes of a chord, from the nut up the neck (each placed as low as it fits). */
export function cagedVoicings(rootPc: number, minor: boolean, maxFret: number): Voicing[] {
  const list = (minor ? CAGED_MIN : CAGED_MAJ).map((m) => place(m.name, rootPc, minor ? "min" : "maj", minor ? "Mineur" : "Majeur", minor ? "m" : "", m, 0));
  // Keep them in their order along the neck, starting from the lowest one.
  const low = (v: Voicing) => Math.min(...v.strings.filter((s): s is NonNullable<Played> => !!s).map((s) => s.fret));
  const high = (v: Voicing) => Math.max(...v.strings.filter((s): s is NonNullable<Played> => !!s).map((s) => s.fret));
  return list.sort((a, b) => low(a) - low(b)).filter((v) => high(v) <= maxFret);
}

/** Notes of a voicing (low → high) for playback. */
export const voicingMidis = (v: Voicing) =>
  v.strings.map((s, i) => (s ? OPEN_MIDI[i] + s.fret : null)).filter((m): m is number => m !== null);
