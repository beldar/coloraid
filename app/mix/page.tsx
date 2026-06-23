"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ImageCanvas, { type SampleResult } from "@/components/ImageCanvas";
import Dropzone from "@/components/Dropzone";
import Nav from "@/components/Nav";
import { useImageFile } from "@/hooks/useImageFile";
import { describeColor } from "@/lib/color/describe";
import { usePalette } from "@/lib/palette/storage";
import { predictMix, labToHex, labToRgb } from "@/lib/mix/km";
import { predictMixCalibrated, paintSetOf, useCalibrations } from "@/lib/mix/calibration";
import { suggestMixes } from "@/lib/mix/suggest";
import { describeDifference } from "@/lib/mix/compare";
import { DILUTION_LEVELS, type Recipe } from "@/lib/mix/types";

export default function MixPage() {
  const { paints } = usePalette();
  const { samples, addSample, removeSample } = useCalibrations();

  const targetImg = useImageFile();
  const swatchImg = useImageFile();
  const [targetSample, setTargetSample] = useState<SampleResult | null>(null);
  const [actualSample, setActualSample] = useState<SampleResult | null>(null);

  // Recipe state (up to 2 paints).
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [ratioA, setRatioA] = useState(0.5); // share of paint A
  const [dilution, setDilution] = useState(0.45); // medium
  const [saved, setSaved] = useState(false);

  const targetDesc = targetSample ? describeColor(targetSample.rgb) : null;
  const actualDesc = actualSample ? describeColor(actualSample.rgb) : null;

  const recipe: Recipe | null = useMemo(() => {
    if (!aId) return null;
    const components = bId
      ? [
          { paintId: aId, weight: ratioA },
          { paintId: bId, weight: 1 - ratioA },
        ]
      : [{ paintId: aId, weight: 1 }];
    return { components, dilution };
  }, [aId, bId, ratioA, dilution]);

  const corrPred = useMemo(
    () => (recipe ? predictMixCalibrated(recipe, paints, samples) : null),
    [recipe, paints, samples],
  );

  const suggestions = useMemo(
    () => (targetDesc ? suggestMixes(targetDesc.lab, paints, samples, { topK: 4 }) : []),
    [targetDesc, paints, samples],
  );

  const diff = useMemo(
    () => (corrPred && actualDesc ? describeDifference(corrPred.lab, actualDesc.lab) : null),
    [corrPred, actualDesc],
  );

  function applySuggestion(r: Recipe) {
    const [a, b] = r.components;
    setAId(a.paintId);
    setRatioA(a.weight);
    setBId(b?.paintId ?? "");
    setDilution(r.dilution);
    setSaved(false);
  }

  function saveCalibration() {
    if (!recipe || !actualDesc) return;
    // Store the *base* KM prediction so residuals don't compound.
    const base = predictMix(recipe, paints);
    addSample({
      recipe,
      paintSet: paintSetOf(recipe),
      predicted: base.lab,
      actual: actualDesc.lab,
    });
    setSaved(true);
    setActualSample(null);
    swatchImg.reset();
  }

  if (paints.length === 0) {
    return (
      <main>
        <h1>Coloraid</h1>
        <p className="tagline">Mix &amp; calibrate.</p>
        <Nav />
        <p className="hint" style={{ marginTop: "1rem" }}>
          Add some paints first on the{" "}
          <Link href="/palette" className="link">
            My palette
          </Link>{" "}
          tab — then come back to mix and calibrate.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Coloraid</h1>
      <p className="tagline">Mix a target with your paints, then calibrate from a real swatch.</p>
      <Nav />

      {/* 1. Target (optional) */}
      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 className="section-title">1. Target color (optional)</h2>
        {!targetImg.imageSrc ? (
          <Dropzone
            onFile={targetImg.loadFile}
            title="Load a photo to pick a target"
            hint="Tap the color you want to reproduce, or skip and build a recipe by hand below."
          />
        ) : (
          <>
            <div className="toolbar">
              <span className="hint" style={{ margin: 0 }}>
                Tap the color you want to match.
              </span>
              <button
                className="reset"
                onClick={() => {
                  targetImg.reset();
                  setTargetSample(null);
                }}
              >
                New photo
              </button>
            </div>
            <ImageCanvas imageSrc={targetImg.imageSrc} onSample={setTargetSample} />
          </>
        )}

        {targetDesc && (
          <div className="add-row" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="swatch sm" style={{ background: targetDesc.hex }} aria-hidden />
            <span className="codes" style={{ flex: 1 }}>
              Target: {targetDesc.sentence}
            </span>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mix-suggest" style={{ marginTop: "0.75rem" }}>
            <span className="k">Suggested recipes — tap one to load it</span>
            {suggestions.map((s, i) => (
              <button key={i} className="mix-row mix-row-btn" onClick={() => applySuggestion(s.recipe)}>
                <span className="swatch sm" style={{ background: labToHex(s.prediction.lab) }} aria-hidden />
                <span className="mix-text">{s.text}</span>
                <span className="mix-de">ΔE {s.deltaE.toFixed(1)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 2. Recipe + prediction */}
      <section className="panel" style={{ marginTop: "1.25rem" }}>
        <h2 className="section-title">2. Recipe</h2>
        <div className="recipe-grid">
          <label className="field">
            <span className="k">Paint A</span>
            <select className="select" value={aId} onChange={(e) => { setAId(e.target.value); setSaved(false); }}>
              <option value="">— choose —</option>
              {paints.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="k">Paint B (optional)</span>
            <select className="select" value={bId} onChange={(e) => { setBId(e.target.value); setSaved(false); }}>
              <option value="">— none (single paint) —</option>
              {paints.filter((p) => p.id !== aId).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        </div>

        {bId && (
          <label className="field" style={{ marginTop: "0.75rem" }}>
            <span className="k">
              Ratio — {Math.round(ratioA * 100)}% A / {Math.round((1 - ratioA) * 100)}% B
            </span>
            <input
              type="range" min={10} max={90} step={5}
              value={Math.round(ratioA * 100)}
              onChange={(e) => { setRatioA(Number(e.target.value) / 100); setSaved(false); }}
            />
          </label>
        )}

        <div className="field" style={{ marginTop: "0.75rem" }}>
          <span className="k">Wash strength (water sets the value)</span>
          <div className="chip-row">
            {DILUTION_LEVELS.map((d) => (
              <button
                key={d.label}
                className={`chip${Math.abs(dilution - d.value) < 0.01 ? " active" : ""}`}
                onClick={() => { setDilution(d.value); setSaved(false); }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {corrPred && (
          <div className="add-row" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="swatch" style={{ background: labToHex(corrPred.lab) }} aria-hidden />
            <span className="codes" style={{ flex: 1 }}>
              Predicted: {describeColor(labToRgb(corrPred.lab)).sentence}
              {corrPred.calibrated && <span className="badge">calibrated</span>}
            </span>
          </div>
        )}
      </section>

      {/* 3. Calibrate */}
      {corrPred && (
        <section className="panel" style={{ marginTop: "1.25rem" }}>
          <h2 className="section-title">3. Paint it, then calibrate</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Paint this mix, let it dry, photograph it in good light, then tap the swatch so
            Coloraid can compare and learn how your paints really behave.
          </p>
          {!swatchImg.imageSrc ? (
            <Dropzone
              onFile={swatchImg.loadFile}
              title="Load a photo of your painted swatch"
              hint="Dry, even light, plain background."
            />
          ) : (
            <>
              <div className="toolbar">
                <span className="hint" style={{ margin: 0 }}>Tap your painted swatch.</span>
                <button className="reset" onClick={() => { swatchImg.reset(); setActualSample(null); }}>
                  New photo
                </button>
              </div>
              <ImageCanvas imageSrc={swatchImg.imageSrc} onSample={setActualSample} />
            </>
          )}

          {actualDesc && diff && corrPred && (
            <>
              <div className="compare">
                <div className="compare-cell">
                  <span className="swatch" style={{ background: labToHex(corrPred.lab) }} aria-hidden />
                  <span className="k">Predicted</span>
                </div>
                <div className="compare-cell">
                  <span className="swatch" style={{ background: actualDesc.hex }} aria-hidden />
                  <span className="k">Your swatch</span>
                </div>
                <p className="compare-text">{diff.sentence}</p>
              </div>
              <button className="primary" onClick={saveCalibration} style={{ marginTop: "0.75rem" }}>
                Save calibration
              </button>
            </>
          )}
          {saved && <p className="hint" style={{ color: "var(--accent)" }}>Calibration saved — future predictions for this mix are corrected.</p>}
        </section>
      )}

      {/* Saved calibrations */}
      <section style={{ marginTop: "1.25rem" }}>
        <h2 className="section-title">Saved calibrations ({samples.length})</h2>
        {samples.length === 0 && (
          <p className="hint">None yet. Each one you save sharpens the mix predictions.</p>
        )}
        <ul className="paint-list">
          {samples.map((s) => {
            const names = s.paintSet
              .map((id) => paints.find((p) => p.id === id)?.name ?? "?")
              .join(" + ");
            const d = describeDifference(s.predicted, s.actual);
            return (
              <li key={s.id} className="paint-item">
                <span className="swatch sm" style={{ background: labToHex(s.actual) }} aria-hidden />
                <span className="paint-name">{names}</span>
                <span className="codes">{d.sentence}</span>
                <button className="reset" onClick={() => removeSample(s.id)} aria-label="Remove calibration">
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
