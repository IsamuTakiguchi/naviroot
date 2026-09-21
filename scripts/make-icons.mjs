/**
 * アプリアイコン（PWA / Apple タッチアイコン）を生成する。
 * 依存ライブラリなしで PNG を書き出す（zlib + 自前の CRC32）。
 *
 *   node scripts/make-icons.mjs
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

/** ターコイズ → スカイのグラデーション地に白のピン */
const TOP = [14, 165, 196];
const BOTTOM = [47, 155, 240];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel((x + 0.5) / size, (y + 0.5) / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 斜め方向のグラデーション（左上が濃いターコイズ、右下がスカイ） */
const gradient = (u, v) => {
  const t = Math.min(1, Math.max(0, (u + v) / 2));
  return [
    Math.round(TOP[0] + (BOTTOM[0] - TOP[0]) * t),
    Math.round(TOP[1] + (BOTTOM[1] - TOP[1]) * t),
    Math.round(TOP[2] + (BOTTOM[2] - TOP[2]) * t),
    255,
  ];
};

/** 地図ピン（頭の円 + 下向きの三角） */
function inPin(u, v) {
  const dx = u - 0.5;
  const dy = v - 0.41;
  if (dx * dx + dy * dy <= 0.22 * 0.22) return true;
  if (v > 0.41 && v <= 0.81) {
    const w = (0.22 * (0.81 - v)) / 0.4;
    return Math.abs(dx) <= w;
  }
  return false;
}

const inHole = (u, v) => (u - 0.5) ** 2 + (v - 0.41) ** 2 <= 0.085 * 0.085;

function rounded(u, v, r) {
  const cx = Math.min(Math.max(u, r), 1 - r);
  const cy = Math.min(Math.max(v, r), 1 - r);
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
}

function draw(u, v, maskable) {
  if (!maskable && !rounded(u, v, 0.19)) return CLEAR;
  // maskable はセーフゾーンに収まるよう図柄を縮める
  const s = maskable ? 0.7 : 1;
  const uu = (u - 0.5) / s + 0.5;
  const vv = (v - 0.5) / s + 0.5;
  if (inHole(uu, vv)) return gradient(u, v);
  if (inPin(uu, vv)) return WHITE;
  return gradient(u, v);
}

writeFileSync('public/icons/icon-192.png', png(192, (u, v) => draw(u, v, false)));
writeFileSync('public/icons/icon-512.png', png(512, (u, v) => draw(u, v, false)));
writeFileSync('public/icons/icon-maskable-512.png', png(512, (u, v) => draw(u, v, true)));
writeFileSync('public/icons/apple-touch-icon.png', png(180, (u, v) => draw(u, v, true)));

writeFileSync(
  'public/icons/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0ea5c4"/>
      <stop offset="1" stop-color="#2f9bf0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <path d="M256 96c-62 0-112 50-112 112 0 84 112 208 112 208s112-124 112-208c0-62-50-112-112-112z" fill="#fff"/>
  <circle cx="256" cy="208" r="44" fill="url(#g)"/>
</svg>
`,
);

console.log('icons written to public/icons/');
