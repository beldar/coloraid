import type { RGB } from "@/lib/color/sampling";

/** Minimal structural type so this works with both ImageData and test fixtures. */
export interface ImageLike {
  width: number;
  height: number;
  data: Uint8ClampedArray | number[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function chroma(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/**
 * Bounding box of the "colorful" pixels — used to auto-fit the well grid over a
 * palette photo. Restricted to a vertical band by default because in a typical
 * shot the printed label (also colorful) sits above the actual paint wells.
 */
export function detectColorfulBounds(
  data: ImageLike,
  opts: { minChroma?: number; bandTop?: number; bandBottom?: number } = {},
): Rect | null {
  const minChroma = opts.minChroma ?? 35;
  const bandTop = opts.bandTop ?? 0;
  const bandBottom = opts.bandBottom ?? 1;
  const { width, height, data: px } = data;

  const y0 = Math.floor(height * bandTop);
  const y1 = Math.floor(height * bandBottom);
  // Sample on a coarse grid for speed; full res isn't needed to find bounds.
  const step = Math.max(1, Math.floor(Math.min(width, height) / 200));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;

  for (let y = y0; y < y1; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (chroma(px[i], px[i + 1], px[i + 2]) >= minChroma) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        count++;
      }
    }
  }

  if (count < 5 || !Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Find the centers of the `k` strongest "blobs" in a 1-D profile.
 *
 * Wells are saturated regions separated by the light tray, so the chroma profile
 * is a series of plateaus separated by near-zero gaps. We threshold, split into
 * contiguous runs, take each run's intensity-weighted centroid (robust to where
 * the plateau's max happens to fall), and keep the `k` heaviest runs.
 */
function profilePeaks(profile: number[], k: number): number[] {
  const max = Math.max(...profile);
  if (max <= 0) return [];
  const threshold = max * 0.3;

  const runs: { center: number; weight: number }[] = [];
  let i = 0;
  while (i < profile.length) {
    if (profile[i] < threshold) {
      i++;
      continue;
    }
    let j = i;
    let wSum = 0;
    let iSum = 0;
    while (j < profile.length && profile[j] >= threshold) {
      wSum += profile[j];
      iSum += j * profile[j];
      j++;
    }
    runs.push({ center: iSum / wSum, weight: wSum });
    i = j;
  }

  return runs
    .sort((a, b) => b.weight - a.weight)
    .slice(0, k)
    .map((r) => r.center)
    .sort((a, b) => a - b);
}

/**
 * Detect a clean rows×cols grid of paint wells by saturation projection.
 *
 * Paint wells are saturated squares separated by a light tray, so the per-column
 * and per-row sums of chroma have `cols` and `rows` clear peaks. We find those
 * peaks and build an evenly-spaced grid centered on them — far more accurate than
 * a loose bounding box, which can't align cells to the actual wells.
 *
 * `bandTop` restricts the search below the printed label (which carries the same
 * colors and would otherwise add phantom rows).
 */
export function detectWellGrid(
  data: ImageLike,
  rows: number,
  cols: number,
  opts: { minChroma?: number; bandTop?: number } = {},
): Rect | null {
  const minChroma = opts.minChroma ?? 30;
  const bandTop = opts.bandTop ?? 0.5;
  const { width, height, data: px } = data;
  const y0 = Math.floor(height * bandTop);
  const step = Math.max(1, Math.floor(Math.min(width, height) / 400));

  const colProfile = new Array(width).fill(0);
  const rowProfile = new Array(height).fill(0);
  for (let y = y0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const c = chroma(px[i], px[i + 1], px[i + 2]);
      if (c >= minChroma) {
        colProfile[x] += c;
        rowProfile[y] += c;
      }
    }
  }

  const colCenters = cols > 1 ? profilePeaks(colProfile, cols) : null;
  const rowCenters = rows > 1 ? profilePeaks(rowProfile, rows) : null;

  if ((cols > 1 && (!colCenters || colCenters.length < cols)) ||
      (rows > 1 && (!rowCenters || rowCenters.length < rows))) {
    return null;
  }

  // Reject clustered false-peaks: e.g. 6 sub-pixel runs in a 30px hotspot instead of 6 real wells.
  if (colCenters && cols > 1 && colCenters[colCenters.length - 1] - colCenters[0] < width * 0.15) return null;
  if (rowCenters && rows > 1 && rowCenters[rowCenters.length - 1] - rowCenters[0] < height * 0.05) return null;

  const span = (centers: number[] | null, n: number, fullLo: number, fullHi: number): [number, number] => {
    if (!centers || n === 1) return [fullLo, fullHi];
    const lo = centers[0];
    const hi = centers[centers.length - 1];
    const pitch = (hi - lo) / (n - 1);
    return [lo - pitch / 2, hi + pitch / 2];
  };

  const [x0, x1] = span(colCenters, cols, width * 0.05, width * 0.95);
  const [ry0, ry1] = span(rowCenters, rows, y0, height * 0.98);
  return {
    x: Math.max(0, x0),
    y: Math.max(0, ry0),
    w: Math.min(width, x1) - Math.max(0, x0),
    h: Math.min(height, ry1) - Math.max(0, ry0),
  };
}

/**
 * Slice a region into a row-major grid of cell rectangles.
 * `gap` (0-0.5) trims a fraction off each cell so neighbouring wells don't bleed
 * into one another.
 */
export function makeGrid(bounds: Rect, rows: number, cols: number, gap = 0.12): Rect[] {
  const cells: Rect[] = [];
  const cw = bounds.w / cols;
  const ch = bounds.h / rows;
  const padX = cw * gap;
  const padY = ch * gap;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        x: bounds.x + c * cw + padX,
        y: bounds.y + r * ch + padY,
        w: cw - 2 * padX,
        h: ch - 2 * padY,
      });
    }
  }
  return cells;
}

export interface Pt {
  x: number;
  y: number;
}
/** Four corners of a (possibly perspective-skewed) region, image-pixel coords. */
export interface Quad {
  tl: Pt;
  tr: Pt;
  br: Pt;
  bl: Pt;
}

/** Bilinear interpolation of a point at (u,v) in [0,1]² within a quad. */
export function bilerp(q: Quad, u: number, v: number): Pt {
  const tx = q.tl.x + (q.tr.x - q.tl.x) * u;
  const ty = q.tl.y + (q.tr.y - q.tl.y) * u;
  const bx = q.bl.x + (q.br.x - q.bl.x) * u;
  const by = q.bl.y + (q.br.y - q.bl.y) * u;
  return { x: tx + (bx - tx) * v, y: ty + (by - ty) * v };
}

/** The inset sub-quad for grid cell (r,c) — handles perspective via bilerp. */
export function cellQuad(q: Quad, r: number, c: number, rows: number, cols: number, inset = 0.18): Quad {
  const u0 = (c + inset) / cols;
  const u1 = (c + 1 - inset) / cols;
  const v0 = (r + inset) / rows;
  const v1 = (r + 1 - inset) / rows;
  return { tl: bilerp(q, u0, v0), tr: bilerp(q, u1, v0), br: bilerp(q, u1, v1), bl: bilerp(q, u0, v1) };
}

function pointInQuad(px: number, py: number, q: Quad): boolean {
  const edges: [Pt, Pt][] = [
    [q.tl, q.tr],
    [q.tr, q.br],
    [q.br, q.bl],
    [q.bl, q.tl],
  ];
  let sign = 0;
  for (const [a, b] of edges) {
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (cross !== 0) {
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

/**
 * Sample a well color from a quad (perspective-aware).
 *
 * Uses a component-wise median after discarding confirmed specular highlights
 * (very bright pixels with near-zero saturation — those are glare, not paint).
 * The median is robust: as long as >50% of the cell pixels are actual paint,
 * the median lands on the paint color regardless of rim shadows or tray gaps.
 * The old dark-luminance-band approach would land on plastic dividers for vivid
 * paints (yellow, red) because their high-luminance paint pixels sat above the
 * 15–45th percentile window.
 *
 * The `band` parameter is kept for API compatibility but is no longer used.
 */
export function sampleQuadColor(
  data: ImageLike,
  quad: Quad,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _band: { lo?: number; hi?: number } = {},
): { rgb: RGB; count: number } {
  const { width, height, data: px } = data;
  const xs = [quad.tl.x, quad.tr.x, quad.br.x, quad.bl.x];
  const ys = [quad.tl.y, quad.tr.y, quad.br.y, quad.bl.y];
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const x1 = Math.min(width - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(height - 1, Math.ceil(Math.max(...ys)));

  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!pointInQuad(x, y, quad)) continue;
      const i = (y * width + x) * 4;
      if (px[i + 3] === 0) continue;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      // Exclude pure specular highlights: very bright with near-zero saturation.
      if (luminance(r, g, b) > 240 && chroma(r, g, b) < 15) continue;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }

  if (rs.length === 0) return { rgb: { r: 0, g: 0, b: 0 }, count: 0 };

  rs.sort((a, b) => a - b);
  gs.sort((a, b) => a - b);
  bs.sort((a, b) => a - b);

  const mid = Math.floor(rs.length / 2);
  return { rgb: { r: rs[mid], g: gs[mid], b: bs[mid] }, count: rs.length };
}

/**
 * Sample a well's true pigment color, discarding the glossy highlight.
 *
 * Wells photograph with a bright specular streak (very high luminance, low
 * chroma) and darker edges. We collect the central pixels, sort by luminance,
 * and average a *dark band* (default 15th–45th percentile). That throws away the
 * glare at the top and the shadowed rim at the very bottom, leaving the
 * saturated masstone — which is what the painter actually mixes from.
 */
export function sampleWellColor(
  data: ImageLike,
  rect: Rect,
  band: { lo?: number; hi?: number } = {},
): { rgb: RGB; count: number } {
  // Sample the central 60% of the cell (avoids rims/neighbours) by delegating to
  // the perspective-aware quad sampler with an axis-aligned, inset quad.
  const inset = 0.2;
  const x0 = rect.x + rect.w * inset;
  const x1 = rect.x + rect.w * (1 - inset);
  const y0 = rect.y + rect.h * inset;
  const y1 = rect.y + rect.h * (1 - inset);
  const quad: Quad = {
    tl: { x: x0, y: y0 },
    tr: { x: x1, y: y0 },
    br: { x: x1, y: y1 },
    bl: { x: x0, y: y1 },
  };
  return sampleQuadColor(data, quad, band);
}
