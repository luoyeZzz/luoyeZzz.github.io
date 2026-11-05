/* 生成多尺寸 favicon.ico（16/32/48/64/128/256） */
const fs = require('fs');
const sharp = require('sharp');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#F7DCE6"/>
  <path d="M21.6 5.8a10.4 10.4 0 1 1 5.6 17.9A8.5 8.5 0 0 1 21.6 5.8z" fill="#B34168"/>
  <circle cx="24.2" cy="9.4" r="1.1" fill="#FFF3F6"/>
</svg>`;

const sizes = [16, 32, 48, 64, 128, 256];

(async function () {
  const pngs = [];
  for (const s of sizes) {
    const buf = await sharp(Buffer.from(SVG), { density: 300 })
      .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    pngs.push({ size: s, buf });
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + 16 * pngs.length;
  const entries = [];
  for (const p of pngs) {
    const e = Buffer.alloc(16);
    e[0] = p.size >= 256 ? 0 : p.size;
    e[1] = p.size >= 256 ? 0 : p.size;
    e[2] = 0;
    e[3] = 0;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(p.buf.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += p.buf.length;
  }
  const out = Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
  fs.writeFileSync('assets/img/favicon.ico', out);
  console.log('ico written', out.length, 'bytes,', pngs.length, 'sizes');
})();
