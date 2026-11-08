import { useEffect, useRef, useState } from "react";

import { detectPitch, type PitchFrame } from "@/src/music/yin";

export type DetectorStatus = "idle" | "starting" | "listening" | "error";

export function usePitchDetector(enabled: boolean, onFrame: (f: PitchFrame) => void) {
  const cbRef = useRef(onFrame);
  cbRef.current = onFrame;
  const [status, setStatus] = useState<DetectorStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let ctx: AudioContext | null = null;
    let media: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    setStatus("starting");
    setError(null);
    (async () => {
      try {
        media = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        if (stopped) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        ctx = new AC();
        const src = ctx.createMediaStreamSource(media);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 4096;
        src.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const sr = ctx.sampleRate;
        setStatus("listening");
        timer = setInterval(() => {
          analyser.getFloatTimeDomainData(buf);
          cbRef.current(detectPitch(buf, sr));
        }, 70);
      } catch (e: any) {
        if (stopped) return;
        setStatus("error");
        setError(e?.name === "NotAllowedError" ? "denied" : String(e?.message ?? e));
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      media?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
      setStatus("idle");
    };
  }, [enabled]);

  return { status, error };
}
