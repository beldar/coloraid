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
type Edge = "top" | "bottom" | "left" | "right";
type DragType = Corner | Edge | "move";

const DEFAULT_QUAD: Quad = {
  tl: { x: 0.15, y: 0.6 },
  tr: { x: 0.85, y: 0.6 },
  br: { x: 0.85, y: 0.95 },
  bl: { x: 0.15, y: 0.95 },
};

/**
 * Palette photo with a draggable grid overlay.
 *
 * Controls:
 *  - 4 corner handles: drag to adjust perspective / individual corners
 *  - 4 edge midpoint handles: drag to slide a full edge (top/bottom = vertical
 *    only, left/right = horizontal only) — much easier on mobile
 *  - Tapping inside the quad moves the whole grid
 *  - Live color preview rendered in each cell so alignment feedback is instant
 */
export default function WellGridPicker({ imageSrc, rows, cols, onWells }: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const imageDataRef = useRef<ImageLike | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [quad, setQuad] = useState<Quad>(DEFAULT_QUAD);
  const [wells, setWells] = useState<DetectedWell[]>([]);
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

  // Auto-fit on load.
  useEffect(() => {
    const data = imageDataRef.current;
    if (!data) return;
    const wgResult = detectWellGrid(data, rows, cols, { bandTop: 0.5 });
    const bounds = wgResult ?? detectColorfulBounds(data, { minChroma: 55, bandTop: 0.5 });
    // Reject degenerate detection (tiny cluster → all handles collapse to one point).
    if (!bounds || bounds.w < data.width * 0.08 || bounds.h < data.height * 0.04) return;
    const padX = bounds.w * 0.05;
    const padY = bounds.h * 0.05;
    const x0 = Math.max(0, bounds.x - padX) / data.width;
    const y0 = Math.max(0, bounds.y - padY) / data.height;
    const x1 = Math.min(data.width, bounds.x + bounds.w + padX) / data.width;
    const y1 = Math.min(data.height, bounds.y + bounds.h + padY) / data.height;
    setQuad({ tl: { x: x0, y: y0 }, tr: { x: x1, y: y0 }, br: { x: x1, y: y1 }, bl: { x: x0, y: y1 } });
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sample every well whenever the quad or grid changes; also store locally for preview.
  useEffect(() => {
    const data = imageDataRef.current;
    if (!data) return;
    const imgQuad: Quad = {
      tl: { x: quad.tl.x * data.width, y: quad.tl.y * data.height },
      tr: { x: quad.tr.x * data.width, y: quad.tr.y * data.height },
      br: { x: quad.br.x * data.width, y: quad.br.y * data.height },
      bl: { x: quad.bl.x * data.width, y: quad.bl.y * data.height },
    };
    const result: DetectedWell[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push({ rgb: sampleQuadColor(data, cellQuad(imgQuad, r, c, rows, cols)).rgb });
      }
    }
    setWells(result);
    onWells(result);
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
    const moveXY = (p: Pt): Pt => ({ x: clamp(p.x + dx), y: clamp(p.y + dy) });
    const moveX = (p: Pt): Pt => ({ x: clamp(p.x + dx), y: p.y });
    const moveY = (p: Pt): Pt => ({ x: p.x, y: clamp(p.y + dy) });

    const q = d.start;
    switch (d.type) {
      case "move":
        setQuad({ tl: moveXY(q.tl), tr: moveXY(q.tr), br: moveXY(q.br), bl: moveXY(q.bl) });
        break;
      case "tl": setQuad({ ...q, tl: moveXY(q.tl) }); break;
      case "tr": setQuad({ ...q, tr: moveXY(q.tr) }); break;
      case "br": setQuad({ ...q, br: moveXY(q.br) }); break;
      case "bl": setQuad({ ...q, bl: moveXY(q.bl) }); break;
      // Edge handles: slide the full edge (constrained to one axis)
      case "top":    setQuad({ ...q, tl: moveY(q.tl), tr: moveY(q.tr) }); break;
      case "bottom": setQuad({ ...q, bl: moveY(q.bl), br: moveY(q.br) }); break;
      case "left":   setQuad({ ...q, tl: moveX(q.tl), bl: moveX(q.bl) }); break;
      case "right":  setQuad({ ...q, tr: moveX(q.tr), br: moveX(q.br) }); break;
    }
  }, []);

  const onUp = useCallback(() => { drag.current = null; }, []);

  // Grid lines in normalized space.
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

  // Edge midpoint handles (normalized coords).
  const edgeMids: { key: Edge; p: Pt; axis: "h" | "v" }[] = [
    { key: "top",    p: bilerp(quad, 0.5, 0),   axis: "v" },
    { key: "bottom", p: bilerp(quad, 0.5, 1),   axis: "v" },
    { key: "left",   p: bilerp(quad, 0,   0.5), axis: "h" },
    { key: "right",  p: bilerp(quad, 1,   0.5), axis: "h" },
  ];

  // Cell center points and colors for the live preview overlay.
  const cellPreviews = wells.map((w, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const cellCenter = bilerp(quad, (c + 0.5) / cols, (r + 0.5) / rows);
    return { cellCenter, rgb: w.rgb };
  });

  return (
    <div className="canvas-wrap" style={{ touchAction: "none" }} onPointerMove={onMove} onPointerUp={onUp}>
      <canvas ref={displayRef} aria-label="Palette photo with adjustable well grid" role="img" />
      <svg className="grid-svg" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
        {/* Draggable interior polygon */}
        <polygon
          points={`${quad.tl.x},${quad.tl.y} ${quad.tr.x},${quad.tr.y} ${quad.br.x},${quad.br.y} ${quad.bl.x},${quad.bl.y}`}
          fill="rgba(110,168,254,0.08)"
          stroke="none"
          style={{ pointerEvents: "auto", cursor: "move" }}
          onPointerDown={onDown("move")}
        />
        {/* Grid lines */}
        {[...vLines, ...hLines].map(([a, b], i) => (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        ))}
        {/* Live color previews — tiny swatch in each cell center */}
        {cellPreviews.map(({ cellCenter, rgb }, i) => (
          <rect
            key={`prev-${i}`}
            x={cellCenter.x - 0.022}
            y={cellCenter.y - 0.022}
            width={0.044}
            height={0.044}
            fill={`rgb(${rgb.r},${rgb.g},${rgb.b})`}
            stroke="rgba(0,0,0,0.4)"
            strokeWidth={0.003}
            rx={0.006}
            style={{ pointerEvents: "none" }}
          />
        ))}
      </svg>
      {/* Corner handles */}
      {corners.map(({ key, p }) => (
        <span
          key={key}
          className="grid-handle grid-handle-corner"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          onPointerDown={onDown(key)}
          aria-hidden
        />
      ))}
      {/* Edge midpoint handles */}
      {edgeMids.map(({ key, p, axis }) => (
        <span
          key={key}
          className={`grid-handle grid-handle-edge grid-handle-edge-${axis}`}
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          onPointerDown={onDown(key)}
          aria-hidden
        />
      ))}
    </div>
  );
}
