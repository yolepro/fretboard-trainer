// Reconnais l’intervalle (FS-38): the 12 intervals and where the two notes sit on the neck.
import { intervalName } from "@/src/ear/questions";
import { getLang } from "@/src/i18n";
import { TUNING } from "@/src/music/theory";

export type IntervalId = "b2" | "2" | "b3" | "3" | "4" | "b5" | "5" | "b6" | "6" | "b7" | "7" | "8";
/** label = the degree shown on the neck once answered; semi = semitones. */
export const INTERVALS: { id: IntervalId; semi: number; label: string }[] = [
  { id: "b2", semi: 1, label: "♭2" },
  { id: "2", semi: 2, label: "2" },
  { id: "b3", semi: 3, label: "♭3" },
  { id: "3", semi: 4, label: "3" },
  { id: "4", semi: 5, label: "4" },
  { id: "b5", semi: 6, label: "♭5" },
  { id: "5", semi: 7, label: "5" },
  { id: "b6", semi: 8, label: "♭6" },
  { id: "6", semi: 9, label: "6" },
  { id: "b7", semi: 10, label: "♭7" },
  { id: "7", semi: 11, label: "7" },
  { id: "8", semi: 12, label: "8" },
];
export const intervalById = (id: string) => INTERVALS.find((i) => i.id === id) ?? INTERVALS[6];
/** The name shown on the choices (the tritone gets its nickname). */
export const intervalTitle = (id: string) => intervalName(id);
export const intervalSub = (id: string) => {
  const n = intervalById(id).semi;
  if (getLang() === "en") return `${id === "b5" ? "tritone · " : ""}${n} semitone${n > 1 ? "s" : ""}`;
  return `${id === "b5" ? "triton · " : ""}${n} demi-ton${n > 1 ? "s" : ""}`;
};

export type Spot = { string: number; fret: number; midi: number };
const MAX_FRET = 15;

/**
 * Two notes `semi` semitones apart (up, or down when `down`), as a guitarist plays them: the root on strings 6 to 3,
 * the other note on the same string or one or two strings away, within a hand span (4 frets) when possible.
 */
export function placeInterval(semi: number, down: boolean, rand: () => number = Math.random): { root: Spot; other: Spot } {
  for (let tries = 0; tries < 60; tries++) {
    // Strings: 5 = low E … 0 = high e. Up: root on a low string; down: root higher so the other note fits below.
    const rs = down ? 1 + Math.floor(rand() * 4) : 2 + Math.floor(rand() * 4);
    const rf = 1 + Math.floor(rand() * 9);
    const rootMidi = TUNING[rs] + rf;
    const target = rootMidi + (down ? -semi : semi);
    const strings = down ? [rs + 1, rs + 2, rs] : [rs - 1, rs - 2, rs];
    let best: Spot | null = null;
    let bestD = Infinity;
    for (const s of strings) {
      if (s < 0 || s > 5) continue;
      const f = target - TUNING[s];
      if (f < 0 || f > MAX_FRET) continue;
      const d = Math.abs(f - rf) + (s === rs ? 1.5 : 0); // another string reads better than a long slide
      if (d < bestD) {
        best = { string: s, fret: f, midi: target };
        bestD = d;
      }
    }
    if (best && Math.abs(best.fret - rf) <= (best.string === rs ? 12 : 4)) return { root: { string: rs, fret: rf, midi: rootMidi }, other: best };
  }
  // Fallback: same string.
  const rs = down ? 2 : 4;
  const rf = down ? 13 : 1;
  return { root: { string: rs, fret: rf, midi: TUNING[rs] + rf }, other: { string: rs, fret: rf + (down ? -semi : semi), midi: TUNING[rs] + rf + (down ? -semi : semi) } };
}
