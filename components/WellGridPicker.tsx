"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RGB } from "@/lib/color/sampling";
import {
  bilerp,
  cellQuad,
  detectColorfulBounds,
  detectWellGrid,
  sampleQuadColor,
  type ImageLike,
  type Pt,
  type Quad,
} from "@/lib/palette/wells";

export interface DetectedWell {
  rgb: RGB;
}

interface Props {
  imageSrc: string;
  rows: number;
  cols: number;
  onWells: (wells: DetectedWell[]) => void;
}

type Corner = "tl" | "tr" | "br" | "bl";
type DragType = Corner | "move";

const DEFAULT_QUAD: Quad = {
  tl: { x: 0.15, y: 0.6 },
  tr: { x: 0.85, y: 0.6 },
  br: { x: 0.85, y: 0.95 },
  bl: { x: 0.15, y: 0.95 },
};

/**
 * Palette photo with a draggable 4-corner grid. The user drags the corners to
 * frame the wells — a quad (not a rectangle) so it fits photos taken at an angle.
 * Each cell is sampled with perspective-aware bilinear interpolation, taking the
 * dark hue and discarding glare. Auto-fits on load so it's usually close.
 */
export default function WellGridPicker({ imageSrc, rows, cols, onWells }: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const imageDataRef = useRef<ImageLike | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [quad, setQuad] = useState<Quad>(DEFAULT_QUAD);
  const drag = useRef<{ type: DragType; startX: number; startY: number; start: Quad } | null>(null);

  // Load image; cache full-res pixels.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const off = document.createElement("canvas");
      off.width = img.naturalWidth;
      off.height = img.naturalHeight;
      const ctx = off.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      imageDataRef.current = ctx.getImageData(0, 0, off.width, off.height);
      const disp = displayRef.current;
      if (disp) {
        disp.width = img.naturalWidth;
        disp.height = img.naturalHeight;
        disp.getContext("2d")?.drawImage(img, 0, 0);
      }
      setLoaded((v) => v + 1);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Auto-fit on load: frame the saturated wells region (lower half). The user
  // then nudges the corners to match the photo's perspective.
  useEffect(() => {
    const data = imageDataRef.current;
    if (!data) return;
    const bounds =
      detectWellGrid(data, rows, cols, { bandTop: 0.5 }) ??
      detectColorfulBounds(data, { minChroma: 55, bandTop: 0.5 });
    if (!bounds) return;
    const padX = bounds.w * 0.05;
    const padY = bounds.h * 0.05;
    const x0 = Math.max(0, bounds.x - padX) / data.width;
    const y0 = Math.max(0, bounds.y - padY) / data.height;
    const x1 = Math.min(data.width, bounds.x + bounds.w + padX) / data.width;
    const y1 = Math.min(data.height, bounds.y + bounds.h + padY) / data.height;
    setQuad({ tl: { x: x0, y: y0 }, tr: { x: x1, y: y0 }, br: { x: x1, y: y1 }, bl: { x: x0, y: y1 } });
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sample every well whenever the quad or grid changes.
  useEffect(() => {
    const data = imageDataRef.current;
    if (!data) return;
    const imgQuad: Quad = {
      tl: { x: quad.tl.x * data.width, y: quad.tl.y * data.height },
      tr: { x: quad.tr.x * data.width, y: quad.tr.y * data.height },
      br: { x: quad.br.x * data.width, y: quad.br.y * data.height },
      bl: { x: quad.bl.x * data.width, y: quad.bl.y * data.height },
    };
    const wells: DetectedWell[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        wells.push({ rgb: sampleQuadColor(data, cellQuad(imgQuad, r, c, rows, cols)).rgb });
      }
    }
    onWells(wells);
  }, [quad, rows, cols, loaded, onWells]);

  const onDown = useCallback(
    (type: DragType) => (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      drag.current = { type, startX: e.clientX, startY: e.clientY, start: quad };
    },
    [quad],
  );

  const onMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    const disp = displayRef.current;
    if (!d || !disp) return;
    const rect = disp.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const move = (p: Pt): Pt => ({ x: clamp(p.x + dx), y: clamp(p.y + dy) });
    if (d.type === "move") {
      setQuad({ tl: move(d.start.tl), tr: move(d.start.tr), br: move(d.start.br), bl: move(d.start.bl) });
    } else {
      setQuad({ ...d.start, [d.type]: move(d.start[d.type]) });
    }
  }, []);

  const onUp = useCallback(() => {
    drag.current = null;
  }, []);

  // Grid line endpoints in normalized space (straight segments under bilerp).
  const vLines = Array.from({ length: cols + 1 }, (_, c) => {
    const u = c / cols;
    return [bilerp(quad, u, 0), bilerp(quad, u, 1)];
  });
  const hLines = Array.from({ length: rows + 1 }, (_, r) => {
    const v = r / rows;
    return [bilerp(quad, 0, v), bilerp(quad, 1, v)];
  });
  const corners: { key: Corner; p: Pt }[] = [
    { key: "tl", p: quad.tl },
    { key: "tr", p: quad.tr },
    { key: "br", p: quad.br },
    { key: "bl", p: quad.bl },
  ];

  return (
    <div className="canvas-wrap" onPointerMove={onMove} onPointerUp={onUp}>
      <canvas ref={displayRef} aria-label="Palette photo with adjustable well grid" role="img" />
      <svg className="grid-svg" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
        <polygon
          points={`${quad.tl.x},${quad.tl.y} ${quad.tr.x},${quad.tr.y} ${quad.br.x},${quad.br.y} ${quad.bl.x},${quad.bl.y}`}
          fill="rgba(110,168,254,0.08)"
          stroke="none"
          style={{ pointerEvents: "auto", cursor: "move" }}
          onPointerDown={onDown("move")}
        />
        {[...vLines, ...hLines].map(([a, b], i) => (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--accent)" strokeWidth={1.5}
            vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {corners.map(({ key, p }) => (
        <span
          key={key}
          className="grid-handle"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          onPointerDown={onDown(key)}
          aria-hidden
        />
      ))}
    </div>
  );
}
