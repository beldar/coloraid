"use client";

import { useMemo } from "react";
import { describeColor } from "@/lib/color/describe";
import type { RGB } from "@/lib/color/sampling";
import { nearestPaints } from "@/lib/palette/storage";
import type { Paint } from "@/lib/palette/types";
import { suggestMixes } from "@/lib/mix/suggest";
import { labToHex } from "@/lib/mix/km";
import { useCalibrations } from "@/lib/mix/calibration";

interface Props {
  rgb: RGB;
  variance: number;
  palette?: Paint[];
}

// Above this RGB patch variance we assume the tap straddled a color boundary.
const EDGE_VARIANCE = 900; // ~30 levels std dev per channel

// CIEDE2000 rule of thumb: <2 imperceptible, ~2-10 close, >10 clearly different.
function closenessWord(d: number): string {
  if (d < 4) return "a very close match";
  if (d < 10) return "close";
  if (d < 20) return "in the ballpark";
  return "the nearest you have, but not close";
}

export default function ColorReadout({ rgb, variance, palette = [] }: Props) {
  const { samples } = useCalibrations();
  const desc = useMemo(() => describeColor(rgb), [rgb]);
  const matches = useMemo(
    () => nearestPaints(desc.lab, palette, 2),
    [desc.lab, palette],
  );
  const mixes = useMemo(
    () => (palette.length ? suggestMixes(desc.lab, palette, samples, { topK: 2 }) : []),
    [desc.lab, palette, samples],
  );
  const onEdge = variance > EDGE_VARIANCE;

  return (
    <div className="readout" aria-live="polite">
      <div className="readout-top">
        <span
          className="swatch"
          style={{ background: desc.hex }}
          aria-hidden
        />
        <p className="readout-sentence">{desc.sentence}</p>
      </div>

      {onEdge && (
        <div className="edge-warning" role="status">
          <span aria-hidden>⚠</span>
          <span>
            This spot mixes more than one color — you may be on an edge. Tap the
            middle of a single area for a cleaner reading.
          </span>
        </div>
      )}

      {palette.length > 0 && matches.length > 0 && (
        <div className="palette-match">
          <span className="k">From your palette</span>
          <p className="match-lead">
            Closest paint: <strong>{matches[0].paint.name}</strong> —{" "}
            {closenessWord(matches[0].deltaE)} (ΔE {matches[0].deltaE.toFixed(1)}).
          </p>
          {matches[1] && (
            <p className="hint" style={{ margin: 0 }}>
              Next closest: {matches[1].paint.name} (ΔE{" "}
              {matches[1].deltaE.toFixed(1)}).
            </p>
          )}
        </div>
      )}

      {mixes.length > 0 && (
        <div className="mix-suggest">
          <span className="k">How to mix it</span>
          {mixes.map((m, i) => (
            <div className="mix-row" key={i}>
              <span
                className="swatch sm"
                style={{ background: labToHex(m.prediction.lab) }}
                aria-hidden
              />
              <span className="mix-text">
                {m.text}
                {m.prediction.calibrated && (
                  <span className="badge" title="Adjusted using your painted swatches">
                    calibrated
                  </span>
                )}
              </span>
              <span className="mix-de">ΔE {m.deltaE.toFixed(1)}</span>
            </div>
          ))}
          <p className="hint" style={{ margin: "0.4rem 0 0" }}>
            Pigments set the hue; the wash strength sets how light it is. Lower ΔE
            = closer. Paint one and calibrate to sharpen these.
          </p>
        </div>
      )}

      <div className="attrs">
        <div className="attr">
          <span className="k">Nearest name</span>
          <span className="v">{desc.nearestName}</span>
        </div>
        <div className="attr">
          <span className="k">Hue family</span>
          <span className="v">{desc.hueFamily}</span>
        </div>
        <div className="attr">
          <span className="k">Lightness</span>
          <span className="v">{desc.lightnessWord}</span>
        </div>
        <div className="attr">
          <span className="k">Saturation</span>
          <span className="v">{desc.chromaWord}</span>
        </div>
        <div className="attr">
          <span className="k">Temperature</span>
          <span className="v">{desc.warmthWord}</span>
        </div>
      </div>

      <div className="codes">
        <span>HEX {desc.hex}</span>
        <span>
          RGB {desc.rgb.r}, {desc.rgb.g}, {desc.rgb.b}
        </span>
        <span>
          LAB {desc.lab.l.toFixed(0)}, {desc.lab.a.toFixed(0)},{" "}
          {desc.lab.b.toFixed(0)}
        </span>
        <span>
          LCh {desc.lch.l.toFixed(0)}, {desc.lch.c.toFixed(0)},{" "}
          {desc.lch.h.toFixed(0)}°
        </span>
      </div>
    </div>
  );
}
