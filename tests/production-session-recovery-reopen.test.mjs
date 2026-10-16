import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import React from 'react';
import {generateKeyPair, exportJWK, createLocalJWKSet, SignJWT} from 'jose';
import {loadBindings, transform} from 'next/dist/build/swc/index.js';
import {safeRecoverySignInPath, verifyFreshSession} from '../src/lib/session-recovery.mjs';
import {createSessionVerifier, sessionCheckResponse} from '../src/lib/verified-session.mjs';
import {IDENTITY_ORIGIN, IDENTITY_ISSUER, IDENTITY_PUBLIC_KEY, IDENTITY_INSTANCE} from '../src/lib/production-identity-config.mjs';

// Execute the production JSX, effects and click handlers with controlled hook
// scheduling. The real recovery helper, route GET and cryptographic verifier run
// in memory; this does not establish browser/Clerk scheduling or live acceptance.
const componentSource = readFileSync(new URL('../src/app/(identity)/cuenta/session-recovery.js', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../src/app/api/identity/session/route.js', import.meta.url), 'utf8');
await loadBindings();
const compile = async (source, filename, jsx = false) => (await transform(source.replace(/^import .*;\r?\n/gm, ''), {
  filename, jsc: {parser: {syntax: 'ecmascript', jsx}, target: 'es2022', transform: {react: {runtime: 'classic'}}}, module: {type: 'commonjs'},
})).code;
const componentCode = await compile(componentSource, 'session-recovery.js', true);
const routeCode = await compile(routeSource, 'route.js');
const instant = new Date('2026-10-16T12:00:00Z'), epoch = instant.getTime() / 1000;
const pair = await generateKeyPair('RS256');
const jwk = {...await exportJWK(pair.publicKey), kid: 'reopen-synthetic-key', alg: 'RS256', use: 'sig'};
const verify = createSessionVerifier(createLocalJWKSet({keys: [jwk]}), {now: () => instant});
const environment = {NEXT_PUBLIC_APP_URL: IDENTITY_ORIGIN, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: IDENTITY_PUBLIC_KEY,
  CLERK_EXPECTED_INSTANCE_ID: IDENTITY_INSTANCE, CLERK_AUTHORIZED_PARTIES: IDENTITY_ORIGIN};
const sign = extra => new SignJWT({iss: IDENTITY_ISSUER, sub: 'user_ReopenSynthetic', sid: 'sess_ReopenSynthetic',
  azp: IDENTITY_ORIGIN, iat: epoch, nbf: epoch - 1, exp: epoch + 60, v: 2, ...extra})
  .setProtectedHeader({alg: 'RS256', typ: 'JWT', kid: jwk.kid}).sign(pair.privateKey);
const fresh = await sign(), prior = await sign({iat: epoch - 1, exp: epoch + 59}), expired = await sign({iat: epoch - 120, nbf: epoch - 120, exp: epoch - 60});
const invitation = 'invite_' + 'a'.repeat(32), sameUrl = IDENTITY_ORIGIN + '/cuenta?participar=' + invitation + '#continuar';
const props = {signInPath: '/sign-in?participar=' + invitation};
const pendingCopy = 'Comprobamos tu sesión. Volvé a abrir la cuenta para verificar el acceso de este navegador.';
const nodes = (tree, predicate, result = []) => {
  if (!tree || typeof tree !== 'object') return result;
  if (predicate(tree)) result.push(tree);
  for (const child of React.Children.toArray(tree.props?.children)) nodes(child, predicate, result);
  return result;
};
const text = tree => typeof tree === 'string' ? tree : tree?.props ? React.Children.toArray(tree.props.children).map(text).join('') : '';
const buttons = (tree, label) => nodes(tree, node => node.type === 'button' && text(node) === label);
const button = (tree, label) => {const matches = buttons(tree, label); assert.equal(matches.length, 1, label); return matches[0];};
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

function fixture({signedIn = true, loaded = true, token = fresh, mode = 'success', getToken, holdFetch = false, initialCode} = {}) {
  const states = [], refs = [], effects = [], callbacks = [], timers = new Map(), pending = new Set();
  let stateCursor = 0, refCursor = 0, effectCursor = 0, callbackCursor = 0, dirty = true, tree, queue = [], mounted = true;
  let cookie = '__session=' + prior, timerId = 0, tokenReads = 0, cookieReads = 0, refreshes = 0, releaseFetch;
  const requests = [], reloads = [], replacements = [];
  const router = {refresh: () => {refreshes++;}, replace: value => replacements.push(value)};
  const auth = {isLoaded: loaded, isSignedIn: signedIn, userId: 'user_ReopenSynthetic', sessionId: 'sess_ReopenSynthetic', orgId: null,
    getToken: async options => {tokenReads++; assert.deepEqual(options, {skipCache: true}); return getToken ? getToken() : token;}};
  const sameDeps = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const routeExports = {};
  runInNewContext(routeCode, {exports: routeExports, sessionCheckResponse: request => sessionCheckResponse(request,
    headers => mode === '503' ? Promise.resolve({authenticated: false, code: 'IDENTITY_PROVIDER_UNAVAILABLE'}) : verify(headers, environment))});
  const fetchImpl = async (url, options) => {
    assert.equal(url, '/api/identity/session'); assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error'); assert.equal(options.body, undefined);
    requests.push({url, method: options.method});
    if (holdFetch) await new Promise(resolve => {releaseFetch = resolve;});
    const response = await routeExports.GET(new Request(IDENTITY_ORIGIN + url, {headers: {...options.headers, Cookie: cookie}}));
    if (mode === 'expired-response') return Response.json({authenticated: true, verification: 'clerk-production-jwt', businessAccessEnabled: false, expiresAt: epoch - 1});
    if (mode === 'untrusted-response') return Response.json({authenticated: true, verification: 'client-flag', businessAccessEnabled: false, expiresAt: epoch + 60});
    return response;
  };
  const exports = {}, surface = {
    exports, React, AbortController, safeRecoverySignInPath, styles: {retry: 'primary', home: 'secondary'}, Link: 'a',
    document: Object.defineProperty({}, 'cookie', {get: () => {cookieReads++; return cookie;}, set: () => assert.fail('The component must not write a cookie')}),
    window: {location: {get href() {return sameUrl;}, set href(_value) {assert.fail('Do not construct or replace the account URL');},
      reload(...args) {assert.deepEqual(args, []); reloads.push(sameUrl);}}},
    useAuth: () => auth, useRouter: () => router,
    setTimeout: (handler, milliseconds) => {const id = ++timerId; timers.set(id, {handler, milliseconds}); return id;},
    clearTimeout: id => timers.delete(id),
    useState: initial => {const index = stateCursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => {const next = typeof value === 'function' ? value(states[index]) : value; if (!Object.is(states[index], next)) {states[index] = next; dirty = true;}}];},
    useRef: initial => {const index = refCursor++; return refs[index] ?? (refs[index] = {current: initial});},
    useCallback: (callback, dependencies) => {const index = callbackCursor++; if (!sameDeps(callbacks[index]?.dependencies, dependencies)) callbacks[index] = {callback, dependencies}; return callbacks[index].callback;},
    useEffect: (effect, dependencies) => {const index = effectCursor++; if (!sameDeps(effects[index]?.dependencies, dependencies)) queue.push(() => {
      effects[index]?.cleanup?.(); effects[index] = {dependencies, cleanup: effect()};
    });},
    verifyFreshSession: options => {
      const promise = verifyFreshSession({...options, fetchImpl, now: () => instant.getTime(), cookieChecks: 1});
      pending.add(promise); promise.then(() => pending.delete(promise), () => pending.delete(promise)); return promise;
    },
  };
  runInNewContext(componentCode, surface);
  function render(patch = {}) {
    assert.equal(mounted, true); Object.assign(auth, patch); dirty = true;
    let renders = 0;
    do {
      assert.ok(++renders <= 20, 'Controlled effect rendering must settle'); dirty = false;
      stateCursor = refCursor = effectCursor = callbackCursor = 0;
      tree = exports.SessionRecovery({...props, ...(initialCode ? {initialCode} : {})});
      const commit = queue; queue = []; commit.forEach(effect => effect());
    } while (dirty);
    return tree;
  }
  async function settle({batch = false} = {}) {
    if (!batch && dirty && mounted) render();
    let timeout;
    try {
      await Promise.race([Promise.allSettled([...pending]), new Promise((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Synthetic recovery did not settle')), 5000);
      })]);
    } finally {clearTimeout(timeout);}
    await nextTurn(); if (dirty && mounted) render(); assert.equal(pending.size, 0); return tree;
  }
  return {render, settle, get tree() {return tree;}, requests, reloads, replacements,
    counts: () => ({tokenReads, cookieReads, refreshes}), cookie: value => {cookie = value;},
    releaseFetch: () => {assert.equal(typeof releaseFetch, 'function'); releaseFetch();},
    timers: milliseconds => {for (const [id, timer] of [...timers]) if (timer.milliseconds === milliseconds) {timers.delete(id); timer.handler();} if (dirty) render();},
    unmount: () => {mounted = false; effects.forEach(effect => effect?.cleanup?.());},
    cookieOnly: () => routeExports.GET(new Request(IDENTITY_ORIGIN + '/api/identity/session', {headers: {Cookie: cookie}})),
  };
}

test('COOKIE_PENDING offers one guarded same-URL reopen without another token, HTTP request, cookie write or workspace refresh', async () => {
  const page = fixture(); page.render(); const tree = await page.settle();
  assert.match(text(tree), new RegExp(pendingCopy.replaceAll('.', '\\.')));
  assert.equal(text(nodes(tree, node => node.type === 'button')[0]), 'Volver a abrir mi cuenta');
  assert.equal(button(tree, 'Volver a verificar').props.className, 'secondary');
  assert.equal(nodes(tree, node => node.type === 'a')[0].props.href, props.signInPath);
  assert.deepEqual(page.counts(), {tokenReads: 1, cookieReads: 1, refreshes: 0});
  const cookieResponse = await page.cookieOnly(); assert.equal(cookieResponse.status, 200);
  assert.deepEqual(await cookieResponse.json(), {authenticated: true, verification: 'clerk-production-jwt', expiresAt: epoch + 59, businessAccessEnabled: false});
  const reopen = button(tree, 'Volver a abrir mi cuenta').props.onClick;
  reopen(); reopen();
  assert.deepEqual(page.reloads, [sameUrl]); assert.equal(page.requests.length, 1);
  assert.deepEqual(page.counts(), {tokenReads: 1, cookieReads: 1, refreshes: 0});
  assert.doesNotMatch(text(tree), /ESPACIO DE TRABAJO|Seleccioná o creá tu organización|acceso sincronizado/i);
  page.unmount();
});

test('the existing secondary verification can still synchronize exactly and asks only the server to refresh', async () => {
  const page = fixture(); page.render(); let tree = await page.settle(); const staleReopen = button(tree, 'Volver a abrir mi cuenta').props.onClick;
  page.cookie('__session=' + fresh); button(tree, 'Volver a verificar').props.onClick(); staleReopen();
  tree = await page.settle(); assert.match(text(tree), /Volvemos a comprobar tu cuenta en el servidor/);
  assert.equal(buttons(tree, 'Volver a abrir mi cuenta').length, 0); assert.deepEqual(page.reloads, []);
  assert.deepEqual(page.counts(), {tokenReads: 2, cookieReads: 2, refreshes: 1}); assert.equal(page.requests.length, 2);
  assert.doesNotMatch(text(tree), /ESPACIO DE TRABAJO/); page.unmount();
});

test('a secondary retry that stays pending renews only the current navigation attempt even when checking is batched', async () => {
  const page = fixture(); page.render(); let tree = await page.settle();
  const staleReopen = button(tree, 'Volver a abrir mi cuenta').props.onClick;
  button(tree, 'Volver a verificar').props.onClick(); staleReopen();
  assert.deepEqual(page.reloads, []);
  // Deliberately do not commit the intermediate checking render. No permission
  // or cookie result is changed to make the pending result succeed.
  tree = await page.settle({batch: true}); assert.match(text(tree), /Comprobamos tu sesión/);
  assert.deepEqual(page.counts(), {tokenReads: 2, cookieReads: 2, refreshes: 0});
  const reopen = button(tree, 'Volver a abrir mi cuenta').props.onClick;
  reopen(); page.render(); button(page.tree, 'Volver a abrir mi cuenta').props.onClick();
  assert.deepEqual(page.reloads, [sameUrl]); assert.equal(page.requests.length, 2); page.unmount();
});

for (const [name, options, message] of [
  ['401', {token: expired}, /Tu acceso no pudo renovarse/],
  ['503', {mode: '503'}, /El servicio de acceso no respondió/],
  ['expired response', {mode: 'expired-response'}, /El servicio de acceso no respondió/],
  ['untrusted response', {mode: 'untrusted-response'}, /El servicio de acceso no respondió/],
]) test(name + ' does not expose the COOKIE_PENDING reopen action', async () => {
  const page = fixture(options); page.render(); const tree = await page.settle();
  assert.match(text(tree), message); assert.equal(buttons(tree, 'Volver a abrir mi cuenta').length, 0);
  assert.equal(button(tree, 'Volver a verificar').props.disabled, false);
  assert.deepEqual(page.reloads, []); assert.deepEqual(page.counts(), {tokenReads: 1, cookieReads: 0, refreshes: 0}); page.unmount();
});

test('SDK loading and signed-out states retain their existing actions without the pending-only CTA', async () => {
  const loading = fixture({loaded: false}); loading.render(); loading.timers(15000);
  assert.match(text(loading.tree), /El servicio de acceso está tardando en cargar/);
  assert.equal(buttons(loading.tree, 'Volver a abrir mi cuenta').length, 0); button(loading.tree, 'Recargar página');
  assert.deepEqual(loading.counts(), {tokenReads: 0, cookieReads: 0, refreshes: 0}); loading.unmount();
  const signedOut = fixture({signedIn: false}); signedOut.render();
  assert.equal(buttons(signedOut.tree, 'Volver a abrir mi cuenta').length, 0);
  assert.deepEqual(signedOut.replacements, [props.signInPath]); assert.deepEqual(signedOut.reloads, []); signedOut.unmount();
});

test('account, session and organization changes reset pending and make retained reopen handlers inert', async () => {
  for (const patch of [{userId: 'user_OtherSynthetic'}, {sessionId: 'sess_OtherSynthetic'}, {orgId: 'org_OtherSynthetic'}, {isSignedIn: false}, {isLoaded: false}]) {
    const page = fixture(); page.render(); const tree = await page.settle(); const staleReopen = button(tree, 'Volver a abrir mi cuenta').props.onClick;
    const changed = page.render(patch); staleReopen();
    assert.equal(buttons(changed, 'Volver a abrir mi cuenta').length, 0); assert.deepEqual(page.reloads, []);
    if (!('isSignedIn' in patch) && !('isLoaded' in patch)) assert.match(text(changed), /Cambió la cuenta o la organización/);
    assert.equal(page.requests.length, 1); assert.equal(page.counts().refreshes, 0); page.unmount();
  }
});

test('late token and endpoint completions cannot restore pending or navigation after a context switch', async () => {
  for (const stage of ['token', 'endpoint']) {
    let release;
    const page = fixture(stage === 'token' ? {getToken: () => new Promise(resolve => {release = resolve;})} : {holdFetch: true});
    page.render(); await nextTurn(); page.render({orgId: 'org_ChangedSynthetic'});
    if (stage === 'token') release(fresh); else page.releaseFetch();
    const tree = await page.settle(); assert.match(text(tree), /Cambió la cuenta o la organización/);
    assert.equal(buttons(tree, 'Volver a abrir mi cuenta').length, 0); assert.deepEqual(page.reloads, []);
    assert.equal(page.requests.length, stage === 'token' ? 0 : 1); assert.equal(page.counts().cookieReads, 0); assert.equal(page.counts().refreshes, 0); page.unmount();
  }
});

test('unmount invalidates a retained pending action, and provider-unavailable startup still requires explicit verification', async () => {
  const page = fixture(); page.render(); const tree = await page.settle(); const staleReopen = button(tree, 'Volver a abrir mi cuenta').props.onClick;
  page.unmount(); staleReopen(); assert.deepEqual(page.reloads, []);
  const unavailable = fixture({initialCode: 'IDENTITY_PROVIDER_UNAVAILABLE'}); unavailable.render();
  assert.equal(unavailable.requests.length, 0); assert.equal(buttons(unavailable.tree, 'Volver a abrir mi cuenta').length, 0);
  button(unavailable.tree, 'Volver a verificar').props.onClick(); const pending = await unavailable.settle();
  button(pending, 'Volver a abrir mi cuenta'); assert.equal(unavailable.requests.length, 1); assert.equal(unavailable.counts().refreshes, 0); unavailable.unmount();
});
