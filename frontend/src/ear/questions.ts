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
import { getLang, tr } from "@/src/i18n";

export type Section = "board" | "listen" | "degree" | "interval" | "chords";

export const SECTIONS: { id: Section; label: string; desc: string }[] = [
  { id: "board", label: "Trouve la note", desc: "Joue la note demandée sur la corde indiquée." },
  { id: "listen", label: "Rejoue la note", desc: "Écoute une note et rejoue-la à la bonne octave." },
  { id: "degree", label: "Trouve le degré de l’accord", desc: "Joue le degré demandé d’un accord (n’importe quelle octave)." },
  { id: "interval", label: "Reconnais l’intervalle", desc: "Un intervalle est joué et montré sur le manche : reconnais-le." },
  { id: "chords", label: "Reconnais l’accord", desc: "Un accord est joué : reconnais son type (majeur, mineur…)." },
];

export type Options = {
  count: number;
  strings: number[]; // display indices: 0 = high e … 5 = low E
  scaleId: string;
  intervals: string[]; // interval labels (from the scale) in play
  level: number; // 1..5
  weak: boolean; // “Mes points faibles”: questions drawn from the weak targets (see weakness.ts)
};

export const DEFAULT_OPTIONS: Options = {
  count: 10,
  strings: [5, 4, 3],
  scaleId: "major",
  intervals: ["5"],
  level: 1,
  weak: false,
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
  /** What the results dashboard groups by (see stats.ts). */
  stat: { key: string; midi?: number; label?: string; sub?: string };
  /** Weak-points mode: why this target was picked (tag under the note). */
  focus?: { weak: boolean; text: string };
};

export const STRING_NAMES = ["Mi aigu", "Si", "Sol", "Ré", "La", "Mi grave"];

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(arr: T[]) => arr[rand(0, arr.length - 1)];

// ---- Intervals ----
const BASE: Record<number, string> = { 2: "Seconde", 3: "Tierce", 4: "Quarte", 5: "Quinte", 6: "Sixte", 7: "Septième" };
const numOf = (label: string) => parseInt(label.replace(/[^0-9]/g, ""), 10);

export function intervalName(label: string) {
  const n = numOf(label);
  if (n === 8) return tr("Octave");
  const perfect = n === 4 || n === 5;
  let q = perfect ? "juste" : "majeure";
  if (label.startsWith("bb")) q = "diminuée";
  else if (label.startsWith("b")) q = perfect ? "diminuée" : "mineure";
  else if (label.startsWith("#")) q = "augmentée";
  const base = BASE[n] ?? label;
  // English puts the quality first: "Major third".
  if (getLang() === "en") {
    const qe = tr(q);
    return `${qe.charAt(0).toUpperCase()}${qe.slice(1)} ${tr(base).toLowerCase()}`;
  }
  return `${base} ${q}`;
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
  tr("corde {s} ({l}), {where}", { s: p.string + 1, l: STRING_LABELS[p.string], where: p.fret === 0 ? tr("à vide") : tr("case {f}", { f: p.fret }) });

// ---- Generators ----
const QUIZ_CHORDS = CHORDS.filter((c) => ["maj", "min", "dom7", "maj7", "m7", "m7b5", "dom9", "m9", "dom11", "dom13", "six", "sus4"].includes(c.id));

/** Every target a challenge can ask with these options, as stat keys (see Question.stat). */
export function candidateKeys(section: Section, opts: Options): string[] {
  if (section === "board") return (opts.strings.length ? opts.strings : [5]).flatMap((s) => Array.from({ length: 13 }, (_, f) => `b${s}-${f}`));
  if (section === "listen") return Array.from({ length: 25 }, (_, i) => `l${40 + i}`);
  if (section === "degree") return QUIZ_CHORDS.flatMap((c) => c.intervals.filter((i) => i.num !== 1).map((i) => `d${c.id}:${i.label}`));
  const pool = scaleIntervals(opts.scaleId).filter((i) => opts.intervals.includes(i.label));
  return (pool.length ? pool : scaleIntervals(opts.scaleId)).map((i) => `i${i.label}`);
}

/** `forced`: a stat key to ask (weak-points mode); otherwise a random target. */
export function makeQuestion(section: Section, opts: Options, name: (pc: number) => string, forced?: string): Question {
  const full = (m: number) => `${name(pcOf(m))}${octaveOf(m)}`;
  if (section === "board") {
    const fm = forced?.match(/^b(\d)-(\d+)$/);
    const s = fm ? Number(fm[1]) : pick(opts.strings.length ? opts.strings : [5]);
    const fret = fm ? Number(fm[2]) : rand(0, 12);
    const midi = TUNING[s] + fret;
    return {
      targetMidi: midi,
      pitchClassOnly: false,
      prompt: tr("Joue"),
      big: full(midi),
      sub: tr("Corde {s} · {name} ({l})", { s: s + 1, name: tr(STRING_NAMES[s]), l: STRING_LABELS[s] }),
      hidden: false,
      playMidi: midi,
      autoPlay: false,
      string: s,
      fret,
      stat: { key: `b${s}-${fret}`, midi },
    };
  }
  if (section === "listen") {
    const lm = forced?.match(/^l(\d+)$/);
    const midi = lm ? Number(lm[1]) : rand(40, 64);
    return {
      targetMidi: midi,
      pitchClassOnly: false,
      prompt: tr("Écoute et rejoue"),
      big: full(midi),
      sub: tr("à la bonne octave"),
      hidden: true,
      playMidi: midi,
      autoPlay: true,
      stat: { key: `l${midi}`, midi },
    };
  }
  if (section === "degree") {
    const root = rand(0, 11);
    const dm = forced?.match(/^d([^:]+):(.+)$/);
    const chord = (dm && QUIZ_CHORDS.find((c) => c.id === dm[1])) || pick(QUIZ_CHORDS);
    const ivs = chord.intervals.filter((i) => i.num !== 1);
    const iv = (dm && ivs.find((i) => i.label === dm[2])) || pick(ivs);
    const key = degreeKeyFromNum(iv.num);
    const degName = ({ "6": "sixte", "4": "quarte", "2": "seconde" } as Record<string, string>)[iv.label] ?? DEGREE_META[key].name;
    const target = 48 + pcOf(root + iv.semi);
    return {
      targetMidi: target,
      pitchClassOnly: true,
      prompt: tr("Joue la {deg} de", { deg: tr(degName) }),
      big: `${name(root)}${chord.symbol}`,
      sub: tr("n’importe quelle octave"),
      hidden: false,
      playMidi: 48 + pcOf(root),
      autoPlay: false,
      degree: key,
      badge: iv.label,
      stat: { key: `d${chord.id}:${iv.label}`, label: degName, sub: chord.name },
    };
  }
  // interval
  const pool = scaleIntervals(opts.scaleId).filter((i) => opts.intervals.includes(i.label));
  const avail = pool.length ? pool : scaleIntervals(opts.scaleId);
  const iv = (forced && avail.find((i) => `i${i.label}` === forced)) || pick(avail);
  const root = rand(40, 55);
  const target = root + iv.semi;
  return {
    targetMidi: target,
    pitchClassOnly: false,
    prompt: tr("Joue la"),
    big: intervalName(iv.label),
    sub: tr("au-dessus de {note} (tonique)", { note: full(root) }),
    hidden: false,
    playMidi: root,
    autoPlay: true,
    degree: degreeKeyFromNum(iv.num),
    badge: iv.label,
    stat: { key: `i${iv.label}`, label: iv.label },
  };
}

export const bestKey = (s: Section, count: number) => `fretstudio_best_${s}_${count}`;
export type Best = { score: number; timeMs: number; at?: number };

export function formatTime(ms: number) {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const d = Math.floor((t % 1000) / 100);
  return `${m}:${String(s).padStart(2, "0")}.${d}`;
}
