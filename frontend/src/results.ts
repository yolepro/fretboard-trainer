// What the app records, family by family (Oreille, Challenges, Accords), to show it and erase it selectively.
import { useEffect, useState } from "react";

import { loadHistory, rewriteHistory } from "@/src/ear/stats";
import { storage } from "@/src/utils/storage";

export type Family = "ear" | "challenges" | "chords";
export const FAMILIES: Family[] = ["ear", "challenges", "chords"];

/** The family of a history entry, from its section (“chords”, “find-degree”…, or an Oreille section). */
export const familyOf = (s: string): Family => (s === "chords" ? "chords" : s.startsWith("find-") ? "challenges" : "ear");

/** Record keys of each family (see bestKey and challengeBestKey). */
const RECORD_PREFIXES: Record<Family, string[]> = {
  ear: ["board", "listen", "degree", "interval"].map((s) => `fretstudio_best_${s}_`),
  challenges: ["fretstudio_chbest_"],
  chords: ["fretstudio_best_chords_"],
};

export type FamilySummary = { records: number; games: number };

export async function resultsSummary(): Promise<Record<Family, FamilySummary>> {
  const [keys, { sessions }] = await Promise.all([storage.keysByPrefix(Object.values(RECORD_PREFIXES).flat()), loadHistory()]);
  const out = {} as Record<Family, FamilySummary>;
  FAMILIES.forEach((f) => {
    out[f] = {
      records: keys.filter((k) => RECORD_PREFIXES[f].some((p) => k.startsWith(p))).length,
      games: sessions.filter((x) => familyOf(String(x.s)) === f).length,
    };
  });
  return out;
}

/** Erases the records, games and answers (hence the weak points) of these families. */
export async function clearResults(families: Family[]) {
  if (!families.length) return;
  await Promise.all([
    storage.removeByPrefix(families.flatMap((f) => RECORD_PREFIXES[f])),
    rewriteHistory((s) => !families.includes(familyOf(s))),
  ]);
  version += 1;
  listeners.forEach((l) => l(version));
}

// Screens that show a record stay mounted (tabs): they reload it when results are erased.
let version = 0;
const listeners = new Set<(v: number) => void>();
export function useResultsVersion() {
  const [v, setV] = useState(version);
  useEffect(() => {
    listeners.add(setV);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}
