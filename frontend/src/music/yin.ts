// YIN pitch detection (de Cheveigné & Kawahara), tuned for guitar range (70–1400 Hz).
export type PitchFrame = { freq: number; clarity: number } | null;

export function detectPitch(buf: Float32Array, sampleRate: number, threshold = 0.12): PitchFrame {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return null;

  const tauMin = Math.floor(sampleRate / 1400);
  const tauMax = Math.min(Math.floor(sampleRate / 70), Math.floor(n / 2));
  const w = n - tauMax;
  const d = new Float32Array(tauMax + 1);

  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const delta = buf[i] - buf[i + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }

  // Cumulative mean normalized difference
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    d[tau] = running === 0 ? 1 : (d[tau] * tau) / running;
  }

  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau === -1) {
    let best = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (d[t] < d[best]) best = t;
    if (d[best] > 0.25) return null;
    tau = best;
  }

  // Parabolic interpolation
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const s0 = d[tau - 1];
    const s1 = d[tau];
    const s2 = d[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) better = tau + (s2 - s0) / denom;
  }
  const freq = sampleRate / better;
  if (!isFinite(freq) || freq < 60 || freq > 1500) return null;
  return { freq, clarity: 1 - d[tau] };
}
