import type { ScoreEvent, ScoreModel } from "@/src/music/score";

/**
 * Turns a ScoreModel into plain drawing primitives (lines, ellipses, text, paths). No React here: the same shapes
 * are drawn by Score.tsx (react-native-svg) and can be dumped to an SVG file for checking.
 */
export type Tone = "ink" | "muted" | "accent" | "onAccent" | "panel";

export type Shape =
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; w: number; c: Tone }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; rot?: number; c: Tone }
  | { t: "rect"; x: number; y: number; w: number; h: number; r?: number; c: Tone; o?: number }
  | { t: "text"; x: number; y: number; s: string; size: number; c: Tone; anchor?: "start" | "middle" | "end"; bold?: boolean; italic?: boolean }
  | { t: "path"; d: string; tx: number; ty: number; c: Tone; w: number; fill?: boolean };

export type ScoreLayout = {
  width: number;
  height: number;
  /** Static drawing: staff, clef, notes, tab… */
  shapes: Shape[];
  /** Per event: shapes drawn on top while it is the current note. */
  highlights: Shape[][];
  /** Per event: x centre of the note (used to scroll and to place the cursor band). */
  eventX: number[];
};

const HALF = 4; // half a staff space, in px (one diatonic step)
const TAB_GAP = 10;

// Own drawing of a treble clef (stroke only), staff coordinates: bottom line y = 0, 8 px per staff space.
const CLEF_PATH =
  "M 1.5,-17 C 9,-24 10,-37 4.5,-43 C 1.5,-46 -1.5,-42 -0.5,-36 C 0.5,-28 3,-14 2,2 C 1.5,10 1,14 -1,15 C -4.5,16 -6,12 -3,11 C -1,10.5 0,12 -0.5,13.5 M 2.2,-6 C 0,-18 -11,-14 -9,-5 C -8,3 7,5 7.5,-5.5 C 7.8,-13 -3,-16.5 -4.5,-8";

const SHARP_STEPS = [38, 35, 39, 36, 33, 37, 34]; // F5 C5 G5 D5 A4 E5 B4
const FLAT_STEPS = [34, 37, 33, 36, 32, 35, 31]; // B4 E5 A4 D5 G4 C5 F4

const noteWidth = (perBeat: number) => (perBeat >= 4 ? 22 : perBeat === 3 ? 27 : 30);

export function layoutScore(model: ScoreModel, opts: { showTab: boolean }): ScoreLayout {
  const { events, groups, perBeat, keySig } = model;
  const staff: Shape[] = []; // staff-local coordinates (bottom line y = 0, up is negative)
  const stepY = (step: number) => -(step - 30) * HALF;

  // ---- horizontal layout ----
  const clefX = 14;
  const ksW = keySig.kind ? keySig.count * 8 + 6 : 0;
  let cursor = 6 + 30 + ksW + 8;
  const nx: number[] = new Array(events.length).fill(0);
  const accX: number[] = new Array(events.length).fill(0);
  const barLines: number[] = [];
  groups.forEach((g, gi) => {
    for (let i = g.start; i <= g.end; i++) {
      if (events[i].accidental) {
        accX[i] = cursor + 2;
        cursor += events[i].accidental!.length > 1 ? 18 : 11;
      }
      nx[i] = cursor + 6;
      cursor += noteWidth(perBeat);
    }
    cursor += 4;
    if ((gi + 1) % 4 === 0 || gi === groups.length - 1) {
      barLines.push(cursor);
      cursor += 14;
    }
  });
  const width = cursor + 6;

  // ---- staff lines, clef, key signature ----
  for (let l = 0; l < 5; l++) staff.push({ t: "line", x1: 4, y1: -l * 8, x2: width - 4, y2: -l * 8, w: 1, c: "muted" });
  staff.push({ t: "path", d: CLEF_PATH, tx: clefX + 8, ty: 0, c: "ink", w: 2.2 });
  if (keySig.kind) {
    const steps = keySig.kind === "sharp" ? SHARP_STEPS : FLAT_STEPS;
    for (let i = 0; i < keySig.count; i++) {
      staff.push({
        t: "text", x: 6 + 30 + i * 8, y: stepY(steps[i]) + 5, s: keySig.kind === "sharp" ? "♯" : "♭", size: 17, c: "ink", anchor: "start",
      });
    }
  }

  // ---- notes ----
  const noteY = (e: ScoreEvent) => stepY(e.step);
  events.forEach((e, i) => {
    const y = noteY(e);
    // ledger lines
    if (e.step <= 28) for (let s = 28; s >= e.step; s -= 2) staff.push({ t: "line", x1: nx[i] - 9, y1: stepY(s), x2: nx[i] + 9, y2: stepY(s), w: 1, c: "muted" });
    if (e.step >= 40) for (let s = 40; s <= e.step; s += 2) staff.push({ t: "line", x1: nx[i] - 9, y1: stepY(s), x2: nx[i] + 9, y2: stepY(s), w: 1, c: "muted" });
    staff.push({ t: "ellipse", cx: nx[i], cy: y, rx: 5.4, ry: 4, rot: -20, c: "ink" });
    if (e.accidental) staff.push({ t: "text", x: accX[i], y: y + 5.5, s: e.accidental, size: 17, c: "ink", anchor: "start" });
  });

  // ---- stems, beams, tuplets, flags ----
  groups.forEach((g) => {
    const idx: number[] = [];
    for (let i = g.start; i <= g.end; i++) idx.push(i);
    const avg = idx.reduce((s, i) => s + events[i].step, 0) / idx.length;
    const down = avg >= 34;
    const dir = down ? 1 : -1; // y direction of the stem (down = +)
    const sx = (i: number) => nx[i] + (down ? -5 : 5);
    const stemLen = 26;
    if (idx.length === 1) {
      const i = idx[0];
      const y0 = noteY(events[i]);
      const yEnd = y0 + dir * stemLen;
      staff.push({ t: "line", x1: sx(i), y1: y0, x2: sx(i), y2: yEnd, w: 1.3, c: "ink" });
      const f = down ? "M 0,0 C 0,-7 -8,-9 -7,-19" : "M 0,0 C 0,7 8,9 7,19";
      staff.push({ t: "path", d: f, tx: sx(i), ty: yEnd, c: "ink", w: 1.6 });
      return;
    }
    const first = idx[0];
    const last = idx[idx.length - 1];
    const yF = noteY(events[first]) + dir * stemLen;
    const yL = noteY(events[last]) + dir * stemLen;
    const dy = Math.max(-10, Math.min(10, yL - yF));
    const xF = sx(first);
    const xL = sx(last);
    const lineAt = (x: number) => yF + (xL === xF ? 0 : ((x - xF) / (xL - xF)) * dy);
    // shift the beam so that every stem is at least 22 px long
    let shift = 0;
    idx.forEach((i) => {
      const need = noteY(events[i]) + dir * 22;
      const gap = dir * (lineAt(sx(i)) - need); // > 0: beam farther than needed
      shift = Math.min(shift, gap);
    });
    const by = (x: number) => lineAt(x) - dir * shift;
    idx.forEach((i) => staff.push({ t: "line", x1: sx(i), y1: noteY(events[i]), x2: sx(i), y2: by(sx(i)), w: 1.3, c: "ink" }));
    const beams = perBeat >= 4 ? 2 : 1;
    for (let b = 0; b < beams; b++) {
      const off = -dir * b * 5;
      staff.push({ t: "line", x1: xF, y1: by(xF) + off, x2: xL, y2: by(xL) + off, w: 3.4, c: "ink" });
    }
    if (perBeat === 3 && idx.length === 3) {
      const yb = Math.min(by(xF), by(xL)) * (down ? 0 : 1) + Math.max(by(xF), by(xL)) * (down ? 1 : 0);
      const ty = yb + dir * 9;
      const xc = (xF + xL) / 2;
      const tick = -dir * 4;
      staff.push({ t: "line", x1: xF, y1: ty, x2: xc - 7, y2: ty, w: 1, c: "muted" });
      staff.push({ t: "line", x1: xc + 7, y1: ty, x2: xL, y2: ty, w: 1, c: "muted" });
      staff.push({ t: "line", x1: xF, y1: ty, x2: xF, y2: ty + tick, w: 1, c: "muted" });
      staff.push({ t: "line", x1: xL, y1: ty, x2: xL, y2: ty + tick, w: 1, c: "muted" });
      staff.push({ t: "text", x: xc, y: ty + 4, s: "3", size: 12, c: "muted", anchor: "middle", italic: true });
    }
  });

  // ---- bar lines (staff part) ----
  barLines.forEach((x, k) => {
    const final = k === barLines.length - 1;
    staff.push({ t: "line", x1: x, y1: 0, x2: x, y2: -32, w: final ? 1 : 1.2, c: "ink" });
    if (final) staff.push({ t: "line", x1: x + 4, y1: 0, x2: x + 4, y2: -32, w: 3, c: "ink" });
  });

  // ---- vertical placement ----
  let minY = -46; // clef top
  let maxY = 16; // clef tail
  const grow = (a: number, b: number) => {
    minY = Math.min(minY, a);
    maxY = Math.max(maxY, b);
  };
  staff.forEach((s) => {
    if (s.t === "line") grow(Math.min(s.y1, s.y2), Math.max(s.y1, s.y2));
    else if (s.t === "ellipse") grow(s.cy - 6, s.cy + 6);
    else if (s.t === "text") grow(s.y - 14, s.y + 4);
  });
  // No chord / interval symbol above the staff (plain scales, listening): don't reserve the row.
  const CHORD_H = groups.some((g) => g.label) ? 22 : 2;
  const y0 = CHORD_H + 6 - minY; // y of the staff bottom line in the final picture
  const staffBottom = y0 + maxY + 4;
  const tabTop = staffBottom + 8;
  const tabY = (string: number) => tabTop + 10 + string * TAB_GAP;
  const height = opts.showTab ? tabTop + 10 + 5 * TAB_GAP + 14 : staffBottom + 4;

  const shapes: Shape[] = staff.map((s) => {
    switch (s.t) {
      case "line": return { ...s, y1: s.y1 + y0, y2: s.y2 + y0 };
      case "ellipse": return { ...s, cy: s.cy + y0 };
      case "text": return { ...s, y: s.y + y0 };
      case "path": return { ...s, ty: s.ty + y0 };
      default: return s;
    }
  });

  // chord / interval labels
  groups.forEach((g) => {
    if (!g.label) return;
    const xs = [nx[g.start], nx[g.end]];
    shapes.push({ t: "text", x: (xs[0] + xs[1]) / 2 - (perBeat > 1 ? 0 : 0), y: 15, s: g.label, size: 13, c: "ink", anchor: "middle", bold: true });
  });

  // ---- tab ----
  if (opts.showTab) {
    for (let s = 0; s < 6; s++) shapes.push({ t: "line", x1: 4, y1: tabY(s), x2: width - 4, y2: tabY(s), w: 1, c: "muted" });
    shapes.push({ t: "text", x: 8, y: tabY(1) + 4, s: "T", size: 12, c: "ink", bold: true });
    shapes.push({ t: "text", x: 8, y: tabY(2.5) + 4, s: "A", size: 12, c: "ink", bold: true });
    shapes.push({ t: "text", x: 8, y: tabY(4) + 4, s: "B", size: 12, c: "ink", bold: true });
    barLines.forEach((x, k) => {
      const final = k === barLines.length - 1;
      shapes.push({ t: "line", x1: x, y1: tabY(0), x2: x, y2: tabY(5), w: 1.2, c: "ink" });
      if (final) shapes.push({ t: "line", x1: x + 4, y1: tabY(0), x2: x + 4, y2: tabY(5), w: 3, c: "ink" });
    });
    events.forEach((e, i) => {
      const w = String(e.fret).length * 7 + 5;
      shapes.push({ t: "rect", x: nx[i] - w / 2, y: tabY(e.string) - 6, w, h: 12, r: 2, c: "panel" });
      shapes.push({ t: "text", x: nx[i], y: tabY(e.string) + 4, s: String(e.fret), size: 12, c: "ink", anchor: "middle", bold: true });
    });
  }
  // barlines of the staff, notes etc. were already shifted; staff-lines through chords row are fine.

  // ---- highlights ----
  const highlights: Shape[][] = events.map((e, i) => {
    const hs: Shape[] = [{ t: "ellipse", cx: nx[i], cy: stepY(e.step) + y0, rx: 5.9, ry: 4.5, rot: -20, c: "accent" }];
    if (opts.showTab) {
      const w = String(e.fret).length * 7 + 9;
      hs.push({ t: "rect", x: nx[i] - w / 2, y: tabY(e.string) - 8, w, h: 16, r: 4, c: "accent" });
      hs.push({ t: "text", x: nx[i], y: tabY(e.string) + 4.5, s: String(e.fret), size: 12, c: "onAccent", anchor: "middle", bold: true });
    }
    return hs;
  });

  return { width, height, shapes, highlights, eventX: nx };
}
