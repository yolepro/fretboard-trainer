import { Platform } from "react-native";
import { Asset } from "expo-asset";

/**
 * Web only: sample-accurate playback with the Web Audio API. HTML <audio> elements (what expo-audio uses on the
 * web) start with a variable delay and their seeks are asynchronous, so notes and metronome drift apart. Here every
 * sound is decoded once into an AudioBuffer and started at an exact time of the audio clock, scheduled a little
 * ahead by the sequencer: the JS thread being busy (re-renders) no longer moves the sounds.
 */
type Ctx = AudioContext;
const AC: (new () => Ctx) | undefined =
  Platform.OS === "web" && typeof window !== "undefined"
    ? ((window as unknown as { AudioContext?: new () => Ctx; webkitAudioContext?: new () => Ctx }).AudioContext ??
      (window as unknown as { webkitAudioContext?: new () => Ctx }).webkitAudioContext)
    : undefined;

/** True on the web when the Web Audio API exists: the sequencer then schedules the sounds ahead of time. */
export const webAudioScheduling = !!AC;

let ctx: Ctx | null = null;
export function webCtx(): Ctx | null {
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Call from a user gesture (Play button): browsers keep the audio clock suspended until then. */
export function resumeWebAudio() {
  const c = webCtx();
  if (c && c.state !== "running") c.resume().catch(() => {});
}

const buffers = new Map<number, AudioBuffer>();
const loading = new Map<number, Promise<AudioBuffer | null>>();

/** Decodes a bundled sound (by its require() module id) once; later calls reuse the buffer. */
export function loadWebBuffer(mod: number): Promise<AudioBuffer | null> {
  const c = webCtx();
  if (!c) return Promise.resolve(null);
  const have = buffers.get(mod);
  if (have) return Promise.resolve(have);
  let p = loading.get(mod);
  if (!p) {
    p = (async () => {
      try {
        const uri = Asset.fromModule(mod).uri;
        const data = await (await fetch(uri)).arrayBuffer();
        const buf = await c.decodeAudioData(data);
        buffers.set(mod, buf);
        return buf;
      } catch {
        return null;
      } finally {
        loading.delete(mod);
      }
    })();
    loading.set(mod, p);
  }
  return p;
}

/** Audio-clock time (seconds) of a Date.now() timestamp. */
const toCtxTime = (c: Ctx, atMs: number) => Math.max(c.currentTime, c.currentTime + (atMs - Date.now()) / 1000);

type Voice = { src: AudioBufferSourceNode; gain: GainNode };
let lastNote: Voice | null = null;
/** Every sound started or scheduled and not finished yet: Stop silences them all, even those due in a moment. */
const live = new Set<Voice>();

/**
 * Starts a decoded sound at `atMs` (Date.now() time). `mono`: a new note fades the previous one out (80 ms), like
 * the native player. Returns false when the sound isn't decoded yet (the caller then falls back to the <audio> path).
 */
export function playWebBuffer(mod: number, atMs: number, volume: number, rate = 1, mono = false): boolean {
  const c = webCtx();
  const buf = buffers.get(mod);
  if (!c || !buf) return false;
  const t = toCtxTime(c, atMs);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.setValueAtTime(rate, t);
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, t);
  src.connect(gain).connect(c.destination);
  src.start(t);
  const voice = { src, gain };
  live.add(voice);
  src.onended = () => live.delete(voice);
  if (mono) {
    if (lastNote) {
      const { src: ps, gain: pg } = lastNote;
      try {
        pg.gain.setValueAtTime(pg.gain.value, t);
        pg.gain.linearRampToValueAtTime(0.0001, t + 0.08);
        ps.stop(t + 0.1);
      } catch {
        // already stopped
      }
    }
    lastNote = voice;
  }
  return true;
}

/** Stops every scheduled / ringing sound (Stop button, end of an exercise). */
export function stopWebNotes() {
  const c = webCtx();
  if (!c) return;
  live.forEach(({ src, gain }) => {
    try {
      gain.gain.cancelScheduledValues(c.currentTime);
      gain.gain.setValueAtTime(0.0001, c.currentTime);
      src.stop();
    } catch {
      // not started yet / already stopped
    }
  });
  live.clear();
  lastNote = null;
}
