import { converter, differenceCiede2000 } from "culori";
import type { Lab } from "@/lib/color/describe";

const toLch = converter("lch");
const deltaE = differenceCiede2000();

export interface Difference {
  deltaE: number;
  sentence: string;
}

function joinWords(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}

/**
 * Plain-language comparison of a predicted color vs the actually-painted swatch,
 * written so it's meaningful without seeing the hue: lightness, saturation and
 * warmth, plus the ΔE distance.
 */
export function describeDifference(predicted: Lab, actual: Lab): Difference {
  const d = deltaE(
    { mode: "lab", l: predicted.l, a: predicted.a, b: predicted.b },
    { mode: "lab", l: actual.l, a: actual.a, b: actual.b },
  );

  const pc = toLch({ mode: "lab", l: predicted.l, a: predicted.a, b: predicted.b });
  const ac = toLch({ mode: "lab", l: actual.l, a: actual.a, b: actual.b });

  const dL = actual.l - predicted.l;
  const dC = (ac.c ?? 0) - (pc.c ?? 0);
  // Movement toward yellow/red reads as warmer.
  const dWarm = actual.b - predicted.b + (actual.a - predicted.a) * 0.5;

  if (d < 2) {
    return { deltaE: d, sentence: `Spot on — your real mix matches the prediction (ΔE ${d.toFixed(1)}).` };
  }

  const parts: string[] = [];
  if (Math.abs(dL) >= 2) parts.push(dL > 0 ? "lighter" : "darker");
  if (Math.abs(dC) >= 3) parts.push(dC > 0 ? "more saturated" : "more muted");
  if (Math.abs(dWarm) >= 4) parts.push(dWarm > 0 ? "warmer" : "cooler");

  if (parts.length === 0) {
    return { deltaE: d, sentence: `Close — a small overall difference (ΔE ${d.toFixed(1)}).` };
  }
  return {
    deltaE: d,
    sentence: `Your real mix came out ${joinWords(parts)} than predicted (ΔE ${d.toFixed(1)}).`,
  };
}
