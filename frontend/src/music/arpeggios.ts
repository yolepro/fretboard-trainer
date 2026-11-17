import { CHORDS, FRET_COUNT, TUNING, cellKey, pcOf, type BoxWindow, type Formula, type PathStep } from "@/src/music/theory";

/**
 * 4-note arpeggios (∆, 7, m7, Ø) as 5 movable shapes named Do, La, Sol, Fa, Ré, transcribed dot for dot from the
 * user's chart "Arpèges 4 sons". A shape is a list of [string, row, isRoot]: string 0 = high e … 5 = low E, row = fret
 * row of the diagram (only relative frets matter). The shapes are placed on the neck from the root, in any key.
 */
export type ArpTypeId = "maj7" | "dom7" | "m7" | "m7b5";

export const ARP_TYPES: { id: ArpTypeId; symbol: string }[] = [
  { id: "maj7", symbol: "∆" },
  { id: "dom7", symbol: "7" },
  { id: "m7", symbol: "m7" },
  { id: "m7b5", symbol: "Ø" },
];

/** Shape names, in the order they follow each other up the neck (towards the body): Do, La, Sol, Fa, Ré, Do… */
export const ARP_SHAPES = ["Do", "La", "Sol", "Fa", "Ré"];

type Dot = [number, number, number];
const SHAPES: Record<ArpTypeId, Dot[][]> = {
  maj7: [
    [[0, 2, 0], [1, 4, 0], [2, 3, 0], [2, 4, 1], [3, 1, 0], [3, 4, 0], [4, 1, 0], [4, 2, 1], [5, 2, 0]], // Do
    [[0, 3, 0], [0, 4, 1], [1, 1, 0], [1, 4, 0], [2, 0, 0], [2, 1, 1], [3, 1, 0], [4, 3, 0], [5, 3, 0], [5, 4, 1]], // La
    [[0, 1, 0], [0, 2, 1], [1, 2, 0], [2, 3, 0], [3, 3, 0], [3, 4, 1], [4, 1, 0], [4, 4, 0], [5, 1, 0], [5, 2, 1]], // Sol
    [[0, 4, 0], [1, 4, 0], [1, 5, 1], [2, 1, 0], [2, 4, 0], [3, 1, 0], [3, 2, 1], [4, 2, 0], [5, 4, 0]], // Fa
    [[0, 1, 0], [0, 4, 0], [1, 1, 0], [1, 2, 1], [2, 1, 0], [3, 3, 0], [4, 3, 0], [4, 4, 1], [5, 1, 0], [5, 4, 0]], // Re
  ],
  dom7: [
    [[0, 2, 0], [0, 5, 0], [1, 4, 0], [2, 2, 0], [2, 4, 1], [3, 1, 0], [3, 4, 0], [4, 2, 1], [5, 2, 0], [5, 5, 0]], // Do
    [[0, 2, 0], [0, 4, 1], [1, 1, 0], [1, 4, 0], [2, 1, 1], [3, 1, 0], [3, 4, 0], [4, 3, 0], [5, 2, 0], [5, 4, 1]], // La
    [[0, 2, 1], [1, 2, 0], [1, 5, 0], [2, 3, 0], [3, 2, 0], [3, 4, 1], [4, 1, 0], [4, 4, 0], [5, 0, 0], [5, 2, 1]], // Sol
    [[0, 4, 0], [1, 3, 0], [1, 5, 1], [2, 1, 0], [2, 4, 0], [3, 2, 1], [4, 2, 0], [4, 5, 0], [5, 4, 0]], // Fa
    [[0, 1, 0], [0, 4, 0], [1, 2, 1], [2, 1, 0], [2, 4, 0], [3, 3, 0], [4, 2, 0], [4, 4, 1], [5, 1, 0], [5, 4, 0]], // Re
  ],
  m7: [
    [[0, 2, 0], [0, 5, 0], [1, 3, 0], [2, 2, 0], [2, 4, 1], [3, 4, 0], [4, 2, 1], [4, 5, 0], [5, 2, 0], [5, 5, 0]], // Do
    [[0, 2, 0], [0, 4, 1], [1, 4, 0], [2, 1, 1], [2, 4, 0], [3, 1, 0], [3, 4, 0], [4, 2, 0], [5, 2, 0], [5, 4, 1]], // La
    [[0, 2, 1], [0, 5, 0], [1, 2, 0], [1, 5, 0], [2, 2, 0], [3, 2, 0], [3, 4, 1], [4, 4, 0], [5, 2, 1], [5, 5, 0]], // Sol
    [[0, 3, 0], [1, 3, 0], [1, 5, 1], [2, 4, 0], [3, 2, 1], [3, 5, 0], [4, 2, 0], [4, 5, 0], [5, 3, 0]], // Fa
    [[0, 4, 0], [1, 2, 1], [1, 5, 0], [2, 1, 0], [2, 4, 0], [3, 2, 0], [4, 2, 0], [4, 4, 1], [5, 4, 0]], // Re
  ],
  m7b5: [
    [[0, 5, 0], [1, 3, 0], [1, 6, 0], [2, 2, 0], [2, 4, 1], [3, 3, 0], [4, 2, 1], [4, 5, 0], [5, 5, 0]], // Do
    [[0, 2, 0], [0, 4, 1], [1, 3, 0], [2, 1, 1], [2, 4, 0], [3, 4, 0], [4, 2, 0], [4, 5, 0], [5, 2, 0], [5, 4, 1]], // La
    [[0, 2, 1], [0, 5, 0], [1, 5, 0], [2, 2, 0], [2, 5, 0], [3, 2, 0], [3, 4, 1], [4, 3, 0], [5, 2, 1], [5, 5, 0]], // Sol
    [[0, 3, 0], [0, 6, 0], [1, 3, 0], [1, 5, 1], [2, 3, 0], [3, 2, 1], [3, 5, 0], [4, 5, 0], [5, 3, 0], [5, 6, 0]], // Fa
    [[0, 3, 0], [1, 2, 1], [1, 5, 0], [2, 4, 0], [3, 2, 0], [3, 5, 0], [4, 2, 0], [4, 4, 1], [5, 3, 0]], // Re
  ],
};

export type ArpNote = PathStep & { loc: { string: number; fret: number }; root: boolean };

/** The chord formula behind an arpeggio type (degrees, colors, spelling of the score). */
export function arpFormula(type: ArpTypeId): Formula {
  return CHORDS.find((c) => c.id === type) ?? CHORDS[0];
}

/** Every place a shape fits on the neck for this root (lowest first); notes sorted from the lowest to the highest. */
function placements(type: ArpTypeId, shape: number, rootPc: number): ArpNote[][] {
  const dots = SHAPES[type][shape];
  const [s0, r0] = dots.find((d) => d[2] === 1)!;
  const out: ArpNote[][] = [];
  for (let off = -8; off <= FRET_COUNT; off++) {
    if (pcOf(TUNING[s0] + r0 + off) !== pcOf(rootPc)) continue;
    const notes = dots
      .map(([s, r, root]) => ({ midi: TUNING[s] + r + off, loc: { string: s, fret: r + off }, root: root === 1 }))
      .sort((a, b) => a.midi - b.midi || b.loc.string - a.loc.string);
    out.push(notes);
  }
  return out;
}

const onNeck = (notes: ArpNote[]) => notes.length > 0 && notes.every((n) => n.loc.fret >= 0 && n.loc.fret <= FRET_COUNT);

/** A shape in one position: its placements that fit entirely on the neck (usually one, sometimes two: 1/2, 2/2). */
export function arpShapePlacements(type: ArpTypeId, shape: number, rootPc: number): ArpNote[][] {
  return placements(type, shape, rootPc).filter(onNeck);
}

/**
 * Horizontal route: the shape is played from its lowest note up to the root it shares with its neighbour, then the
 * neighbour takes over with its higher notes. `towardBody`: the neighbour is the next shape up the neck (Do → La →
 * Sol → Fa → Ré → Do); otherwise the previous one (towards the nut). When two shapes share several roots (La / Sol:
 * both E strings), the highest one is the pivot, so the route is the whole first shape.
 */
export function arpRoutes(type: ArpTypeId, shape: number, rootPc: number, towardBody: boolean): ArpNote[][] {
  const n = ARP_SHAPES.length;
  const other = (shape + (towardBody ? 1 : n - 1)) % n;
  const out: ArpNote[][] = [];
  for (const a of placements(type, shape, rootPc)) {
    for (const b of placements(type, other, rootPc)) {
      const shared = a.filter((x) => x.root && b.some((y) => y.root && y.loc.string === x.loc.string && y.loc.fret === x.loc.fret));
      if (!shared.length) continue;
      const pivot = shared[shared.length - 1].midi;
      const route = [...a.filter((x) => x.midi <= pivot), ...b.filter((y) => y.midi > pivot)];
      if (onNeck(route)) out.push(route);
    }
  }
  return out.sort((x, y) => Math.min(...x.map((q) => q.loc.fret)) - Math.min(...y.map((q) => q.loc.fret)));
}

/** Up then back down (the top note once). With `startOnRoot`, the lowest notes under the first root are left out. */
export function arpUpDown(notes: ArpNote[], startOnRoot: boolean): PathStep[] {
  let up: ArpNote[] = notes;
  if (startOnRoot) {
    const r = up.findIndex((x) => x.root);
    if (r > 0) up = up.slice(r);
  }
  return [...up, ...up.slice(0, -1).reverse()];
}

/** What the fretboard lights up: the exact notes; fret columns tinted for a position, not for a route. */
export function arpWindow(notes: ArpNote[], noColumns: boolean): BoxWindow {
  const cells = new Set<string>();
  let min = Infinity;
  let max = -Infinity;
  notes.forEach((x) => {
    cells.add(cellKey(x.loc.string, x.loc.fret));
    min = Math.min(min, x.loc.fret);
    max = Math.max(max, x.loc.fret);
  });
  if (!cells.size) return { min: 0, max: 0, cells, noColumns: true };
  return { min, max, cells, noColumns };
}

/**
 * "3 sons sur 2 cordes" (horizontal): the triad of the chord on pairs of strings — the root on the low string, the
 * third and fifth on the next one — repeated on Mi-La, Ré-Sol, then Si-Mi, an octave higher each time (the same
 * shape moving up the neck). With `withSeventh`, the 7th of the chord (∆: major 7th, others: minor 7th) comes first
 * on the low string, just under the root. Returns one group per pair of strings (3 or 4 notes), lowest first;
 * the route starts on the lowest root of the low E string where the 3 pairs fit on the neck.
 */
export function arpTwoStringGroups(type: ArpTypeId, rootPc: number, withSeventh: boolean): ArpNote[][] {
  const f = arpFormula(type);
  const semi = (num: number) => f.intervals.find((i) => i.num === num)!.semi;
  const third = semi(3);
  const fifth = semi(5);
  const seventh = semi(7);
  const pairs: [number, number][] = [
    [5, 4],
    [3, 2],
    [1, 0],
  ];
  const build = (rootMidi: number): ArpNote[][] | null => {
    const groups: ArpNote[][] = [];
    for (let k = 0; k < pairs.length; k++) {
      const [lo, hi] = pairs[k];
      const r = rootMidi + 12 * k;
      const notes: { midi: number; string: number; root: boolean }[] = [
        ...(withSeventh ? [{ midi: r - 12 + seventh, string: lo, root: false }] : []),
        { midi: r, string: lo, root: true },
        { midi: r + third, string: hi, root: false },
        { midi: r + fifth, string: hi, root: false },
      ];
      const g: ArpNote[] = [];
      for (const n of notes) {
        const fret = n.midi - TUNING[n.string];
        if (fret < 0 || fret > FRET_COUNT) return null;
        g.push({ midi: n.midi, loc: { string: n.string, fret }, root: n.root });
      }
      groups.push(g);
    }
    return groups;
  };
  for (let fret = 0; fret <= FRET_COUNT; fret++) {
    const m = TUNING[5] + fret;
    if (pcOf(m) !== pcOf(rootPc)) continue;
    const g = build(m);
    if (g) return g;
  }
  return [];
}

/** Up through the groups, then back down: the top group once, each lower group played backwards (aligned on beats). */
export function arpGroupsUpDown(groups: ArpNote[][]): ArpNote[] {
  const down = groups
    .slice(0, -1)
    .reverse()
    .map((g) => [...g].reverse());
  return [...groups, ...down].flat();
}
