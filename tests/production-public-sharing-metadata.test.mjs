import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {legacyBoundaryKind} from '../src/lib/legacy-access-boundary.js';
import {PUBLIC_SITE_ORIGIN, PUBLIC_SITE_PATHS, PUBLIC_SHARE_IMAGE, publicPageMetadata} from '../src/app/public-site-metadata.mjs';
import sitemap from '../src/app/sitemap.js';
import robots from '../src/app/robots.js';

const asset = '/brand/obrasaas-social-v1.png';
const publicPaths = ['/', '/manual', '/demo', '/privacidad', '/terminos', '/eliminacion-datos'];
const legalPaths = ['/privacidad', '/terminos', '/eliminacion-datos'];
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
  for (const path of ['/cuenta', '/sign-in', '/api/identity/participants', '/?workerId=private', '/manual?email=private', ...legalPaths.flatMap(path => [path + '/extra', path + '?email=private', path + '#private', path + '/', 'https://other.invalid' + path]), 'https://other.invalid/', '__proto__', null, ['/'], {toString: () => '/'}]) assert.throws(() => publicPageMetadata(path), {message:'PUBLIC_METADATA_PATH_REQUIRED'});
});
test('public legal pages allow only exact read routes and keep descendants, lookalikes and all other methods closed', () => {
  for (const path of legalPaths) {
    for (const method of ['GET', 'HEAD']) {
      for (const suffix of ['', '/', '///']) assert.equal(legacyBoundaryKind(path + suffix, method), 'public');
      assert.equal(legacyBoundaryKind(new URL('https://foreign.invalid' + path + '?email=private#ignored').pathname, method), 'public');
      for (const candidate of [path + '/private', path + '-extra', path + '.json', path + '%2Fprivate', path.toUpperCase()]) assert.equal(legacyBoundaryKind(candidate, method), 'private-page');
      assert.equal(legacyBoundaryKind('/api' + path, method), 'private-api');
    }
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE', 'get']) assert.equal(legacyBoundaryKind(path, method), 'private-api');
  }
});
test('only the six reviewed public pages enter sitemap and exact robots permissions', () => {
  assert.deepEqual(PUBLIC_SITE_PATHS, publicPaths);
  assert.equal(Object.isFrozen(PUBLIC_SITE_PATHS), true);
  assert.deepEqual(sitemap(), publicPaths.map(path => ({url: PUBLIC_SITE_ORIGIN + path})));
  const policy = robots();
  assert.equal(policy.rules.disallow, '/');
  assert.equal(policy.sitemap, PUBLIC_SITE_ORIGIN + '/sitemap.xml');
  for (const path of publicPaths) assert.ok(policy.rules.allow.includes(path + '$'));
  for (const path of ['/privacidad/', '/terminos/', '/eliminacion-datos/', '/api/', '/cuenta', '/sign-in']) assert.equal(policy.rules.allow.includes(path), false);
  assert.equal(policy.rules.allow.includes('/cuenta$'), false);
  assert.equal(policy.rules.allow.includes('/sign-in$'), false);
});
test('shared public metadata contains a fixed branded image and canonical origin, independently of caller host', () => {
  for (const path of publicPaths) {
    const result = publicPageMetadata(path);
    assert.equal(new URL(result.alternates.canonical).origin, PUBLIC_SITE_ORIGIN);
    assert.equal(new URL(result.alternates.canonical).pathname, path);
    assert.equal(result.openGraph.url, result.alternates.canonical);
    assert.equal(result.openGraph.images[0].url, PUBLIC_SHARE_IMAGE.url);
    assert.equal(result.twitter.images[0].url, PUBLIC_SHARE_IMAGE.url);
    assert.equal(new URL(result.openGraph.images[0].url).search, '');
    assert.equal(result.twitter.card, 'summary_large_image');
    assert.deepEqual(result.robots, {index: true, follow: true});
    assert.doesNotMatch(JSON.stringify(result), /workerId|operationId|email=|automatic payments|plug.?and.?play/i);
  }
});
