import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

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
let modeReady = false;

function getPlayer(base: number) {
  let p = players.get(base);
  if (!p) {
    p = createAudioPlayer(SAMPLES[base]);
    players.set(base, p);
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
          if (i === FADE_STEPS) p.pause();
          else p.volume = start * (1 - i / FADE_STEPS);
        } catch {
          // ignore
        }
      }, (FADE_MS / FADE_STEPS) * i),
    );
  }
  releaseTimers.set(base, timers);
}

/** Plays a note. It rings naturally until another note is played, which stops it. */
export function playNote(midi: number, volume = 1) {
  initAudio();
  const { base, rate } = resolve(midi);
  if (current !== null && current !== base) fadeOut(current);
  current = base;
  const p = getPlayer(base);
  clearRelease(base);
  try {
    p.volume = volume;
    p.shouldCorrectPitch = false;
    p.setPlaybackRate(rate);
    p.seekTo(0);
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
