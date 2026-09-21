/**
 * アプリアイコン（PWA / Apple タッチアイコン）を生成する。
 * 依存ライブラリなしで PNG を書き出す（zlib + 自前の CRC32）。
 *
 *   node scripts/make-icons.mjs
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

/** 緑のグラデーション地に白の太字「N」 */
const TOP = [59, 196, 111];
const BOTTOM = [14, 122, 58];
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

/** 斜め方向のグラデーション（左上が明るい緑、右下が深い緑） */
const gradient = (u, v) => {
  const t = Math.min(1, Math.max(0, (u + v) / 2));
  return [
    Math.round(TOP[0] + (BOTTOM[0] - TOP[0]) * t),
    Math.round(TOP[1] + (BOTTOM[1] - TOP[1]) * t),
    Math.round(TOP[2] + (BOTTOM[2] - TOP[2]) * t),
    255,
  ];
};

/**
 * 太字の「N」。左右の縦棒と、左上の角から右下の角へ走る斜め棒で構成する。
 * 文字は 0.24..0.76 の正方形に収め、縦棒の太さは 0.14、斜め棒は水平幅 0.172（垂直方向の太さがほぼ同じになる値）。
 */
const N_LEFT = 0.24;
const N_RIGHT = 0.76;
const N_TOP = 0.25;
const N_BOTTOM = 0.75;
const N_BAR = 0.14;
const N_DIAG = 0.172;

function inN(u, v) {
  if (v < N_TOP || v > N_BOTTOM) return false;
  if (u >= N_LEFT && u <= N_LEFT + N_BAR) return true;
  if (u >= N_RIGHT - N_BAR && u <= N_RIGHT) return true;
  const t = (v - N_TOP) / (N_BOTTOM - N_TOP);
  const left = N_LEFT + t * (N_RIGHT - N_DIAG - N_LEFT);
  return u >= left && u <= left + N_DIAG;
}

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
  return inN(uu, vv) ? WHITE : gradient(u, v);
}

/** 4x4 のスーパーサンプリングで縁を滑らかにする */
function aa(size, maskable) {
  const n = 4;
  return (u, v) => {
    const acc = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const c = draw(u + ((i + 0.5) / n - 0.5) / size, v + ((j + 0.5) / n - 0.5) / size, maskable);
        for (let k = 0; k < 4; k++) acc[k] += c[k];
      }
    }
    return acc.map((x) => Math.round(x / (n * n)));
  };
}

writeFileSync('public/icons/icon-192.png', png(192, aa(192, false)));
writeFileSync('public/icons/icon-512.png', png(512, aa(512, false)));
writeFileSync('public/icons/icon-maskable-512.png', png(512, aa(512, true)));
writeFileSync('public/icons/apple-touch-icon.png', png(180, aa(180, true)));

writeFileSync(
  'public/icons/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3bc46f"/>
      <stop offset="1" stop-color="#0e7a3a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <!-- 太字の N: 左棒 + 斜め棒 + 右棒 -->
  <path d="M123 128h72v256h-72zM317 128h72v256h-72zM123 128h88l178 256h-88z" fill="#fff"/>
</svg>
`,
);

console.log('icons written to public/icons/');
