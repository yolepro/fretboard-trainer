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
  /** Optional metronome during the notes: called on every beat (quarter note) with its index, 0 = first beat. */
  onClick?: (beatIndex: number) => void;
  now?: () => number;
  /**
   * Web: the sounds are scheduled ahead on the audio clock instead of being played in the callbacks above (which
   * then only update the screen). Each receives the exact Date.now() time of the sound.
   */
  audio?: {
    beat: (beat: number, atMs: number) => void;
    note: (index: number, atMs: number) => void;
    click?: (beatIndex: number, atMs: number) => void;
    /** Silences the sounds already handed to the audio clock (called by cancel()). */
    cancel?: () => void;
  };
};

/** How far ahead the web sounds are handed to the audio clock. */
const LOOKAHEAD_MS = 200;

export function runSequence(o: SequenceOptions): () => void {
  const now = o.now ?? Date.now;
  const t0 = now() + (o.leadMs ?? 150);
  // One pass of the notes lasts a whole number of beats: when the notes stop in the middle of a beat, the rest of
  // the beat is silent before the loop starts again, so the loop (and the metronome) always fall on the beat.
  const cycleMs = Math.max(1, Math.ceil((o.length * o.noteMs) / o.beatMs - 1e-6)) * o.beatMs;
  const timeOf = (g: number) => {
    if (g < o.beats) return t0 + g * o.beatMs;
    const n = g - o.beats;
    return t0 + o.beats * o.beatMs + Math.floor(n / o.length) * cycleMs + (n % o.length) * o.noteMs;
  };
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

  // Web: the sounds themselves, handed to the audio clock LOOKAHEAD_MS ahead (exact times, same grid as above).
  let audioTimer: ReturnType<typeof setTimeout> | undefined;
  if (o.audio) {
    const audio = o.audio;
    const notesStart = t0 + o.beats * o.beatMs;
    const total = cycleMs;
    let ga = 0;
    let ka = 0;
    const pump = () => {
      if (cancelled) return;
      const horizon = now() + LOOKAHEAD_MS;
      for (;;) {
        if (!o.loop && ga - o.beats >= o.length) break;
        const t = timeOf(ga);
        if (t > horizon) break;
        if (ga < o.beats) audio.beat(ga, t);
        else audio.note((ga - o.beats) % o.length, t);
        ga += 1;
      }
      if (audio.click) {
        for (;;) {
          if (!o.loop && ka * o.beatMs >= total - 1) break;
          const t = notesStart + ka * o.beatMs;
          if (t > horizon) break;
          audio.click(ka, t);
          ka += 1;
        }
      }
      audioTimer = setTimeout(pump, 25);
    };
    pump();
  }

  // Metronome: its own absolute chain, locked to the same start, one click per beat while the notes last.
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  if (o.onClick && !o.audio) {
    const notesStart = t0 + o.beats * o.beatMs;
    const total = cycleMs;
    let k = 0;
    const click = () => {
      if (cancelled) return;
      o.onClick!(k);
      k += 1;
      if (!o.loop && k * o.beatMs >= total - 1) return;
      clickTimer = setTimeout(click, Math.max(0, notesStart + k * o.beatMs - now()));
    };
    clickTimer = setTimeout(click, Math.max(0, notesStart - now()));
  }
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    if (clickTimer) clearTimeout(clickTimer);
    if (audioTimer) clearTimeout(audioTimer);
    o.audio?.cancel?.();
  };
}
