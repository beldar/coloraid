import { describe, it, expect } from "vitest";
import { describeColor } from "@/lib/color/describe";
import { describeDifference } from "@/lib/mix/compare";
import { samplePatch } from "@/lib/color/sampling";
import { nearestPaints } from "@/lib/palette/storage";
import type { Paint } from "@/lib/palette/types";
import { makeImage } from "./helpers";

describe("describeColor", () => {
  it("describes a vivid red as warm", () => {
    const d = describeColor({ r: 220, g: 36, b: 40 });
    expect(d.hueFamily).toBe("red");
    expect(d.warmthWord).toBe("warm");
  });

  it("describes ultramarine as a cool blue", () => {
    const d = describeColor({ r: 56, g: 70, b: 160 });
    expect(d.hueFamily).toBe("blue");
    expect(d.warmthWord).toBe("cool");
  });

  it("treats a gray as neutral with no hue", () => {
    const d = describeColor({ r: 128, g: 128, b: 128 });
    expect(d.hueFamily).toBe("gray");
    expect(d.warmthWord).toBe("neutral");
  });
});

describe("describeDifference", () => {
  it("reports a darker, real swatch in plain words", () => {
    const predicted = { l: 70, a: 0, b: 10 };
    const actual = { l: 40, a: 0, b: 10 };
    const { sentence } = describeDifference(predicted, actual);
    expect(sentence).toContain("darker");
  });

  it("reports a near-perfect match", () => {
    const lab = { l: 50, a: 5, b: -5 };
    const { sentence } = describeDifference(lab, { ...lab });
    expect(sentence.toLowerCase()).toContain("spot on");
  });
});

describe("samplePatch", () => {
  it("averages a uniform patch with zero variance", () => {
    const img = makeImage(10, 10, () => [30, 60, 90]);
    const { rgb, variance } = samplePatch(img as ImageData, 5, 5, 3);
    expect(rgb).toMatchObject({ r: 30, g: 60, b: 90 });
    expect(variance).toBe(0);
  });

  it("reports high variance across a color boundary", () => {
    const img = makeImage(10, 10, (x) => (x < 5 ? [0, 0, 0] : [255, 255, 255]));
    const { variance } = samplePatch(img as ImageData, 5, 5, 4);
    expect(variance).toBeGreaterThan(900);
  });
});

describe("nearestPaints", () => {
  it("finds the closest paint by CIEDE2000", () => {
    const paints: Paint[] = [
      { id: "r", name: "Red", rgb: { r: 220, g: 30, b: 30 }, lab: describeColor({ r: 220, g: 30, b: 30 }).lab },
      { id: "b", name: "Blue", rgb: { r: 40, g: 60, b: 170 }, lab: describeColor({ r: 40, g: 60, b: 170 }).lab },
    ];
    const target = describeColor({ r: 210, g: 40, b: 35 }).lab;
    const [match] = nearestPaints(target, paints, 1);
    expect(match.paint.id).toBe("r");
    expect(match.deltaE).toBeLessThan(10);
  });
});
