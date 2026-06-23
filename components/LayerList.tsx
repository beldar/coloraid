"use client";

import { useMemo } from "react";
import { describeColor } from "@/lib/color/describe";
import { suggestMixes } from "@/lib/mix/suggest";
import type { Layer } from "@/lib/segment/segment";
import type { Paint } from "@/lib/palette/types";
import type { CalibrationSample } from "@/lib/mix/types";

interface Props {
  layers: Layer[];
  palette: Paint[];
  samples: CalibrationSample[];
  highlight: number | null;
  onHighlight: (index: number | null) => void;
}

/**
 * The legend for the layer map: one card per colour layer with its name,
 * coverage, plain-language description and (if a palette exists) a mix recipe.
 * Tapping a card spotlights that layer on the image; the active card is driven
 * by whatever region was last tapped, so the image and list stay in sync.
 */
export default function LayerList({ layers, palette, samples, highlight, onHighlight }: Props) {
  const rows = useMemo(
    () =>
      layers.map((layer) => {
        const desc = describeColor(layer.rgb);
        const mix = palette.length
          ? suggestMixes(desc.lab, palette, samples, { topK: 1 })[0]
          : undefined;
        return { desc, mix, coverage: layer.coverage };
      }),
    [layers, palette, samples],
  );

  return (
    <ul className="layer-list" role="list">
      {rows.map((row, i) => {
        const active = highlight === i;
        return (
          <li key={i}>
            <button
              type="button"
              className={`layer-card${active ? " active" : ""}`}
              aria-pressed={active}
              onClick={() => onHighlight(active ? null : i)}
            >
              <span
                className="layer-chip"
                style={{ background: row.desc.hex }}
                aria-hidden
              />
              <span className="layer-body">
                <span className="layer-head">
                  <span className="layer-name">{row.desc.nearestName}</span>
                  <span className="layer-cov">{Math.round(row.coverage * 100)}%</span>
                </span>
                <span className="layer-desc">{row.desc.sentence}</span>
                {row.mix && (
                  <span className="layer-mix">
                    <strong>Mix:</strong> {row.mix.text}{" "}
                    <span className="mix-de">ΔE {row.mix.deltaE.toFixed(1)}</span>
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
