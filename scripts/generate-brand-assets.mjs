import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const brand = path.join(root, 'public', 'brand');
const app = path.join(root, 'src', 'app');
const appIconSvg = await readFile(path.join(brand, 'obrasaas-app-icon.svg'));
const faviconSvg = await readFile(path.join(brand, 'obrasaas-favicon.svg'));

async function renderPng(input, size, options = {}) {
  let pipeline = sharp(input).resize(size, size, { fit: 'fill' });
  if (options.flatten) pipeline = pipeline.flatten({ background: '#08110F' });
  if (options.rgba) pipeline = pipeline.ensureAlpha(1);
  return pipeline.png({ compressionLevel: 9 }).toBuffer();
}

const icon1024 = await renderPng(appIconSvg, 1024);
const icon512 = await renderPng(appIconSvg, 512);
const icon192 = await renderPng(appIconSvg, 192);
const maskable512 = await renderPng(appIconSvg, 512, { flatten: true });
const apple180 = await sharp(maskable512)
  .resize(180, 180, { fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toBuffer();

await Promise.all([
  writeFile(path.join(brand, 'obrasaas-app-icon-1024.png'), icon1024),
  writeFile(path.join(brand, 'obrasaas-app-icon-512.png'), icon512),
  writeFile(path.join(brand, 'obrasaas-app-icon-192.png'), icon192),
  writeFile(path.join(brand, 'obrasaas-maskable-512.png'), maskable512),
  writeFile(path.join(app, 'icon.png'), icon512),
  writeFile(path.join(app, 'apple-icon.png'), apple180),
]);

const faviconSizes = [16, 32, 48];
const faviconPngs = await Promise.all(
  faviconSizes.map((size) => renderPng(faviconSvg, size, {
    flatten: true,
    rgba: true,
  })),
);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(faviconPngs.length, 4);
let offset = header.length + (16 * faviconPngs.length);
const entries = faviconPngs.map((png, index) => {
  const size = faviconSizes[index];
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0);
  entry.writeUInt8(size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  return entry;
});

await writeFile(
  path.join(app, 'favicon.ico'),
  Buffer.concat([header, ...entries, ...faviconPngs]),
);

console.log('Generated ObraSaaS app, Apple, maskable, and multi-resolution favicon assets.');
