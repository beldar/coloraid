export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

/**
 * Average the pixels in a square patch centered on (cx, cy).
 *
 * We sample a patch rather than a single pixel because:
 *  - JPEG compression introduces per-pixel color noise,
 *  - a single pixel can land on a stray highlight/speck,
 *  - a painter cares about the local *area* color, not one dot.
 *
 * Returns the mean RGB plus a measure of how varied the patch was, so the UI
 * can warn when the user tapped across a color boundary (high variance =
 * "you're on an edge, the reading mixes two colors").
 */
export function samplePatch(
  data: ImageData,
  cx: number,
  cy: number,
  radius = 4,
): { rgb: RGB; variance: number; count: number } {
  const { width, height, data: px } = data;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;

  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));

  // First pass: mean. Skip fully transparent pixels.
  const samples: RGB[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * 4;
      const a = px[i + 3];
      if (a === 0) continue;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      sr += r;
      sg += g;
      sb += b;
      samples.push({ r, g, b });
      n++;
    }
  }

  if (n === 0) {
    return { rgb: { r: 0, g: 0, b: 0 }, variance: 0, count: 0 };
  }

  const mean: RGB = { r: sr / n, g: sg / n, b: sb / n };

  // Second pass: mean squared distance from the mean, in plain RGB.
  // This is a cheap "are we on an edge?" signal, not a perceptual metric.
  let varSum = 0;
  for (const s of samples) {
    const dr = s.r - mean.r;
    const dg = s.g - mean.g;
    const db = s.b - mean.b;
    varSum += dr * dr + dg * dg + db * db;
  }

  return {
    rgb: { r: Math.round(mean.r), g: Math.round(mean.g), b: Math.round(mean.b) },
    variance: varSum / n,
    count: n,
  };
}
