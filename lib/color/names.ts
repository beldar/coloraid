import type { RGB } from "./sampling";

export interface NamedColor {
  name: string;
  rgb: RGB;
}

/**
 * A curated reference list of named colors spanning the gamut, biased toward
 * names a painter would recognize. This is intentionally human-friendly rather
 * than the raw CSS color list — the names are meant to be read aloud by someone
 * who cannot rely on seeing the hue.
 *
 * Nearest-match is done in CIELAB with CIEDE2000 (see describe.ts), so the list
 * does not need to be dense to be useful; it needs to be well spread.
 */
export const NAMED_COLORS: NamedColor[] = [
  // Neutrals / lightness ladder
  { name: "Black", rgb: { r: 0, g: 0, b: 0 } },
  { name: "Charcoal", rgb: { r: 54, g: 54, b: 58 } },
  { name: "Dark gray", rgb: { r: 90, g: 90, b: 94 } },
  { name: "Gray", rgb: { r: 128, g: 128, b: 128 } },
  { name: "Light gray", rgb: { r: 180, g: 180, b: 182 } },
  { name: "Off-white", rgb: { r: 236, g: 234, b: 228 } },
  { name: "White", rgb: { r: 255, g: 255, b: 255 } },

  // Reds
  { name: "Maroon", rgb: { r: 110, g: 24, b: 30 } },
  { name: "Crimson", rgb: { r: 196, g: 30, b: 58 } },
  { name: "Red", rgb: { r: 220, g: 36, b: 40 } },
  { name: "Scarlet", rgb: { r: 230, g: 60, b: 40 } },
  { name: "Brick red", rgb: { r: 156, g: 64, b: 54 } },
  { name: "Rose", rgb: { r: 214, g: 90, b: 110 } },
  { name: "Pink", rgb: { r: 240, g: 150, b: 175 } },
  { name: "Pale pink", rgb: { r: 248, g: 200, b: 210 } },

  // Oranges / earths
  { name: "Burnt sienna", rgb: { r: 150, g: 78, b: 50 } },
  { name: "Rust", rgb: { r: 180, g: 90, b: 44 } },
  { name: "Orange", rgb: { r: 240, g: 140, b: 40 } },
  { name: "Terracotta", rgb: { r: 200, g: 110, b: 80 } },
  { name: "Peach", rgb: { r: 248, g: 190, b: 150 } },
  { name: "Raw sienna", rgb: { r: 190, g: 140, b: 70 } },
  { name: "Ochre", rgb: { r: 196, g: 152, b: 66 } },

  // Yellows
  { name: "Gold", rgb: { r: 224, g: 180, b: 50 } },
  { name: "Yellow", rgb: { r: 244, g: 214, b: 60 } },
  { name: "Lemon yellow", rgb: { r: 246, g: 232, b: 90 } },
  { name: "Cream", rgb: { r: 244, g: 236, b: 180 } },

  // Browns
  { name: "Dark brown", rgb: { r: 74, g: 50, b: 36 } },
  { name: "Brown", rgb: { r: 118, g: 80, b: 54 } },
  { name: "Raw umber", rgb: { r: 110, g: 90, b: 60 } },
  { name: "Tan", rgb: { r: 196, g: 164, b: 124 } },
  { name: "Beige", rgb: { r: 224, g: 208, b: 178 } },

  // Greens
  { name: "Dark green", rgb: { r: 28, g: 70, b: 44 } },
  { name: "Forest green", rgb: { r: 40, g: 100, b: 60 } },
  { name: "Green", rgb: { r: 60, g: 150, b: 80 } },
  { name: "Olive", rgb: { r: 116, g: 122, b: 56 } },
  { name: "Sap green", rgb: { r: 90, g: 130, b: 60 } },
  { name: "Sage", rgb: { r: 150, g: 168, b: 132 } },
  { name: "Teal", rgb: { r: 36, g: 130, b: 130 } },
  { name: "Viridian", rgb: { r: 30, g: 120, b: 100 } },
  { name: "Mint", rgb: { r: 168, g: 216, b: 184 } },

  // Blues
  { name: "Navy", rgb: { r: 30, g: 44, b: 90 } },
  { name: "Prussian blue", rgb: { r: 30, g: 60, b: 90 } },
  { name: "Ultramarine", rgb: { r: 56, g: 70, b: 160 } },
  { name: "Blue", rgb: { r: 50, g: 100, b: 190 } },
  { name: "Cobalt blue", rgb: { r: 60, g: 110, b: 180 } },
  { name: "Cerulean", rgb: { r: 70, g: 150, b: 200 } },
  { name: "Sky blue", rgb: { r: 140, g: 196, b: 230 } },
  { name: "Powder blue", rgb: { r: 190, g: 218, b: 234 } },

  // Purples
  { name: "Indigo", rgb: { r: 60, g: 50, b: 110 } },
  { name: "Violet", rgb: { r: 120, g: 70, b: 160 } },
  { name: "Purple", rgb: { r: 140, g: 70, b: 150 } },
  { name: "Mauve", rgb: { r: 170, g: 130, b: 170 } },
  { name: "Lavender", rgb: { r: 200, g: 180, b: 220 } },
  { name: "Magenta", rgb: { r: 200, g: 60, b: 150 } },
];
