import { describe, it, expect } from "vitest";
import { kmeans, type LabPt } from "@/lib/segment/kmeans";
import { segmentImage } from "@/lib/segment/segment";
import { makeImage } from "./helpers";

describe("kmeans", () => {
  it("recovers three well-separated clusters", () => {
    const centers: LabPt[] = [
      { l: 20, a: 40, b: 30 },
      { l: 60, a: -30, b: 20 },
      { l: 80, a: 0, b: -40 },
    ];
    const pts: LabPt[] = [];
    let seed = 7;
    const jitter = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280 - 0.5) * 6;
    for (const c of centers) for (let i = 0; i < 60; i++) pts.push({ l: c.l + jitter(), a: c.a + jitter(), b: c.b + jitter() });

    const { centroids } = kmeans(pts, 3, { seed: 1 });
    expect(centroids).toHaveLength(3);
    // Every true center should have a centroid near it.
    for (const c of centers) {
      const near = centroids.some(
        (q) => Math.hypot(q.l - c.l, q.a - c.a, q.b - c.b) < 8,
      );
      expect(near, `no centroid near ${JSON.stringify(c)}`).toBe(true);
    }
  });
});

describe("segmentImage", () => {
  it("splits a three-band image into three layers with even coverage", () => {
    const W = 90, H = 30;
    const img = makeImage(W, H, (x) =>
      x < 30 ? [220, 30, 30] : x < 60 ? [30, 170, 60] : [40, 60, 200],
    );
    const { layers, assignRgb } = segmentImage(img, 3);
    expect(layers).toHaveLength(3);
    // Each band is ~1/3 of the image.
    for (const layer of layers) {
      expect(layer.coverage).toBeGreaterThan(0.25);
      expect(layer.coverage).toBeLessThan(0.42);
    }
    // The three planted colours each map to a distinct layer.
    const idxRed = assignRgb(220, 30, 30);
    const idxGreen = assignRgb(30, 170, 60);
    const idxBlue = assignRgb(40, 60, 200);
    expect(new Set([idxRed, idxGreen, idxBlue]).size).toBe(3);
    // The red layer should actually be reddish.
    expect(layers[idxRed].rgb.r).toBeGreaterThan(layers[idxRed].rgb.b);
  });
});
