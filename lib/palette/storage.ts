"use client";

import { useCallback, useEffect, useState } from "react";
import { differenceCiede2000 } from "culori";
import type { Lab } from "@/lib/color/describe";
import type { Paint } from "./types";
import { uid } from "@/lib/util/id";

const KEY = "coloraid.palettes.v2";
const LEGACY_KEY = "coloraid.palette.v1";
const deltaE = differenceCiede2000();

/** A named, saved palette — the unit of the palette gallery. */
export interface StoredPalette {
  id: string;
  name: string;
  createdAt: number;
  paints: Paint[];
}

interface Store {
  palettes: StoredPalette[];
  activeId: string;
}

function blank(): Store {
  const p: StoredPalette = { id: uid(), name: "My palette", createdAt: Date.now(), paints: [] };
  return { palettes: [p], activeId: p.id };
}

function read(): Store {
  if (typeof window === "undefined") return { palettes: [], activeId: "" };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.palettes?.length) return parsed as Store;
    }
    // One-time migration from the old single-palette format.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const paints = JSON.parse(legacy);
      if (Array.isArray(paints)) {
        const p: StoredPalette = { id: uid(), name: "My palette", createdAt: Date.now(), paints };
        const store: Store = { palettes: [p], activeId: p.id };
        write(store);
        return store;
      }
    }
  } catch {
    /* fall through to a blank store */
  }
  return blank();
}

// Tiny pub/sub so every usePalette() instance re-reads when any of them writes.
const listeners = new Set<() => void>();
function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
  listeners.forEach((l) => l());
}

function activePalette(store: Store): StoredPalette | undefined {
  return store.palettes.find((p) => p.id === store.activeId) ?? store.palettes[0];
}

/**
 * Palette gallery in localStorage. `usePalette()` keeps its original shape
 * (`paints`, `addPaint`, `removePaint`) operating on the *active* palette, plus
 * gallery controls to create / switch / rename / delete palettes.
 */
export function usePalette() {
  const [store, setStore] = useState<Store>({ palettes: [], activeId: "" });
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => setStore(read()), []);

  useEffect(() => {
    refresh();
    setHydrated(true);
    const l = () => refresh();
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [refresh]);

  const mutateActive = useCallback((fn: (paints: Paint[]) => Paint[]) => {
    const s = read();
    const active = activePalette(s);
    if (!active) return;
    active.paints = fn(active.paints);
    write({ ...s });
  }, []);

  const addPaint = useCallback(
    (paint: Omit<Paint, "id">) => mutateActive((paints) => [...paints, { ...paint, id: uid() }]),
    [mutateActive],
  );

  const removePaint = useCallback(
    (id: string) => mutateActive((paints) => paints.filter((p) => p.id !== id)),
    [mutateActive],
  );

  const createPalette = useCallback((name?: string) => {
    const s = read();
    const p: StoredPalette = {
      id: uid(),
      name: (name ?? "").trim() || `Palette ${s.palettes.length + 1}`,
      createdAt: Date.now(),
      paints: [],
    };
    write({ palettes: [...s.palettes, p], activeId: p.id });
  }, []);

  const selectPalette = useCallback((id: string) => {
    const s = read();
    if (s.palettes.some((p) => p.id === id)) write({ ...s, activeId: id });
  }, []);

  const renamePalette = useCallback((id: string, name: string) => {
    const s = read();
    const p = s.palettes.find((x) => x.id === id);
    if (p) {
      p.name = name.trim() || p.name;
      write({ ...s });
    }
  }, []);

  const deletePalette = useCallback((id: string) => {
    const s = read();
    let palettes = s.palettes.filter((p) => p.id !== id);
    if (palettes.length === 0) palettes = blank().palettes;
    const activeId = palettes.some((p) => p.id === s.activeId) ? s.activeId : palettes[0].id;
    write({ palettes, activeId });
  }, []);

  const active = activePalette(store);
  return {
    paints: active?.paints ?? [],
    palettes: store.palettes,
    activeId: active?.id ?? "",
    activeName: active?.name ?? "",
    hydrated,
    addPaint,
    removePaint,
    createPalette,
    selectPalette,
    renamePalette,
    deletePalette,
  };
}

export interface PaintMatch {
  paint: Paint;
  deltaE: number;
}

/** Closest paints in the palette to a target Lab color, nearest first. */
export function nearestPaints(target: Lab, paints: Paint[], k = 1): PaintMatch[] {
  const t = { mode: "lab" as const, l: target.l, a: target.a, b: target.b };
  return paints
    .map((paint) => ({
      paint,
      deltaE: deltaE(t, { mode: "lab", l: paint.lab.l, a: paint.lab.a, b: paint.lab.b }),
    }))
    .sort((x, y) => x.deltaE - y.deltaE)
    .slice(0, k);
}
