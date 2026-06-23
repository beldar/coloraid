// Generates a test PNG with two known solid color halves, for verifying the
// color reader end-to-end. Left = ultramarine-ish blue, right = warm yellow.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 240;
const H = 240;
const left = [56, 70, 160]; // blue
const right = [244, 214, 60]; // yellow

// Raw image: each row is preceded by a filter byte (0 = none).
const raw = Buffer.alloc((W * 4 + 1) * H);
let o = 0;
for (let y = 0; y < H; y++) {
  raw[o++] = 0;
  for (let x = 0; x < W; x++) {
    const c = x < W / 2 ? left : right;
    raw[o++] = c[0];
    raw[o++] = c[1];
    raw[o++] = c[2];
    raw[o++] = 255;
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c;
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(new URL("./fixture.png", import.meta.url), png);
console.log("wrote scripts/fixture.png", W + "x" + H);
