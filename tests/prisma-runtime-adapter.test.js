import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { after, beforeEach, test } from 'node:test';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDisposable = process.env.S92_E2E_DISPOSABLE;
const originalNodeEnv = process.env.NODE_ENV;
const originalVercelEnv = process.env.VERCEL_ENV;

globalThis.__prismaRuntimeAdapterTest = { adapters: [], clients: [] };

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = {
      '@prisma/adapter-neon': 'mock:prisma-adapter-neon',
      '@prisma/adapter-pg': 'mock:prisma-adapter-pg',
      '@/generated/prisma/client': 'mock:generated-prisma-client',
    };
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:prisma-adapter-neon') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export class PrismaNeon {
            constructor(config) {
              this.kind = 'neon';
              globalThis.__prismaRuntimeAdapterTest.adapters.push({ kind: this.kind, config });
            }
          }
        `,
      };
    }
    if (url === 'mock:prisma-adapter-pg') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export class PrismaPg {
            constructor(config, options) {
              this.kind = 'pg';
              globalThis.__prismaRuntimeAdapterTest.adapters.push({
                kind: this.kind,
                config,
                options,
              });
            }
          }
        `,
      };
    }
    if (url === 'mock:generated-prisma-client') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export class PrismaClient {
            constructor(config) {
              this.adapterKind = config.adapter.kind;
              globalThis.__prismaRuntimeAdapterTest.clients.push(this);
            }
          }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { getPrisma } = await import('../src/lib/prisma.js');

beforeEach(() => {
  delete globalThis.__obraSaasPrisma;
  globalThis.__prismaRuntimeAdapterTest.adapters.length = 0;
  globalThis.__prismaRuntimeAdapterTest.clients.length = 0;
  delete process.env.S92_E2E_DISPOSABLE;
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
});

after(() => {
  delete globalThis.__obraSaasPrisma;
  delete globalThis.__prismaRuntimeAdapterTest;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalDisposable === undefined) delete process.env.S92_E2E_DISPOSABLE;
  else process.env.S92_E2E_DISPOSABLE = originalDisposable;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
});

test('uses PrismaNeon for the normal runtime', () => {
  process.env.DATABASE_URL = 'postgresql://neon.example.test/obrasaas?sslmode=verify-full';

  const client = getPrisma();

  assert.equal(client.adapterKind, 'neon');
  assert.deepEqual(globalThis.__prismaRuntimeAdapterTest.adapters, [{
    kind: 'neon',
    config: { connectionString: process.env.DATABASE_URL },
  }]);
});

test('uses PrismaPg only for the explicit S9.2 disposable loopback database', () => {
  process.env.S92_E2E_DISPOSABLE = '1';
  process.env.DATABASE_URL = 'postgresql://obrasaas_e2e:secret@127.0.0.1:5432/obrasaas_e2e?schema=public';

  const client = getPrisma();

  assert.equal(client.adapterKind, 'pg');
  assert.deepEqual(globalThis.__prismaRuntimeAdapterTest.adapters, [{
    kind: 'pg',
    config: { connectionString: process.env.DATABASE_URL },
    options: { schema: 'public' },
  }]);
});

test('fails closed instead of using PrismaPg for a remote disposable target', () => {
  process.env.S92_E2E_DISPOSABLE = '1';
  process.env.DATABASE_URL = 'postgresql://obrasaas_e2e:secret@database.example.test/obrasaas_e2e?schema=public';

  assert.throws(
    () => getPrisma(),
    /exact loopback PostgreSQL host/,
  );
  assert.deepEqual(globalThis.__prismaRuntimeAdapterTest.adapters, []);
  assert.equal(globalThis.__obraSaasPrisma, undefined);
});

test('fails closed on a wrong disposable identity or URL contract', () => {
  process.env.S92_E2E_DISPOSABLE = '1';
  process.env.DATABASE_URL = 'postgresql://obrasaas_e2e:secret@localhost:5432/production?schema=public';
  assert.throws(() => getPrisma(), /exact loopback PostgreSQL host/);

  process.env.DATABASE_URL = 'postgres://obrasaas_e2e:secret@127.0.0.1:5432/obrasaas_e2e?schema=public';
  assert.throws(() => getPrisma(), /exact postgresql protocol/);

  process.env.DATABASE_URL = 'postgresql://obrasaas_e2e:secret@127.0.0.1:5433/obrasaas_e2e?schema=public';
  assert.throws(() => getPrisma(), /exact PostgreSQL TCP port/);

  process.env.DATABASE_URL = 'postgresql://127.0.0.1:5432/obrasaas_e2e?schema=public';
  assert.throws(() => getPrisma(), /explicit database credentials/);

  process.env.DATABASE_URL = 'postgresql://obrasaas_e2e@127.0.0.1:5432/obrasaas_e2e?schema=public';
  assert.throws(() => getPrisma(), /explicit database credentials/);

  process.env.DATABASE_URL = 'postgresql://obrasaas_e2e:secret@127.0.0.1:5432/production?schema=public';
  assert.throws(() => getPrisma(), /exact obrasaas_e2e database/);

  process.env.DATABASE_URL = 'postgresql://obrasaas_e2e:secret@127.0.0.1:5432/%6fbrasaas_e2e?schema=public';
  assert.throws(() => getPrisma(), /exact obrasaas_e2e database/);

  process.env.DATABASE_URL = 'postgresql://obrasaas_e2e:secret@127.0.0.1:5432/obrasaas_e2e?schema=public&sslmode=disable';
  assert.throws(() => getPrisma(), /exact schema=public option/);

  process.env.DATABASE_URL = 'postgresql://obrasaas_e2e:secret@127.0.0.1:5432/obrasaas_e2e?schema=public&schema=public';
  assert.throws(() => getPrisma(), /exact schema=public option/);

  process.env.DATABASE_URL = 'postgresql://obrasaas_e2e:secret@127.0.0.1:5432/obrasaas_e2e?schema=public#unexpected';
  assert.throws(() => getPrisma(), /must not include a fragment/);

  assert.deepEqual(globalThis.__prismaRuntimeAdapterTest.adapters, []);
});

test('keeps PrismaNeon in production-like environments even if the disposable flag leaks', () => {
  process.env.S92_E2E_DISPOSABLE = '1';
  process.env.DATABASE_URL = 'postgresql://neon.example.test/obrasaas?sslmode=verify-full';
  process.env.NODE_ENV = 'production';

  assert.equal(getPrisma().adapterKind, 'neon');

  delete globalThis.__obraSaasPrisma;
  globalThis.__prismaRuntimeAdapterTest.adapters.length = 0;
  process.env.NODE_ENV = 'development';
  process.env.VERCEL_ENV = 'preview';
  assert.equal(getPrisma().adapterKind, 'neon');
  assert.deepEqual(
    globalThis.__prismaRuntimeAdapterTest.adapters.map(({ kind }) => kind),
    ['neon'],
  );
});

test('fails closed when disposable mode is enabled outside a known runtime mode', () => {
  process.env.S92_E2E_DISPOSABLE = '1';
  process.env.DATABASE_URL = 'postgresql://obrasaas_e2e:secret@127.0.0.1:5432/obrasaas_e2e?schema=public';
  process.env.NODE_ENV = 'test';

  assert.throws(() => getPrisma(), /restricted to local development/);
  assert.deepEqual(globalThis.__prismaRuntimeAdapterTest.adapters, []);
});

test('still requires DATABASE_URL before selecting an adapter', () => {
  delete process.env.DATABASE_URL;

  assert.throws(
    () => getPrisma(),
    /DATABASE_URL is required for durable ObraSaaS storage/,
  );
  assert.deepEqual(globalThis.__prismaRuntimeAdapterTest.adapters, []);
});

test('pins the PrismaPg runtime adapter to the generated Prisma version', async () => {
  const packageJson = JSON.parse(await readFile(
    new URL('../package.json', import.meta.url),
    'utf8',
  ));
  const packageLock = JSON.parse(await readFile(
    new URL('../package-lock.json', import.meta.url),
    'utf8',
  ));

  assert.equal(packageJson.dependencies['@prisma/adapter-pg'], '7.9.0');
  assert.equal(packageLock.packages[''].dependencies['@prisma/adapter-pg'], '7.9.0');
  assert.equal(packageLock.packages['node_modules/@prisma/adapter-pg'].version, '7.9.0');
});
