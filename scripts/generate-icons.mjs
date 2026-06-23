// Run once: node scripts/generate-icons.mjs
// Generates PNG icons from an SVG source for PWA manifest + Next.js favicon.
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="88" fill="#16140f"/>
  <!-- Watercolour drop — amber/ochre accent, safe zone for maskable -->
  <path d="M256,110 C256,110 152,244 152,320 C152,398 197,452 256,452 C315,452 360,398 360,320 C360,244 256,110 256,110Z" fill="#e3aa34"/>
  <!-- Specular highlight -->
  <ellipse cx="228" cy="274" rx="20" ry="42" fill="#f5efe1" opacity="0.32"/>
  <circle cx="228" cy="238" r="9" fill="#f5efe1" opacity="0.45"/>
</svg>`;

const buf = Buffer.from(svg);

const targets = [
  // PWA manifest icons
  { out: 'public/icons/icon-192.png', size: 192 },
  { out: 'public/icons/icon-512.png', size: 512 },
  // Next.js App Router conventions (auto-added to <head>)
  { out: 'app/icon.png',              size: 512 },
  { out: 'app/apple-icon.png',        size: 180 },
];

mkdirSync(join(root, 'public/icons'), { recursive: true });

for (const { out, size } of targets) {
  await sharp(buf).resize(size, size).png().toFile(join(root, out));
  console.log(`✓  ${out}  (${size}×${size})`);
}
