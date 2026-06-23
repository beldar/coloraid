import { describe, it, expect } from "vitest";
import {
  makeGrid, sampleWellColor, detectColorfulBounds, detectWellGrid,
  bilerp, cellQuad, sampleQuadColor, type Rect, type Quad,
} from "@/lib/palette/wells";
import { makeImage } from "./helpers";

describe("makeGrid", () => {
  it("produces rows×cols cells in row-major order", () => {
    const cells = makeGrid({ x: 0, y: 0, w: 600, h: 200 }, 2, 6, 0);
    expect(cells).toHaveLength(12);
    // first cell top-left
    expect(cells[0]).toMatchObject({ x: 0, y: 0, w: 100, h: 100 });
    // 7th cell starts the second row
    expect(cells[6]).toMatchObject({ x: 0, y: 100 });
  });

  it("applies a gap inset so neighbours don't bleed", () => {
    const [cell] = makeGrid({ x: 0, y: 0, w: 100, h: 100 }, 1, 1, 0.1);
    expect(cell.x).toBeCloseTo(10);
    expect(cell.w).toBeCloseTo(80);
  });
});

describe("sampleWellColor", () => {
  it("discards the bright glare highlight and returns the true pigment color", () => {
    // 20×20 red well with a vertical white glare stripe through the middle.
    const img = makeImage(20, 20, (x) =>
      x >= 8 && x <= 11 ? [255, 255, 255] : [200, 30, 30],
    );
    const { rgb } = sampleWellColor(img, { x: 0, y: 0, w: 20, h: 20 });
    // Should read as red, not washed toward white.
    expect(rgb.r).toBeGreaterThan(170);
    expect(rgb.g).toBeLessThan(80);
    expect(rgb.b).toBeLessThan(80);
  });

  it("returns the solid color for a uniform well", () => {
    const img = makeImage(20, 20, () => [40, 90, 160]);
    const { rgb } = sampleWellColor(img, { x: 0, y: 0, w: 20, h: 20 });
    expect(rgb).toMatchObject({ r: 40, g: 90, b: 160 });
  });
});

describe("detectColorfulBounds", () => {
  it("finds the bounding box of the saturated region", () => {
    // Gray background with a saturated block from (30,30) to (70,70).
    const img = makeImage(100, 100, (x, y) =>
      x >= 30 && x < 70 && y >= 30 && y < 70 ? [220, 20, 20] : [128, 128, 128],
    );
    const bounds = detectColorfulBounds(img) as Rect;
    expect(bounds).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(28);
    expect(bounds.x).toBeLessThanOrEqual(32);
    expect(bounds.x + bounds.w).toBeGreaterThanOrEqual(66);
  });

  it("returns null when nothing is colorful", () => {
    const img = makeImage(50, 50, () => [120, 120, 122]);
    expect(detectColorfulBounds(img)).toBeNull();
  });
});

describe("detectWellGrid", () => {
  // Build a 6×2 grid of saturated squares on a white tray, in the lower half,
  // mimicking the real palette photo (label colors up top are ignored).
  const W = 600;
  const H = 400;
  const colors = [
    [230, 200, 40], [240, 150, 30], [220, 40, 40], [150, 30, 60], [40, 60, 160], [40, 150, 210],
    [30, 110, 90], [70, 130, 50], [200, 150, 60], [150, 70, 50], [90, 60, 50], [240, 240, 235],
  ];
  // Grid geometry in the lower half.
  const gx = 60, gy = 230, cellW = 80, cellH = 70, gapX = 10, gapY = 10;
  const img = makeImage(W, H, (x, y) => {
    // phantom label swatches up top (should be ignored by bandTop)
    if (y < 120 && x > 60 && x < 540) return [200, 100, 100];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 6; c++) {
        const x0 = gx + c * (cellW + gapX);
        const y0 = gy + r * (cellH + gapY);
        if (x >= x0 && x < x0 + cellW && y >= y0 && y < y0 + cellH) {
          return colors[r * 6 + c];
        }
      }
    }
    return [245, 245, 242]; // white tray
  });

  it("snaps a grid onto the real well positions and samples the right colors", () => {
    const bounds = detectWellGrid(img, 2, 6, { bandTop: 0.5 });
    expect(bounds).not.toBeNull();
    const cells = makeGrid(bounds as Rect, 2, 6);
    const sampled = cells.map((cell) => sampleWellColor(img, cell).rgb);
    // Each sampled color should be close to the planted well color.
    sampled.forEach((rgb, i) => {
      const [er, eg, eb] = colors[i];
      const dist = Math.abs(rgb.r - er) + Math.abs(rgb.g - eg) + Math.abs(rgb.b - eb);
      expect(dist, `well ${i} got ${JSON.stringify(rgb)} expected ${colors[i]}`).toBeLessThan(60);
    });
  });

  it("samples correct colors through a skewed (perspective) quad", () => {
    // A 2×2 colored grid, but the wells form a trapezoid (right side taller),
    // mimicking an angled photo. A rectangle can't fit this; a quad can.
    const cols2 = [
      [220, 40, 40], [40, 80, 200],
      [40, 160, 70], [220, 190, 40],
    ];
    const W = 200, H = 200;
    // Quad corners (image px) framing the trapezoid the cells live in.
    const quad: Quad = { tl: { x: 40, y: 40 }, tr: { x: 170, y: 20 }, br: { x: 170, y: 180 }, bl: { x: 40, y: 150 } };
    // Paint each cell's quad region with its color.
    const img = makeImage(W, H, (x, y) => {
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const cq = cellQuad(quad, r, c, 2, 2, 0.02);
          // crude point-in-quad via bounding triangle test using bilerp corners
          const xs = [cq.tl.x, cq.tr.x, cq.br.x, cq.bl.x];
          const ys = [cq.tl.y, cq.tr.y, cq.br.y, cq.bl.y];
          if (x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys)) {
            return cols2[r * 2 + c];
          }
        }
      }
      return [250, 250, 248];
    });
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const { rgb } = sampleQuadColor(img, cellQuad(quad, r, c, 2, 2));
        const [er, eg, eb] = cols2[r * 2 + c];
        const dist = Math.abs(rgb.r - er) + Math.abs(rgb.g - eg) + Math.abs(rgb.b - eb);
        expect(dist, `cell ${r},${c} got ${JSON.stringify(rgb)}`).toBeLessThan(60);
      }
    }
  });

  it("bilerp returns the center of a quad at (0.5, 0.5)", () => {
    const q: Quad = { tl: { x: 0, y: 0 }, tr: { x: 10, y: 0 }, br: { x: 10, y: 10 }, bl: { x: 0, y: 10 } };
    expect(bilerp(q, 0.5, 0.5)).toMatchObject({ x: 5, y: 5 });
  });

  it("can be restricted to a vertical band (ignore the label above the wells)", () => {
    // Colorful strip at the top (label) and another at the bottom (wells).
    const img = makeImage(100, 100, (x, y) => {
      if (y < 20) return [220, 30, 30]; // label
      if (y > 70) return [30, 30, 220]; // wells
      return [128, 128, 128];
    });
    const bounds = detectColorfulBounds(img, { bandTop: 0.5 }) as Rect;
    expect(bounds.y).toBeGreaterThan(50); // only found the lower (wells) band
  });
});
