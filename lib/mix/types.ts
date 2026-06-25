import type { RGB } from "@/lib/color/sampling";
import type { Lab } from "@/lib/color/describe";

/** A proportion of one paint within a mix (weights are normalized to sum 1). */
export interface MixComponent {
  paintId: string;
  weight: number; // 0-1 after normalization
}

/** A mixing recipe: which paints, in what proportion, at what dilution. */
export interface Recipe {
  components: MixComponent[];
  /**
   * Pigment load, 0-1. 1 = masstone (full strength), lower = more water.
   * In watercolor this is the *value* dial — water lightens via the paper.
   */
  dilution: number;
}

export interface MixPrediction {
  rgb: RGB;
  lab: Lab;
}

/**
 * Named dilution levels, from full strength to a barely-there wash.
 * In watercolour, lightening a colour means adding *water* (the paper does the
 * lightening), never white paint — so the range runs paler than you might think,
 * giving the mixer enough reach to hit pale skies and tints with water alone.
 */
export const DILUTION_LEVELS: { label: string; value: number }[] = [
  { label: "masstone", value: 1.0 },
  { label: "strong", value: 0.65 },
  { label: "medium", value: 0.42 },
  { label: "light", value: 0.24 },
  { label: "glaze", value: 0.13 },
  { label: "pale", value: 0.07 },
  { label: "faint", value: 0.035 },
  // Very thin washes for pale sky tints and other highly-diluted targets.
  // Dark pigments (Ultramarine, Cerulean) can only reach L≈75 at "faint";
  // "mist" and "ghost" let them reach L≈82 and L≈88 respectively — pale sky territory.
  { label: "mist", value: 0.015 },
  { label: "ghost", value: 0.006 },
];

export function dilutionLabel(value: number): string {
  let best = DILUTION_LEVELS[0];
  let bestD = Infinity;
  for (const lvl of DILUTION_LEVELS) {
    const d = Math.abs(lvl.value - value);
    if (d < bestD) {
      bestD = d;
      best = lvl;
    }
  }
  return best.label;
}

/** A real painted swatch measured against its predicted color, for calibration. */
export interface CalibrationSample {
  id: string;
  recipe: Recipe;
  /** Sorted paint ids — identifies the paint *set* for residual matching. */
  paintSet: string[];
  predicted: Lab;
  actual: Lab;
  createdAt: number;
}
