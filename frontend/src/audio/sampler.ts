import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

import { loadWebBuffer, playWebBuffer, webAudioScheduling } from "@/src/audio/webAudio";

// Acoustic guitar samples E2 (MIDI 40) → D5 (MIDI 74), bundled locally (works offline).
const SAMPLES: Record<number, number> = {
  40: require("../../assets/sounds/E2.mp3"),
  41: require("../../assets/sounds/F2.mp3"),
  42: require("../../assets/sounds/Fs2.mp3"),
  43: require("../../assets/sounds/G2.mp3"),
  44: require("../../assets/sounds/Gs2.mp3"),
  45: require("../../assets/sounds/A2.mp3"),
  46: require("../../assets/sounds/As2.mp3"),
  47: require("../../assets/sounds/B2.mp3"),
  48: require("../../assets/sounds/C3.mp3"),
  49: require("../../assets/sounds/Cs3.mp3"),
  50: require("../../assets/sounds/D3.mp3"),
  51: require("../../assets/sounds/Ds3.mp3"),
  52: require("../../assets/sounds/E3.mp3"),
  53: require("../../assets/sounds/F3.mp3"),
  54: require("../../assets/sounds/Fs3.mp3"),
  55: require("../../assets/sounds/G3.mp3"),
  56: require("../../assets/sounds/Gs3.mp3"),
  57: require("../../assets/sounds/A3.mp3"),
  58: require("../../assets/sounds/As3.mp3"),
  59: require("../../assets/sounds/B3.mp3"),
  60: require("../../assets/sounds/C4.mp3"),
  61: require("../../assets/sounds/Cs4.mp3"),
  62: require("../../assets/sounds/D4.mp3"),
  63: require("../../assets/sounds/Ds4.mp3"),
  64: require("../../assets/sounds/E4.mp3"),
  65: require("../../assets/sounds/F4.mp3"),
  66: require("../../assets/sounds/Fs4.mp3"),
  67: require("../../assets/sounds/G4.mp3"),
  68: require("../../assets/sounds/Gs4.mp3"),
  69: require("../../assets/sounds/A4.mp3"),
  70: require("../../assets/sounds/As4.mp3"),
  71: require("../../assets/sounds/B4.mp3"),
  72: require("../../assets/sounds/C5.mp3"),
  73: require("../../assets/sounds/Cs5.mp3"),
  74: require("../../assets/sounds/D5.mp3"),
};
const MIN = 40;
const MAX = 74;

const players = new Map<number, AudioPlayer>();
// Players that are paused at position 0: the next play() needs no seek, so it starts immediately.
const fresh = new Set<number>();
let modeReady = false;

function getPlayer(base: number) {
  let p = players.get(base);
  if (!p) {
    p = createAudioPlayer(SAMPLES[base]);
    players.set(base, p);
    fresh.add(base);
  }
  return p;
}

function resolve(midi: number): { base: number; rate: number } {
  if (midi >= MIN && midi <= MAX) return { base: midi, rate: 1 };
  if (midi > MAX) {
    const down = midi - 12;
    if (down >= MIN && down <= MAX) return { base: down, rate: 2 };
    return { base: MAX, rate: Math.min(2, Math.pow(2, (midi - MAX) / 12)) };
  }
  return { base: MIN, rate: Math.max(0.5, Math.pow(2, (midi - MIN) / 12)) };
}

// iOS: "doNotMix" makes expo-audio reset the session mode to .default (the mic stream
// leaves it in .measurement, which lowers the output) and routes playback to the loudspeaker.
export function restorePlaybackMode() {
  return setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    shouldRouteThroughEarpiece: false,
    interruptionMode: "doNotMix",
  });
}

export async function initAudio() {
  if (modeReady) return;
  modeReady = true;
  try {
    await restorePlaybackMode();
  } catch {
    modeReady = false;
  }
}

const releaseTimers = new Map<number, ReturnType<typeof setTimeout>[]>();
const FADE_STEPS = 5;
const FADE_MS = 120;
let current: number | null = null;

function clearRelease(base: number) {
  releaseTimers.get(base)?.forEach(clearTimeout);
  releaseTimers.delete(base);
}

/** Quick fade-out then pause, so the previous note doesn't ring under the new one. */
function fadeOut(base: number) {
  const p = players.get(base);
  if (!p) return;
  clearRelease(base);
  const start = p.volume;
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (let i = 1; i <= FADE_STEPS; i++) {
    timers.push(
      setTimeout(() => {
        try {
          if (i === FADE_STEPS) {
            p.pause();
            // Rewind now, while nothing is playing, so the next use of this note starts without a seek.
            Promise.resolve(p.seekTo(0))
              .then(() => fresh.add(base))
              .catch(() => {});
          } else p.volume = start * (1 - i / FADE_STEPS);
        } catch {
          // ignore
        }
      }, (FADE_MS / FADE_STEPS) * i),
    );
  }
  releaseTimers.set(base, timers);
}

/**
 * Plays a note. It rings naturally until another note is played, which stops it. `atMs` (web, Date.now() time):
 * start exactly then on the Web Audio clock — used by the sequencer, which schedules the notes a little ahead.
 */
export function playNote(midi: number, volume = 1, atMs?: number) {
  initAudio();
  if (atMs !== undefined && webAudioScheduling) {
    const { base, rate } = resolve(midi);
    if (playWebBuffer(SAMPLES[base], atMs, volume, rate, true)) return;
    // Not decoded yet: play it at its time with the <audio> player.
    setTimeout(() => playNote(midi, volume), Math.max(0, atMs - Date.now()));
    return;
  }
  const { base, rate } = resolve(midi);
  if (current !== null && current !== base) fadeOut(current);
  current = base;
  const p = getPlayer(base);
  clearRelease(base);
  try {
    p.volume = volume;
    p.shouldCorrectPitch = false;
    p.setPlaybackRate(rate);
    if (!fresh.has(base)) p.seekTo(0);
    fresh.delete(base);
    p.play();
  } catch {
    // player not ready yet; ignore single tap
  }
}

export function stopAll() {
  players.forEach((p) => {
    try {
      p.pause();
    } catch {
      // ignore
    }
  });
}

export function playSequence(midis: number[], volume = 1, gapMs = 380): () => void {
  const timers = midis.map((m, i) => setTimeout(() => playNote(m, volume), i * gapMs));
  return () => timers.forEach(clearTimeout);
}

/** Creates the players for these notes ahead of time, so the first play of each note has no loading delay. */
export function preloadNotes(midis: number[]) {
  initAudio();
  new Set(midis.map((m) => resolve(m).base)).forEach((base) => {
    if (webAudioScheduling) loadWebBuffer(SAMPLES[base]);
    try {
      getPlayer(base);
    } catch {
      // ignore
    }
  });
}

// ---- Count-in claves ----
const CLICKS = {
  high: require("../../assets/sounds/clave_high.wav"),
  low: require("../../assets/sounds/clave_low.wav"),
};
const CLICK_COUNT = 4; // one dedicated player per count-in beat: each beat always has its own, ready-to-play sound
const clickPlayers: AudioPlayer[] = [];
const clickReady: boolean[] = [];

function clickPlayer(i: number) {
  if (!clickPlayers[i]) {
    clickPlayers[i] = createAudioPlayer(i === 0 ? CLICKS.high : CLICKS.low);
    clickReady[i] = true;
  }
  return clickPlayers[i];
}

export function preloadClicks() {
  initAudio();
  if (webAudioScheduling) {
    loadWebBuffer(CLICKS.high);
    loadWebBuffer(CLICKS.low);
  }
  try {
    for (let i = 0; i < CLICK_COUNT; i++) clickPlayer(i);
  } catch {
    // ignore
  }
}

/** Count-in click: beat 0 is the accented (higher) clave, beats 1–3 the softer one. */
export function playClick(beat: number, volume = 1, atMs?: number) {
  initAudio();
  const i = Math.max(0, Math.min(CLICK_COUNT - 1, beat));
  if (atMs !== undefined && webAudioScheduling) {
    if (playWebBuffer(i === 0 ? CLICKS.high : CLICKS.low, atMs, volume)) return;
    setTimeout(() => playClick(beat, volume), Math.max(0, atMs - Date.now()));
    return;
  }
  try {
    const p = clickPlayer(i);
    p.volume = volume;
    if (!clickReady[i]) {
      try {
        p.seekTo(0);
      } catch {
        // not loaded yet: it starts at 0 anyway
      }
    }
    clickReady[i] = false;
    p.play();
    // Rewind once the short sound is over, so the next count-in starts with no seek.
    setTimeout(() => {
      try {
        Promise.resolve(p.seekTo(0))
          .then(() => {
            clickReady[i] = true;
          })
          .catch(() => {});
      } catch {
        // ignore
      }
    }, 400);
  } catch {
    // ignore
  }
}

// ---- Answer feedback (Oreille): crystal ping when right, soft low “no” when wrong ----
const FEEDBACK = {
  success: require("../../assets/sounds/success.wav"),
  error: require("../../assets/sounds/error.wav"),
  found: require("../../assets/sounds/found.wav"), // challenges: one note found (lighter than “success”)
  tick: require("../../assets/sounds/tick.wav"), // challenges: note found on the guitar (very short, the guitar still rings)
};
// The “wrong” sound is kept quieter so a mistake never feels harsh.
const FEEDBACK_GAIN = { success: 0.55, error: 0.6, found: 0.45, tick: 0.4 };
export const FEEDBACK_MS = { success: 800, error: 600, found: 160, tick: 70 };
const feedbackPlayers: Partial<Record<keyof typeof FEEDBACK, AudioPlayer>> = {};

function feedbackPlayer(kind: keyof typeof FEEDBACK) {
  let p = feedbackPlayers[kind];
  if (!p) {
    p = createAudioPlayer(FEEDBACK[kind]);
    feedbackPlayers[kind] = p;
  }
  return p;
}

export function preloadFeedback() {
  initAudio();
  if (webAudioScheduling) {
    loadWebBuffer(FEEDBACK.success);
    loadWebBuffer(FEEDBACK.error);
    loadWebBuffer(FEEDBACK.found);
    loadWebBuffer(FEEDBACK.tick);
  }
  try {
    feedbackPlayer("success");
    feedbackPlayer("error");
    feedbackPlayer("found");
    feedbackPlayer("tick");
  } catch {
    // ignore
  }
}

export function playFeedback(kind: keyof typeof FEEDBACK, volume = 1) {
  initAudio();
  const v = volume * FEEDBACK_GAIN[kind];
  if (webAudioScheduling && playWebBuffer(FEEDBACK[kind], Date.now(), v)) return;
  try {
    const p = feedbackPlayer(kind);
    p.volume = v;
    Promise.resolve(p.seekTo(0))
      .catch(() => {})
      .then(() => p.play());
  } catch {
    // ignore
  }
}
