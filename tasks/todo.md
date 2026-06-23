# Coloraid — Build Plan

A web app that helps a colorblind watercolor painter read the colors in a photo
and reproduce them with their own paints.

## Decisions (locked)
- **Stack:** Next.js (App Router) + TypeScript + React, deploy to Vercel.
- **Color math:** client-side, CIELAB + CIEDE2000 via `culori`. Offline/free.
- **Calibration philosophy:** give an approximate palette-guided mix first, then the
  user paints a real swatch, photographs it, and the app corrects (empirical loop).
- **First milestone:** Tap-to-describe color.

## Architecture (whole app, for context)
- `lib/color/` — pure color science (no React): sampling, Lab/LCh conversion,
  naming, description, later: mixing + calibration.
- `components/` — UI (image canvas, readouts, palette, etc.).
- `app/` — Next.js routes. Everything client-side for now (privacy, offline).
- Accessibility rule: **UI never depends on color** — names, numbers, labels only.

## Roadmap
- [x] **Phase 1 — Tap-to-describe (MVP, this pass)**
  - [x] Scaffold Next.js + TS project, deploys clean to Vercel
  - [x] Load/photograph an image onto a canvas
  - [x] Tap a point → sample an averaged patch (robust to noise/JPEG)
  - [x] RGB → Lab/LCh → nearest named color
  - [x] Plain-language description: lightness, hue family, chroma, warmth
  - [x] Accessible readout panel (name + numbers + sentence)
  - [x] Edge-detection guard (warns when a tap straddles two colors)
- [x] **Phase 2 — Palette ingestion**
  - [x] Build palette by tapping swatches on a palette photo + naming them
  - [x] Persist palette in localStorage (client-side, private)
  - [x] Reader shows nearest paint(s) by CIEDE2000, with honest closeness wording
  - [x] /palette route + nav between Read and Palette
  - [ ] Later: auto-detect swatches from a palette photo
- [x] **Phase 3 — Mix suggestions** (KM subtractive, up to 2 paints, `lib/mix/`)
- [x] **Phase 4 — Empirical calibration** (paint swatch → compare → learned residuals)
- [x] **Phase 5 — Paint-by-numbers segmentation** (`/layers`, k-means in Lab, each
  region named + recipe). Verified on the real family-landscape photo.
- [x] **Milestone 3 — Auto-calibrate palette from a photo** (`/palette` → "Auto
  from photo"): draggable 4-corner quad over the wells, dark-band/glare-discarding
  sampling, W&N Cotman 12 preset names. Verified on the real Cotman phone photo.
- [x] **Watercolour-true mixing** (2026-06-23): white is never a mixing partner —
  lighten with water (dilution range extended paler); forgiveness penalty prefers
  stable mixes over hue-cancelling complementaries. Verified on real scene colours.

## Milestone 2 — Fixes + Mixing & Calibration loop
Goal: turn "what color is this" into "here's how to MIX it with your paints, and
let me learn from your real swatch." Three workstreams below.

### 2.0 — Bug fixes & palette scaling (do first, unblocks everything)
- [ ] **Fix dropzone click** (blocking). Replace JS-triggered hidden input with a
  native `<label>`-wrapped input (see tasks/lessons.md). Drag/drop stays.
- [ ] **Palette scales to 13+.** Storage already has no cap; confirm and polish:
  - [ ] Responsive paint list (multi-column on wider screens), count shown.
  - [ ] Multi-add ergonomics: keep photo loaded after Add, clear name, re-focus
    so you can tap → name → Add repeatedly from one palette photo.

### 2.1 — Mixing predictor (the "approximate first guess")
- [ ] `lib/mix/km.ts` — Kubelka–Munk single-constant model, per RGB channel:
  paint RGB → linear reflectance → K/S; mix = Σ wᵢ·(K/S)ᵢ; **dilution** scales K/S
  toward paper-white (water = value, pigment = hue/chroma); invert KM → RGB → Lab.
  - Rationale: with the user's *real* (non-primary) paint colors, subtractive KM
    yields plausible mixes (e.g. their blue + yellow → green, not gray).
- [ ] `lib/mix/types.ts` — `Recipe { components:{paintId,weight}[], dilution }`,
  `MixPrediction { rgb, lab }`, `CalibrationSample`.
- [ ] Dilution levels with painter words: masstone / strong / medium / light / glaze.

### 2.2 — Recipe suggester (target → recipe)
- [ ] `lib/mix/suggest.ts` — given a target Lab + palette, search paint combos
  (**up to N paints — TO CONFIRM**) × ratio grid × dilution levels; rank by
  CIEDE2000; return top-K recipes with predicted Lab + ΔE + plain-language recipe
  ("≈⅔ Ultramarine + ⅓ Burnt Sienna, diluted to medium").
- [ ] Integrate into reader: after a tap, show best suggested mix alongside the
  existing "closest single paint."
- [ ] New **/mix** workspace + 3rd nav tab (Read / Palette / Mix).

### 2.3 — Calibration & comparing (the empirical correction)
- [ ] In /mix: pick a recipe (or a suggestion) → see PREDICTED swatch.
- [ ] "I painted this" → load/tap a photo of your real swatch → capture ACTUAL Lab.
- [ ] **Compare view:** predicted vs actual swatch, ΔE, and a plain sentence on the
  difference ("your real mix came out darker and a bit warmer than predicted").
- [ ] `lib/mix/calibration.ts` — store calibration samples (localStorage); residual
  model: corrected = base KM prediction + proximity-weighted (actual − predicted)
  from calibration samples sharing the same paint set. Base physics + learned
  residuals, so it improves as you calibrate.
- [ ] Predictions/suggestions show a "calibrated" badge when corrections applied.

### Decisions (locked)
1. Max paints per suggested mix: **up to 2** (cleaner mixes, fast search; 3 later).
2. Scope of this pass: **full loop (2.0–2.3)** — fixes, predict, suggest, calibrate.

### Verification plan
- KM unit check: predict (their blue)+(their yellow) → expect a* < 0 (greenish).
- Suggest check: target green w/ blue+yellow palette → top recipe is blue/yellow, low ΔE.
- Calibration check: save a sample with a known offset → re-predicting that recipe
  returns a Lab shifted toward the recorded actual.
- Browser E2E: dropzone opens dialog on real click; add 13 paints; run a suggestion;
  capture an actual swatch and see the compare view.

## Review
_(filled in as phases complete)_

### Phase 1 — done & verified
- Clean `next build` (types + lint pass). Fully client-side, deploys to Vercel as-is.
- End-to-end browser test against a two-color fixture:
  - Blue half → RGB 56,70,160, "saturated, dark blue, cool. Essentially ultramarine." ✓
  - Yellow half → RGB 244,214,60, "vivid, very light yellow, warm." ✓
  - Exact seam → sampled the blended color AND fired the edge warning. ✓
- Color science lives in `lib/color/` (pure, no React) so phases 2–5 can reuse it.
- Known follow-ups: missing favicon (404, cosmetic); stray parent package-lock
  triggers a Next build warning (set `outputFileTracingRoot` to silence).

### Phase 2 — done & verified
- Refactored shared image loading into `useImageFile` hook + `Dropzone` component
  (used by both Read and Palette pages). Added `Nav`.
- Palette model in `lib/palette/` (types + localStorage hook + `nearestPaints`).
- Browser-verified the whole loop: added "Ultramarine" (RGB 56,70,160) by tapping
  a swatch → persisted to localStorage → reader matched blue at ΔE 0.0 ("very close")
  and yellow at ΔE 77.9 ("nearest you have, but not close"). Both routes build clean.
- Closeness wording is deliberately honest so a far match never reads as a good one.

### Milestone 2 — done & verified (4 routes build clean)
- **Dropzone fix:** `<label>`-wrapped input. Real browser click opens exactly ONE
  file chooser (was double-opening). Lesson recorded in tasks/lessons.md.
- **Palette 13+:** confirmed no storage cap; responsive multi-column list; photo
  stays loaded after Add for fast tap→name→Add of many swatches.
- **KM mixing (`lib/mix/km.ts`):** verified Ultramarine+Yellow → "muted yellow-green"
  (subtractive: not gray/black). Dilution = value dial via paper-white.
- **Suggester (`lib/mix/suggest.ts`):** pure-blue target → "Ultramarine, masstone
  wash, ΔE 0.0" (correctly prefers single paint over a muddy mix). Up to 2 paints.
- **Calibration (`lib/mix/calibration.ts`):** seeded a +25 L residual → prediction
  shifted "medium"→"light", "calibrated" badge shown. Base physics + learned residuals.
- **Compare view:** tapped a real swatch → "came out darker, more saturated and
  cooler than predicted (ΔE 51.6)" + Save. Difference shown in WORDS (colorblind-safe).

### Milestone 3 + Layers + Watercolour-true — done & verified (2026-06-23)
- **Auto-calibrate from photo:** `lib/palette/wells.ts` pure CV (saturation-peak
  grid detection, perspective quad bilinear sampling, dark-luminance-band average).
  `WellGridPicker.tsx` draggable 4-corner overlay. Verified on the REAL Cotman photo
  (`tests/fixtures/cotman-palette.jpg`) → 12 correctly-named masstone colours.
- **Layers (`/layers`):** k-means in Lab → flat regions; verified on the real
  landscape → 6 sensible layers (sky/haze/figures/ground), each named + recipe.
- **Watercolour-true:** verified end-to-end in the browser with the real Cotman
  palette seeded — sky → "Cerulean, pale wash ΔE 2.7" (no white). Layers recipes all
  washes, ΔE 2–4. Shadowed rock now leads with forgiving Burnt Sienna, not a
  cancelling Cad-Red+Viridian. 34 unit tests pass; `tsc --noEmit` clean.

## Milestone 4 — Mobile redesign + galleries + merged Studio (frontend-design)
Aesthetic: "pigment lab" — warm charcoal ink, ochre/amber accent (CVD-safe yellow-blue
axis), Fraunces display + Hanken Grotesk UI + mono data. Bottom tab bar, big touch targets.
- [x] **FIX (critical):** `crypto.randomUUID is not a function` on mobile — undefined
  in non-secure contexts (http://LAN-IP). `lib/util/id.ts` safe `uid()` + 3 tests.
- [x] Design system: Fraunces/Hanken/Spline Mono via <link>; re-themed through CSS
  vars; fixed bottom tab bar (top pill bar ≥720px); 24px touch targets; safe-area insets.
- [x] Persist images → IndexedDB blobs (`lib/store/imageStore.ts`) + thumb/meta in
  localStorage for instant listing. Palettes/calibration already in localStorage.
- [x] **Image gallery** — auto-saves on upload; thumbnail strip; reopen verified
  after a full navigation; delete per item.
- [x] **Palette gallery** — multiple named palettes (tabs), create/switch/rename/delete;
  `usePalette()` shape unchanged so /mix + reader still work; v1→v2 migration verified.
- [x] **Merged Studio** (`components/StudioCanvas.tsx`): layers toggle over the photo;
  tap a region → spotlight + highlight its card; tap a card → spotlight region. `/layers`
  now redirects to `/`. Verified on a 390px viewport with the real landscape.

### Milestone 4 — done & verified (2026-06-23, mobile 390px)
- Bug root cause confirmed + fixed; `uid()` falls back to getRandomValues then Math.random.
- Full mobile pass: upload → auto-saved to library; layers ON → 6 named layers with
  washes; tapped ground → "Raw umber" card spotlit; reopened from gallery after nav →
  read sky → "Cerulean, pale wash ΔE 2.7". 37 tests pass; `tsc --noEmit` clean.

## Milestone 5 — Vercel deploy prep + PWA (2026-06-23) — done
- [x] PWA: `app/manifest.ts` (manifest.webmanifest), `public/sw.js` (app-shell cache,
  network-first nav, SWR assets), `components/PWARegister.tsx` (registers SW), apple +
  icons metadata in layout. Icons generated from `public/icon.svg` → 192/512/maskable/
  apple-touch + `app/icon.png` favicon (ochre paint-drop on charcoal).
- [x] `next.config.mjs`: `outputFileTracingRoot` pinned (a stray parent lockfile was
  inferred as workspace root) — silences warning, correct Vercel file tracing.
- [x] Production `next build` clean (9 routes prerendered). 37 tests pass.
- [x] Personal photos gitignored (`tests/fixtures/*.{jpg,jpeg,png,webp,heic}`); tests
  use synthetic/hardcoded data so the suite is self-contained.
- [x] git init + commit on `main`; remote `git@github.com:beldar/coloraid.git`.
- [ ] **PUSH BLOCKED in sandbox** (SSH keys passphrase-protected, agent empty) — user
  runs `git push -u origin main` from their own terminal.
- NOTE: `@ducanh2912/next-pwa` + `sharp` were added to package.json externally. PWA is
  hand-rolled (doesn't use next-pwa); kept the deps + synced the lockfile so deploy
  works. Decide later: keep lightweight SW, or migrate to next-pwa.

### Open / next (not yet built)
- Optional 3-paint mixes (currently capped at 2).
- "Leave paper white" suggestion for near-white targets (instead of Chinese White).
- Auto-detect well grid without any dragging (currently auto-fit + manual nudge).
- Not a git repo yet — `git init` + first commit when you want version control.
- **Bug caught & fixed during verify:** predicted *sentence* was derived from the
  uncorrected RGB, so calibration was invisible in text; now derived from corrected
  Lab via `labToRgb`, so corrections show in the words a colorblind user relies on.

## Milestone 3 — Photo auto-calibration + production hardening
- [x] **Auto-import a whole palette from one photo** (`/palette` → Auto from photo):
  - [x] Draggable **4-corner perspective quad** (handles angled phone photos).
  - [x] Per-cell **bilinear** sampling + **dark-band** average (discards glare).
  - [x] Saturation peak/centroid auto-fit as a starting frame.
  - [x] Known-set presets (W&N Cotman 12) auto-name wells; names editable.
  - [x] "Add all" → whole palette in one step.
  - [x] VERIFIED on the real Cotman phone photo: 12 wells → correct named colors.
- [x] **Test suite (vitest, 31 tests):** color/describe, sampling, mix/KM, suggest,
  calibration, compare, palette nearest, wells (grid/quad/peaks), and a real-palette
  → real-landscape "mixes make sense" test (sandstone→Burnt Sienna+Ochre ΔE 1.7,
  sky→Cerulean, foliage→Sap Green). `npm test`.
- [x] Mobile polish (fluid layout + `@media(max-width:480px)`, 16px inputs to stop
  iOS zoom, responsive well-preview, wrap toolbars). Verified at 390px.
- [x] Refactor/simplify: `sampleWellColor` now delegates to `sampleQuadColor`;
  `devIndicators:false`; README added.
- [x] **Layers (paint-by-numbers)** — `/layers`: k-means in Lab segments a photo
  into flat colour layers; legend gives each layer a name, coverage %, and a mix
  recipe from your palette. `lib/segment/`, `LayerMap.tsx`. VERIFIED on a real
  coastal photo (6 layers, sensible recipes ΔE 0.8–4.4). 32 tests total.

### Follow-ups (next)
- Smarter auto-fit that survives dark pigments (don't rely on chroma for extent).
- Triples / "allow 3 paints" toggle for harder-to-reach targets.
- Prefer water-dilution over Chinese-White when lightening (more watercolor-true).
- Run the recipe search / segmentation in a Web Worker if it feels heavy.
- Overlay layer outlines on the original photo (not just a flat map).
