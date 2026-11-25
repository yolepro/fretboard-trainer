// Explorer › Harmonie › Les degrés de la gamme: the 7 four-note chords of a major key, their function (tonic,
// subdominant, dominant) and why chords of the same function can replace each other. Edit the texts here.
import { QUALITIES, chordLabel, type Chord, type ChordVoicing, type ChordNote } from "@/src/music/cadences";
import { TUNING, pcOf } from "@/src/music/theory";

export type Fn = "T" | "SD" | "D";
export const FUNCTIONS: Record<Fn, { name: string; color: string; bg: string; feel: string; role: string }> = {
  T: {
    name: "Tonique",
    color: "#2DD4BF",
    bg: "#0E2A27",
    feel: "Repos, la maison",
    role: "Repos : la musique est « à la maison ». Un morceau commence et finit souvent sur la tonique.",
  },
  SD: {
    name: "Sous-dominante",
    color: "#A78BFA",
    bg: "#221B38",
    feel: "Départ, préparation",
    role: "Départ : on s’éloigne de la maison. Elle prépare la dominante (IV – V, ii – V).",
  },
  D: {
    name: "Dominante",
    color: "#FB923C",
    bg: "#2E1A0C",
    feel: "Tension vers la tonique",
    role: "Tension : elle contient le triton (la 4 et la 7 de la gamme) qui appelle la tonique. V – I est la résolution la plus forte.",
  },
};
export const FN_ORDER: Fn[] = ["T", "SD", "D"];

/** The 7 degrees: semitones above the tonic, 4-note quality (QUALITIES key), function. */
const DEGREES: { roman: string; semi: number; quality: string; fn: Fn }[] = [
  { roman: "IΔ", semi: 0, quality: "∆7", fn: "T" },
  { roman: "IIm7", semi: 2, quality: "m7", fn: "SD" },
  { roman: "IIIm7", semi: 4, quality: "m7", fn: "T" },
  { roman: "IVΔ", semi: 5, quality: "∆7", fn: "SD" },
  { roman: "V7", semi: 7, quality: "7", fn: "D" },
  { roman: "VIm7", semi: 9, quality: "m7", fn: "T" },
  { roman: "VIIø", semi: 11, quality: "ø", fn: "D" },
];
/** How a quality is written after the chord name. */
export const SYMBOL: Record<string, string> = { "∆7": "Δ", m7: "m7", "7": "7", ø: "ø" };

export type DegreeChord = Chord & { fn: Fn; deg: number };
export const degreeChords = (keyPc: number): DegreeChord[] =>
  DEGREES.map((d, deg) => {
    const root = pcOf(keyPc + d.semi);
    return { root, quality: d.quality, roman: d.roman, pcs: QUALITIES[d.quality].map((i) => pcOf(root + i)), fn: d.fn, deg };
  });

/** Why two degrees of the same function are interchangeable (key: lower degree index - higher one). */
const WHY: Record<string, string> = {
  "0-5": "VIm7 est le relatif mineur de IΔ : même armure, même centre. Remplacer IΔ par VIm7 garde le repos, en plus sombre.",
  "0-2": "IIIm7 contient la tierce, la quinte et la septième de IΔ : une tonique plus légère, souvent de passage.",
  "2-5": "Deux toniques mineures voisines dans le cycle des quintes : iii – vi s’enchaînent naturellement.",
  "1-3": "IIm7 est le relatif mineur de IVΔ : c’est IV avec la sixte à la basse. ii – V – I et IV – V – I disent la même chose.",
  "4-6": "VIIø = V7 sans sa fondamentale : les deux gardent le triton qui appelle la tonique.",
};
export const whyOf = (a: number, b: number) => WHY[`${Math.min(a, b)}-${Math.max(a, b)}`] ?? "";
export const commonPcs = (a: Chord, b: Chord) => a.pcs.filter((p) => b.pcs.includes(p));

// ---------- 4-note shapes (strings 6 → 1, offsets from the root fret, null = muted) ----------
export type Bass = "auto" | 6 | 5;
const SHAPES: Record<6 | 5, Record<string, (number | null)[]>> = {
  6: { "∆7": [0, null, 1, 1, 0, null], m7: [0, null, 0, 0, 0, null], "7": [0, null, 0, 1, 0, null], ø: [0, null, 0, 0, -1, null] },
  5: { "∆7": [null, 0, 2, 1, 2, null], m7: [null, 0, 2, 0, 1, null], "7": [null, 0, 2, 0, 2, null], ø: [null, 0, 1, 0, 1, null] },
};
/** The root's fret on string 6 or 5, as low as the shape allows (an open string if no finger goes below it). */
const rootFret = (ch: Chord, s: 6 | 5) => {
  const low = Math.min(...SHAPES[s][ch.quality].filter((o): o is number => o !== null));
  const f = pcOf(ch.root - (s === 6 ? 4 : 9));
  return f + low < 0 ? f + 12 : f;
};
export function degreeVoicing(ch: Chord, bass: Bass): ChordVoicing & { bass: 6 | 5 } {
  const s: 6 | 5 = bass !== "auto" ? bass : rootFret(ch, 5) < rootFret(ch, 6) ? 5 : 6;
  const r = rootFret(ch, s);
  const notes: ChordNote[] = [];
  const muted: number[] = [];
  SHAPES[s][ch.quality].forEach((o, i) => {
    const string = 5 - i; // shape index 0 = low E = Fretboard string 5
    if (o === null) return void muted.push(string);
    const fret = o + r;
    notes.push({ string, fret, label: chordLabel(ch, TUNING[string] + fret) });
  });
  const frets = notes.map((n) => n.fret);
  return { notes, muted, min: Math.min(...frets), max: Math.max(...frets), bass: s };
}

// ---------- Fonctions: a progression where each chord can be swapped for one of the same function ----------
export const START = [0, 3, 4, 0];
const NAMES: Record<string, string> = {
  "0,3,4,0": "I – IV – V – I · Les bases du rock",
  "0,1,4,0": "I – ii – V – I · le ii remplace le IV",
  "5,3,4,0": "vi – IV – V – I · le vi remplace le I",
  "0,3,6,0": "I – IV – vii – I · le viiø remplace le V",
  "0,1,4,5": "I – ii – V – vi · cadence rompue (vi au lieu de I)",
  "0,3,4,5": "I – IV – V – vi · cadence rompue (vi au lieu de I)",
  "2,1,4,0": "iii – ii – V – I",
  "5,1,4,0": "vi – ii – V – I · le turnaround",
};
export const progName = (p: number[]) => NAMES[p.join(",")];
/** The next degree of the same function (tapping a chord of the progression). */
export const swapDegree = (deg: number) => {
  const fn = DEGREES[deg].fn;
  const same = DEGREES.map((d, i) => (d.fn === fn ? i : -1)).filter((i) => i >= 0);
  return same[(same.indexOf(deg) + 1) % same.length];
};
export const fnOfDegree = (deg: number) => DEGREES[deg].fn;
export const SWAP_NOTE: Record<Fn, string> = {
  T: "Tonique : IΔ, IIIm7 et VIm7 se remplacent. VIm7 est le relatif mineur de IΔ (3 notes communes).",
  SD: "Sous-dominante : IIm7 et IVΔ se remplacent. IIm7 est le relatif mineur de IVΔ (3 notes communes).",
  D: "Dominante : V7 et VIIø se remplacent. VIIø = V7 sans la fondamentale, avec le même triton qui appelle la tonique.",
};
