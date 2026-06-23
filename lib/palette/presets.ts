/** A known commercial palette: ordered paint names laid out on a grid. */
export interface PalettePreset {
  id: string;
  label: string;
  rows: number;
  cols: number;
  /** Paint names in row-major order, matching the physical well layout. */
  names: string[];
}

export const PALETTE_PRESETS: PalettePreset[] = [
  {
    id: "wn-cotman-12",
    label: "Winsor & Newton Cotman — 12 (Pocket)",
    rows: 2,
    cols: 6,
    names: [
      "Lemon Yellow Hue",
      "Cadmium Yellow Hue",
      "Cadmium Red Pale Hue",
      "Alizarin Crimson Hue",
      "Ultramarine",
      "Cerulean Blue Hue",
      "Viridian Hue",
      "Sap Green",
      "Yellow Ochre",
      "Burnt Sienna",
      "Burnt Umber",
      "Chinese White",
    ],
  },
];

/** Generic fallback names when no preset matches (e.g. "Color 1", "Color 2"…). */
export function numberedNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Color ${i + 1}`);
}
