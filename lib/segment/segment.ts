import { converter } from "culori";
import { kmeans, type LabPt } from "./kmeans";
import type { ImageLike } from "@/lib/palette/wells";
import type { RGB } from "@/lib/color/sampling";

const toLab = converter("lab");
const toRgb = converter("rgb");

function rgb2lab(r: number, g: number, b: number): LabPt {
  const c = toLab({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
  return { l: c.l, a: c.a, b: c.b };
}
function lab2rgb(p: LabPt): RGB {
  const c = toRgb({ mode: "lab", l: p.l, a: p.a, b: p.b });
  const to255 = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255);
  return { r: to255(c.r), g: to255(c.g), b: to255(c.b) };
}

export interface Layer {
  rgb: RGB;
  lab: LabPt;
  /** Fraction of the image (0-1) this colour covers. */
  coverage: number;
}

export interface Segmentation {
  layers: Layer[];
  /** Nearest layer index for an RGB pixel — for rendering the flat colour map. */
  assignRgb: (r: number, g: number, b: number) => number;
  /** Display RGB per layer, in the same index order returned by `layers`. */
  layerRgb: RGB[];
}

/**
 * Reduce an image to its `k` dominant colours ("layers") via k-means in CIELAB.
 * Returns the layers sorted by coverage, plus an assignment function so a flat
 * paint-by-numbers map can be rendered.
 */
export function segmentImage(data: ImageLike, k: number, opts: { maxSamples?: number } = {}): Segmentation {
  const maxSamples = opts.maxSamples ?? 6000;
  const { width, height, data: px } = data;
  const totalPx = width * height;
  const step = Math.max(1, Math.floor(Math.sqrt(totalPx / maxSamples)));

  const points: LabPt[] = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (px[i + 3] === 0) continue;
      points.push(rgb2lab(px[i], px[i + 1], px[i + 2]));
    }
  }

  const { centroids, counts } = kmeans(points, k);
  const total = counts.reduce((a, b) => a + b, 0) || 1;

  // Sort layers by coverage (most of the image first) but keep a stable map back
  // to the original centroid index for assignment.
  const order = centroids.map((_, i) => i).sort((a, b) => counts[b] - counts[a]);
  const layers: Layer[] = order.map((ci) => ({
    lab: centroids[ci],
    rgb: lab2rgb(centroids[ci]),
    coverage: counts[ci] / total,
  }));
  const sortedToOriginal = order; // layers[i] === centroids[order[i]]
  const originalToSorted = new Array(centroids.length);
  sortedToOriginal.forEach((ci, sorted) => (originalToSorted[ci] = sorted));

  const assignRgb = (r: number, g: number, b: number): number => {
    const p = rgb2lab(r, g, b);
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < centroids.length; c++) {
      const dl = p.l - centroids[c].l;
      const da = p.a - centroids[c].a;
      const db = p.b - centroids[c].b;
      const d = dl * dl + da * da + db * db;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return originalToSorted[best];
  };

  return { layers, assignRgb, layerRgb: layers.map((l) => l.rgb) };
}
