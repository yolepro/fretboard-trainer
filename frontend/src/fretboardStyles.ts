import type { ThemeColors } from "@/src/theme";

/**
 * Fretboard looks selectable in Réglages → Manche.
 * Each style sets the wood, fret wires, nut, strings and the shape/color of the inlay markers.
 * Markers always differ from the notes (color and, for most styles, shape) so they never get mistaken for them.
 */
export type MarkerShape = "dot" | "block" | "diamond" | "bar";
export type FretboardStyleId = "studio" | "palissandre" | "erable" | "ebene" | "indigo";

export type FretboardPalette = {
  /** Open-string cell (left of the nut) */
  open: string;
  wood: string;
  woodAlt: string;
  /** Background of the frets inside the selected scale position */
  boxHighlight: string;
  fretWire: string;
  nut: string;
  stringPlain: string;
  stringWound: string;
  marker: string;
  markerShape: MarkerShape;
  /** Color of the numbers of the marked frets (3, 5, 7, 9, 12…), drawn under the board */
  markerText: string;
};

export const DEFAULT_FRETBOARD_STYLE: FretboardStyleId = "studio";

export const FRETBOARD_STYLES: { id: FretboardStyleId; name: string; description: string }[] = [
  { id: "studio", name: "Studio", description: "Bois sombre, repères ronds marron (style d'origine)" },
  { id: "palissandre", name: "Palissandre", description: "Touche rouge-brun, frettes nickel, pastilles crème" },
  { id: "erable", name: "Érable miel", description: "Bois clair doré, frettes argentées, repères noirs en blocs" },
  { id: "ebene", name: "Ébène", description: "Noir profond, frettes laiton, losanges nacrés" },
  { id: "indigo", name: "Nuit indigo", description: "Bleu nuit, frettes discrètes, barres indigo" },
];

export function isFretboardStyle(id: unknown): id is FretboardStyleId {
  return FRETBOARD_STYLES.some((s) => s.id === id);
}

export function fretboardPalette(id: FretboardStyleId, c: ThemeColors): FretboardPalette {
  switch (id) {
    case "palissandre":
      return {
        open: "#160D0A",
        wood: "#2E1B14",
        woodAlt: "#38221A",
        boxHighlight: "#5A3524",
        fretWire: "#A8A29E",
        nut: "#E7DDC8",
        stringPlain: "#D1D5DB",
        stringWound: "#C08A4E",
        marker: "#D9C28F",
        markerShape: "dot",
        markerText: "#D9C28F",
      };
    case "erable":
      return {
        open: "#2A1F12",
        wood: "#86642F",
        woodAlt: "#926E36",
        boxHighlight: "#AB8445",
        fretWire: "#E5E1D6",
        nut: "#F1EBDC",
        stringPlain: "#F4F4F5",
        stringWound: "#F3E3B0",
        marker: "#1C140D",
        markerShape: "block",
        markerText: "#E2B878",
      };
    case "ebene":
      return {
        open: "#08080A",
        wood: "#0F0F12",
        woodAlt: "#151519",
        boxHighlight: "#2B2616",
        fretWire: "#B8962E",
        nut: "#EDE6D3",
        stringPlain: "#C4C4CC",
        stringWound: "#9C8A5A",
        marker: "#C9B27C",
        markerShape: "diamond",
        markerText: "#D6C28E",
      };
    case "indigo":
      return {
        open: "#080B18",
        wood: "#0D1228",
        woodAlt: "#121935",
        boxHighlight: "#25306A",
        fretWire: "#33427A",
        nut: "#A5B4FC",
        stringPlain: "#CBD5E1",
        stringWound: "#8794C9",
        marker: "#818CF8",
        markerShape: "bar",
        markerText: "#A5B4FC",
      };
    case "studio":
    default:
      return {
        open: c.surface,
        wood: c.fretboardWood,
        woodAlt: c.fretboardWoodAlt,
        boxHighlight: c.boxHighlight,
        fretWire: c.fretWire,
        nut: c.nut,
        stringPlain: c.stringPlain,
        stringWound: c.stringWound,
        marker: c.fretMarker,
        markerShape: "dot",
        markerText: c.fretMarkerText,
      };
  }
}

/** Size of each marker shape in px (diamond is drawn rotated 45°). */
export const MARKER_SIZE: Record<MarkerShape, { w: number; h: number; radius: number; rotate?: boolean }> = {
  dot: { w: 12, h: 12, radius: 6 },
  block: { w: 10, h: 22, radius: 2 },
  diamond: { w: 11, h: 11, radius: 1, rotate: true },
  bar: { w: 4, h: 26, radius: 2 },
};
