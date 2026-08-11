import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertS92DescriptorHasNoSecrets,
  assertS92ClientSocketIdentity,
  assertS92RuntimeDatabaseIdentity,
  authorizeS92DisposableDatabase,
  buildS92E2EDescriptor,
  parseS92DatabaseSeedArgs,
  S92_DB_FIXTURE,
  S92_E2E_PERIOD,
  seedS92E2EDatabase,
} from '../scripts/seed-s92-e2e-db.mjs';
import { parseS92FixtureDescriptor } from '../e2e/s92-fixture.js';

function clerkFixture() {
  const actor = (key, tenantRole, organizationKey, clerkRole = 'org:member') => ({
    externalId: `obrasaas-e2e:s92:user:${key}`,
    email: `s92-${key}+clerk_test@example.com`,
    clerkUserId: `user_${key}`,
    clerkOrganizationId: `org_${organizationKey}`,
    tenantRole,
    clerkRole,
  });
  return {
    instanceId: 'ins_Development123',
    environmentType: 'development',
    organizations: {
      tenantA: {
        externalId: 'obrasaas-e2e:s92:organization:primary',
        clerkOrganizationId: 'org_tenantA',
      },
      tenantB: {
        externalId: 'obrasaas-e2e:s92:organization:other',
        clerkOrganizationId: 'org_tenantB',
      },
    },
    actors: {
      admin: actor('admin', 'ADMIN', 'tenantA', 'org:admin'),
      director: actor('director', 'DIRECTOR', 'tenantA'),
      siteManager: actor('site-manager', 'SITE_MANAGER', 'tenantA'),
      finance: actor('finance', 'FINANCE', 'tenantA'),
      auditor: actor('auditor', 'AUDITOR', 'tenantA'),
      outsider: actor('outsider', 'ADMIN', 'tenantB', 'org:admin'),
    },
  };
}

test('database seed CLI resolves descriptor path without weakening gates', () => {
  assert.match(
    parseS92DatabaseSeedArgs([], {}).descriptorPath,
    /test-results[\\/]s92-e2e-fixture\.json$/,
  );
  assert.match(
    parseS92DatabaseSeedArgs([], { S92_E2E_FIXTURE_FILE: 'custom-fixture.json' }).descriptorPath,
    /custom-fixture\.json$/,
  );
  assert.match(
    parseS92DatabaseSeedArgs(['--descriptor', 'explicit.json'], {
      S92_E2E_FIXTURE_FILE: 'ignored.json',
    }).descriptorPath,
    /explicit\.json$/,
  );
  assert.throws(() => parseS92DatabaseSeedArgs(['--apply']), /Unknown argument/);
});

test('database authorization requires explicit disposable opt-in, loopback and exact name', () => {
  const valid = {
    S92_E2E_DISPOSABLE: '1',
    DATABASE_URL: 'postgresql://fixture:secret@127.0.0.1:5432/obrasaas_e2e',
  };
  assert.deepEqual(authorizeS92DisposableDatabase(valid), {
    databaseUrl: valid.DATABASE_URL,
    databaseName: 'obrasaas_e2e',
    hostname: '127.0.0.1',
    port: 5432,
  });
  assert.throws(() => authorizeS92DisposableDatabase({
    ...valid,
    S92_E2E_DISPOSABLE: '0',
  }), /S92_E2E_DISPOSABLE=1/);
  assert.throws(() => authorizeS92DisposableDatabase({
    ...valid,
    DATABASE_URL: 'postgresql://fixture:secret@db.example.com/obrasaas_e2e',
  }), /local PostgreSQL host/);
  assert.throws(() => authorizeS92DisposableDatabase({
    ...valid,
    DATABASE_URL: 'postgresql://fixture:secret@localhost/obrasaas',
  }), /exact database name/);
  assert.throws(() => authorizeS92DisposableDatabase({
    ...valid,
    DATABASE_URL: 'postgresql://fixture:secret@127.0.0.1/obrasaas_e2e?host=evil.example',
  }), /only permits/);
  assert.throws(() => authorizeS92DisposableDatabase({
    ...valid,
    DATABASE_URL: 'postgresql://fixture:secret@127.0.0.1/obrasaas_e2e?host=%2Ftmp',
  }), /only permits/);
  assert.throws(() => authorizeS92DisposableDatabase({
    ...valid,
    DATABASE_URL: 'postgresql://fixture:secret@127.0.0.1/obrasaas_e2e?dbname=other',
  }), /only permits/);
  assert.equal(authorizeS92DisposableDatabase({
    ...valid,
    DATABASE_URL: `${valid.DATABASE_URL}?schema=public`,
  }).databaseName, 'obrasaas_e2e');
});

test('client socket identity verifies the real loopback peer and URL port', () => {
  assert.equal(assertS92ClientSocketIdentity({
    remoteAddress: '127.0.0.1',
    remotePort: 5432,
  }, 5432), true);
  assert.equal(assertS92ClientSocketIdentity({
    remoteAddress: '::1',
    remotePort: 5432,
  }, 5432), true);
  assert.equal(assertS92ClientSocketIdentity({
    remoteAddress: '::ffff:127.0.0.1',
    remotePort: 6543,
  }, 6543), true);
  assert.throws(() => assertS92ClientSocketIdentity({
    remoteAddress: '8.8.8.8',
    remotePort: 5432,
  }, 5432), /not connected to loopback/);
  assert.throws(() => assertS92ClientSocketIdentity({
    remoteAddress: null,
    remotePort: 5432,
  }, 5432), /not connected to loopback/);
  assert.throws(() => assertS92ClientSocketIdentity({
    remoteAddress: '127.0.0.1',
    remotePort: 6543,
  }, 5432), /port differs/);
});

test('runtime database identity independently verifies database and internal port', () => {
  assert.equal(assertS92RuntimeDatabaseIdentity({
    database_name: 'obrasaas_e2e',
    server_port: 5432,
  }), true);
  assert.throws(() => assertS92RuntimeDatabaseIdentity({
    database_name: 'obrasaas',
    server_port: 5432,
  }), /not the exact/);
  assert.throws(() => assertS92RuntimeDatabaseIdentity({
    database_name: 'obrasaas_e2e',
    server_port: 6543,
  }), /internal port 5432/);
});

test('descriptor exposes the closed fortnight, stable actors, payloads and operation keys', () => {
  const descriptor = buildS92E2EDescriptor(clerkFixture());
  assert.equal(descriptor.schemaVersion, 1);
  assert.equal(descriptor.fixtureId, 'obrasaas-e2e:s92');
  assert.deepEqual(descriptor.period, S92_E2E_PERIOD);
  assert.deepEqual(Object.keys(descriptor.primary.actors), [
    'admin', 'director', 'siteManager', 'finance', 'auditor',
  ]);
  assert.equal(descriptor.primary.actors.siteManager.expectedRole, 'SITE_MANAGER');
  assert.equal(descriptor.otherTenant.admin.expectedRole, 'ADMIN');
  assert.equal(descriptor.primary.project.status, 'ACTIVE');
  assert.notEqual(descriptor.primary.anchorProjectId, descriptor.primary.project.id);
  assert.equal(descriptor.primary.tasks.measured.initialProgress, 37);
  assert.equal(descriptor.primary.tasks.missing.initialProgress, 0);
  assert.equal(descriptor.primary.evidence.status, 'APPROVED');
  assert.equal(descriptor.payloads.measurementV1.executedQuantity, '30.0000');
  assert.equal(descriptor.payloads.measurementV2.executedQuantity, '25.0000');
  assert.deepEqual(Object.keys(descriptor.operationKeys), [
    'measurementV1', 'reviewV1', 'cutV1', 'measurementV2', 'reviewV2', 'cutV2',
  ]);
  for (const operationKey of Object.values(descriptor.operationKeys)) {
    assert.match(operationKey, /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
  }
  assert.equal(assertS92DescriptorHasNoSecrets(descriptor), true);
  assert.deepEqual(parseS92FixtureDescriptor(descriptor), descriptor);
  assert.throws(
    () => assertS92DescriptorHasNoSecrets({ password: 'not-allowed' }),
    /forbidden key/,
  );
  assert.throws(
    () => assertS92DescriptorHasNoSecrets({ value: 'sk_test_not-allowed' }),
    /credential-shaped/,
  );
});

test('fixture definition has two target projects plus a distinct primary anchor', () => {
  assert.deepEqual(Object.keys(S92_DB_FIXTURE.projects), ['primary', 'primaryAnchor', 'isolation']);
  assert.notEqual(S92_DB_FIXTURE.projects.primary.id, S92_DB_FIXTURE.projects.primaryAnchor.id);
  assert.equal(S92_DB_FIXTURE.tasks.measured.code, 'S92-MEASURED');
  assert.equal(S92_DB_FIXTURE.tasks.missing.code, 'S92-MISSING');
  assert.equal(S92_DB_FIXTURE.evidence.taskKey, 'measured');
});

test('seed authorization fails before any database or Clerk operation', async () => {
  const calls = [];
  const database = {
    async query() {
      calls.push('database');
      throw new Error('must not be reached');
    },
  };
  await assert.rejects(() => seedS92E2EDatabase({
    environment: {
      S92_E2E_DISPOSABLE: '1',
      DATABASE_URL: 'postgresql://fixture:secret@remote.example.com/obrasaas_e2e',
    },
    database,
    async clerkVerifier() {
      calls.push('clerk');
      throw new Error('must not be reached');
    },
  }), /local PostgreSQL host/);
  assert.deepEqual(calls, []);
});

test('seed source never writes measurements or cuts', async () => {
  const source = await readFile(
    new URL('../scripts/seed-s92-e2e-db.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /INSERT\s+INTO\s+"TaskProgressMeasurement/i);
  assert.doesNotMatch(source, /INSERT\s+INTO\s+"ProjectProgressMeasurementCut/i);
  assert.match(source, /INSERT INTO "ProgressEvidence"/);
  assert.match(source, /assertNoS92LedgerHistory/);
  assert.match(source, /S92_E2E_DISPOSABLE/);
  assert.match(source, /obrasaas_e2e/);
  assert.match(source, /"subscriptionPlan"/);
  assert.match(source, /'PRO', 'ACTIVE', NULL/);
});
