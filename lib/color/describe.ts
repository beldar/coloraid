import { converter, differenceCiede2000, formatHex } from "culori";
import type { RGB } from "./sampling";
import { NAMED_COLORS } from "./names";

const toLab = converter("lab");
const toLch = converter("lch");
const deltaE = differenceCiede2000();

export interface Lab {
  l: number;
  a: number;
  b: number;
}
export interface Lch {
  l: number;
  c: number;
  h: number; // degrees, 0-360
}

export interface ColorDescription {
  rgb: RGB;
  hex: string;
  lab: Lab;
  lch: Lch;
  /** Nearest named reference color and its perceptual distance (CIEDE2000). */
  nearestName: string;
  nearestDeltaE: number;
  /** Plain-language attributes, safe to read without seeing the color. */
  hueFamily: string;
  lightnessWord: string;
  chromaWord: string;
  warmthWord: string;
  /** One-sentence summary. */
  sentence: string;
}

/** culori color object from 0-255 RGB. */
function culoriRgb(rgb: RGB) {
  return { mode: "rgb" as const, r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255 };
}

interface HueBucket {
  max: number; // upper bound of Lab-LCh hue angle, degrees
  family: string;
  warmth: "warm" | "cool" | "neutral";
}

// Hue angle ranges in CIELAB-LCh. Approximate but stable for naming.
const HUE_BUCKETS: HueBucket[] = [
  { max: 15, family: "red", warmth: "warm" },
  { max: 45, family: "red", warmth: "warm" },
  { max: 70, family: "orange", warmth: "warm" },
  { max: 105, family: "yellow", warmth: "warm" },
  { max: 150, family: "yellow-green", warmth: "warm" },
  { max: 200, family: "green", warmth: "cool" },
  { max: 255, family: "blue-green", warmth: "cool" },
  { max: 300, family: "blue", warmth: "cool" },
  { max: 335, family: "violet", warmth: "cool" },
  { max: 360, family: "pink", warmth: "warm" },
];

function hueBucket(h: number): HueBucket {
  const angle = ((h % 360) + 360) % 360;
  for (const b of HUE_BUCKETS) {
    if (angle <= b.max) return b;
  }
  return HUE_BUCKETS[HUE_BUCKETS.length - 1];
}

function lightnessWord(l: number): string {
  if (l < 15) return "very dark";
  if (l < 35) return "dark";
  if (l < 55) return "medium";
  if (l < 75) return "light";
  if (l < 92) return "very light";
  return "near-white";
}

function chromaWord(c: number): string {
  if (c < 8) return "nearly neutral";
  if (c < 22) return "muted";
  if (c < 40) return "moderately saturated";
  if (c < 65) return "saturated";
  return "vivid";
}

/** Precompute Lab for the reference list once. */
const NAMED_LAB = NAMED_COLORS.map((n) => ({
  name: n.name,
  lab: toLab(culoriRgb(n.rgb)),
}));

export function describeColor(rgb: RGB): ColorDescription {
  const c = culoriRgb(rgb);
  const labRaw = toLab(c);
  const lchRaw = toLch(c);

  const lab: Lab = { l: labRaw.l, a: labRaw.a, b: labRaw.b };
  // h is undefined for true neutrals; fall back to 0.
  const lch: Lch = {
    l: lchRaw.l,
    c: lchRaw.c,
    h: Number.isFinite(lchRaw.h) ? (lchRaw.h as number) : 0,
  };

  // Nearest named color by CIEDE2000.
  let nearestName = NAMED_LAB[0].name;
  let nearestDeltaE = Infinity;
  for (const cand of NAMED_LAB) {
    const d = deltaE(labRaw, cand.lab);
    if (d < nearestDeltaE) {
      nearestDeltaE = d;
      nearestName = cand.name;
    }
  }

  const lWord = lightnessWord(lch.l);
  const cWord = chromaWord(lch.c);
  const bucket = hueBucket(lch.h);

  // For nearly-neutral colors, hue and temperature are meaningless noise.
  const isNeutral = lch.c < 8;
  const hueFamily = isNeutral ? "gray" : bucket.family;
  const warmthWord = isNeutral ? "neutral" : bucket.warmth;

  const sentence = buildSentence({
    lWord,
    cWord,
    hueFamily,
    warmthWord,
    isNeutral,
    nearestName,
    nearestDeltaE,
  });

  return {
    rgb,
    hex: formatHex(c),
    lab,
    lch,
    nearestName,
    nearestDeltaE,
    hueFamily,
    lightnessWord: lWord,
    chromaWord: cWord,
    warmthWord,
    sentence,
  };
}

function buildSentence(p: {
  lWord: string;
  cWord: string;
  hueFamily: string;
  warmthWord: string;
  isNeutral: boolean;
  nearestName: string;
  nearestDeltaE: number;
}): string {
  const near =
    p.nearestDeltaE < 3
      ? ` Essentially ${p.nearestName.toLowerCase()}.`
      : p.nearestDeltaE < 10
        ? ` Closest to ${p.nearestName.toLowerCase()}.`
        : ` In the neighborhood of ${p.nearestName.toLowerCase()}.`;

  if (p.isNeutral) {
    return `A ${p.lWord} neutral gray, with almost no hue.${near}`;
  }
  return `A ${p.cWord}, ${p.lWord} ${p.hueFamily} — ${p.warmthWord} in temperature.${near}`;
}
