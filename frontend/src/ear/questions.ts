import {
  CHORDS,
  DEGREE_META,
  SCALES,
  STRING_LABELS,
  TUNING,
  degreeKeyFromNum,
  octaveOf,
  pcOf,
  type DegreeKey,
  type IntervalDef,
} from "@/src/music/theory";

export type Section = "board" | "listen" | "degree" | "interval";

export const SECTIONS: { id: Section; label: string; desc: string }[] = [
  { id: "board", label: "Manche", desc: "Joue la note demandée sur la corde indiquée." },
  { id: "listen", label: "Écoute & rejoue", desc: "Écoute une note et rejoue-la à la bonne octave." },
  { id: "degree", label: "Degrés d’accord", desc: "Joue le degré demandé d’un accord (n’importe quelle octave)." },
  { id: "interval", label: "Intervalles", desc: "L’app joue la tonique : joue l’intervalle demandé au-dessus." },
];

export type Options = {
  count: number;
  strings: number[]; // display indices: 0 = high e … 5 = low E
  scaleId: string;
  intervals: string[]; // interval labels (from the scale) in play
  level: number; // 1..5
};

export const DEFAULT_OPTIONS: Options = {
  count: 10,
  strings: [5, 4, 3],
  scaleId: "major",
  intervals: ["5"],
  level: 1,
};

export type Question = {
  targetMidi: number;
  pitchClassOnly: boolean;
  prompt: string;
  big: string;
  sub: string;
  hidden: boolean; // target name hidden until answered (listen mode)
  playMidi: number; // what “Écouter” plays
  autoPlay: boolean;
  degree?: DegreeKey;
  badge?: string;
  string?: number;
  fret?: number;
};

export const STRING_NAMES = ["Mi aigu", "Si", "Sol", "Ré", "La", "Mi grave"];

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(arr: T[]) => arr[rand(0, arr.length - 1)];

// ---- Intervals ----
const BASE: Record<number, string> = { 2: "Seconde", 3: "Tierce", 4: "Quarte", 5: "Quinte", 6: "Sixte", 7: "Septième" };
const numOf = (label: string) => parseInt(label.replace(/[^0-9]/g, ""), 10);

export function intervalName(label: string) {
  const n = numOf(label);
  const perfect = n === 4 || n === 5;
  let q = perfect ? "juste" : "majeure";
  if (label.startsWith("bb")) q = "diminuée";
  else if (label.startsWith("b")) q = perfect ? "diminuée" : "mineure";
  else if (label.startsWith("#")) q = "augmentée";
  return `${BASE[n] ?? label} ${q}`;
}

export function scaleIntervals(scaleId: string): IntervalDef[] {
  const scale = SCALES.find((s) => s.id === scaleId) ?? SCALES[0];
  const seen = new Set<string>();
  return scale.intervals.filter((i) => {
    if (i.num === 1 || seen.has(i.label)) return false;
    seen.add(i.label);
    return true;
  });
}

const LEVELS = [[5], [5, 4], [5, 4, 3], [5, 4, 3, 6, 2], [2, 3, 4, 5, 6, 7]];
export const LEVEL_LABELS = ["1 · Unique", "2 · Facile", "3 · Moyen", "4 · Difficile", "5 · Tous"];

export function intervalsForLevel(scaleId: string, level: number): string[] {
  const avail = scaleIntervals(scaleId);
  const nums = LEVELS[level - 1];
  const out = avail.filter((i) => nums.includes(numOf(i.label))).map((i) => i.label);
  if (!out.length) return [avail[0].label];
  if (level === 1) return [out.find((l) => !/[b#]/.test(l)) ?? out[0]];
  return out;
}

// ---- Position helpers ----
export function lowestPosition(midi: number, pcOnly: boolean) {
  let best: { string: number; fret: number } | null = null;
  TUNING.forEach((open, s) => {
    for (let f = 0; f <= 12; f++) {
      const ok = pcOnly ? pcOf(open + f) === pcOf(midi) : open + f === midi;
      if (ok && (!best || f < best.fret)) best = { string: s, fret: f };
    }
  });
  return best as { string: number; fret: number } | null;
}

export const positionText = (p: { string: number; fret: number }) =>
  `corde ${p.string + 1} (${STRING_LABELS[p.string]}), ${p.fret === 0 ? "à vide" : `case ${p.fret}`}`;

// ---- Generators ----
const QUIZ_CHORDS = CHORDS.filter((c) => ["maj", "min", "dom7", "maj7", "m7", "m7b5", "dom9", "m9", "dom11", "dom13", "six", "sus4"].includes(c.id));

export function makeQuestion(section: Section, opts: Options, name: (pc: number) => string): Question {
  const full = (m: number) => `${name(pcOf(m))}${octaveOf(m)}`;
  if (section === "board") {
    const s = pick(opts.strings.length ? opts.strings : [5]);
    const fret = rand(0, 12);
    const midi = TUNING[s] + fret;
    return {
      targetMidi: midi,
      pitchClassOnly: false,
      prompt: "Joue",
      big: full(midi),
      sub: `Corde ${s + 1} · ${STRING_NAMES[s]} (${STRING_LABELS[s]})`,
      hidden: false,
      playMidi: midi,
      autoPlay: false,
      string: s,
      fret,
    };
  }
  if (section === "listen") {
    const midi = rand(40, 64);
    return {
      targetMidi: midi,
      pitchClassOnly: false,
      prompt: "Écoute et rejoue",
      big: full(midi),
      sub: "à la bonne octave",
      hidden: true,
      playMidi: midi,
      autoPlay: true,
    };
  }
  if (section === "degree") {
    const root = rand(0, 11);
    const chord = pick(QUIZ_CHORDS);
    const iv = pick(chord.intervals.filter((i) => i.num !== 1));
    const key = degreeKeyFromNum(iv.num);
    const degName = ({ "6": "sixte", "4": "quarte", "2": "seconde" } as Record<string, string>)[iv.label] ?? DEGREE_META[key].name;
    const target = 48 + pcOf(root + iv.semi);
    return {
      targetMidi: target,
      pitchClassOnly: true,
      prompt: `Joue la ${degName} de`,
      big: `${name(root)}${chord.symbol}`,
      sub: "n’importe quelle octave",
      hidden: false,
      playMidi: 48 + pcOf(root),
      autoPlay: false,
      degree: key,
      badge: iv.label,
    };
  }
  // interval
  const pool = scaleIntervals(opts.scaleId).filter((i) => opts.intervals.includes(i.label));
  const iv = pick(pool.length ? pool : scaleIntervals(opts.scaleId));
  const root = rand(40, 55);
  const target = root + iv.semi;
  return {
    targetMidi: target,
    pitchClassOnly: false,
    prompt: "Joue la",
    big: intervalName(iv.label),
    sub: `au-dessus de ${full(root)} (tonique)`,
    hidden: false,
    playMidi: root,
    autoPlay: true,
    degree: degreeKeyFromNum(iv.num),
    badge: iv.label,
  };
}

export const bestKey = (s: Section, count: number) => `fretstudio_best_${s}_${count}`;
export type Best = { score: number; timeMs: number };

export function formatTime(ms: number) {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const d = Math.floor((t % 1000) / 100);
  return `${m}:${String(s).padStart(2, "0")}.${d}`;
}
