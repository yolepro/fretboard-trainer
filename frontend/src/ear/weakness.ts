// “Mes points faibles”: a weakness score per target, and the weighted draw of the next question.
import type { Attempt } from "@/src/ear/stats";

const DAY = 86400000;
const RECENT = 8; // answers looked at per target
const DECAY = 0.7; // weight of each older answer
export const WEAK_SHARE = 0.7; // ~7 questions out of 10 come from the weak targets
const WEAK_MIN = 0.2;

export type Weakness = { key: string; score: number; weak: boolean; tries: number };

const found = (a: Attempt) => !a.skipped && a.errors < 2;
const missed = (a: Attempt) => !!a.skipped || a.errors > 0;

const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/**
 * Score in [0, ~1.3]: errors (recent ones weigh more) + slowness against the player's own median
 * + a little forgetting (not seen for a while). 3 fast right answers in a row take a target out of the weak list.
 */
export function weaknessScores(keys: string[], attempts: Attempt[], now = Date.now()): Weakness[] {
  const by = new Map<string, Attempt[]>();
  attempts.forEach((a) => {
    const l = by.get(a.key);
    if (l) l.push(a);
    else by.set(a.key, [a]);
  });
  const allFound = attempts.filter(found).map((a) => a.ms);
  const ref = allFound.length ? median(allFound) : 2500;

  return keys.map((key) => {
    const list = (by.get(key) ?? []).sort((a, b) => a.t - b.t).slice(-RECENT);
    // Never or rarely asked: worth asking (moderately weak), never asked first.
    if (list.length < 3) return { key, score: list.length === 0 ? 0.6 : 0.45, weak: true, tries: list.length };

    let wSum = 0;
    let errSum = 0;
    list.forEach((a, i) => {
      const w = Math.pow(DECAY, list.length - 1 - i);
      wSum += w;
      errSum += w * (missed(a) ? 1 : 0);
    });
    const err = errSum / wSum;
    const times = list.filter(found).slice(-5).map((a) => a.ms);
    const slow = times.length ? Math.min(1.5, Math.max(0, median(times) / ref - 1)) / 1.5 : 1;
    const days = (now - list[list.length - 1].t) / DAY;
    const forget = Math.min(1, days / 14) * 0.3;

    const last3 = list.slice(-3);
    const acquired = last3.length === 3 && last3.every((a) => !missed(a) && a.ms <= ref * 1.1);
    const score = acquired ? forget * 0.5 : 0.5 * err + 0.35 * slow + forget;
    return { key, score, weak: score >= WEAK_MIN, tries: list.length };
  });
}

function weighted<T>(items: T[], weight: (t: T) => number): T {
  const total = items.reduce((s, x) => s + Math.max(0.01, weight(x)), 0);
  let r = Math.random() * total;
  for (const x of items) {
    r -= Math.max(0.01, weight(x));
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}

/** Next target: weak ones ~70 % of the time (weakest more often), else a known one; never the same twice in a row. */
export function pickWeakKey(scores: Weakness[], previous?: string): { key: string; weak: boolean } | null {
  const pool = scores.length > 1 ? scores.filter((s) => s.key !== previous) : scores;
  if (!pool.length) return null;
  const weak = pool.filter((s) => s.weak);
  const strong = pool.filter((s) => !s.weak);
  const fromWeak = weak.length > 0 && (strong.length === 0 || Math.random() < WEAK_SHARE);
  const chosen = fromWeak ? weighted(weak, (s) => s.score) : strong[Math.floor(Math.random() * strong.length)];
  return { key: chosen.key, weak: chosen.weak };
}
