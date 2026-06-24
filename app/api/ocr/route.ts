import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });

  const { image, rows, cols } = await req.json();
  if (!image || !rows || !cols) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const client = new OpenAI({ apiKey });
  const count = rows * cols;

  // The label strip is always in the top portion of the palette photo.
  // Crop the top 50% client-side is not reliable (unknown dimensions), so we
  // send the full image but instruct the model to focus on the label, not the wells.
  const prompt =
    `This photo shows a watercolor palette. Ignore the paint wells (the circular or square depressions in the lower portion). ` +
    `Focus ONLY on the printed label strip in the TOP portion of the image — it shows ${rows} rows and ${cols} columns of color-name cells. ` +
    `Each cell contains the same paint name in multiple languages; English is always printed first or most prominently.\n\n` +
    `Read the label strictly left-to-right, row by row:\n` +
    `- Row 1: cells 1–${cols} (left to right)\n` +
    `- Row 2: cells ${cols + 1}–${count} (left to right)\n\n` +
    `Return a JSON array of exactly ${count} English names in title case, nothing else.\n` +
    `Example: ["Lemon Yellow Hue", "Cadmium Yellow Hue", ..., "Chinese White"]`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}`, detail: "high" } },
        ],
      },
    ],
    max_tokens: 400,
  });

  const text = response.choices[0]?.message?.content ?? "[]";
  const match = text.match(/\[[\s\S]*\]/);
  const names: string[] = match ? JSON.parse(match[0]) : [];

  return NextResponse.json({ names });
}
