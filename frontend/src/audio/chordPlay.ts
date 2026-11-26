// How a chord sounds, from Réglages › Entraînement › « Accords : façon de jouer » (settings.chordStyle).
// One helper for the screens that play chords one after the other (Cadences, Harmonie), so the setting applies everywhere.
export type ChordStyle = "both" | "block" | "arp";
export type Hit = { midi: number; at: number };

const ARP = 280; // between two notes of an arpeggio (as in Explorer › Les formes à jouer)
const GAP = 350; // between the arpeggio and the strum
const RING = 1300; // how long a strum rings before the next chord

/**
 * One chord played once, as in Explorer › Les formes à jouer: the arpeggio, the strum, or the arpeggio then the strum.
 * Returns the notes from `t0` and when the next chord can start. `beat` (ms): follow a tempo instead of the default speed.
 */
export function chordOnce(midis: number[], style: ChordStyle, t0 = 0, beat?: number): { hits: Hit[]; next: number } {
  const notes = [...new Set(midis)].sort((a, b) => a - b);
  // With a tempo (Cadences): eighth-note arpeggio, a half-beat gap, the strum rings 2 beats.
  const ARP_MS = beat ? beat / 2 : ARP;
  const GAP_MS = beat ? beat / 2 : GAP;
  const RING_MS = beat ? 2 * beat : RING;
  const hits: Hit[] = [];
  let t = t0;
  if (style !== "block") {
    notes.forEach((midi, i) => hits.push({ midi, at: t0 + i * ARP_MS }));
    t = t0 + notes.length * ARP_MS + (style === "arp" ? ARP_MS * 2 : GAP_MS);
  }
  if (style !== "arp") {
    notes.forEach((midi, i) => hits.push({ midi, at: t + i * 30 }));
    t += RING_MS;
  }
  return { hits, next: t };
}
