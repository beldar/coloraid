// Run once: node scripts/generate-icons.mjs
// Generates PNG icons from public/icon.svg for PWA manifest + Next.js favicon.
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const buf = readFileSync(join(root, 'public/icon.svg'));

const targets = [
  // PWA manifest icons (referenced in app/manifest.ts)
  { out: 'public/icon-192.png',      size: 192 },
  { out: 'public/icon-512.png',      size: 512 },
  { out: 'public/icon-maskable-512.png', size: 512 },
  { out: 'public/apple-touch-icon.png',  size: 180 },
  // Next.js App Router conventions (auto-added to <head>)
  { out: 'app/icon.png',             size: 512 },
  { out: 'app/apple-icon.png',       size: 180 },
];

for (const { out, size } of targets) {
  await sharp(buf).resize(size, size).png().toFile(join(root, out));
  console.log(`✓  ${out}  (${size}×${size})`);
}
