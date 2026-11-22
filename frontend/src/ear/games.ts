// Oreille: the games offered, in the order shown. Edit this file to rename a game, change what it trains,
// its settings at start, the settings the player can change (pastilles) or its lengths.
import type { Options, Section } from "@/src/ear/questions";

/** Settings a micro game can let the player change (each one opens its own sheet). */
export type EarSetting = "strings" | "scale" | "level" | "intervals";

export type EarFamily = "mic" | "chords";

export type EarGame = {
  /**
   * Micro games: the record key (fretstudio_best_<id>_<count>), the section id by default.
   * Accords: the chord set (records fretstudio_best_chords_<count>_<id>).
   */
  id: string;
  family: EarFamily;
  section: Section; // the question engine and the results it is counted with
  name: string;
  meta: string;
  preset?: Partial<Options>; // micro games: settings when the game is first opened
  edit?: EarSetting[]; // micro games: settings the player can change
  chords?: string[]; // Accords: the chord kinds to tell apart (ids of CHORD_TYPES, ChordQuiz.tsx)
  counts?: number[]; // lengths offered (default 5, 10, 20)
  defaultCount?: number; // default 10
};

export const EAR_FAMILIES: { id: EarFamily; title: string; lead: string }[] = [
  { id: "mic", title: "Joue sur ta guitare", lead: "Le micro écoute ta guitare. Chrono global · 2 chances par note." },
  { id: "chords", title: "Accords", lead: "Un accord est joué : reconnais son type parmi les choix. Une seule réponse par accord." },
];

export const EAR_GAMES: EarGame[] = [
  // ----- Joue sur ta guitare (micro) -----
  { id: "board", family: "mic", section: "board", name: "Manche", meta: "Joue la note demandée sur la corde indiquée.", preset: { strings: [5, 4, 3] }, edit: ["strings"] },
  { id: "listen", family: "mic", section: "listen", name: "Écoute & rejoue", meta: "Écoute une note et rejoue-la à la bonne octave." },
  { id: "degree", family: "mic", section: "degree", name: "Degrés d’accord", meta: "Joue le degré demandé d’un accord (n’importe quelle octave)." },
  {
    id: "interval",
    family: "mic",
    section: "interval",
    name: "Intervalles",
    meta: "L’app joue la tonique : joue l’intervalle demandé au-dessus.",
    preset: { scaleId: "major", level: 1, intervals: ["5"] },
    edit: ["scale", "level", "intervals"],
  },
  // ----- Accords -----
  { id: "majmin", family: "chords", section: "chords", name: "Majeur / mineur", meta: "Le plus important : gai ou triste ?", chords: ["maj", "min"] },
  { id: "triads", family: "chords", section: "chords", name: "Les 4 triades", meta: "Majeur, mineur et les quintes altérées : diminuée, augmentée", chords: ["maj", "min", "dim", "aug"] },
  { id: "sevenths", family: "chords", section: "chords", name: "Les accords 7", meta: "∆7, 7, m7, Ø : la couleur de la septième", chords: ["maj7", "dom7", "min7", "m7b5"] },
  { id: "all", family: "chords", section: "chords", name: "Tout", meta: "Les 8 accords mélangés", chords: ["maj", "min", "dim", "aug", "maj7", "dom7", "min7", "m7b5"] },
];

export const DEFAULT_COUNTS = [5, 10, 20];
export const countsOf = (g: EarGame) => g.counts ?? DEFAULT_COUNTS;
export const defaultCountOf = (g: EarGame) => g.defaultCount ?? 10;
