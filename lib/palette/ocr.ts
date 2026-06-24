/**
 * Extract paint color names from a palette photo using the AI OCR endpoint.
 * Crops the top 50% of the image (label strip) before sending to reduce noise.
 * OPENAI_API_KEY stays server-side and is never exposed to the client.
 */
export async function extractPaletteNames(
  imageSrc: string, // full data-URL
  rows: number,
  cols: number,
): Promise<string[]> {
  const base64 = await cropTopHalf(imageSrc);

  const res = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, rows, cols }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `OCR request failed (${res.status})`);
  }

  const { names } = await res.json();
  return Array.isArray(names) ? names : [];
}

/** Crop the top 50% of an image using an offscreen canvas. Returns raw base64. */
function cropTopHalf(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const h = Math.floor(img.naturalHeight * 0.5);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      resolve(dataUrl.replace(/^data:[^;]+;base64,/, ""));
    };
    img.onerror = reject;
    img.src = src;
  });
}
