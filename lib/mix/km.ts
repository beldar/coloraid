import { converter } from "culori";
import type { RGB } from "@/lib/color/sampling";
import type { Lab } from "@/lib/color/describe";
import type { Paint } from "@/lib/palette/types";
import type { MixPrediction, Recipe } from "./types";

const toLab = converter("lab");
const toRgb = converter("rgb");

/**
 * Subtractive pigment mixing via the Kubelka–Munk single-constant model.
 *
 * Why not average RGB/Lab? Paint mixes subtractively: combining pigments
 * multiplies absorptions, it doesn't average colors. KM is the standard
 * hobbyist-grade approximation. We only have each paint's surface color (its
 * masstone RGB), so we run KM independently per RGB channel:
 *
 *   reflectance R  ->  K/S = (1-R)^2 / (2R)          (absorption/scatter ratio)
 *   mix:  (K/S)_mix = Σ wᵢ·(K/S)ᵢ                    (weighted by pigment share)
 *   dilution: scale K/S toward 0 (paper white)       (water = value)
 *   invert: R = 1 + K/S - sqrt((K/S)² + 2·K/S)
 *
 * With the user's *real* paints (whose colors are never pure primaries) this
 * yields believable results — e.g. their blue + yellow comes out green, because
 * both pigments reflect some green and that survives the multiply.
 *
 * This is the physics-based "first guess"; calibration (see calibration.ts)
 * learns residual corrections from real painted swatches on top of it.
 */

// sRGB <-> linear-light. KM operates on linear reflectance.
function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function linearToSrgb(x: number): number {
  const c = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

// Keep reflectance strictly inside (0,1) so K/S stays finite.
function clampR(x: number): number {
  return Math.min(0.9999, Math.max(0.0001, x));
}
function ks(R: number): number {
  return ((1 - R) * (1 - R)) / (2 * R);
}
function unmix(KS: number): number {
  return 1 + KS - Math.sqrt(KS * KS + 2 * KS);
}

const CHANNELS = ["r", "g", "b"] as const;

/** Predict the color of a recipe mixed from the given palette. */
export function predictMix(recipe: Recipe, palette: Paint[]): MixPrediction {
  const byId = new Map(palette.map((p) => [p.id, p]));
  const comps = recipe.components
    .map((c) => ({ paint: byId.get(c.paintId), weight: c.weight }))
    .filter((c): c is { paint: Paint; weight: number } => !!c.paint);

  const total = comps.reduce((s, c) => s + c.weight, 0) || 1;

  const out: Record<(typeof CHANNELS)[number], number> = { r: 0, g: 0, b: 0 };
  for (const ch of CHANNELS) {
    // Weighted-average K/S across pigments (single-constant KM).
    let ksMix = 0;
    for (const c of comps) {
      const lin = srgbToLinear(c.paint.rgb[ch]);
      ksMix += (c.weight / total) * ks(clampR(lin));
    }
    // Dilution: pigment fraction `dilution` over white paper (K/S = 0).
    ksMix *= recipe.dilution;
    out[ch] = linearToSrgb(unmix(ksMix));
  }

  const rgb: RGB = { r: out.r, g: out.g, b: out.b };
  const lab = toLab({ mode: "rgb", r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255 });
  return { rgb, lab: { l: lab.l, a: lab.a, b: lab.b } };
}

/** Lab -> 0-255 RGB (gamut-clamped), for displaying predicted colors. */
export function labToRgb(lab: Lab): RGB {
  const rgb = toRgb({ mode: "lab", l: lab.l, a: lab.a, b: lab.b });
  const to255 = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255);
  return { r: to255(rgb.r), g: to255(rgb.g), b: to255(rgb.b) };
}

/** Lab -> displayable hex, for swatches of predicted colors. */
export function labToHex(lab: Lab): string {
  const { r, g, b } = labToRgb(lab);
  const h = (x: number) => x.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
