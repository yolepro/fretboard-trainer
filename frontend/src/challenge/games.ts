// Challenges (S’exercer): the games whose settings are chosen by the player — “Trouve la gamme”, and the “Perso”
// game of “Trouve le degré”. Edit this file to rename a game, change its settings at start, the settings the player
// can change (pastilles) or its lengths. The level games of “Trouve le degré” are in levels.ts.
import type { ChallengeKind, ChallengeOptions } from "@/src/challenge/rounds";

/** Settings a game can let the player change (each one opens its own sheet). */
export type ChallengeSetting = "key" | "context" | "degrees" | "scope" | "position" | "hideTonic" | "scales" | "order" | "cadences" | "cadenceOrder";

export type CustomGame = {
  id: string; // records: fretstudio_chbest_<kind>_<id>_<length> (“custom” keeps the records made before)
  name: string;
  meta: string;
  preset?: Partial<ChallengeOptions>; // settings when the game is first opened
  edit: ChallengeSetting[];
  rounds: number[]; // lengths offered (tours)
  defaultRounds: number;
};

export const CUSTOM_GAMES: Record<ChallengeKind, CustomGame[]> = {
  degree: [
    {
      id: "custom",
      name: "Perso",
      meta: "Tous les réglages à ta main",
      preset: { degrees: ["2", "3", "4", "5", "6", "7"], position: 0 },
      edit: ["key", "context", "degrees", "scope", "position", "hideTonic"],
      rounds: [5, 10, 20],
      defaultRounds: 10,
    },
  ],
  scale: [
    {
      id: "custom",
      name: "Trouve la gamme",
      meta: "Toutes les notes d’une gamme dans une position, libre ou dans l’ordre",
      preset: { scales: ["major", "minor", "pentamin", "dorian", "mixolydian"], position: 0 },
      edit: ["key", "scales", "order", "position"],
      rounds: [1, 3, 5],
      defaultRounds: 1,
    },
  ],
  // Trouve l’accord de la tonalité: one game per level (the three ways of playing a cadence in S’exercer › Cadences).
  chord: [
    {
      id: "beginner",
      name: "Débutant · Accords simples",
      meta: "Joue ou touche la fondamentale de l’accord sur la corde de Mi ou de La",
      preset: { chordStyle: "simple", cadences: ["rock", "pop4"], cadenceOrder: "order", position: 0 },
      edit: ["key", "cadences", "cadenceOrder"],
      rounds: [4, 8, 12],
      defaultRounds: 8,
    },
    {
      id: "inter",
      name: "Intermédiaire · Triades en position",
      meta: "Les 3 notes de l’accord sans quitter la position",
      preset: { chordStyle: "triads", cadences: ["rock", "pop4", "251"], cadenceOrder: "order", position: 0 },
      edit: ["key", "cadences", "cadenceOrder", "position"],
      rounds: [4, 8, 12],
      defaultRounds: 8,
    },
    {
      id: "expert",
      name: "Expert · Accords à 4 sons en position",
      meta: "Les 4 notes de l’accord (∆7, m7, 7, ø) sans quitter la position",
      preset: { chordStyle: "four", cadences: ["251", "turn"], cadenceOrder: "mix", position: -1, randomKey: true },
      edit: ["key", "cadences", "cadenceOrder", "position"],
      rounds: [4, 8, 12],
      defaultRounds: 8,
    },
  ],
};
