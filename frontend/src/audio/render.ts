/**
 * Android: a sequence (count-in, notes, metronome) is mixed AHEAD OF TIME into one sound file, then played by a
 * single player. The rhythm then depends on nothing but the audio hardware: a busy JavaScript thread (drawing the
 * neck and the score, Expo Go's development mode…) can delay the highlighting, never the sound.
 *
 * Same time grid as runSequence (sequencer.ts), so the screen and the sound stay together.
 */
import { Platform } from "react-native";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

import { initAudio } from "@/src/audio/sampler";

export const renderedPlayback = Platform.OS === "android";

export type RenderSpec = {
  midis: number[]; // the notes, in order
  noteMs: number;
  beatMs: number;
  beats: number; // count-in beats
  firstBeat: number; // index of the first count-in click (0 = accented): “3, 4” count-ins start at 2
  loop: boolean;
  volume: number;
  /** Metronome during the notes: clicks per bar (0 = accented), or null. */
  metronome: { barPulses: number; volume: number } | null;
};

type Pcm = { rate: number; notes: Record<number, string>; high: string; low: string };
let pcm: Pcm | null = null;
function samples(): Pcm {
  if (!pcm) {
    // Loaded on first use only (3 MB of samples): app start is not slowed down.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const P = require("@/src/audio/pcm") as typeof import("@/src/audio/pcm");
    pcm = { rate: P.PCM_RATE, notes: P.NOTES, high: P.CLAVE_HIGH, low: P.CLAVE_LOW };
  }
  return pcm;
}

// ---- base64 <-> bytes (no dependency, fast enough for a few MB) ----
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Uint8Array(128);
for (let i = 0; i < B64.length; i++) LOOKUP[B64.charCodeAt(i)] = i;

function decodeInt16(b64: string): Float32Array {
  const len = b64.length;
  let pad = 0;
  if (b64[len - 1] === "=") pad++;
  if (b64[len - 2] === "=") pad++;
  const bytes = new Uint8Array((len * 3) / 4 - pad);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = LOOKUP[b64.charCodeAt(i)];
    const b = LOOKUP[b64.charCodeAt(i + 1)];
    const c = LOOKUP[b64.charCodeAt(i + 2)];
    const d = LOOKUP[b64.charCodeAt(i + 3)];
    bytes[p++] = (a << 2) | (b >> 4);
    if (p < bytes.length) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < bytes.length) bytes[p++] = ((c & 3) << 6) | d;
  }
  const view = new DataView(bytes.buffer);
  const out = new Float32Array(bytes.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

function encodeBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    chunk +=
      B64[a >> 2] +
      B64[((a & 3) << 4) | (b >> 4)] +
      (i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : "=") +
      (i + 2 < bytes.length ? B64[c & 63] : "=");
    if (chunk.length >= 16384) {
      parts.push(chunk);
      chunk = "";
    }
  }
  parts.push(chunk);
  return parts.join("");
}

const decoded = new Map<string, Float32Array>();
function sample(key: string, b64: string) {
  let s = decoded.get(key);
  if (!s) {
    s = decodeInt16(b64);
    decoded.set(key, s);
  }
  return s;
}

const MIN = 40;
const MAX = 74;
/** The sample and playback rate for a note (same as the live sampler). */
function noteSample(midi: number): { s: Float32Array; rate: number } | null {
  const P = samples();
  let base = midi;
  let rate = 1;
  if (midi > MAX) {
    base = midi - 12 >= MIN && midi - 12 <= MAX ? midi - 12 : MAX;
    rate = Math.pow(2, (midi - base) / 12);
  } else if (midi < MIN) {
    base = MIN;
    rate = Math.pow(2, (midi - MIN) / 12);
  }
  const b64 = P.notes[base];
  return b64 ? { s: sample(`n${base}`, b64), rate } : null;
}

/** Adds a sound into the mix at `at` (samples), for at most `maxLen` samples, with a short fade at the cut. */
function mixIn(mix: Float32Array, src: Float32Array, at: number, gain: number, rate = 1, maxLen = Infinity) {
  const fade = 0.06 * samples().rate; // 60 ms release when the next note cuts this one
  const len = Math.min(Math.floor(src.length / rate), maxLen === Infinity ? Infinity : Math.floor(maxLen + fade));
  for (let i = 0; i < len; i++) {
    const t = at + i;
    if (t < 0) continue;
    if (t >= mix.length) break;
    const x = i * rate;
    const k = Math.floor(x);
    const v = rate === 1 ? src[k] : src[k] + (src[Math.min(k + 1, src.length - 1)] - src[k]) * (x - k);
    const env = maxLen !== Infinity && i > maxLen ? 1 - (i - maxLen) / fade : 1;
    mix[t] += v * gain * env;
  }
}

/** Length of the loop: whole beats (as runSequence). */
export const cycleMsOf = (s: RenderSpec) => Math.max(1, Math.ceil((s.midis.length * s.noteMs) / s.beatMs - 1e-6)) * s.beatMs;

type Rendered = { uri: string; countInMs: number; cycleMs: number; durationMs: number };
const cache = new Map<string, Rendered>();
const keyOf = (s: RenderSpec) =>
  JSON.stringify([s.midis, Math.round(s.noteMs), Math.round(s.beatMs), s.beats, s.firstBeat, s.loop, s.volume, s.metronome]);

/** Mixes the sequence into a WAV (data URI). Cached: the same sequence is mixed only once. */
export function renderSequence(spec: RenderSpec): Rendered | null {
  const key = keyOf(spec);
  const hit = cache.get(key);
  if (hit) return hit;
  const P = samples();
  if (!P.notes[MIN]) return null; // no samples on this platform
  const rate = P.rate;
  const ms = (t: number) => Math.round((t * rate) / 1000);
  const countInMs = spec.beats * spec.beatMs;
  const cycleMs = cycleMsOf(spec);
  // Looping: several passes in the file (the player jumps back after the count-in when it reaches the end).
  const passes = spec.loop ? Math.max(2, Math.ceil(30000 / cycleMs)) : 1;
  const tail = 1600;
  const durationMs = countInMs + passes * cycleMs + (spec.loop ? 0 : tail);
  const mix = new Float32Array(ms(durationMs));
  const high = sample("high", P.high);
  const low = sample("low", P.low);

  for (let b = 0; b < spec.beats; b++) mixIn(mix, spec.firstBeat + b === 0 ? high : low, ms(b * spec.beatMs), spec.volume);
  const n = spec.midis.length;
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < n; i++) {
      const ns = noteSample(spec.midis[i]);
      if (!ns) continue;
      const at = countInMs + p * cycleMs + i * spec.noteMs;
      const last = !spec.loop && p === passes - 1 && i === n - 1;
      // Monophonic like the live sampler: a note rings until the next one starts.
      const nextAt = i < n - 1 ? at + spec.noteMs : countInMs + (p + 1) * cycleMs;
      mixIn(mix, ns.s, ms(at), spec.volume, ns.rate, last ? Infinity : ms(nextAt - at));
    }
  }
  if (spec.metronome) {
    const clicks = Math.round((passes * cycleMs) / spec.beatMs);
    for (let k = 0; k < clicks; k++) {
      mixIn(mix, k % spec.metronome.barPulses === 0 ? high : low, ms(countInMs + k * spec.beatMs), spec.metronome.volume);
    }
  }

  // 16-bit WAV.
  const bytes = new Uint8Array(44 + mix.length * 2);
  const v = new DataView(bytes.buffer);
  const str = (o: number, t: string) => {
    for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + mix.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, mix.length * 2, true);
  for (let i = 0; i < mix.length; i++) {
    const x = Math.max(-1, Math.min(1, mix[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 32768 : x * 32767, true);
  }
  const out = { uri: `data:audio/wav;base64,${encodeBase64(bytes)}`, countInMs, cycleMs, durationMs };
  if (cache.size > 12) cache.delete(cache.keys().next().value as string);
  cache.set(key, out);
  return out;
}

/** Mixes it now, during a quiet moment, so pressing Play starts at once (“charger en avance”). */
export function prerender(spec: RenderSpec) {
  if (!renderedPlayback || !spec.midis.length) return;
  try {
    renderSequence(spec);
  } catch {
    // the live sampler will be used
  }
}

let current: (() => void) | null = null; // the mixed sequence playing (or still ringing), stopped by the next one

/** What the screen shows while the sound plays: the count-in beat, the note, the end. */
export type RenderView = {
  onBeat: (beat: number) => void; // count-in beat index (0 = first click of the count-in)
  onNote: (index: number) => void;
  onEnd: () => void; // last note over (non-looping)
};

/**
 * Plays a mixed sequence and drives the screen FROM THE SOUND: each frame, the position in the file gives the beat
 * or the note to highlight. A late frame never queues up: the highlight jumps straight to the note being heard.
 * The player's own position (status updates) anchors the clock — the earliest-looking report is the most accurate,
 * since a report can only arrive late. Resolves with a stop function, or null when the file could not be loaded
 * (the caller falls back to the live sampler).
 */
export async function playRendered(spec: RenderSpec, view: RenderView): Promise<{ stop: () => void } | null> {
  if (!renderedPlayback) return null;
  initAudio();
  current?.();
  current = null;
  let r: Rendered | null = null;
  try {
    r = renderSequence(spec);
  } catch {
    r = null;
  }
  if (!r) return null;
  let player: AudioPlayer;
  try {
    player = createAudioPlayer({ uri: r.uri });
  } catch {
    return null;
  }
  // Wait until it is loaded (a data URI loads in a few ms; give up after 2 s).
  const w0 = Date.now();
  while (!player.isLoaded && Date.now() - w0 < 2000) await new Promise((res) => setTimeout(res, 15));
  if (!player.isLoaded) {
    try {
      player.remove();
    } catch {
      // ignore
    }
    return null;
  }

  const { countInMs, cycleMs } = r;
  const n = spec.midis.length;
  const notesEndMs = countInMs + n * spec.noteMs; // non-looping: the screen stops after the last note's length
  // File time (ms) = Date.now() - anchor. Before the player reports its position: a guess of its start latency.
  const START_LATENCY_GUESS = 60;
  let anchor = Date.now() + START_LATENCY_GUESS;
  let measured = false;
  let stopped = false;
  let lastShown = ""; // what is on screen (“b2”, “n5”), to update it only when it changes
  let raf: ReturnType<typeof requestAnimationFrame> | null = null;

  const frame = () => {
    if (stopped) return;
    const f = Date.now() - anchor;
    if (f >= 0) {
      if (f < countInMs) {
        const b = Math.min(spec.beats - 1, Math.floor(f / spec.beatMs));
        if (lastShown !== `b${b}`) {
          lastShown = `b${b}`;
          view.onBeat(b);
        }
      } else if (!spec.loop && f >= notesEndMs) {
        stopView();
        view.onEnd();
        return;
      } else {
        const inCycle = (f - countInMs) % cycleMs;
        const i = Math.floor(inCycle / spec.noteMs);
        if (i < n && lastShown !== `n${i}`) {
          lastShown = `n${i}`;
          view.onNote(i);
        }
      }
    }
    raf = requestAnimationFrame(frame);
  };
  const stopView = () => {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  };

  const sub = player.addListener("playbackStatusUpdate", (s) => {
    if (stopped) return;
    if (s.didJustFinish) {
      if (spec.loop) {
        // Back to the first note (the count-in is only played once); the clock is re-anchored on the new reports.
        anchor = Date.now() + START_LATENCY_GUESS - countInMs;
        measured = false;
        Promise.resolve(player.seekTo(countInMs / 1000))
          .then(() => player.play())
          .catch(() => {});
      } else stopSound();
      return;
    }
    if (!s.playing || !(s.currentTime > 0)) return;
    const a = Date.now() - s.currentTime * 1000;
    // A report can only be late: the earliest anchor seen is the right one (the first report replaces the guess).
    if (!measured || a < anchor) anchor = a;
    measured = true;
  });

  const stopSound = () => {
    if (stopped) return;
    stopped = true;
    stopView();
    sub.remove();
    try {
      player.pause();
      player.remove();
    } catch {
      // ignore
    }
  };
  // Stopping by the user ends both; the natural end lets the last note ring (the sound stops itself).
  const stop = () => stopSound();
  current = stopSound;
  player.volume = 1;
  player.play();
  anchor = Date.now() + START_LATENCY_GUESS;
  raf = requestAnimationFrame(frame);
  return { stop };
}
