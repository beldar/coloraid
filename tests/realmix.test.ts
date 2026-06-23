import { describe, it, expect } from "vitest";
import { describeColor } from "@/lib/color/describe";
import { suggestMixes } from "@/lib/mix/suggest";
import type { Paint } from "@/lib/palette/types";
import type { RGB } from "@/lib/color/sampling";

/**
 * The real Winsor & Newton Cotman 12 palette, sampled by Coloraid's auto-import
 * from an actual phone photo of the set (dark-band/glare-discarding sampling).
 * These are masstone colors; the mixer dilutes them for value.
 */
const COTMAN: { name: string; rgb: RGB }[] = [
  { name: "Lemon Yellow Hue", rgb: { r: 214, g: 182, b: 9 } },
  { name: "Cadmium Yellow Hue", rgb: { r: 213, g: 153, b: 4 } },
  { name: "Cadmium Red Pale Hue", rgb: { r: 178, g: 43, b: 33 } },
  { name: "Alizarin Crimson Hue", rgb: { r: 85, g: 41, b: 47 } },
  { name: "Ultramarine", rgb: { r: 41, g: 45, b: 73 } },
  { name: "Cerulean Blue Hue", rgb: { r: 36, g: 70, b: 131 } },
  { name: "Viridian Hue", rgb: { r: 44, g: 51, b: 57 } },
  { name: "Sap Green", rgb: { r: 43, g: 51, b: 40 } },
  { name: "Yellow Ochre", rgb: { r: 140, g: 102, b: 24 } },
  { name: "Burnt Sienna", rgb: { r: 67, g: 43, b: 40 } },
  { name: "Burnt Umber", rgb: { r: 64, g: 59, b: 56 } },
  { name: "Chinese White", rgb: { r: 190, g: 190, b: 178 } },
];

const palette: Paint[] = COTMAN.map((p, i) => ({
  id: `p${i}`,
  name: p.name,
  rgb: p.rgb,
  lab: describeColor(p.rgb).lab,
}));
const byId = new Map(palette.map((p) => [p.id, p.name]));

function recipeNames(ids: string[]): string[] {
  return ids.map((id) => byId.get(id)!);
}

/**
 * Real colors sampled from a sunny sandstone-and-pine landscape photo, each with
 * the pigment families a watercolorist would actually reach for. We assert the
 * suggester (a) gets reasonably close and (b) reaches for sensible paints.
 */
const CASES: { label: string; rgb: RGB; expectAnyOf: string[]; maxDeltaE: number }[] = [
  { label: "sky blue", rgb: { r: 120, g: 160, b: 200 }, expectAnyOf: ["Cerulean Blue Hue", "Ultramarine"], maxDeltaE: 12 },
  { label: "pale haze sky", rgb: { r: 165, g: 190, b: 210 }, expectAnyOf: ["Cerulean Blue Hue", "Ultramarine"], maxDeltaE: 12 },
  { label: "sunlit sandstone", rgb: { r: 170, g: 120, b: 95 }, expectAnyOf: ["Burnt Sienna", "Yellow Ochre", "Cadmium Red Pale Hue"], maxDeltaE: 12 },
  { label: "shadowed rock", rgb: { r: 100, g: 70, b: 62 }, expectAnyOf: ["Burnt Sienna", "Burnt Umber", "Alizarin Crimson Hue"], maxDeltaE: 12 },
  { label: "dry grass", rgb: { r: 150, g: 138, b: 92 }, expectAnyOf: ["Yellow Ochre", "Lemon Yellow Hue", "Sap Green"], maxDeltaE: 13 },
  { label: "pine foliage", rgb: { r: 70, g: 90, b: 55 }, expectAnyOf: ["Sap Green", "Viridian Hue", "Yellow Ochre"], maxDeltaE: 13 },
];

describe("real palette → real landscape colors: mixes make sense", () => {
  for (const c of CASES) {
    it(`${c.label}: close match using sensible pigments`, () => {
      const target = describeColor(c.rgb).lab;
      const [best] = suggestMixes(target, palette, [], { topK: 1 });
      const names = recipeNames(best.recipe.components.map((x) => x.paintId));
      // (a) reasonably close
      expect(best.deltaE, `${c.label} ΔE too high; recipe=${best.text}`).toBeLessThan(c.maxDeltaE);
      // (b) reaches for a sensible pigment
      expect(
        names.some((n) => c.expectAnyOf.includes(n)),
        `${c.label} used ${names.join("+")} (${best.text}); expected one of ${c.expectAnyOf.join("/")}`,
      ).toBe(true);
    });
  }
});
