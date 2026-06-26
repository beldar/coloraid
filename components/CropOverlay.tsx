"use client";

import { useCallback, useRef, useState } from "react";

interface Rect { x: number; y: number; w: number; h: number }
type Handle = "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br";

const HANDLES: { id: Handle; top: string; left: string; cursor: string }[] = [
  { id: "tl", top: "0%",   left: "0%",   cursor: "nwse-resize" },
  { id: "tc", top: "0%",   left: "50%",  cursor: "ns-resize"   },
  { id: "tr", top: "0%",   left: "100%", cursor: "nesw-resize" },
  { id: "ml", top: "50%",  left: "0%",   cursor: "ew-resize"   },
  { id: "mr", top: "50%",  left: "100%", cursor: "ew-resize"   },
  { id: "bl", top: "100%", left: "0%",   cursor: "nesw-resize" },
  { id: "bc", top: "100%", left: "50%",  cursor: "ns-resize"   },
  { id: "br", top: "100%", left: "100%", cursor: "nwse-resize" },
];

const MIN = 0.04;
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function applyHandle(c: Rect, handle: Handle | "move", dx: number, dy: number): Rect {
  let { x, y, w, h } = c;
  const r = x + w, b = y + h;
  if (handle === "move") return { x: clamp(x + dx, 0, 1 - w), y: clamp(y + dy, 0, 1 - h), w, h };
  if (handle.includes("l")) { const nx = clamp(x + dx, 0, r - MIN); w = r - nx; x = nx; }
  if (handle.includes("r")) { w = clamp(r + dx, x + MIN, 1) - x; }
  if (handle.includes("t")) { const ny = clamp(y + dy, 0, b - MIN); h = b - ny; y = ny; }
  if (handle.includes("b")) { h = clamp(b + dy, y + MIN, 1) - y; }
  return { x, y, w, h };
}

interface Props {
  onApply: (crop: Rect) => void;
  onCancel: () => void;
}

export default function CropOverlay({ onApply, onCancel }: Props) {
  const [crop, setCrop] = useState<Rect>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const dragRef = useRef<{ handle: Handle | "move"; sx: number; sy: number; sc: Rect; cW: number; cH: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const beginDrag = useCallback((e: React.PointerEvent, handle: Handle | "move") => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    container.setPointerCapture(e.pointerId);
    dragRef.current = { handle, sx: e.clientX, sy: e.clientY, sc: crop, cW: rect.width, cH: rect.height };
  }, [crop]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / d.cW;
    const dy = (e.clientY - d.sy) / d.cH;
    setCrop(applyHandle(d.sc, d.handle, dx, dy));
  }, []);

  const p = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <div
      ref={containerRef}
      className="crop-overlay"
      onPointerMove={onPointerMove}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
    >
      {/* Crop box — box-shadow darkens everything outside it */}
      <div
        className="crop-box"
        style={{ left: p(crop.x), top: p(crop.y), width: p(crop.w), height: p(crop.h) }}
        onPointerDown={(e) => beginDrag(e, "move")}
      >
        {HANDLES.map((h) => (
          <div
            key={h.id}
            className="crop-handle"
            style={{ top: h.top, left: h.left, cursor: h.cursor }}
            onPointerDown={(e) => beginDrag(e, h.id)}
          />
        ))}
      </div>

      {/* Action bar */}
      <div className="crop-actions">
        <button className="ghost-btn" onClick={onCancel}>Cancel</button>
        <button className="ghost-btn crop-apply-btn" onClick={() => onApply(crop)}>Apply crop</button>
      </div>
    </div>
  );
}
