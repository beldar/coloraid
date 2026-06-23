import { differenceCiede2000 } from "culori";
import type { Lab } from "@/lib/color/describe";
import type { Paint } from "@/lib/palette/types";
import { predictMix } from "./km";
import { predictMixCalibrated, type CorrectedPrediction } from "./calibration";
import { DILUTION_LEVELS, dilutionLabel, type CalibrationSample, type Recipe } from "./types";

const deltaE = differenceCiede2000();

// Mixing ratios for 2-paint combos (share of the first paint).
const RATIO_GRID = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

function chroma(lab: Lab): number {
  return Math.hypot(lab.a, lab.b);
}

/**
 * Penalty (in ΔE-equivalent units) for mixes that lean on chroma *cancellation* —
 * combining two saturated pigments to land on a duller color. Such mixes are
 * hue-unstable: a small ratio error swings the result a lot, and a colorblind
 * painter can't course-correct by eye. So between two recipes that hit the target
 * equally well, we prefer the one that doesn't rely on cancellation (e.g. dilute
 * Burnt Sienna over Cadmium Red + Viridian for a brown rock). Measured at masstone
 * so dilution doesn't confound it. Capped so it only ever breaks near-ties.
 */
function cancellationPenalty(recipe: Recipe, palette: Paint[], byId: Map<string, Paint>): number {
  if (recipe.components.length < 2) return 0;
  const comps = recipe.components
    .map((c) => ({ paint: byId.get(c.paintId), w: c.weight }))
    .filter((c): c is { paint: Paint; w: number } => !!c.paint);
  const total = comps.reduce((s, c) => s + c.w, 0) || 1;
  const meanChroma = comps.reduce((s, c) => s + (c.w / total) * chroma(c.paint.lab), 0);
  const resultChroma = chroma(predictMix({ components: recipe.components, dilution: 1 }, palette).lab);
  const cancelled = Math.max(0, meanChroma - resultChroma);
  return Math.min(1.2, 0.05 * cancelled);
}

export interface SuggestedRecipe {
  recipe: Recipe;
  prediction: CorrectedPrediction;
  deltaE: number;
  /** Human-readable recipe, e.g. "65% Ultramarine + 35% Burnt Sienna, medium wash". */
  text: string;
}

export interface SuggestOptions {
  /** Max paints per mix. Locked to 2 for now (cleaner mixes, fast search). */
  maxPaints?: 1 | 2;
  topK?: number;
}

function labColor(lab: Lab) {
  return { mode: "lab" as const, l: lab.l, a: lab.a, b: lab.b };
}

/**
 * Watercolour rule: you lighten with water, not white. So a white paint is never
 * used as a *mixing partner* to tint another pigment — it would give chalky,
 * un-watercolour results. White is still offered as a single paint (for genuinely
 * whitish targets / opaque highlights), but to make a colour lighter the mixer
 * reaches for a more dilute wash instead.
 */
function isWhitePaint(p: Paint): boolean {
  if (/white|blanc|titanium|zinc|chinese/i.test(p.name)) return true;
  const { r, g, b } = p.rgb;
  return Math.min(r, g, b) > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 16;
}

function recipeText(recipe: Recipe, palette: Paint[]): string {
  const byId = new Map(palette.map((p) => [p.id, p]));
  const total = recipe.components.reduce((s, c) => s + c.weight, 0) || 1;
  const dil = dilutionLabel(recipe.dilution);
  // "masstone" is full strength — not a wash; everything else reads "<label> wash".
  const strength = dil === "masstone" ? "at full strength" : `${dil} wash`;
  const parts = [...recipe.components]
    .sort((a, b) => b.weight - a.weight)
    .map((c) => ({ name: byId.get(c.paintId)?.name ?? "?", pct: Math.round((c.weight / total) * 100) }));

  if (parts.length === 1) {
    return `${parts[0].name}, ${strength}`;
  }
  return `${parts[0].pct}% ${parts[0].name} + ${parts[1].pct}% ${parts[1].name}, ${strength}`;
}

/**
 * Suggest the best ways to approach a target color with the user's palette.
 * Searches single paints and 2-paint combos across a ratio grid and the named
 * dilution levels, predicts each (with calibration applied), and ranks by
 * CIEDE2000 distance to the target.
 */
export function suggestMixes(
  target: Lab,
  palette: Paint[],
  samples: CalibrationSample[],
  opts: SuggestOptions = {},
): SuggestedRecipe[] {
  const maxPaints = opts.maxPaints ?? 2;
  const topK = opts.topK ?? 4;
  if (palette.length === 0) return [];

  const t = labColor(target);
  const byId = new Map(palette.map((p) => [p.id, p]));
  // `score` ranks recipes; `deltaE` is the honest distance we still display.
  const results: (SuggestedRecipe & { score: number })[] = [];

  const evaluate = (recipe: Recipe) => {
    const prediction = predictMixCalibrated(recipe, palette, samples);
    const d = deltaE(t, labColor(prediction.lab));
    const score = d + cancellationPenalty(recipe, palette, byId);
    results.push({ recipe, prediction, deltaE: d, text: recipeText(recipe, palette), score });
  };

  for (const { value: dilution } of DILUTION_LEVELS) {
    // Single paints.
    for (const p of palette) {
      evaluate({ components: [{ paintId: p.id, weight: 1 }], dilution });
    }
    // 2-paint combos. White is never a mixing partner (lighten with water).
    if (maxPaints >= 2) {
      for (let i = 0; i < palette.length; i++) {
        if (isWhitePaint(palette[i])) continue;
        for (let j = i + 1; j < palette.length; j++) {
          if (isWhitePaint(palette[j])) continue;
          for (const r of RATIO_GRID) {
            evaluate({
              components: [
                { paintId: palette[i].id, weight: r },
                { paintId: palette[j].id, weight: 1 - r },
              ],
              dilution,
            });
          }
        }
      }
    }
  }

  results.sort((a, b) => a.score - b.score);

  // De-duplicate: keep recipes that differ meaningfully from already-picked ones.
  const picked: SuggestedRecipe[] = [];
  for (const cand of results) {
    if (picked.length >= topK) break;
    const dup = picked.some((p) => sameKey(p, cand));
    if (!dup) picked.push(cand);
  }
  return picked;
}

// Two suggestions are "the same" if they use the same paint set at very similar
// ratio + dilution — avoids showing 9 near-identical rows of one combo.
function sameKey(a: SuggestedRecipe, b: SuggestedRecipe): boolean {
  const ka = a.recipe.components.map((c) => c.paintId).sort().join("|");
  const kb = b.recipe.components.map((c) => c.paintId).sort().join("|");
  if (ka !== kb) return false;
  const dilClose = Math.abs(a.recipe.dilution - b.recipe.dilution) < 0.12;
  return dilClose;
}
