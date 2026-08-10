import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'mock:server-only', shortCircuit: true };
    }
    const mocks = {
      '@/lib/access': 'mock:whatsapp-flow-access',
      '@/lib/credentials': 'mock:whatsapp-flow-credentials',
      '@/lib/prisma': 'mock:whatsapp-flow-prisma',
      '@/lib/request-body': 'mock:whatsapp-flow-request-body',
      '@/lib/whatsapp/flow-endpoint-provisioning': 'mock:whatsapp-flow-provisioning',
    };
    if (mocks[specifier]) {
      return { url: mocks[specifier], shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:server-only') {
      return { format: 'module', shortCircuit: true, source: 'export {};' };
    }
    if (url === 'mock:whatsapp-flow-access') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export class AccessError extends Error {}
          export function accessErrorResponse() {
            return Response.json({ error: 'unexpected access error' }, { status: 500 });
          }
          export async function getPlatformAccess() {
            globalThis.__whatsAppFlowRouteEffects.push('access');
            return {
              databaseUserId: 'actor-preview',
              organization: { id: 'organization-preview' },
              project: { id: 'project-preview' },
            };
          }
          export function requireTenantPermission() {
            globalThis.__whatsAppFlowRouteEffects.push('authorize');
          }
        `,
      };
    }
    if (url === 'mock:whatsapp-flow-credentials') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export function decryptCredential() {
            globalThis.__whatsAppFlowRouteEffects.push('decrypt');
            throw new Error('Credential decryption must not run.');
          }
        `,
      };
    }
    if (url === 'mock:whatsapp-flow-prisma') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export function getPrisma() {
            globalThis.__whatsAppFlowRouteEffects.push('prisma');
            throw new Error('Prisma must not be opened.');
          }
        `,
      };
    }
    if (url === 'mock:whatsapp-flow-request-body') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export class RequestBodyError extends Error {
            constructor(message, { code = 'INVALID_REQUEST_BODY', status = 400 } = {}) {
              super(message);
              this.code = code;
              this.status = status;
            }
          }
          export async function readJsonRequest() {
            globalThis.__whatsAppFlowRouteEffects.push('body');
            throw new RequestBodyError('Body parsing reached.', {
              code: 'TEST_BODY_REACHED',
              status: 422,
            });
          }
          export function requestBodyErrorResponse(error) {
            return Response.json(
              { error: error.message, code: error.code },
              { status: error.status },
            );
          }
        `,
      };
    }
    if (url === 'mock:whatsapp-flow-provisioning') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export function buildWhatsAppFlowEndpointUri() { return 'https://preview.invalid/flow'; }
          export function flowRuntimeIsReady() { return false; }
          export async function provisionWhatsAppFlowDataEndpoint() {
            globalThis.__whatsAppFlowRouteEffects.push('meta');
            throw new Error('Meta provisioning must not run.');
          }
          export async function readWhatsAppFlowEndpointState() { return null; }
          export function remoteFlowUsesDataEndpoint() { return false; }
          export function whatsAppFlowHealthIsBlocked() { return false; }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { POST } = await import('../src/app/api/integrations/whatsapp/flows/route.js');

const MANAGED_ENVIRONMENT_KEYS = [
  'NEXT_PUBLIC_APP_URL',
  'NODE_ENV',
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'WHATSAPP_PREVIEW_ALLOWED_PUBLIC_ORIGINS',
  'WHATSAPP_PRODUCTION_PUBLIC_ORIGINS',
];

function withEnvironment(values, run) {
  const previous = Object.fromEntries(
    MANAGED_ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
  );
  for (const key of MANAGED_ENVIRONMENT_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  globalThis.__whatsAppFlowRouteEffects = [];

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const key of MANAGED_ENVIRONMENT_KEYS) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
      delete globalThis.__whatsAppFlowRouteEffects;
    });
}

function provisioningRequest() {
  return new Request('https://obrasaas-preview.vercel.app/api/integrations/whatsapp/flows', {
    method: 'POST',
  });
}

test('Preview without an explicit public origin fails before body, persistence, credentials or Meta', () => (
  withEnvironment({
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_PROJECT_PRODUCTION_URL: 'app.obrasaas.com',
  }, async () => {
    const response = await POST(provisioningRequest());
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.code, 'WHATSAPP_PUBLIC_APP_URL_REQUIRED');
    assert.deepEqual(globalThis.__whatsAppFlowRouteEffects, ['access', 'authorize']);
  })
));

test('Preview refuses to provision a Flow against the Production project origin', () => (
  withEnvironment({
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    NEXT_PUBLIC_APP_URL: 'https://app.obrasaas.com/',
    VERCEL_PROJECT_PRODUCTION_URL: 'app.obrasaas.com',
  }, async () => {
    const response = await POST(provisioningRequest());
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.code, 'WHATSAPP_PUBLIC_APP_URL_PRODUCTION_LEAK');
    assert.equal(JSON.stringify(payload).includes('https://app.obrasaas.com'), false);
    assert.deepEqual(globalThis.__whatsAppFlowRouteEffects, ['access', 'authorize']);
  })
));

test('Preview refuses the canonical Production alias when the Vercel project host differs', () => (
  withEnvironment({
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    NEXT_PUBLIC_APP_URL: 'https://obrasaas.vercel.app/',
    VERCEL_PROJECT_PRODUCTION_URL: 'obrasaas-saas.vercel.app',
  }, async () => {
    const response = await POST(provisioningRequest());
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.code, 'WHATSAPP_PUBLIC_APP_URL_PRODUCTION_LEAK');
    assert.deepEqual(globalThis.__whatsAppFlowRouteEffects, ['access', 'authorize']);
  })
));

test('an explicit Preview origin passes the environment guard and reaches request validation', () => (
  withEnvironment({
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    NEXT_PUBLIC_APP_URL: 'https://obrasaas-preview.vercel.app/',
    VERCEL_PROJECT_PRODUCTION_URL: 'app.obrasaas.com',
  }, async () => {
    const response = await POST(provisioningRequest());
    const payload = await response.json();

    assert.equal(response.status, 422);
    assert.equal(payload.code, 'TEST_BODY_REACHED');
    assert.deepEqual(globalThis.__whatsAppFlowRouteEffects, [
      'access',
      'authorize',
      'body',
    ]);
  })
));
