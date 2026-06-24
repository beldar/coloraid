"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { samplePatch, type RGB } from "@/lib/color/sampling";

export interface SampleResult {
  rgb: RGB;
  variance: number;
  /** Where the tap landed, in displayed-canvas CSS pixels, for the marker. */
  markerX: number;
  markerY: number;
}

interface Props {
  imageSrc: string;
  onSample: (result: SampleResult) => void;
}

/**
 * Draws the chosen image and lets the user tap anywhere to sample the color.
 *
 * Two canvases are involved:
 *  - a hidden full-resolution canvas holding the original pixels (we sample
 *    from this so accuracy doesn't depend on display size),
 *  - the visible canvas, scaled to fit the screen, where we draw the image and
 *    a marker at the tapped point.
 */
export default function ImageCanvas({ imageSrc, onSample }: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const fullRef = useRef<HTMLCanvasElement | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);

  // Load image into both canvases whenever the source changes.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      // Hidden full-res canvas + cached ImageData for fast repeated sampling.
      const full = document.createElement("canvas");
      full.width = img.naturalWidth;
      full.height = img.naturalHeight;
      const fctx = full.getContext("2d", { willReadFrequently: true });
      if (!fctx) return;
      fctx.drawImage(img, 0, 0);
      fullRef.current = full;
      imageDataRef.current = fctx.getImageData(0, 0, full.width, full.height);

      // Visible canvas: same intrinsic size, CSS scales it down responsively.
      const disp = displayRef.current;
      if (!disp) return;
      disp.width = img.naturalWidth;
      disp.height = img.naturalHeight;
      const dctx = disp.getContext("2d");
      dctx?.drawImage(img, 0, 0);
      setMarker(null);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const start = pointerStart.current;
      pointerStart.current = null;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dx * dx + dy * dy > 64) return; // scroll gesture, ignore

      const disp = displayRef.current;
      const imageData = imageDataRef.current;
      if (!disp || !imageData) return;

      const rect = disp.getBoundingClientRect();
      const scaleX = disp.width / rect.width;
      const scaleY = disp.height / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;
      const radius = Math.max(3, Math.round(Math.min(disp.width, disp.height) / 250));
      const { rgb, variance } = samplePatch(imageData, px, py, radius);

      const markerX = e.clientX - rect.left;
      const markerY = e.clientY - rect.top;
      setMarker({ x: markerX, y: markerY });
      onSample({ rgb, variance, markerX, markerY });
    },
    [onSample],
  );

  return (
    <div className="canvas-wrap">
      <canvas
        ref={displayRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        aria-label="Loaded image. Tap anywhere to read the color at that point."
        role="img"
      />
      {marker && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: marker.x,
            top: marker.y,
            width: 18,
            height: 18,
            marginLeft: -9,
            marginTop: -9,
            borderRadius: "50%",
            border: "2px solid #fff",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.6)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
