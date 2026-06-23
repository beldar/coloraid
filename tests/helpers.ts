import type { ImageLike } from "@/lib/palette/wells";

/** Build an RGBA ImageLike from a per-pixel function returning [r,g,b] or [r,g,b,a]. */
export function makeImage(
  width: number,
  height: number,
  fn: (x: number, y: number) => number[],
): ImageLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = fn(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { width, height, data };
}
