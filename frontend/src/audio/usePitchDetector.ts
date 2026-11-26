import React, { useEffect, useRef, useState } from "react";
import { setAudioModeAsync, useAudioStream } from "expo-audio";

import { detectPitch, rmsOf, type PitchFrame } from "@/src/music/yin";
import { restorePlaybackMode } from "@/src/audio/sampler";

export type DetectorStatus = "idle" | "starting" | "listening" | "error";
type OnFrame = (f: PitchFrame, level: number) => void;
const WINDOW = 3072;
const INTERVAL_MS = 70;

// The last switch back to playback mode: a new stream waits for it, so the two audio-mode changes never overlap.
let lastRestore: Promise<unknown> = Promise.resolve();

/**
 * One microphone session. `stream.stop()` releases the native resources: a stopped stream does not deliver buffers
 * again after `start()` (on iPhone, only the first note of a challenge was heard: the mic pauses during each feedback
 * sound). So every session mounts this component again (new key) and gets a fresh native stream.
 */
function MicStream({ onFrame, onStatus }: { onFrame: React.MutableRefObject<OnFrame>; onStatus: (s: DetectorStatus, e?: string) => void }) {
  const win = useRef(new Float32Array(WINDOW));
  const last = useRef(0);
  const { stream } = useAudioStream({
    sampleRate: 48000,
    channels: 1,
    encoding: "float32",
    onBuffer: (b) => {
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
    onStatus("starting");
    (async () => {
      try {
        await lastRestore;
        if (cancelled) return;
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false,
          interruptionMode: "doNotMix",
        });
        if (cancelled) return;
        await stream.start();
        if (!cancelled) onStatus("listening");
      } catch (e: any) {
        if (!cancelled) onStatus("error", String(e?.message ?? e));
      }
    })();
    return () => {
      cancelled = true;
      try {
        stream.stop();
      } catch {
        // already stopped
      }
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

  const mic = enabled ? React.createElement(MicStream, { key: session.current, onFrame: cbRef, onStatus }) : null;
  return { status, error, mic };
}
