// Défis: the games offered, by family, in the order shown. Edit this file to rename a game, change what it trains,
// its settings at start, the settings the player can change (pastilles), its levels or its lengths.
import type { Options, Section } from "@/src/ear/questions";

/** Settings a micro game can let the player change (each one opens its own sheet). */
export type EarSetting = "strings" | "scale" | "level" | "intervals";

export type DefiFamily = "neck" | "ear";

/**
 * Quiz levels (records per level).
 * Reconnais l’accord: `chords` = the chord kinds to tell apart.
 * Reconnais l’intervalle: `intervals` = the intervals asked (labels of src/ear/intervals.ts), `down` = also descending.
 */
export type ChordLevel = { id: string; name: string; meta: string; chords: string[]; intervals?: string[]; down?: boolean };
export type QuizLevel = ChordLevel;

export type EarGame = {
  /**
   * Micro games: the record key (fretstudio_best_<id>_<count>), the section id.
   * Accords: “chords” (records fretstudio_best_chords_<count>_<level id>).
   * Challenges: opens the challenge screen (its own levels, records and results).
   */
  id: string;
  family: DefiFamily;
  kind: "mic" | "chords" | "intervals" | "challenge"; // chords / intervals: a quiz with choices and levels
  section?: Section; // micro games and Accords: the question engine and the results it is counted with
  challenge?: "degree" | "scale" | "chord"; // challenge games
  name: string;
  meta: string;
  input: ("mic" | "touch")[]; // how the player answers (shown on the card)
  preset?: Partial<Options>; // micro games: settings when the game is first opened
  edit?: EarSetting[]; // micro games: settings the player can change
  levels?: ChordLevel[]; // Accords
  counts?: number[]; // lengths offered (default 5, 10, 20)
  defaultCount?: number; // default 10
};

export const DEFI_FAMILIES: { id: DefiFamily; title: string; lead: string }[] = [
  { id: "neck", title: "Connaître le manche", lead: "Savoir où sont les notes, sans réfléchir." },
  { id: "ear", title: "Entraîner l’oreille", lead: "Entendre, puis jouer ou nommer ce qu’on entend." },
];

export const CHORD_LEVELS: ChordLevel[] = [
  { id: "majmin", name: "Majeur / mineur", meta: "Le plus important : gai ou triste ?", chords: ["maj", "min"] },
  { id: "triads", name: "4 triades", meta: "Majeur, mineur et les quintes altérées : diminuée, augmentée", chords: ["maj", "min", "dim", "aug"] },
  { id: "sevenths", name: "Accords 7", meta: "∆7, 7, m7, Ø : la couleur de la septième", chords: ["maj7", "dom7", "min7", "m7b5"] },
  { id: "all", name: "Tout", meta: "Les 8 accords mélangés", chords: ["maj", "min", "dim", "aug", "maj7", "dom7", "min7", "m7b5"] },
];

/** Reconnais l’intervalle (FS-38). */
export const INTERVAL_LEVELS: QuizLevel[] = [
  { id: "beginner", name: "Débutant", meta: "Tierce majeure, quarte, quinte, octave · en montant", chords: [], intervals: ["3", "4", "5", "8"] },
  {
    id: "inter",
    name: "Intermédiaire",
    meta: "Les intervalles de la gamme majeure et leurs voisins mineurs (seconde, tierces, quarte, quinte, sixte, septième mineure, octave) · en montant",
    chords: [],
    intervals: ["2", "b3", "3", "4", "5", "6", "b7", "8"],
  },
  { id: "expert", name: "Expert", meta: "Les 12 intervalles, en montant ou en descendant", chords: [], intervals: ["b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7", "8"], down: true },
];

export const EAR_GAMES: EarGame[] = [
  // ----- Connaître le manche -----
  {
    id: "board",
    family: "neck",
    kind: "mic",
    section: "board",
    name: "Trouve la note",
    meta: "Joue la note demandée sur la corde indiquée.",
    input: ["mic"],
    preset: { strings: [5, 4, 3] },
    edit: ["strings"],
  },
  { id: "find-degree", family: "neck", kind: "challenge", challenge: "degree", name: "Trouve le degré", meta: "Les degrés d’une tonalité, position par position · débutant à expert", input: ["mic", "touch"] },
  { id: "find-scale", family: "neck", kind: "challenge", challenge: "scale", name: "Trouve la gamme", meta: "Toutes les notes d’une gamme dans une position", input: ["mic", "touch"] },
  { id: "find-chord", family: "neck", kind: "challenge", challenge: "chord", name: "Trouve l’accord de la tonalité", meta: "Le IV de G, le ii de C… dans les cadences choisies · débutant à expert", input: ["mic", "touch"] },
  { id: "degree", family: "neck", kind: "mic", section: "degree", name: "Trouve le degré de l’accord", meta: "Joue le degré demandé d’un accord, à n’importe quelle octave.", input: ["mic"] },
  // ----- Entraîner l’oreille -----
  { id: "listen", family: "ear", kind: "mic", section: "listen", name: "Rejoue la note", meta: "Écoute une note et rejoue-la à la bonne octave.", input: ["mic"] },
  // FS-38: replaces « Rejoue l’intervalle » (micro). Its results stay in the same section.
  {
    id: "intervals",
    family: "ear",
    kind: "intervals",
    section: "interval",
    name: "Reconnais l’intervalle",
    meta: "Un intervalle est joué et montré sur le manche : choisis son nom.",
    input: ["touch"],
    levels: INTERVAL_LEVELS,
  },
  { id: "chords", family: "ear", kind: "chords", section: "chords", name: "Reconnais l’accord", meta: "Un accord est joué : choisis son type.", input: ["touch"], levels: CHORD_LEVELS },
];

export const DEFAULT_COUNTS = [5, 10, 20];
export const countsOf = (g: EarGame) => g.counts ?? DEFAULT_COUNTS;
export const defaultCountOf = (g: EarGame) => g.defaultCount ?? 10;
/** The micro game that plays a section (results › “Travailler mes points faibles”). */
export const micGameOf = (s: Section) => EAR_GAMES.find((g) => g.kind === "mic" && g.section === s) ?? EAR_GAMES[0];
