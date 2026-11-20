// Oreille results: one line per answered question + one line per finished challenge, kept on the device.
import { storage } from "@/src/utils/storage";
import type { Section } from "@/src/ear/questions";

/** One answered question. `key` groups the same target across sessions (a fret, a note, a degree, an interval). */
export type Attempt = {
  t: number; // when (ms since epoch)
  s: Section | string; // ear sections, or a challenge (“find-degree”, “find-scale”)
  key: string;
  midi?: number; // note targets: the name is computed at display time (notation setting)
  label?: string; // other targets (degree / interval name)
  sub?: string; // e.g. the chord type for a degree
  string?: number;
  fret?: number;
  ms: number; // answer time, chrono pauses excluded
  errors: number; // wrong notes before the answer (2 = missed)
  skipped?: boolean;
};

/** One finished challenge (for the progress curve). */
export type SessionRec = { t: number; s: Section | string; count: number; score: number; ms: number };

export const ATTEMPTS_KEY = "fretstudio_ear_attempts";
export const SESSIONS_KEY = "fretstudio_ear_sessions";
const MAX_ATTEMPTS = 2000;
const MAX_SESSIONS = 300;

async function readList<T>(key: string): Promise<T[]> {
  const raw = await storage.getItem(key, null);
  if (typeof raw !== "string") return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

// Writes are chained so two quick answers never overwrite each other.
let chain: Promise<unknown> = Promise.resolve();
function append<T>(key: string, item: T, max: number) {
  chain = chain.then(async () => {
    const list = await readList<T>(key);
    list.push(item);
    await storage.setItem(key, JSON.stringify(list.slice(-max)));
  });
  return chain;
}

export const saveAttempt = (a: Attempt) => append(ATTEMPTS_KEY, a, MAX_ATTEMPTS);
export const saveSession = (s: SessionRec) => append(SESSIONS_KEY, s, MAX_SESSIONS);

export async function loadHistory() {
  await chain;
  const [attempts, sessions] = await Promise.all([readList<Attempt>(ATTEMPTS_KEY), readList<SessionRec>(SESSIONS_KEY)]);
  return { attempts, sessions };
}

export async function clearHistory() {
  await chain;
  await Promise.all([storage.removeItem(ATTEMPTS_KEY), storage.removeItem(SESSIONS_KEY)]);
}

export type Period = 7 | 30 | 0; // days, 0 = all
export const since = (p: Period) => (p === 0 ? 0 : Date.now() - p * 86400000);

/** Per-target figures. A target is “ranked” once it has MIN_TRIES answers. */
export type TargetStat = {
  key: string;
  sample: Attempt; // latest attempt: carries the label / midi / position
  tries: number;
  medianMs: number;
  missed: number; // answers with at least one wrong note, or skipped
  rate: number; // missed / tries
};
export const MIN_TRIES = 3;

const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

export function targetStats(attempts: Attempt[]): Map<string, TargetStat> {
  const by = new Map<string, Attempt[]>();
  attempts.forEach((a) => {
    const l = by.get(a.key);
    if (l) l.push(a);
    else by.set(a.key, [a]);
  });
  const out = new Map<string, TargetStat>();
  by.forEach((list, key) => {
    // Time: only answers actually found (a skipped question has no meaningful time).
    const found = list.filter((a) => !a.skipped && a.errors < 2);
    const missed = list.filter((a) => a.skipped || a.errors > 0).length;
    out.set(key, {
      key,
      sample: list[list.length - 1],
      tries: list.length,
      medianMs: found.length ? median(found.map((a) => a.ms)) : Infinity,
      missed,
      rate: missed / list.length,
    });
  });
  return out;
}

/** Top lists. With few ranked targets the two sides of a list never share an entry. */
export function tops(stats: TargetStat[], n = 5) {
  const ranked = stats.filter((s) => s.tries >= MIN_TRIES);
  const timed = ranked.filter((s) => Number.isFinite(s.medianMs)).sort((a, b) => a.medianMs - b.medianMs);
  const half = Math.ceil(timed.length / 2);
  const fast = timed.slice(0, Math.min(n, half));
  const slow = timed.slice(Math.max(half, timed.length - n)).reverse();
  const byRate = [...ranked].sort((a, b) => a.rate - b.rate || b.tries - a.tries);
  const safe = byRate.filter((s) => s.missed === 0).slice(0, n);
  const fragile = byRate.filter((s) => s.missed > 0).reverse().slice(0, n);
  return { fast, slow, safe, fragile, ranked: ranked.length };
}
