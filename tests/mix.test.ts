import { describe, it, expect } from "vitest";
import { predictMix } from "@/lib/mix/km";
import { suggestMixes } from "@/lib/mix/suggest";
import { predictMixCalibrated } from "@/lib/mix/calibration";
import { describeColor } from "@/lib/color/describe";
import type { Paint } from "@/lib/palette/types";
import type { CalibrationSample } from "@/lib/mix/types";

const blue: Paint = { id: "blue", name: "Ultramarine", rgb: { r: 56, g: 70, b: 160 }, lab: describeColor({ r: 56, g: 70, b: 160 }).lab };
const yellow: Paint = { id: "yellow", name: "Yellow", rgb: { r: 244, g: 214, b: 60 }, lab: describeColor({ r: 244, g: 214, b: 60 }).lab };
const palette = [blue, yellow];

describe("predictMix (Kubelka–Munk subtractive)", () => {
  it("mixes blue + yellow into a green, not gray or black", () => {
    const mix = predictMix(
      { components: [{ paintId: "blue", weight: 0.5 }, { paintId: "yellow", weight: 0.5 }], dilution: 1 },
      palette,
    );
    expect(mix.lab.a).toBeLessThan(0); // negative a* = toward green
    expect(mix.lab.l).toBeGreaterThan(20); // not black
  });

  it("dilution lightens the result (water + paper = value)", () => {
    const recipe = (d: number) => ({ components: [{ paintId: "blue", weight: 1 }], dilution: d });
    const strong = predictMix(recipe(1), palette);
    const weak = predictMix(recipe(0.2), palette);
    expect(weak.lab.l).toBeGreaterThan(strong.lab.l);
  });
});

describe("suggestMixes", () => {
  it("matches an exact palette color with the single paint at ΔE ≈ 0", () => {
    const target = describeColor(blue.rgb).lab;
    const [best] = suggestMixes(target, palette, []);
    expect(best.deltaE).toBeLessThan(1);
    expect(best.recipe.components).toHaveLength(1);
    expect(best.recipe.components[0].paintId).toBe("blue");
  });

  it("ranks best-first (ΔE plus a small forgiveness penalty, capped at 1.2)", () => {
    const target = describeColor({ r: 90, g: 120, b: 80 }).lab; // a muted green
    const results = suggestMixes(target, palette, []);
    expect(results.length).toBeGreaterThan(0);
    // The top pick's ΔE is within the penalty cap of every other option, i.e. we
    // never promote a clearly-worse match — we only re-order near-ties.
    for (const r of results) {
      expect(results[0].deltaE).toBeLessThanOrEqual(r.deltaE + 1.2 + 1e-9);
    }
  });
});

describe("watercolour rule: lighten with water, not white", () => {
  const white: Paint = {
    id: "white",
    name: "Chinese White",
    rgb: { r: 240, g: 240, b: 235 },
    lab: describeColor({ r: 240, g: 240, b: 235 }).lab,
  };
  const pal = [blue, yellow, white];
  const paleBlue = describeColor({ r: 170, g: 185, b: 225 }).lab;

  it("never pairs white with a pigment to lighten it", () => {
    const results = suggestMixes(paleBlue, pal, [], { topK: 8 });
    for (const r of results) {
      const ids = r.recipe.components.map((c) => c.paintId);
      if (ids.length > 1) expect(ids).not.toContain("white");
    }
  });

  it("lightens a pale target with a dilute wash, not by adding white", () => {
    const [best] = suggestMixes(paleBlue, pal, []);
    expect(best.recipe.dilution).toBeLessThan(0.5);
    expect(best.recipe.components.map((c) => c.paintId)).not.toContain("white");
  });
});

describe("predictMixCalibrated", () => {
  const recipe = { components: [{ paintId: "blue", weight: 0.5 }, { paintId: "yellow", weight: 0.5 }], dilution: 0.45 };

  it("applies a learned residual from a matching painted swatch", () => {
    const base = predictMix(recipe, palette);
    const sample: CalibrationSample = {
      id: "s1",
      recipe,
      paintSet: ["blue", "yellow"],
      predicted: base.lab,
      actual: { l: base.lab.l + 20, a: base.lab.a, b: base.lab.b }, // real swatch 20 lighter
      createdAt: 0,
    };
    const corrected = predictMixCalibrated(recipe, palette, [sample]);
    expect(corrected.calibrated).toBe(true);
    expect(corrected.lab.l).toBeGreaterThan(base.lab.l + 15);
  });

  it("ignores calibrations from a different paint set", () => {
    const base = predictMix(recipe, palette);
    const sample: CalibrationSample = {
      id: "s2",
      recipe: { components: [{ paintId: "other", weight: 1 }], dilution: 0.45 },
      paintSet: ["other"],
      predicted: { l: 10, a: 0, b: 0 },
      actual: { l: 90, a: 0, b: 0 },
      createdAt: 0,
    };
    const corrected = predictMixCalibrated(recipe, palette, [sample]);
    expect(corrected.calibrated).toBe(false);
    expect(corrected.lab.l).toBeCloseTo(base.lab.l, 5);
  });
});
