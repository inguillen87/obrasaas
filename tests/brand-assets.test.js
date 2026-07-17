import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import manifest from '../src/app/manifest.js';
import {
  OBRA_SAAS_STRUCTURE_PATH,
  OBRA_SAAS_TRACE_PATH,
} from '../src/app/brand/brand-geometry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = path.join(root, 'public', 'brand');

const VECTOR_ASSETS = [
  'obrasaas-app-icon.svg',
  'obrasaas-favicon.svg',
  'obrasaas-lockup-inverse.svg',
  'obrasaas-lockup-mono.svg',
  'obrasaas-lockup.svg',
  'obrasaas-symbol-inverse.svg',
  'obrasaas-symbol-mono.svg',
  'obrasaas-symbol.svg',
];

test('brand vectors share the canonical operational-trace geometry and remain self-contained', async () => {
  for (const filename of VECTOR_ASSETS) {
    const source = await readFile(path.join(brand, filename), 'utf8');
    assert.match(source, /<svg\b/);
    assert.ok(source.includes(OBRA_SAAS_STRUCTURE_PATH), `${filename} must use canonical structure`);
    assert.ok(source.includes(OBRA_SAAS_TRACE_PATH), `${filename} must use canonical trace`);
    assert.doesNotMatch(source, /<text\b/i);
    assert.doesNotMatch(source, /<script\b/i);
    assert.doesNotMatch(source, /(?:href|src)=["']https?:/i);
    assert.doesNotMatch(source, /field\s*os/i);
  }
});

test('generated launcher assets expose the expected production dimensions', async () => {
  const expected = new Map([
    ['obrasaas-app-icon-192.png', 192],
    ['obrasaas-app-icon-512.png', 512],
    ['obrasaas-app-icon-1024.png', 1024],
    ['obrasaas-maskable-512.png', 512],
  ]);

  for (const [filename, size] of expected) {
    const metadata = await sharp(path.join(brand, filename)).metadata();
    assert.equal(metadata.width, size, `${filename} width`);
    assert.equal(metadata.height, size, `${filename} height`);
    assert.equal(metadata.format, 'png');
  }

  const appIcon = await sharp(path.join(root, 'src', 'app', 'icon.png')).metadata();
  const appleIcon = await sharp(path.join(root, 'src', 'app', 'apple-icon.png')).metadata();
  assert.deepEqual([appIcon.width, appIcon.height], [512, 512]);
  assert.deepEqual([appleIcon.width, appleIcon.height], [180, 180]);
  assert.ok((await stat(path.join(root, 'src', 'app', 'favicon.ico'))).size > 512);
});

test('the web manifest references only generated ObraSaaS brand assets', () => {
  const result = manifest();
  assert.equal(result.short_name, 'ObraSaaS');
  assert.deepEqual(
    result.icons.map((icon) => icon.src),
    [
      '/brand/obrasaas-app-icon.svg',
      '/brand/obrasaas-app-icon-192.png',
      '/brand/obrasaas-app-icon-512.png',
      '/brand/obrasaas-maskable-512.png',
    ],
  );
});
