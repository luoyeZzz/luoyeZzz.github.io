/* 生成 Windows 友好的 ICO：小尺寸用 BMP(DIB)，256 用 PNG
   输出：
     assets/img/favicon.ico
     assets/img/app-icon.ico   （给桌面快捷方式用，换文件名可绕开图标缓存）
*/
const fs = require('fs');
const sharp = require('sharp');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#F7DCE6"/>
  <path d="M21.6 5.8a10.4 10.4 0 1 1 5.6 17.9A8.5 8.5 0 0 1 21.6 5.8z" fill="#B34168"/>
  <circle cx="24.2" cy="9.4" r="1.1" fill="#FFF3F6"/>
</svg>`;

const sizes = [16, 32, 48, 64, 128, 256];

function dibFromRGBA(rgba, w, h) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(w, 4);
  header.writeInt32LE(h * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(w * h * 4, 20);

  const pixels = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = ((h - 1 - y) * w + x) * 4;
      const dst = (y * w + x) * 4;
      pixels[dst] = rgba[src + 2];      /* B */
      pixels[dst + 1] = rgba[src + 1];  /* G */
      pixels[dst + 2] = rgba[src];      /* R */
      pixels[dst + 3] = rgba[src + 3];  /* A */
    }
  }

  const maskRowBytes = Math.ceil(w / 32) * 4;
  const mask = Buffer.alloc(maskRowBytes * h, 0);

  return Buffer.concat([header, pixels, mask]);
}

(async function () {
  const entries = [];
  for (const s of sizes) {
    const rgba = await sharp(Buffer.from(SVG), { density: 300 })
      .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer();

    let data;
    if (s >= 256) {
      data = await sharp(rgba, { raw: { width: s, height: s, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
    } else {
      data = dibFromRGBA(rgba, s, s);
    }
    entries.push({ size: s, data });
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + 16 * entries.length;
  const dir = [];
  for (const e of entries) {
    const b = Buffer.alloc(16);
    b[0] = e.size >= 256 ? 0 : e.size;
    b[1] = e.size >= 256 ? 0 : e.size;
    b[2] = 0;
    b[3] = 0;
    b.writeUInt16LE(1, 4);
    b.writeUInt16LE(32, 6);
    b.writeUInt32LE(e.data.length, 8);
    b.writeUInt32LE(offset, 12);
    dir.push(b);
    offset += e.data.length;
  }

  const out = Buffer.concat([header, ...dir, ...entries.map((e) => e.data)]);
  fs.writeFileSync('assets/img/favicon.ico', out);
  fs.writeFileSync('assets/img/app-icon.ico', out);
  console.log('ico written', out.length, 'bytes;', entries.length, 'sizes; DIB + PNG');
})();
