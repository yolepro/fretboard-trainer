/**
 * Runs a count-in followed by a sequence of notes against ONE absolute clock: every event is scheduled at
 * `start + offset`, so a timer that fires late never pushes the following events back.
 *
 * Events: `beats` count-in clicks (a quarter note apart), then the notes (`noteMs` apart). With `loop`, the notes
 * start over from the first one (no new count-in) until `cancel()` is called.
 */
export type SequenceOptions = {
  length: number;
  noteMs: number;
  beatMs: number;
  beats: number;
  loop: boolean;
  leadMs?: number;
  onBeat: (beat: number) => void;
  onNote: (index: number) => void;
  onEnd: () => void;
  now?: () => number;
};

export function runSequence(o: SequenceOptions): () => void {
  const now = o.now ?? Date.now;
  const t0 = now() + (o.leadMs ?? 150);
  const timeOf = (g: number) => (g < o.beats ? t0 + g * o.beatMs : t0 + o.beats * o.beatMs + (g - o.beats) * o.noteMs);
  let g = 0;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = () => {
    if (cancelled) return;
    if (g < o.beats) {
      o.onBeat(g);
    } else {
      const n = g - o.beats;
      if (!o.loop && n >= o.length) {
        o.onEnd();
        return;
      }
      o.onNote(n % o.length);
    }
    g += 1;
    // After the last note of a non-looping run, wait one more note length before reporting the end.
    timer = setTimeout(run, Math.max(0, timeOf(g) - now()));
  };

  timer = setTimeout(run, Math.max(0, t0 - now()));
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
