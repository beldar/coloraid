"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { samplePatch, type RGB } from "@/lib/color/sampling";
import { segmentImage, type Layer } from "@/lib/segment/segment";

export interface SampleResult {
  rgb: RGB;
  variance: number;
}

interface Props {
  imageSrc: string;
  /** When true, show the flat colour-layer map and tap to identify a layer. */
  layersOn: boolean;
  /** Number of layers (k). */
  k: number;
  /** Layer index to spotlight (dims the rest), or null. */
  highlight: number | null;
  /** Exact colour read at a point (layers off). */
  onSample: (r: SampleResult) => void;
  /** A layer region was tapped (layers on). */
  onPickLayer: (index: number) => void;
  /** Fired after (re)segmentation so the parent can render the legend. */
  onSegmented: (layers: Layer[]) => void;
}

const SEG_MAX = 460; // working resolution for segmentation + display

type Seg = ReturnType<typeof segmentImage>;

/**
 * One canvas, two modes. "Read" samples the full-resolution pixels for an exact
 * colour. "Layers" segments a downscaled copy into flat colours, renders the
 * paint-by-numbers map, hit-tests a tap to a layer, and can spotlight one layer.
 * Display runs at the downscaled size (CSS-scaled); exact reads still use the
 * full-res buffer so accuracy doesn't depend on screen size.
 */
export default function StudioCanvas({
  imageSrc,
  layersOn,
  k,
  highlight,
  onSample,
  onPickLayer,
  onSegmented,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const fullRef = useRef<ImageData | null>(null);
  const baseRef = useRef<ImageData | null>(null);
  const posterRef = useRef<ImageData | null>(null);
  const labelsRef = useRef<Uint16Array | null>(null);
  const segRef = useRef<Seg | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [marker, setMarker] = useState<{ u: number; v: number } | null>(null);

  // Decode once: full-res buffer for reads, downscaled buffer for layers.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const full = document.createElement("canvas");
      full.width = img.naturalWidth;
      full.height = img.naturalHeight;
      const fctx = full.getContext("2d", { willReadFrequently: true });
      if (!fctx) return;
      fctx.drawImage(img, 0, 0);
      fullRef.current = fctx.getImageData(0, 0, full.width, full.height);

      const scale = Math.min(1, SEG_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      octx.drawImage(img, 0, 0, w, h);
      baseRef.current = octx.getImageData(0, 0, w, h);

      const c = canvasRef.current;
      if (c) {
        c.width = w;
        c.height = h;
      }
      segRef.current = null; // force re-segment
      setMarker(null);
      setLoaded((v) => v + 1);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // (Re)segment when needed and build the flat map + label buffer.
  const ensureSeg = useCallback(() => {
    const base = baseRef.current;
    if (!base) return null;
    if (segRef.current && labelsRef.current) return segRef.current;

    const seg = segmentImage(base, k);
    const { width, height, data: src } = base;
    const labels = new Uint16Array(width * height);
    const poster = new ImageData(width, height);
    const dst = poster.data;
    const cache = new Map<number, number>();
    for (let p = 0, i = 0; i < src.length; i += 4, p++) {
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      const key = (r << 16) | (g << 8) | b;
      let idx = cache.get(key);
      if (idx === undefined) {
        idx = seg.assignRgb(r, g, b);
        cache.set(key, idx);
      }
      labels[p] = idx;
      const col = seg.layerRgb[idx];
      dst[i] = col.r;
      dst[i + 1] = col.g;
      dst[i + 2] = col.b;
      dst[i + 3] = 255;
    }
    segRef.current = seg;
    labelsRef.current = labels;
    posterRef.current = poster;
    onSegmented(seg.layers);
    return seg;
  }, [k, onSegmented]);

  // Invalidate segmentation when k changes.
  useEffect(() => {
    segRef.current = null;
    labelsRef.current = null;
    if (layersOn) setLoaded((v) => v + 1);
  }, [k, layersOn]);

  // Paint the canvas for the current mode / highlight.
  useEffect(() => {
    const base = baseRef.current;
    const c = canvasRef.current;
    if (!base || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    if (!layersOn) {
      ctx.putImageData(base, 0, 0);
      return;
    }

    ensureSeg();
    const poster = posterRef.current;
    const labels = labelsRef.current;
    if (!poster || !labels) return;

    if (highlight == null) {
      ctx.putImageData(poster, 0, 0);
      return;
    }

    // Spotlight: keep the highlighted layer, dim everything else.
    const out = new ImageData(poster.width, poster.height);
    const s = poster.data;
    const d = out.data;
    for (let p = 0, i = 0; i < s.length; i += 4, p++) {
      const on = labels[p] === highlight;
      const f = on ? 1 : 0.22;
      d[i] = s[i] * f;
      d[i + 1] = s[i + 1] * f;
      d[i + 2] = s[i + 2] * f;
      d[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }, [loaded, layersOn, highlight, ensureSeg]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const start = pointerStart.current;
      pointerStart.current = null;
      if (!start) return;
      // If pointer moved > 8px, treat as a scroll — don't sample.
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dx * dx + dy * dy > 64) return;

      const c = canvasRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const u = (e.clientX - rect.left) / rect.width;
      const v = (e.clientY - rect.top) / rect.height;
      if (u < 0 || u > 1 || v < 0 || v > 1) return;

      if (layersOn) {
        const labels = labelsRef.current;
        const base = baseRef.current;
        if (!labels || !base) return;
        const x = Math.min(base.width - 1, Math.floor(u * base.width));
        const y = Math.min(base.height - 1, Math.floor(v * base.height));
        onPickLayer(labels[y * base.width + x]);
        setMarker({ u, v });
        return;
      }

      const full = fullRef.current;
      if (!full) return;
      const px = u * full.width;
      const py = v * full.height;
      const radius = Math.max(3, Math.round(Math.min(full.width, full.height) / 250));
      const { rgb, variance } = samplePatch(full, px, py, radius);
      setMarker({ u, v });
      onSample({ rgb, variance });
    },
    [layersOn, onSample, onPickLayer],
  );

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        aria-label={
          layersOn
            ? "Colour-layer map. Tap a region to identify its layer."
            : "Photo. Tap any point to read its colour."
        }
        role="img"
      />
      {marker && (
        <span
          className="tap-marker"
          aria-hidden
          style={{ left: `${marker.u * 100}%`, top: `${marker.v * 100}%` }}
        />
      )}
    </div>
  );
}
