export interface LabPt {
  l: number;
  a: number;
  b: number;
}

function dist2(p: LabPt, q: LabPt): number {
  const dl = p.l - q.l;
  const da = p.a - q.a;
  const db = p.b - q.b;
  return dl * dl + da * da + db * db;
}

/**
 * k-means clustering in CIELAB (perceptually meaningful distance). Used to find
 * the handful of distinct colours that make up an image — the "layers" a painter
 * would block in. Deterministic given a seed so results are stable.
 */
export function kmeans(
  points: LabPt[],
  k: number,
  opts: { iterations?: number; seed?: number } = {},
): { centroids: LabPt[]; counts: number[]; assign: (p: LabPt) => number } {
  const iterations = opts.iterations ?? 16;
  const n = points.length;
  if (n === 0) return { centroids: [], counts: [], assign: () => 0 };
  k = Math.min(k, n);

  // Deterministic PRNG (mulberry32) so segmentation is reproducible.
  let s = (opts.seed ?? 1) >>> 0;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // k-means++ seeding for well-spread initial centroids.
  const centroids: LabPt[] = [{ ...points[Math.floor(rand() * n)] }];
  while (centroids.length < k) {
    const d2 = points.map((p) => Math.min(...centroids.map((c) => dist2(p, c))));
    const total = d2.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      r -= d2[i];
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    centroids.push({ ...points[idx] });
  }

  const labels = new Array(n).fill(0);
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    // Assign.
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = dist2(points[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (labels[i] !== best) {
        labels[i] = best;
        moved = true;
      }
    }
    // Update.
    const sums = centroids.map(() => ({ l: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < n; i++) {
      const s2 = sums[labels[i]];
      s2.l += points[i].l;
      s2.a += points[i].a;
      s2.b += points[i].b;
      s2.n++;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c].n > 0) {
        centroids[c] = { l: sums[c].l / sums[c].n, a: sums[c].a / sums[c].n, b: sums[c].b / sums[c].n };
      }
    }
    if (!moved && iter > 0) break;
  }

  const counts = centroids.map(() => 0);
  for (let i = 0; i < n; i++) counts[labels[i]]++;

  const assign = (p: LabPt): number => {
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < centroids.length; c++) {
      const d = dist2(p, centroids[c]);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  };

  return { centroids, counts, assign };
}
