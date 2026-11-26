// How a chord sounds, from Réglages › Entraînement › « Accords : façon de jouer » (settings.chordStyle).
// One helper for every screen that plays chords in time (Cadences, Harmonie), so the setting applies everywhere.
export type ChordStyle = "both" | "block" | "arp";
export type Hit = { midi: number; at: number };

const STRUM_MS = 25; // between two strings of a strum

/**
 * The notes of one chord filling one 4-beat bar starting at `t0` (ms):
 * - "block": strummed on beats 1 and 3;
 * - "arp": arpeggio in eighth notes over the whole bar (up and down when the chord has few notes);
 * - "both": arpeggio in eighth notes on beats 1–2, then strummed on beat 3.
 */
export function barHits(midis: number[], style: ChordStyle, t0: number, beat: number): Hit[] {
  const notes = [...new Set(midis)].sort((a, b) => a - b);
  if (!notes.length) return [];
  const strum = (at: number) => notes.map((midi, k) => ({ midi, at: at + k * STRUM_MS }));
  if (style === "block") return [...strum(t0), ...strum(t0 + 2 * beat)];
  if (style === "arp") {
    const slots = Math.max(8, notes.length);
    const step = (4 * beat) / slots;
    const cycle = notes.length < slots && notes.length > 2 ? [...notes, ...notes.slice(1, -1).reverse()] : notes;
    return Array.from({ length: slots }, (_, i) => ({ midi: cycle[i % cycle.length], at: t0 + i * step }));
  }
  const step = Math.min(beat / 2, (2 * beat) / notes.length);
  return [...notes.map((midi, i) => ({ midi, at: t0 + i * step })), ...strum(t0 + 2 * beat)];
}
