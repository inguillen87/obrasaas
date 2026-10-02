import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { verifyFreshSession, sessionCookieMatches, safeRecoverySignInPath } from '../src/lib/session-recovery.mjs';
import { createSessionVerifier, sessionCheckResponse } from '../src/lib/verified-session.mjs';
import { IDENTITY_ORIGIN, IDENTITY_ISSUER, IDENTITY_PUBLIC_KEY, IDENTITY_INSTANCE } from '../src/lib/production-identity-config.mjs';

const instant = new Date('2026-10-01T12:00:00Z'), epoch = instant.getTime() / 1000;
const pair = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(pair.publicKey), kid: 'session-recovery-test-key', alg: 'RS256', use: 'sig' };
const verify = createSessionVerifier(createLocalJWKSet({ keys: [jwk] }), { now: () => instant });
const environment = { NEXT_PUBLIC_APP_URL: IDENTITY_ORIGIN, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: IDENTITY_PUBLIC_KEY,
  CLERK_EXPECTED_INSTANCE_ID: IDENTITY_INSTANCE, CLERK_AUTHORIZED_PARTIES: IDENTITY_ORIGIN };
const sign = extra => new SignJWT({ iss: IDENTITY_ISSUER, sub: 'user_RecoveryTest', sid: 'sess_RecoveryTest',
  azp: IDENTITY_ORIGIN, iat: epoch, nbf: epoch-1, exp: epoch+60, v: 2, ...extra })
  .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: jwk.kid }).sign(pair.privateKey);
const fresh = await sign();
const success = () => Response.json({ authenticated: true, verification: 'clerk-production-jwt', businessAccessEnabled: false, expiresAt: epoch+60 });
const dependencies = extra => ({ getToken: async () => fresh, fetchImpl: async () => success(),
  readCookie: () => '__session=' + fresh, now: () => instant.getTime(), cookieChecks: 1, ...extra });

test('expired cookie remains rejected while a freshly minted Bearer is verified by the real server verifier', async () => {
  const expired = await sign({ iat: epoch-120, nbf: epoch-120, exp: epoch-60 });
  assert.equal((await verify(new Headers({ cookie: '__session='+expired }), environment)).authenticated, false);
  let cookie = '__session='+expired, calls = 0;
  const result = await verifyFreshSession(dependencies({
    getToken: async options => { assert.deepEqual(options, { skipCache: true }); cookie = '__session='+fresh; return fresh; },
    readCookie: () => cookie,
    fetchImpl: async (path, options) => {
      calls++; assert.equal(path, '/api/identity/session'); assert.equal(options.method, 'GET');
      assert.equal(options.cache, 'no-store'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.redirect, 'error');
      assert.equal(options.body, undefined);
      return sessionCheckResponse(new Request(IDENTITY_ORIGIN+path, { headers: { ...options.headers, Cookie: '__session='+expired } }), headers => verify(headers, environment));
    },
  }));
  assert.deepEqual(result, { verified: true, cookieSynchronized: true }); assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(result), /user_|sess_|eyJ/);
});
test('a verified Bearer without a synchronized browser cookie cannot request a server refresh', async () => {
  await assert.rejects(verifyFreshSession(dependencies({ readCookie: () => '__session=old.cookie.value' })), { code: 'SESSION_RECOVERY_COOKIE_PENDING' });
});
test('Clerk cookie propagation is bounded and can finish after server verification', async () => {
  let reads = 0;
  await verifyFreshSession(dependencies({ cookieChecks: 3, cookieIntervalMs: 0, readCookie: () => ++reads === 3 ? '__session='+fresh : '' }));
  assert.equal(reads, 3);
});
for (const [status, code] of [[401, 'SESSION_RECOVERY_REQUIRED'], [503, 'SESSION_RECOVERY_UNAVAILABLE'], [500, 'SESSION_RECOVERY_UNAVAILABLE']]) {
  test('HTTP '+status+' cannot complete recovery or read the browser cookie', async () => {
    let cookieReads = 0;
    await assert.rejects(verifyFreshSession(dependencies({ fetchImpl: async () => Response.json({ code: 'controlled_failure' }, { status }),
      readCookie: () => { cookieReads++; return '__session='+fresh; } })), { code });
    assert.equal(cookieReads, 0);
  });
}
for (const body of [{ authenticated: false }, { authenticated: true, verification: 'client-flag', businessAccessEnabled: false, expiresAt: epoch+60 },
  { authenticated: true, verification: 'clerk-production-jwt', businessAccessEnabled: true, expiresAt: epoch+60 },
  { authenticated: true, verification: 'clerk-production-jwt', businessAccessEnabled: false, expiresAt: epoch-1 }]) {
  test('untrusted or expired session response cannot complete recovery '+JSON.stringify(body), async () => {
    await assert.rejects(verifyFreshSession(dependencies({ fetchImpl: async () => Response.json(body) })), { code: 'SESSION_RECOVERY_UNAVAILABLE' });
  });
}
test('missing or malformed client token does not reach the session endpoint', async () => {
  for (const token of [null, '', 'not-a-jwt', 'a.b.c\r\nInjected: value']) {
    let calls = 0;
    await assert.rejects(verifyFreshSession(dependencies({ getToken: async () => token, fetchImpl: async () => { calls++; return success(); } })), { code: 'SESSION_RECOVERY_REQUIRED' });
    assert.equal(calls, 0);
  }
});
test('late token after an account or organization change cannot reach the verifier', async () => {
  let resolve, current = true, calls = 0;
  const pending = verifyFreshSession(dependencies({ getToken: () => new Promise(done => { resolve = done; }), isCurrent: () => current,
    fetchImpl: async () => { calls++; return success(); } }));
  current = false; resolve(fresh);
  await assert.rejects(pending, { code: 'SESSION_RECOVERY_ABORTED' }); assert.equal(calls, 0);
});
test('late successful verification after unmount cannot complete recovery', async () => {
  let resolve, current = true;
  const pending = verifyFreshSession(dependencies({ fetchImpl: () => new Promise(done => { resolve = done; }), isCurrent: () => current }));
  await new Promise(done => setImmediate(done)); current = false; resolve(success());
  await assert.rejects(pending, { code: 'SESSION_RECOVERY_ABORTED' });
});
test('abort bounds a hung SDK promise and its eventual token has no later effect', async () => {
  const controller = new AbortController(); let resolve, calls = 0;
  const pending = verifyFreshSession(dependencies({ getToken: () => new Promise(done => { resolve = done; }), signal: controller.signal,
    fetchImpl: async () => { calls++; return success(); } }));
  controller.abort(); await assert.rejects(pending, { code: 'SESSION_RECOVERY_ABORTED' });
  resolve(fresh); await new Promise(done => setImmediate(done)); assert.equal(calls, 0);
});
test('provider/client diagnostic details never escape a recovery failure', async () => {
  await assert.rejects(verifyFreshSession(dependencies({ getToken: async () => { throw new Error('private diagnostic '+fresh); } })), error => {
    assert.equal(error.code, 'SESSION_RECOVERY_UNAVAILABLE'); assert.doesNotMatch(error.message, /diagnostic|eyJ/); return true;
  });
});
test('duplicate session cookies and unsafe navigation destinations fail closed', () => {
  assert.equal(sessionCookieMatches('__session='+fresh+'; __session='+fresh, fresh), false);
  assert.equal(sessionCookieMatches('__session='+fresh+'%00', fresh), false);
  assert.equal(sessionCookieMatches('other=value; __session='+fresh, fresh), true);
  const invite = 'invite_'+'a'.repeat(32);
  assert.equal(safeRecoverySignInPath('/sign-in?participar='+invite), '/sign-in?participar='+invite);
  for (const path of ['https://other.example', '//other.example', 'javascript:alert(1)', '/sign-in?redirect_url=https://other.example', '/sign-in?participar='+invite+'&other=1']) assert.equal(safeRecoverySignInPath(path), '/sign-in');
});
