"use client";

import { useEffect, useRef, useState } from "react";
import { segmentImage, type Layer } from "@/lib/segment/segment";

interface Props {
  imageSrc: string;
  k: number;
  showOriginal: boolean;
  onLayers: (layers: Layer[]) => void;
}

const MAX_DIM = 460; // working resolution for clustering + flat-map render

/**
 * Renders an image reduced to `k` flat colour "layers" — a paint-by-numbers map
 * showing where one colour ends and another begins. Works on a downscaled buffer
 * for speed; the legend (names + recipes) is built by the parent from onLayers.
 */
export default function LayerMap({ imageSrc, k, showOriginal, onLayers }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<ImageData | null>(null);
  const [loaded, setLoaded] = useState(0);

  // Load + downscale the image once.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const ctx = off.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      baseRef.current = ctx.getImageData(0, 0, w, h);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = w;
        canvas.height = h;
      }
      setLoaded((v) => v + 1);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Segment + render whenever the image, k, or view mode changes.
  useEffect(() => {
    const base = baseRef.current;
    const canvas = canvasRef.current;
    if (!base || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const seg = segmentImage(base, k);
    onLayers(seg.layers);

    if (showOriginal) {
      ctx.putImageData(base, 0, 0);
      return;
    }

    const src = base.data;
    const out = new ImageData(base.width, base.height);
    const dst = out.data;
    const cache = new Map<number, number>(); // packed rgb -> layer index
    for (let i = 0; i < src.length; i += 4) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const key = (r << 16) | (g << 8) | b;
      let idx = cache.get(key);
      if (idx === undefined) {
        idx = seg.assignRgb(r, g, b);
        cache.set(key, idx);
      }
      const c = seg.layerRgb[idx];
      dst[i] = c.r;
      dst[i + 1] = c.g;
      dst[i + 2] = c.b;
      dst[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }, [loaded, k, showOriginal, onLayers]);

  return (
    <div className="canvas-wrap">
      <canvas ref={canvasRef} aria-label="Colour-layer map of the image" role="img" />
    </div>
  );
}
