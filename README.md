# Coloraid

A web app that helps a **colorblind watercolour painter** read the colours in a
photo and reproduce them with their own paints. Every answer is given in words and
numbers — names, lightness, saturation, warmth, mix recipes — never relying on the
user seeing a hue.

Built with Next.js (App Router) + TypeScript + React. Fully client-side: your
photos never leave the browser. Colour maths uses [culori](https://culorijs.org)
(CIELAB + CIEDE2000). Installable as a **PWA** and works offline.

## Features

- **Studio** (home) — load/photograph an image, tap any point, get a plain-language
  description (e.g. *“a muted, dark blue-green, cool”*), the nearest named colour,
  raw HEX/RGB/LAB/LCh, an edge-straddle warning, plus — if you've added a palette —
  the closest paint and a suggested mix. Flip on **Colour layers** to posterize the
  photo into its main colours: tap a region to spotlight it and highlight its card
  (named + recipe) below, or tap a card to spotlight the region.
- **Image gallery** — every photo auto-saves to your device (IndexedDB); reopen past
  images any time.
- **My palette** — your paints, which everything matches against. Keep **multiple
  named palettes** and switch between them.
  - **Auto from photo**: photograph your set, frame the wells with a draggable
    4-corner grid (works on angled phone photos), and Coloraid samples each well's
    true colour (discarding glare) and names them from a known-set preset (e.g.
    Winsor & Newton Cotman 12). One tap adds the whole palette.
  - **Tap one by one**: tap a swatch, name it, add it.
- **Mix & calibrate** — pick a target colour (from a photo or by hand), get ranked
  2-paint recipes (*“65% Ultramarine + 35% Burnt Sienna, medium wash”*), then paint
  the mix, photograph it, and Coloraid compares predicted vs actual and **learns the
  correction** so future predictions match how your paints really behave.

## Colour science

- **Reading colour**: RGB → CIELAB/LCh → lightness / hue family / chroma / warmth.
- **Mixing**: pigments mix *subtractively*, so Coloraid uses a **Kubelka–Munk**
  single-constant model per channel (blue + yellow → green, not grey). In
  watercolour, **value comes from water dilution**, not white paint, so a recipe has
  two dials: pigments set hue+chroma, wash strength sets lightness.
- **Calibration**: base physics + proximity-weighted residuals learned from your
  real painted swatches.
- **Well sampling**: perspective-aware bilinear sampling + a dark-luminance-band
  average to throw away the glossy highlight and keep the true masstone.

## Develop

```bash
npm install
npm run dev      # Turbopack dev server at http://localhost:3000
npm test         # vitest unit tests (colour, mixing, calibration, well detection)
npm run build    # production build (do NOT run while `npm run dev` is up)
```

## Deploy (Vercel)

Zero-config — Vercel auto-detects Next.js. Push to GitHub and import the repo, or:

```bash
npm i -g vercel && vercel        # preview
vercel --prod                    # production
```

No environment variables are required (the app is fully client-side).

### PWA / install

`app/manifest.ts` + `public/sw.js` (registered by `components/PWARegister.tsx`) make
Coloraid installable. On the deployed HTTPS URL: iOS Safari → Share → *Add to Home
Screen*; Android/desktop Chrome → install icon in the address bar. The service worker
caches the app shell so it opens offline. (Install/SW only run over HTTPS or
localhost — not over a plain-IP LAN address.)

## Layout

- `lib/color/` — pure colour science (sampling, describe).
- `lib/palette/` — palette gallery storage, presets, photo well-detection (`wells.ts`).
- `lib/mix/` — Kubelka–Munk prediction, recipe suggestion, calibration, comparison.
- `lib/segment/` — k-means colour-layer segmentation.
- `lib/store/` — IndexedDB image library; `lib/util/id.ts` — safe id (non-secure ctx).
- `components/` — UI (Studio canvas, readouts, layer list, grid picker, nav).
- `app/` — routes: `/` (Studio = read + layers), `/palette`, `/mix`.
- `tests/` — vitest suites (synthetic/hardcoded data; personal photos are gitignored).

Roadmap and decisions live in `tasks/todo.md`; recurring lessons in `tasks/lessons.md`.
