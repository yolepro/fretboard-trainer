import { useEffect, useRef, useState } from "react";
import { setAudioModeAsync, useAudioStream } from "expo-audio";

import { detectPitch, type PitchFrame } from "@/src/music/yin";

export type DetectorStatus = "idle" | "starting" | "listening" | "error";
const WINDOW = 3072;
const INTERVAL_MS = 70;

export function usePitchDetector(enabled: boolean, onFrame: (f: PitchFrame) => void) {
  const cbRef = useRef(onFrame);
  cbRef.current = onFrame;
  const win = useRef(new Float32Array(WINDOW));
  const last = useRef(0);
  const [status, setStatus] = useState<DetectorStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const { stream } = useAudioStream({
    sampleRate: 44100,
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
      cbRef.current(detectPitch(w, b.sampleRate));
    },
  });

  useEffect(() => {
    if (!enabled || !stream) return;
    let cancelled = false;
    setStatus("starting");
    setError(null);
    (async () => {
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: false });
        await stream.start();
        if (!cancelled) setStatus("listening");
      } catch (e: any) {
        if (!cancelled) {
          setStatus("error");
          setError(String(e?.message ?? e));
        }
      }
    })();
    return () => {
      cancelled = true;
      try {
        stream.stop();
      } catch {
        // already stopped
      }
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      setStatus("idle");
    };
  }, [enabled, stream]);

  return { status, error };
}
