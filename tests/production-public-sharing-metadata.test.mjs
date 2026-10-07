import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {legacyBoundaryKind} from '../src/lib/legacy-access-boundary.js';
import {PUBLIC_SITE_ORIGIN, PUBLIC_SHARE_IMAGE, publicPageMetadata} from '../src/app/public-site-metadata.mjs';

const asset = '/brand/obrasaas-social-v1.png';
test('public social image decodes with horizontal card dimensions and no personal EXIF', async () => {
  const bytes = readFileSync(new URL('../public' + asset, import.meta.url));
  const image = await sharp(bytes).metadata();
  assert.equal(image.format, 'png');
  assert.equal(image.width, 1200);
  assert.equal(image.height, 630);
  assert.equal(image.exif, undefined);
  assert.equal(image.iptc, undefined);
  assert.equal(image.xmp, undefined);
  assert.ok(bytes.length < 500000);
});
test('only the exact social asset is public for reads; mutations and lookalikes remain closed', () => {
  for (const method of ['GET', 'HEAD']) assert.equal(legacyBoundaryKind(asset, method), 'public');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(legacyBoundaryKind(asset, method), 'private-api');
  for (const path of ['/brand/', '/brand/private.png', asset + '/extra', '/brand/../api/state', '/brand/%2e%2e/api/state', '/api/state', '/api/identity/participants']) assert.notEqual(legacyBoundaryKind(path), 'public');
});
test('tenant paths, query strings, other origins and non-string caller input cannot enter public metadata', () => {
  for (const path of ['/cuenta', '/sign-in', '/api/identity/participants', '/?workerId=private', '/manual?email=private', 'https://other.invalid/', '__proto__', null, ['/'], {toString: () => '/'}]) assert.throws(() => publicPageMetadata(path), {message:'PUBLIC_METADATA_PATH_REQUIRED'});
});
test('shared public metadata contains a fixed branded image and canonical origin, independently of caller host', () => {
  for (const path of ['/', '/manual', '/demo']) {
    const result = publicPageMetadata(path);
    assert.equal(new URL(result.alternates.canonical).origin, PUBLIC_SITE_ORIGIN);
    assert.equal(new URL(result.alternates.canonical).pathname, path);
    assert.equal(result.openGraph.url, result.alternates.canonical);
    assert.equal(result.openGraph.images[0].url, PUBLIC_SHARE_IMAGE.url);
    assert.equal(result.twitter.images[0].url, PUBLIC_SHARE_IMAGE.url);
    assert.equal(new URL(result.openGraph.images[0].url).search, '');
    assert.equal(result.twitter.card, 'summary_large_image');
    assert.doesNotMatch(JSON.stringify(result), /workerId|operationId|email=|automatic payments|plug.?and.?play/i);
  }
});
