import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  NOTIFICATION_OUTBOX_PREFLIGHT_ACTION,
  classifyNotificationOutboxPreflightState,
} from '../scripts/notification-outbox-preflight-state.mjs';

const preflightUrl = new URL(
  '../scripts/preflight-notification-outbox-project-scope.mjs',
  import.meta.url,
);
const preflight = await readFile(preflightUrl, 'utf8');
const vercelBuild = await readFile(new URL('../scripts/vercel-build.mjs', import.meta.url), 'utf8');

function runPreflight(environment) {
  return spawnSync(process.execPath, [fileURLToPath(preflightUrl)], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, ...environment },
    encoding: 'utf8',
    windowsHide: true,
  });
}

test('project-scope preflight is dedicated, schema-bound, TLS-hardened and read-only', () => {
  assert.match(preflight, /NOTIFICATION_OUTBOX_PREFLIGHT_DATABASE_URL/);
  assert.match(preflight, /migration and runtime URLs are intentionally ignored/);
  assert.match(preflight, /NOTIFICATION_OUTBOX_PREFLIGHT_SCHEMA/);
  assert.match(preflight, /sslmode', 'verify-full'/);
  assert.match(preflight, /SET LOCAL search_path/);
  assert.match(preflight, /BEGIN TRANSACTION READ ONLY/);
  assert.match(preflight, /SHOW transaction_read_only/);
  assert.match(preflight, /await client\.query\('ROLLBACK'\)/);
  assert.doesNotMatch(preflight, /client\.query\(\s*[`'"](?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)/i);
  assert.doesNotMatch(preflight, /client\.query\('COMMIT'\)/);
});

test('preflight detects missing projects and cross-tenant project ownership using a safe count', () => {
  assert.match(preflight, /COUNT\(\*\)::text AS violation_count/);
  assert.match(preflight, /LEFT JOIN "Project" AS project_record/);
  assert.match(preflight, /project_record\."id" IS NULL/);
  assert.match(
    preflight,
    /project_record\."organizationId" <> delivery\."organizationId"/,
  );
  assert.match(preflight, /const violationCount = BigInt\(countText\)/);
  assert.match(preflight, /found \$\{violationCount\.toString\(\)\} incompatible row\(s\)/);
  assert.doesNotMatch(preflight, /SELECT[\s\S]{0,120}delivery\."id"/i);
});

test('clean bootstrap skips safely before the notification base migration exists', () => {
  assert.deepEqual(classifyNotificationOutboxPreflightState({
    projectExists: false,
    notificationDeliveryExists: false,
    migrationTableExists: false,
    baseMigrationApplied: false,
  }), {
    action: NOTIFICATION_OUTBOX_PREFLIGHT_ACTION.SKIP_BOOTSTRAP,
    reason: 'BASE_MIGRATION_NOT_APPLIED',
  });
  assert.deepEqual(classifyNotificationOutboxPreflightState({
    projectExists: true,
    notificationDeliveryExists: false,
    migrationTableExists: true,
    baseMigrationApplied: false,
  }).action, NOTIFICATION_OUTBOX_PREFLIGHT_ACTION.SKIP_BOOTSTRAP);
});

test('bootstrap inconsistencies fail closed before scope inspection', () => {
  assert.throws(
    () => classifyNotificationOutboxPreflightState({
      projectExists: true,
      notificationDeliveryExists: false,
      migrationTableExists: true,
      baseMigrationApplied: true,
    }),
    /base migration is applied but its table is missing/,
  );
  assert.throws(
    () => classifyNotificationOutboxPreflightState({
      projectExists: true,
      notificationDeliveryExists: true,
      migrationTableExists: true,
      baseMigrationApplied: false,
    }),
    /without its applied base migration/,
  );
  assert.throws(
    () => classifyNotificationOutboxPreflightState({
      projectExists: false,
      notificationDeliveryExists: true,
      migrationTableExists: true,
      baseMigrationApplied: true,
    }),
    /Project is missing/,
  );
});

test('an applied and complete base proceeds to tenant-scope verification', () => {
  assert.deepEqual(classifyNotificationOutboxPreflightState({
    projectExists: true,
    notificationDeliveryExists: true,
    migrationTableExists: true,
    baseMigrationApplied: true,
  }), {
    action: NOTIFICATION_OUTBOX_PREFLIGHT_ACTION.VERIFY_SCOPE,
    reason: null,
  });
  assert.match(preflight, /20260724150000_notification_outbox/);
  assert.match(preflight, /clean bootstrap/);
});

test('preflight refuses ambient migration URLs when its dedicated URL is absent', () => {
  const environment = {
    DATABASE_URL: 'postgresql://ambient:secret@localhost/ignored',
    DIRECT_URL: 'postgresql://ambient:secret@localhost/ignored',
  };
  delete environment.NOTIFICATION_OUTBOX_PREFLIGHT_DATABASE_URL;
  const result = runPreflight(environment);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NOTIFICATION_OUTBOX_PREFLIGHT_DATABASE_URL is required/);
  assert.match(result.stderr, /migration and runtime URLs are intentionally ignored/);
});

test('preflight rejects a remote connection without full TLS verification before connecting', () => {
  const result = runPreflight({
    NOTIFICATION_OUTBOX_PREFLIGHT_DATABASE_URL:
      'postgresql://verifier:secret@database.example.test/obrasaas?schema=public',
    NOTIFICATION_OUTBOX_PREFLIGHT_SCHEMA: 'public',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must use sslmode=verify-full/);
  assert.doesNotMatch(result.stderr, /verifier:secret/);
});

test('Vercel build places the preflight before Prisma migration DDL', () => {
  const preflightCall = vercelBuild.indexOf('[cliPaths.notificationOutboxScopePreflight]');
  const migrateCall = vercelBuild.indexOf('[cliPaths.prisma, "migrate", "deploy"]');
  assert.ok(preflightCall >= 0 && migrateCall > preflightCall);
  assert.match(vercelBuild, /NOTIFICATION_OUTBOX_PREFLIGHT_DATABASE_URL/);
  assert.match(vercelBuild, /NOTIFICATION_OUTBOX_PREFLIGHT_SCHEMA: "public"/);
});
