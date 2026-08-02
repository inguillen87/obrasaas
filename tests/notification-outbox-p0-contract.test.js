import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = await readFile(
  new URL('../prisma/migrations/20260802120000_notification_outbox_p0/migration.sql', import.meta.url),
  'utf8',
);
const outbox = await readFile(new URL('../src/lib/notification-outbox.js', import.meta.url), 'utf8');
const client = await readFile(
  new URL('../src/app/dashboard/notifications/notifications-client.js', import.meta.url),
  'utf8',
);
const cronRoute = await readFile(
  new URL('../src/app/api/cron/notifications/route.js', import.meta.url),
  'utf8',
);
const notificationsRoute = await readFile(
  new URL('../src/app/api/notifications/route.js', import.meta.url),
  'utf8',
);
const verifierUrl = new URL('../scripts/verify-notification-outbox-migration.mjs', import.meta.url);
const verifier = await readFile(verifierUrl, 'utf8');
const vercelBuild = await readFile(new URL('../scripts/vercel-build.mjs', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const vercelConfig = JSON.parse(
  await readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
);

test('notification delivery scope is tenant-aware in Prisma and PostgreSQL', () => {
  assert.match(
    schema,
    /project\s+Project\?\s+@relation\(fields: \[organizationId, projectId\], references: \[organizationId, id\]/,
  );
  assert.match(
    schema,
    /@@unique\(\[organizationId, recipientId, channel, eventKey\]\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("organizationId", "projectId"\)[\s\S]*REFERENCES "Project"\("organizationId", "id"\)/,
  );
  assert.match(
    migration,
    /NotificationDelivery_organizationId_recipientId_channel_eventKey_key/,
  );
  assert.match(migration, /NotificationDelivery_read_outcome_check/);
  assert.match(migration, /NotificationDelivery_in_app_delivery_check/);
});

test('legacy inbox rows are normalized without deleting read receipts', () => {
  assert.match(migration, /"readAt" = COALESCE\("readAt", "updatedAt", "createdAt"\)/);
  assert.match(migration, /WHERE "status" = 'READ'/);
  assert.match(migration, /WHERE "channel" = 'IN_APP'/);
  assert.match(migration, /"status" = 'SENT'/);
});

test('new reads use readAt and never mutate delivery status to READ', () => {
  assert.doesNotMatch(outbox, /data:\s*\{\s*status:\s*'READ'/);
  assert.match(outbox, /data: \{ readAt: now \}/);
  assert.doesNotMatch(client, /status:\s*'READ'/);
  assert.match(client, /item\.readAt \? styles\.read/);
  assert.match(client, /body\.marked !== true \|\| typeof body\.readAt !== 'string'/);
  assert.match(client, /readAt: body\.readAt/);
  assert.match(notificationsRoute, /readJsonRequest\(request, \{/);
  assert.match(notificationsRoute, /MAX_NOTIFICATION_READ_BODY_BYTES = 4_000/);
  assert.match(notificationsRoute, /NOTIFICATION_READ_FIELDS = new Set\(\['id'\]\)/);
  assert.match(notificationsRoute, /readAt: result\.readAt\.toISOString\(\)/);
  assert.doesNotMatch(notificationsRoute, /searchParams\.get\(['"]projectId['"]\)/);
  assert.equal(
    [...notificationsRoute.matchAll(/projectId: access\.project\.id/g)].length,
    2,
  );
  assert.match(
    outbox,
    /const scope = \{[\s\S]*organizationId,[\s\S]*recipientId,[\s\S]*projectId,[\s\S]*channel: 'IN_APP'/,
  );
});

test('Vercel invokes the fail-closed notification reconciler every fifteen minutes', () => {
  assert.deepEqual(
    vercelConfig.crons.filter((cron) => cron.path === '/api/cron/notifications'),
    [{ path: '/api/cron/notifications', schedule: '*/15 * * * *' }],
  );
  assert.match(cronRoute, /process\.env\.CRON_SECRET/);
  assert.match(cronRoute, /isAuthorizedCronRequest/);
  assert.match(cronRoute, /export const runtime = 'nodejs'/);
  assert.match(cronRoute, /export const maxDuration = 30/);
});

test('the migration verifier is dedicated, schema-bound, TLS-hardened and rollback-only', () => {
  assert.match(verifier, /NOTIFICATION_OUTBOX_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /DATABASE_URL is intentionally ignored/);
  assert.match(verifier, /NOTIFICATION_OUTBOX_MIGRATION_SCHEMA/);
  assert.match(verifier, /sslmode', 'verify-full'/);
  assert.match(verifier, /SET LOCAL search_path/);
  assert.match(verifier, /expectedMigrationChecksum/);
  assert.match(verifier, /assertNormalization/);
  assert.match(verifier, /cross-tenant project notification/);
  assert.match(verifier, /same-tenant notification replay/);
  assert.match(verifier, /non-delivered IN_APP notification/);
  assert.match(verifier, /await client\.query\('BEGIN'\)/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
  assert.doesNotMatch(verifier, /client\.query\('COMMIT'\)/);
  assert.equal(
    packageJson.scripts['verify:notification-outbox-migration'],
    'node scripts/verify-notification-outbox-migration.mjs',
  );
});

test('the verifier refuses ambient DATABASE_URL and requires its dedicated connection', () => {
  const environment = { ...process.env, DATABASE_URL: 'postgresql://ambient:secret@localhost/ignored' };
  delete environment.NOTIFICATION_OUTBOX_MIGRATION_DATABASE_URL;
  delete environment.NOTIFICATION_OUTBOX_MIGRATION_SCHEMA;
  const result = spawnSync(process.execPath, [fileURLToPath(verifierUrl)], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NOTIFICATION_OUTBOX_MIGRATION_DATABASE_URL is required/);
  assert.match(result.stderr, /DATABASE_URL is intentionally ignored/);
});

test('the protected Vercel build runs the semantic verifier after migrate and before generate', () => {
  const migrate = vercelBuild.indexOf('[cliPaths.prisma, "migrate", "deploy"]');
  const verify = vercelBuild.indexOf('[cliPaths.notificationOutboxVerifier]');
  const generate = vercelBuild.indexOf('[cliPaths.prisma, "generate"]');
  assert.ok(migrate >= 0 && verify > migrate && generate > verify);
  assert.match(vercelBuild, /NOTIFICATION_OUTBOX_MIGRATION_DATABASE_URL/);
  assert.match(vercelBuild, /NOTIFICATION_OUTBOX_MIGRATION_SCHEMA: "public"/);
});
