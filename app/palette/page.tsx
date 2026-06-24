"use client";

import { useCallback, useMemo, useState } from "react";
import ImageCanvas, { type SampleResult } from "@/components/ImageCanvas";
import Dropzone from "@/components/Dropzone";
import Nav from "@/components/Nav";
import WellGridPicker, { type DetectedWell } from "@/components/WellGridPicker";
import { useImageFile } from "@/hooks/useImageFile";
import { usePalette } from "@/lib/palette/storage";
import { describeColor } from "@/lib/color/describe";
import { PALETTE_PRESETS, numberedNames } from "@/lib/palette/presets";
import { extractPaletteNames } from "@/lib/palette/ocr";

type Mode = "auto" | "manual";

export default function PalettePage() {
  const {
    paints,
    hydrated,
    addPaint,
    removePaint,
    palettes,
    activeId,
    selectPalette,
    createPalette,
    renamePalette,
    deletePalette,
  } = usePalette();
  const [mode, setMode] = useState<Mode>("auto");

  return (
    <main>
      <h1 className="wordmark">Palette</h1>
      <p className="tagline">The paints Coloraid mixes and matches against.</p>
      <Nav />

      {hydrated && (
        <div className="palette-bar">
          <div className="palette-tabs" role="tablist" aria-label="Your palettes">
            {palettes.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={p.id === activeId}
                className={`palette-tab${p.id === activeId ? " active" : ""}`}
                onClick={() => selectPalette(p.id)}
              >
                {p.name}
                <span className="palette-tab-n">{p.paints.length}</span>
              </button>
            ))}
            <button
              className="palette-tab add"
              onClick={() => {
                const name = window.prompt("Name this palette", `Palette ${palettes.length + 1}`);
                if (name !== null) createPalette(name);
              }}
            >
              ＋ New
            </button>
          </div>
          {palettes.length > 0 && (
            <div className="palette-bar-actions">
              <button
                className="ghost-btn"
                onClick={() => {
                  const cur = palettes.find((p) => p.id === activeId);
                  const name = window.prompt("Rename palette", cur?.name ?? "");
                  if (name) renamePalette(activeId, name);
                }}
              >
                Rename
              </button>
              <button
                className="ghost-btn"
                onClick={() => {
                  if (window.confirm("Delete this palette and its paints?")) deletePalette(activeId);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      <div className="chip-row" style={{ marginTop: "0.75rem" }}>
        <button className={`chip${mode === "auto" ? " active" : ""}`} onClick={() => setMode("auto")}>
          Auto from photo
        </button>
        <button className={`chip${mode === "manual" ? " active" : ""}`} onClick={() => setMode("manual")}>
          Tap one by one
        </button>
      </div>

      {mode === "auto" ? (
        <AutoImport onAdd={addPaint} />
      ) : (
        <ManualAdd onAdd={addPaint} />
      )}

      <section style={{ marginTop: "1.25rem" }}>
        <h2 className="section-title">Your paints {hydrated && `(${paints.length})`}</h2>
        {hydrated && paints.length === 0 && (
          <p className="hint">No paints yet. Add some above to start matching.</p>
        )}
        <ul className="paint-list">
          {paints.map((p) => (
            <li key={p.id} className="paint-item">
              <span className="swatch sm" style={{ background: `rgb(${p.rgb.r},${p.rgb.g},${p.rgb.b})` }} aria-hidden />
              <span className="paint-name">{p.name}</span>
              <span className="codes">
                RGB {p.rgb.r}, {p.rgb.g}, {p.rgb.b}
              </span>
              <button className="reset" onClick={() => removePaint(p.id)} aria-label={`Remove ${p.name}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

/* ---------- Auto-import from a palette photo ---------- */

type OcrStatus = "idle" | "loading" | "done" | "error";

function AutoImport({ onAdd }: { onAdd: (p: { name: string; rgb: SampleResult["rgb"]; lab: ReturnType<typeof describeColor>["lab"] }) => void }) {
  const { imageSrc, loadFile, reset } = useImageFile();
  const [presetId, setPresetId] = useState(PALETTE_PRESETS[0]?.id ?? "custom");
  const [rows, setRows] = useState(PALETTE_PRESETS[0]?.rows ?? 2);
  const [cols, setCols] = useState(PALETTE_PRESETS[0]?.cols ?? 6);
  const [wells, setWells] = useState<DetectedWell[]>([]);
  const [names, setNames] = useState<string[]>(PALETTE_PRESETS[0]?.names ?? []);
  const [added, setAdded] = useState(0);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrCount, setOcrCount] = useState(0);

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = PALETTE_PRESETS.find((p) => p.id === id);
    if (preset) {
      setRows(preset.rows);
      setCols(preset.cols);
      setNames(preset.names);
    } else {
      setNames(numberedNames(rows * cols));
    }
  }

  const handleWells = useCallback((w: DetectedWell[]) => setWells(w), []);

  function nameAt(i: number): string {
    return names[i] ?? `Color ${i + 1}`;
  }
  function setNameAt(i: number, v: string) {
    setNames((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push(`Color ${next.length + 1}`);
      next[i] = v;
      return next;
    });
  }

  async function readNamesFromPhoto() {
    if (!imageSrc || wells.length === 0) return;
    setOcrStatus("loading");
    setOcrError(null);
    try {
      // Label cell order = well order (left→right, top→bottom). Assign directly.
      const ocrNames = await extractPaletteNames(imageSrc, rows, cols);
      const newNames = [...names];
      let assigned = 0;
      ocrNames.forEach((name, i) => {
        if (i >= wells.length) return;
        while (newNames.length <= i) newNames.push(`Color ${newNames.length + 1}`);
        newNames[i] = name;
        assigned++;
      });
      setNames(newNames);
      setOcrCount(assigned);
      setOcrStatus("done");
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Unknown error");
      setOcrStatus("error");
    }
  }

  function addAll() {
    wells.forEach((w, i) => {
      onAdd({ name: nameAt(i).trim() || `Color ${i + 1}`, rgb: w.rgb, lab: describeColor(w.rgb).lab });
    });
    setAdded(wells.length);
  }

  return (
    <section className="panel" style={{ marginTop: "1rem" }}>
      <h2 className="section-title">Import a whole palette from one photo</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Photograph your palette in good, even light. Frame the wells with the grid below, then
        tap "Read names from label" — Coloraid reads the printed name cells and matches them to
        each well automatically.
      </p>

      <div className="recipe-grid">
        <label className="field">
          <span className="k">Known set</span>
          <select className="select" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            {PALETTE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            <option value="custom">Custom — number them</option>
          </select>
        </label>
        <label className="field">
          <span className="k">Grid (rows × columns)</span>
          <div className="chip-row">
            <input className="select" style={{ width: 64 }} type="number" min={1} max={12} value={rows}
              onChange={(e) => setRows(Math.max(1, Number(e.target.value)))} aria-label="rows" />
            <span style={{ alignSelf: "center" }}>×</span>
            <input className="select" style={{ width: 64 }} type="number" min={1} max={12} value={cols}
              onChange={(e) => setCols(Math.max(1, Number(e.target.value)))} aria-label="columns" />
          </div>
        </label>
      </div>

      {!imageSrc ? (
        <div style={{ marginTop: "0.75rem" }}>
          <Dropzone onFile={loadFile} title="Load a photo of your palette"
            hint="Include the box lid label so names can be read automatically." />
        </div>
      ) : (
        <>
          <div className="toolbar" style={{ marginTop: "0.75rem" }}>
            <span className="hint" style={{ margin: 0 }}>Drag the grid corners to frame the wells.</span>
            <button className="reset" onClick={() => { reset(); setWells([]); setAdded(0); setOcrStatus("idle"); }}>New photo</button>
          </div>
          <WellGridPicker imageSrc={imageSrc} rows={rows} cols={cols} onWells={handleWells} />

          {wells.length > 0 && (
            <>
              {/* Read-names button */}
              <div className="toolbar" style={{ marginTop: "0.75rem" }}>
                <button
                  className="primary"
                  onClick={readNamesFromPhoto}
                  disabled={ocrStatus === "loading"}
                >
                  {ocrStatus === "loading" ? "Reading label…" : "Read names from label"}
                </button>
                {ocrStatus === "done" && (
                  <span className="hint" style={{ margin: 0, color: "var(--accent)" }}>
                    {ocrCount} names read — check below and edit if needed.
                  </span>
                )}
                {ocrStatus === "error" && (
                  <span className="hint" style={{ margin: 0, color: "var(--danger, #e53)" }}>
                    {ocrError ?? "Failed to read names."}
                  </span>
                )}
              </div>

              {/* Wells list */}
              <p className="hint">Detected {wells.length} wells — fix any name, then add them all.</p>
              <ul className="well-grid">
                {wells.map((w, i) => (
                  <li key={i} className="well-cell">
                    <span className="swatch sm" style={{ background: `rgb(${w.rgb.r},${w.rgb.g},${w.rgb.b})` }} aria-hidden />
                    <input className="name-input" value={nameAt(i)} onChange={(e) => setNameAt(i, e.target.value)}
                      aria-label={`Name for well ${i + 1}`} />
                  </li>
                ))}
              </ul>
              <button className="primary" onClick={addAll} style={{ marginTop: "0.75rem" }}>
                Add all {wells.length} paints
              </button>
              {added > 0 && <p className="hint" style={{ color: "var(--accent)" }}>Added {added} paints to your palette.</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}

/* ---------- Manual single-swatch add ---------- */

function ManualAdd({ onAdd }: { onAdd: (p: { name: string; rgb: SampleResult["rgb"]; lab: ReturnType<typeof describeColor>["lab"] }) => void }) {
  const { imageSrc, loadFile, reset } = useImageFile();
  const [sample, setSample] = useState<SampleResult | null>(null);
  const [name, setName] = useState("");
  const sampled = useMemo(() => (sample ? describeColor(sample.rgb) : null), [sample]);

  function handleAdd() {
    if (!sampled || !name.trim()) return;
    onAdd({ name: name.trim(), rgb: sampled.rgb, lab: sampled.lab });
    setName("");
    setSample(null);
  }

  return (
    <section className="panel" style={{ marginTop: "1rem" }}>
      <h2 className="section-title">Add a paint by tapping a swatch</h2>
      {!imageSrc ? (
        <Dropzone onFile={loadFile} title="Tap to choose a palette photo"
          hint="Tap a swatch to capture its color, then name it." />
      ) : (
        <>
          <div className="toolbar">
            <span className="hint" style={{ margin: 0 }}>Tap a swatch on the photo.</span>
            <button className="reset" onClick={reset}>New photo</button>
          </div>
          <ImageCanvas imageSrc={imageSrc} onSample={setSample} />
          {sampled && (
            <div className="add-row">
              <span className="swatch sm" style={{ background: sampled.hex }} aria-hidden />
              <span className="codes" style={{ flex: 1 }}>{sampled.sentence}</span>
              <input className="name-input" placeholder="Paint name (e.g. Ultramarine)" value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }} aria-label="Paint name" />
              <button className="primary" onClick={handleAdd} disabled={!name.trim()}>Add</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
