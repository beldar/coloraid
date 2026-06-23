# Lessons — Coloraid

## File input: never trigger a hidden `<input type=file>` via JS `.click()` from a parent's onClick
**Symptom (user-reported):** clicking the dropzone did not open the file dialog.
**Root cause:** `<div onClick={() => inputRef.current.click()}>` with the file input
nested inside. `HTMLElement.click()` dispatches a *bubbling* click, so the input's
click bubbles back to the div's onClick and calls `.click()` again — a re-entrant
double-open that real browsers suppress (dialog never appears). It happened to work
under Playwright, which masked the bug.
**Fix / rule:** use a native `<label className="dropzone">` wrapping the input. The
label opens the dialog on click with zero JS and no re-entrancy. Keep the input
visually hidden but focusable (sr-only clip, NOT `display:none`) for keyboard access.
**Meta-lesson:** Playwright clicking a file input ≠ a real user gesture for file
dialogs. Verify file-picker interactions against a real browser, or trust the user's
report over a green automated check.

## Never run `next build` while `next dev` is running
They share the `.next` directory; the production build clobbers the dev server's
state and it starts returning 500s (`buildManifest .tmp` / webpack module errors).
For typechecks while dev is up, use `npx tsc --noEmit` (doesn't touch `.next`).
Also: Next 15.5 webpack dev has a flaky `segment-explorer` manifest bug — run dev
on Turbopack (`next dev --turbopack`) to avoid it.

## `crypto.randomUUID()` is undefined in non-secure contexts (mobile on LAN http)
**Symptom (user-reported, on phone):** "crypto.randomUUID is not a function" when
adding to the palette.
**Root cause:** `crypto.randomUUID` (and most of Web Crypto's `subtle`) is only
exposed in a *secure context* — HTTPS or localhost. Testing the dev server from a
phone over the LAN (http://192.168.x.x:3000) is NOT secure, so it's undefined.
Desktop localhost hid the bug.
**Fix / rule:** never call `crypto.randomUUID()` directly. Use `lib/util/id.ts`
`uid()` which falls back to `crypto.getRandomValues` (works over plain http) then
Math.random. Verify mobile features against a phone or a non-localhost origin.

## Palette wells: detection is hard on angled photos; sampling is the real win
A casual phone photo of a paint set is perspective-skewed AND has dark, low-chroma
pigments (viridian, umber) that defeat chroma-based auto-detection of the grid
extent. Lessons that worked:
- Frame wells with a draggable **4-corner quad** (perspective), not a rectangle —
  a rectangle can't fit a trapezoid; columns drift on one side.
- Sample each cell with **bilinear interpolation** + **dark-luminance-band average**
  (15–45th percentile) to get the true masstone and discard the glossy glare.
- Peak-finding on a 1-D profile must use the **centroid of each above-threshold run**,
  not argmax (argmax ties to a plateau edge and shifts the grid half a cell).
- Auto-fit is only a starting guess; the user's drag is what makes it exact. Verified
  on the real Cotman photo: all 12 wells sampled to correct named colors.
- When simulating multi-step drags in Playwright, await a tick between each so React
  re-renders; otherwise every handler closes over the original (pre-drag) state.
