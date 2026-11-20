import { getLang } from "@/src/i18n";
import type { Formula } from "@/src/music/theory";

/**
 * Short names of scales and chords, for the compact landscape header. Chords use the usual chord symbols
 * (Maj / ∆, min / m, dim / °, Ø = m7♭5, aug / +, 7 = dominant).
 */
const FR: Record<string, string> = {
  major: "Maj",
  minor: "min",
  harmonic: "min harm.",
  melodic: "min mél.",
  pentamaj: "Penta Maj",
  pentamin: "Penta min",
  blues: "Blues",
  dorian: "Dorien",
  phrygian: "Phrygien",
  lydian: "Lydien",
  mixolydian: "Mixo",
  locrian: "Locrien",
  chromatic: "Chrom.",
  wholetone: "Tons ent.",
  halfwhole: "½ ton-ton",
  wholehalf: "ton-½ ton",
};
const EN: Record<string, string> = {
  major: "Maj",
  minor: "min",
  harmonic: "harm. min",
  melodic: "mel. min",
  pentamaj: "Maj penta",
  pentamin: "min penta",
  blues: "Blues",
  dorian: "Dorian",
  phrygian: "Phrygian",
  lydian: "Lydian",
  mixolydian: "Mixo",
  locrian: "Locrian",
  chromatic: "Chrom.",
  wholetone: "Whole tone",
  halfwhole: "half-whole",
  wholehalf: "whole-half",
};
const CHORD: Record<string, string> = {
  maj: "Maj",
  min: "min",
  dim: "dim",
  aug: "aug",
  sus2: "sus2",
  sus4: "sus4",
  dom7: "7",
  maj7: "∆7",
  m7: "m7",
  m7b5: "Ø",
  dim7: "°7",
  six: "6",
  m6: "m6",
  add9: "add9",
  dom9: "9",
  maj9: "∆9",
  m9: "m9",
  dom11: "11",
  m11: "m11",
  dom13: "13",
};

export function shortName(f: Formula): string {
  return CHORD[f.id] ?? (getLang() === "en" ? EN : FR)[f.id] ?? f.symbol ?? f.name;
}
