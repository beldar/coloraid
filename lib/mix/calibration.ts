"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lab } from "@/lib/color/describe";
import type { Paint } from "@/lib/palette/types";
import { predictMix } from "./km";
import { uid } from "@/lib/util/id";
import type { CalibrationSample, MixPrediction, Recipe } from "./types";

const STORAGE_KEY = "coloraid.calibration.v1";

// Bandwidth for how quickly a calibration's influence falls off with recipe
// distance (normalized weights + dilution all live in 0-1).
const BANDWIDTH = 0.28;
// Below this summed influence we treat a prediction as uncalibrated.
const MIN_INFLUENCE = 0.05;

function load(): CalibrationSample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CalibrationSample[]) : [];
  } catch {
    return [];
  }
}

function save(samples: CalibrationSample[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
  } catch {
    /* ignore quota/private-mode */
  }
}

export function paintSetOf(recipe: Recipe): string[] {
  return recipe.components.map((c) => c.paintId).sort();
}

function normalizedWeights(recipe: Recipe): Map<string, number> {
  const total = recipe.components.reduce((s, c) => s + c.weight, 0) || 1;
  return new Map(recipe.components.map((c) => [c.paintId, c.weight / total]));
}

/**
 * Recipe distance within a shared paint set: Euclidean over per-paint weight
 * differences plus the dilution difference. Returns Infinity for different sets.
 */
function recipeDistance(a: Recipe, b: Recipe): number {
  const setA = paintSetOf(a);
  const setB = paintSetOf(b);
  if (setA.length !== setB.length || setA.some((id, i) => id !== setB[i])) {
    return Infinity;
  }
  const wa = normalizedWeights(a);
  const wb = normalizedWeights(b);
  let sum = 0;
  for (const id of setA) {
    const d = (wa.get(id) ?? 0) - (wb.get(id) ?? 0);
    sum += d * d;
  }
  const dd = a.dilution - b.dilution;
  sum += dd * dd;
  return Math.sqrt(sum);
}

export interface CorrectedPrediction extends MixPrediction {
  /** True when calibration samples meaningfully adjusted the base prediction. */
  calibrated: boolean;
  /** ΔLab applied (for debugging/feedback). */
  correction: Lab;
}

/**
 * Base KM prediction plus a proximity-weighted residual learned from real
 * painted swatches that share the same paint set. Nearby calibrations pull the
 * prediction toward how the paint *actually* behaves.
 */
export function predictMixCalibrated(
  recipe: Recipe,
  palette: Paint[],
  samples: CalibrationSample[],
): CorrectedPrediction {
  const base = predictMix(recipe, palette);

  let wSum = 0;
  let dL = 0;
  let dA = 0;
  let dB = 0;
  for (const s of samples) {
    const dist = recipeDistance(recipe, s.recipe);
    if (!Number.isFinite(dist)) continue;
    const w = Math.exp(-((dist / BANDWIDTH) ** 2));
    wSum += w;
    dL += w * (s.actual.l - s.predicted.l);
    dA += w * (s.actual.a - s.predicted.a);
    dB += w * (s.actual.b - s.predicted.b);
  }

  if (wSum < MIN_INFLUENCE) {
    return { ...base, calibrated: false, correction: { l: 0, a: 0, b: 0 } };
  }

  const correction: Lab = { l: dL / wSum, a: dA / wSum, b: dB / wSum };
  return {
    rgb: base.rgb, // swatch still shows the base hue; correction is in Lab terms
    lab: {
      l: base.lab.l + correction.l,
      a: base.lab.a + correction.a,
      b: base.lab.b + correction.b,
    },
    calibrated: true,
    correction,
  };
}

/** Calibration samples in localStorage. */
export function useCalibrations() {
  const [samples, setSamples] = useState<CalibrationSample[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSamples(load());
    setHydrated(true);
  }, []);

  const addSample = useCallback((sample: Omit<CalibrationSample, "id" | "createdAt">) => {
    const entry: CalibrationSample = {
      ...sample,
      id: uid(),
      createdAt: Date.now(),
    };
    const next = [...load(), entry];
    setSamples(next);
    save(next);
  }, []);

  const removeSample = useCallback((id: string) => {
    const next = load().filter((s) => s.id !== id);
    setSamples(next);
    save(next);
  }, []);

  return { samples, hydrated, addSample, removeSample };
}
