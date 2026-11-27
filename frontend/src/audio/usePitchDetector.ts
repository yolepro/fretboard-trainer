import React, { useEffect, useRef, useState } from "react";
import { setAudioModeAsync, useAudioStream } from "expo-audio";

import { detectPitch, rmsOf, type PitchFrame } from "@/src/music/yin";
import { restorePlaybackMode, stopAll } from "@/src/audio/sampler";

export type DetectorStatus = "idle" | "starting" | "listening" | "error";
type OnFrame = (f: PitchFrame, level: number) => void;
const WINDOW = 3072;
const INTERVAL_MS = 70;
const STALL_MS = 2500; // no buffer at all for this long while listening: the stream is stuck, start a new one
const MAX_RESTARTS = 2; // per listening session (each new stream is a risk: see below)
// A new stream never starts sooner than this after the previous one stopped, and waits a little after the audio mode
// switch: starting the input too soon makes iOS throw inside AVAudioEngine (installTap / AURemoteIO timeout), which
// crashes the whole app — seen on the simulator when the mic paused and resumed at each note touched.
const MIN_GAP_MS = 450;
const AFTER_MODE_MS = 150;
let lastStopAt = 0;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The last switch back to playback mode: a new stream waits for it, so the two audio-mode changes never overlap.
let lastRestore: Promise<unknown> = Promise.resolve();

/**
 * One microphone session. On iPhone only the first note of a challenge was heard: the mic pauses during each feedback
 * sound and came back silent, until « Écouter » (which pauses every player) was pressed. So each session:
 * - mounts this component again (new key) and gets a fresh native stream (`stop()` releases the native resources);
 * - first pauses every player (a player left “playing” after its sound kept the stream silent);
 * - waits for the previous switch back to playback mode;
 * - and starts a new stream if no buffer arrives for STALL_MS (watchdog, at most MAX_RESTARTS times).
 * Starts are spaced out (MIN_GAP_MS): see the crash note above.
 */
function MicStream({
  onFrame,
  onStatus,
  onStall,
}: {
  onFrame: React.MutableRefObject<OnFrame>;
  onStatus: (s: DetectorStatus, e?: string) => void;
  onStall: () => void;
}) {
  const win = useRef(new Float32Array(WINDOW));
  const last = useRef(0);
  const lastBuffer = useRef(0);
  const { stream } = useAudioStream({
    sampleRate: 48000,
    channels: 1,
    encoding: "float32",
    onBuffer: (b) => {
      lastBuffer.current = Date.now();
      const data = new Float32Array(b.data);
      const w = win.current;
      if (data.length >= w.length) {
        w.set(data.subarray(data.length - w.length));
      } else {
        w.copyWithin(0, data.length);
        w.set(data, w.length - data.length);
      }
      const now = Date.now();
      if (now - last.current < INTERVAL_MS) return;
      last.current = now;
      onFrame.current(detectPitch(w, b.sampleRate), rmsOf(w));
    },
  });

  useEffect(() => {
    if (!stream) return;
    let cancelled = false;
    let watchdog: ReturnType<typeof setInterval> | null = null;
    onStatus("starting");
    (async () => {
      try {
        stopAll();
        // Starts are spaced out: a quick pause / resume (a note touched) never reaches the native stream.
        const gap = lastStopAt + MIN_GAP_MS - Date.now();
        if (gap > 0) await wait(gap);
        if (cancelled) return;
        await lastRestore;
        if (cancelled) return;
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false,
          interruptionMode: "doNotMix",
        });
        await wait(AFTER_MODE_MS);
        if (cancelled) return;
        await stream.start();
        if (cancelled) return;
        onStatus("listening");
        lastBuffer.current = Date.now();
        watchdog = setInterval(() => {
          if (!cancelled && Date.now() - lastBuffer.current > STALL_MS) onStall();
        }, 1000);
      } catch (e: any) {
        if (!cancelled) onStatus("error", String(e?.message ?? e));
      }
    })();
    return () => {
      cancelled = true;
      if (watchdog) clearInterval(watchdog);
      try {
        stream.stop();
      } catch {
        // already stopped
      }
      lastStopAt = Date.now();
      lastRestore = restorePlaybackMode().catch(() => {});
    };
  }, [stream]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/**
 * Listens to the microphone while `enabled`. Render the returned `mic` element somewhere in the screen: it holds the
 * native stream (nothing visible), and a new one is created each time listening starts again.
 */
export function usePitchDetector(enabled: boolean, onFrame: OnFrame) {
  const cbRef = useRef(onFrame);
  cbRef.current = onFrame;
  const [status, setStatus] = useState<DetectorStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const session = useRef(0);
  const [restarts, setRestarts] = useState(0); // fresh streams after a stall, within the same session
  const wasOn = useRef(false);
  if (enabled && !wasOn.current) session.current += 1;
  wasOn.current = enabled;

  useEffect(() => {
    if (enabled) setError(null);
    else setStatus("idle");
  }, [enabled]);
  const onStatus = useRef((s: DetectorStatus, e?: string) => {
    setStatus(s);
    if (e) setError(e);
  }).current;

  const sessionRestarts = useRef({ session: 0, n: 0 });
  const onStall = useRef(() => {
    const r = sessionRestarts.current;
    if (r.session !== session.current) {
      r.session = session.current;
      r.n = 0;
    }
    if (r.n >= MAX_RESTARTS) return;
    r.n += 1;
    setRestarts((n) => n + 1);
  }).current;

  const mic = enabled ? React.createElement(MicStream, { key: `${session.current}-${restarts}`, onFrame: cbRef, onStatus, onStall }) : null;
  return { status, error, mic };
}
