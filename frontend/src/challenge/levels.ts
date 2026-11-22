// “Trouve le degré”: ready-made levels (Débutant / Intermédiaire / Expert), each with categories.
import type { ChallengeOptions } from "@/src/challenge/rounds";

export type LevelId = "beginner" | "inter" | "expert";

export type Category = {
  id: string;
  name: string;
  meta: string;
  degrees: string[]; // degree numbers
  set?: Partial<ChallengeOptions>; // what the category changes on top of its level
};

export type Level = {
  id: LevelId;
  name: string;
  intro: string;
  base: Partial<ChallengeOptions>;
  rounds: number[]; // choices offered (the first of `defaultRounds` index)
  defaultRounds: number;
  keyChoice: boolean; // the player picks the key
  categories: Category[];
};

export const LEVELS: Level[] = [
  {
    id: "beginner",
    name: "Débutant",
    intro: "Une tonalité simple, les positions l’une après l’autre, les notes qui structurent tout. La tonique reste affichée.",
    base: { randomKey: false, scaleId: "major", contextRandom: false, position: -2, scope: "position", hideTonic: false, sprintSec: 0 },
    rounds: [3, 5, 10],
    defaultRounds: 5,
    keyChoice: true, // C by default, any key on the rosace
    categories: [
      { id: "tonics", name: "Toniques", meta: "Toutes les toniques d’une position, puis de la suivante", degrees: ["1"] },
      { id: "pillars", name: "Les piliers", meta: "Tonique, tierce, quinte, mélangées", degrees: ["1", "3", "5"] },
      { id: "fifths", name: "Quintes", meta: "La tonique et sa quinte : le power chord", degrees: ["1", "5"] },
    ],
  },
  {
    id: "inter",
    name: "Intermédiaire",
    intro: "Tous les degrés, ta tonalité, une position différente à chaque tour.",
    base: { randomKey: false, scaleId: "major", contextRandom: false, position: -1, scope: "position", hideTonic: false, sprintSec: 0 },
    rounds: [5, 10, 20],
    defaultRounds: 10,
    keyChoice: true,
    categories: [
      {
        id: "pillars",
        name: "Les piliers",
        meta: "Tonique, tierce, quinte, septième · tonalité au hasard",
        degrees: ["1", "3", "5", "7"],
        set: { randomKey: true },
      },
      { id: "colors", name: "Les couleurs", meta: "Les degrés qui colorent : 2, 4, 6", degrees: ["2", "4", "6"] },
      { id: "all7", name: "Les 7 degrés", meta: "Un degré différent à chaque tour", degrees: ["2", "3", "4", "5", "6", "7"] },
      { id: "arp7", name: "Arpège 7", meta: "Les notes de l’accord à 4 sons : 3, 5, 7", degrees: ["3", "5", "7"] },
      { id: "minor", name: "Le mineur", meta: "Les degrés qui changent en mineur : ♭3, ♭6, ♭7", degrees: ["3", "6", "7"], set: { scaleId: "minor" } },
      { id: "neck", name: "Tout le manche", meta: "Un degré sur les 5 positions d’un coup", degrees: ["1", "3", "5", "7"], set: { scope: "neck" } },
    ],
  },
  {
    id: "expert",
    name: "Expert",
    intro: "Tout est au hasard : tonalité, position, majeur ou mineur, degré. La tonique n’est plus affichée.",
    base: { randomKey: true, contextRandom: true, position: -1, scope: "position", hideTonic: true, sprintSec: 0 },
    rounds: [10, 20, 30],
    defaultRounds: 20,
    keyChoice: false,
    categories: [
      { id: "random", name: "Tout au hasard", meta: "Chaque tour : nouvelle tonalité, position et degré", degrees: ["1", "2", "3", "4", "5", "6", "7"] },
      { id: "neck", name: "Tout le manche", meta: "Un degré sur les 5 positions d’un coup", degrees: ["2", "3", "4", "5", "6", "7"], set: { scope: "neck" } },
      { id: "sprint", name: "Contre-la-montre", meta: "Un maximum de degrés en 60 secondes", degrees: ["1", "2", "3", "4", "5", "6", "7"], set: { sprintSec: 60 } },
    ],
  },
];

/** The options a level + category give (the player keeps the key when the level lets him choose it, and his rounds). */
export function levelOptions(base: ChallengeOptions, level: Level, cat: Category, rounds: number): ChallengeOptions {
  return {
    ...base,
    ...level.base,
    ...(level.keyChoice ? { rootPc: base.rootPc } : {}),
    ...cat.set,
    degrees: cat.degrees,
    rounds,
  };
}

/** Neck categories: fewer rounds make sense (a round = the whole neck). */
export const neckRounds = [3, 5, 10];
