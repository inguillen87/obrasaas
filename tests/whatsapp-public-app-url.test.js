import assert from 'node:assert/strict';
import test from 'node:test';

import {
  inspectWhatsAppPublicAppUrl,
  isWhatsAppPublicAppUrlConfigured,
  resolveWhatsAppPublicAppUrl,
} from '../src/lib/whatsapp/public-app-url.js';
import { tsImport } from 'tsx/esm/api';

const { processIncomingObraMessage } = await tsImport(
  '../src/lib/whatsapp/obra-engine.js',
  { parentURL: import.meta.url, tsconfig: './jsconfig.json' },
);

function engineOptions(environment) {
  return {
    state: {
      attendance: {},
      incidents: [],
      tasks: {},
      alertsCount: 0,
      operariosCount: 0,
    },
    projectSettings: {
      id: 'project-preview',
      organizationId: 'organization-preview',
      timezone: 'America/Argentina/Buenos_Aires',
    },
    worker: {
      id: 'worker-preview',
      projectId: 'project-preview',
      name: 'Carlos Albañil',
      role: 'Albañil',
      active: true,
    },
    environment,
    persist: false,
  };
}

test('Preview uses only its explicit stable public URL', () => {
  const environment = {
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    NEXT_PUBLIC_APP_URL: 'https://obrasaas-preview.vercel.app/',
    VERCEL_PROJECT_PRODUCTION_URL: 'obrasaas.example.com',
  };

  assert.equal(
    resolveWhatsAppPublicAppUrl(environment),
    'https://obrasaas-preview.vercel.app',
  );
  assert.equal(isWhatsAppPublicAppUrlConfigured(environment), true);
});

test('Preview fails closed instead of falling back to the Production project URL', () => {
  const environment = {
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_PROJECT_PRODUCTION_URL: 'obrasaas.example.com',
  };

  assert.throws(
    () => resolveWhatsAppPublicAppUrl(environment),
    (error) => error.code === 'WHATSAPP_PUBLIC_APP_URL_REQUIRED',
  );
  assert.equal(isWhatsAppPublicAppUrlConfigured(environment), false);
});

test('Preview rejects an explicit URL that points at the Production project host', () => {
  const environment = {
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    NEXT_PUBLIC_APP_URL: 'https://obrasaas.example.com/',
    VERCEL_PROJECT_PRODUCTION_URL: 'obrasaas.example.com',
  };

  assert.throws(
    () => resolveWhatsAppPublicAppUrl(environment),
    (error) => error.code === 'WHATSAPP_PUBLIC_APP_URL_PRODUCTION_LEAK',
  );
  assert.deepEqual(inspectWhatsAppPublicAppUrl(environment), {
    configured: false,
    status: 'PRODUCTION_LEAK',
  });
});

test('Preview rejects the canonical Production alias even when Vercel reports another project host', () => {
  const environment = {
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    NEXT_PUBLIC_APP_URL: 'https://obrasaas.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'obrasaas-saas.vercel.app',
  };

  assert.throws(
    () => resolveWhatsAppPublicAppUrl(environment),
    (error) => error.code === 'WHATSAPP_PUBLIC_APP_URL_PRODUCTION_LEAK',
  );
});

test('Preview accepts only its canonical or explicitly registered origin', () => {
  const unregistered = {
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    NEXT_PUBLIC_APP_URL: 'https://candidate-preview.obrasaas.test',
  };
  assert.throws(
    () => resolveWhatsAppPublicAppUrl(unregistered),
    (error) => error.code === 'WHATSAPP_PUBLIC_APP_URL_PREVIEW_NOT_ALLOWED',
  );
  assert.equal(inspectWhatsAppPublicAppUrl(unregistered).status, 'INVALID');

  assert.equal(resolveWhatsAppPublicAppUrl({
    ...unregistered,
    WHATSAPP_PREVIEW_ALLOWED_PUBLIC_ORIGINS:
      'https://candidate-preview.obrasaas.test,https://another-preview.obrasaas.test',
  }), 'https://candidate-preview.obrasaas.test');
});

test('Preview can answer messages that do not emit a webview without a public URL', async () => {
  const result = await processIncomingObraMessage(
    {
      kind: 'text',
      text: 'ayuda',
      timestamp: new Date('2026-07-28T12:00:00.000Z'),
    },
    { projectId: 'project-preview' },
    engineOptions({
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      VERCEL_PROJECT_PRODUCTION_URL: 'obrasaas.example.com',
    }),
  );

  assert.match(result.reply, /Puedo ayudarte/i);
  assert.equal(result.reply.includes('obrasaas.example.com'), false);
});

test('obra engine refuses to issue webview links in Preview without an explicit public URL', async () => {
  await assert.rejects(
    processIncomingObraMessage(
      {
        kind: 'text',
        text: 'certificado',
        timestamp: new Date('2026-07-28T12:00:00.000Z'),
      },
      { projectId: 'project-preview' },
      engineOptions({
          VERCEL: '1',
          VERCEL_ENV: 'preview',
          VERCEL_PROJECT_PRODUCTION_URL: 'obrasaas.example.com',
      }),
    ),
    (error) => error.code === 'WHATSAPP_PUBLIC_APP_URL_REQUIRED',
  );
});

test('Preview medical links remain bound to the explicit Preview origin', async () => {
  const result = await processIncomingObraMessage(
    {
      kind: 'text',
      text: 'certificado',
      timestamp: new Date('2026-07-28T12:00:00.000Z'),
    },
    { projectId: 'project-preview' },
    engineOptions({
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      NEXT_PUBLIC_APP_URL: 'https://obrasaas-preview.vercel.app',
      VERCEL_PROJECT_PRODUCTION_URL: 'obrasaas.example.com',
    }),
  );

  assert.match(
    result.reply,
    /https:\/\/obrasaas-preview\.vercel\.app\/webview\/medical\?/,
  );
  assert.equal(result.reply.includes('obrasaas.example.com'), false);
});

test('Production remains compatible when its documented public URL is explicit', () => {
  assert.equal(resolveWhatsAppPublicAppUrl({
    VERCEL: '1',
    VERCEL_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://app.obrasaas.com',
  }), 'https://app.obrasaas.com');
});

test('deployed webview URLs must be HTTPS while local development keeps localhost', () => {
  assert.throws(
    () => resolveWhatsAppPublicAppUrl({
      VERCEL_ENV: 'preview',
      NEXT_PUBLIC_APP_URL: 'http://preview.obrasaas.test',
    }),
    (error) => error.code === 'WHATSAPP_PUBLIC_APP_URL_INVALID',
  );
  assert.equal(resolveWhatsAppPublicAppUrl({ NODE_ENV: 'development' }), 'http://localhost:3000');
  assert.throws(
    () => resolveWhatsAppPublicAppUrl({ NODE_ENV: 'production' }),
    (error) => error.code === 'WHATSAPP_PUBLIC_APP_URL_REQUIRED',
  );
  assert.throws(
    () => resolveWhatsAppPublicAppUrl({ VERCEL: '1' }),
    (error) => error.code === 'WHATSAPP_PUBLIC_APP_URL_REQUIRED',
  );
  assert.equal(resolveWhatsAppPublicAppUrl({
    NODE_ENV: 'development',
    VERCEL_PROJECT_PRODUCTION_URL: 'obrasaas.example.com',
  }), 'http://localhost:3000');
});

test('configured URLs reject credentials, paths, queries and fragments', () => {
  for (const configured of [
    'https://user:secret@preview.obrasaas.test',
    'https://preview.obrasaas.test/unexpected-path',
    'https://preview.obrasaas.test?tenant=one',
    'https://preview.obrasaas.test#unsafe',
  ]) {
    assert.throws(
      () => resolveWhatsAppPublicAppUrl({
        VERCEL_ENV: 'preview',
        NEXT_PUBLIC_APP_URL: configured,
      }),
      (error) => error.code === 'WHATSAPP_PUBLIC_APP_URL_INVALID',
    );
  }
});
