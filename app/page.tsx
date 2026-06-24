"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StudioCanvas, { type SampleResult } from "@/components/StudioCanvas";
import ColorReadout from "@/components/ColorReadout";
import LayerList from "@/components/LayerList";
import Dropzone from "@/components/Dropzone";
import Nav from "@/components/Nav";
import { useImageLibrary } from "@/hooks/useImageLibrary";
import { usePalette } from "@/lib/palette/storage";
import { useCalibrations } from "@/lib/mix/calibration";
import { describeColor } from "@/lib/color/describe";
import type { Layer } from "@/lib/segment/segment";
import type { Paint } from "@/lib/palette/types";

export default function Studio() {
  const { items, imageSrc, currentId, loadFile, openId, remove, reset } = useImageLibrary();
  const { paints } = usePalette();
  const { samples } = useCalibrations();

  const [layersOn, setLayersOn] = useState(false);
  const [k, setK] = useState(6);
  const [sample, setSample] = useState<SampleResult | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [highlight, setHighlight] = useState<number | null>(null);

  const onSegmented = useCallback((l: Layer[]) => setLayers(l), []);

  function toggleLayers() {
    setLayersOn((on) => {
      const next = !on;
      if (next) setSample(null);
      else setHighlight(null);
      return next;
    });
  }

  function pickLayerFromList(i: number | null) {
    setLayersOn(true);
    setHighlight(i);
  }

  function newPhoto() {
    reset();
    setSample(null);
    setHighlight(null);
    setLayersOn(false);
  }

  return (
    <main className="studio">
      <header className="topbar">
        <div>
          <h1 className="wordmark">Coloraid</h1>
          <p className="tagline">Read a photo&rsquo;s colours · mix them from your paints</p>
        </div>
      </header>

      <GalleryStrip
        items={items}
        currentId={currentId}
        onOpen={openId}
        onAdd={loadFile}
        onRemove={remove}
      />

      {!imageSrc ? (
        <Dropzone
          onFile={loadFile}
          title="Add a photo to begin"
          hint="It saves to your library on this device — come back to it any time."
        />
      ) : (
        <>
          <div className="studio-toolbar">
            <button
              type="button"
              className={`toggle${layersOn ? " on" : ""}`}
              role="switch"
              aria-checked={layersOn}
              onClick={toggleLayers}
            >
              <span className="toggle-track" aria-hidden>
                <span className="toggle-thumb" />
              </span>
              Colour layers
            </button>

            {layersOn && (
              <label className="layers-k">
                <span className="k-label">{layers.length || k} layers</span>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={k}
                  onChange={(e) => setK(Number(e.target.value))}
                  aria-label="Number of colour layers"
                />
              </label>
            )}

            <button className="ghost-btn" onClick={newPhoto}>
              Close
            </button>
          </div>

          <StudioCanvas
            imageSrc={imageSrc}
            layersOn={layersOn}
            k={k}
            highlight={highlight}
            onSample={setSample}
            onPickLayer={(i) => setHighlight(i)}
            onSegmented={onSegmented}
          />

          {layersOn ? (
            <>
              <p className="hint">
                Tap a region on the photo to spotlight it, or tap a layer below.
              </p>
              <LayerList
                layers={layers}
                palette={paints}
                samples={samples}
                highlight={highlight}
                onHighlight={pickLayerFromList}
              />
            </>
          ) : (
            <p className="hint">{sample ? "Tap the photo to pick a different colour." : "Tap anywhere on the photo to read its colour."}</p>
          )}
        </>
      )}

      {!layersOn && <ColorSheet sample={sample} palette={paints} />}
      <Nav />
    </main>
  );
}

/* ---------- Sticky bottom colour sheet ---------- */

function ColorSheet({ sample, palette }: { sample: SampleResult | null; palette: Paint[] }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (sample) setExpanded(false); // collapse on every new tap
  }, [sample]);

  const desc = useMemo(() => (sample ? describeColor(sample.rgb) : null), [sample]);

  const cls = `color-sheet${!sample ? "" : expanded ? " expanded" : " peeking"}`;

  return (
    <div className={cls} aria-live="polite">
      <button
        className="color-sheet-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse colour info" : "Expand colour info"}
      >
        <div className="color-sheet-handle-row" aria-hidden>
          <span className="color-sheet-drag" />
        </div>
        {desc && (
          <div className="color-sheet-peek-row">
            <span className="swatch sm" style={{ background: desc.hex }} aria-hidden />
            <p className="color-sheet-sentence">{desc.sentence}</p>
            <span className="color-sheet-chevron" aria-hidden>{expanded ? "▾" : "▴"}</span>
          </div>
        )}
      </button>
      {sample && expanded && (
        <div className="color-sheet-body">
          <ColorReadout rgb={sample.rgb} variance={sample.variance} palette={palette} />
        </div>
      )}
    </div>
  );
}

/* ---------- Image gallery strip ---------- */

function GalleryStrip({
  items,
  currentId,
  onOpen,
  onAdd,
  onRemove,
}: {
  items: { id: string; name: string; thumb: string }[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onAdd: (file: File | undefined) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="gallery" role="list" aria-label="Your photos">
      <label className="gallery-add" role="listitem">
        <span aria-hidden>＋</span>
        <span className="gallery-add-label">Add</span>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => onAdd(e.target.files?.[0])}
        />
      </label>
      {items.map((it) => (
        <div
          key={it.id}
          role="listitem"
          className={`gallery-item${currentId === it.id ? " active" : ""}`}
        >
          <button
            type="button"
            className="gallery-thumb"
            style={{ backgroundImage: `url(${it.thumb})` }}
            onClick={() => onOpen(it.id)}
            aria-label={`Open ${it.name}`}
            title={it.name}
          />
          <button
            type="button"
            className="gallery-del"
            onClick={() => onRemove(it.id)}
            aria-label={`Delete ${it.name}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
