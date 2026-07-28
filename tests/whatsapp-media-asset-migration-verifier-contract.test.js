import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const verifier = await readFile(
  new URL('scripts/verify-whatsapp-media-asset-migration.mjs', root),
  'utf8',
);
const migration = await readFile(
  new URL(
    'prisma/migrations/20260728070000_whatsapp_media_asset_lifecycle/migration.sql',
    root,
  ),
  'utf8',
);
const build = await readFile(new URL('scripts/vercel-build.mjs', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

test('media asset verifier uses an isolated schema-bound TLS connection', () => {
  assert.match(verifier, /WHATSAPP_MEDIA_ASSET_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /WHATSAPP_MEDIA_ASSET_MIGRATION_SCHEMA/);
  assert.match(verifier, /DATABASE_URL is intentionally ignored/);
  assert.match(verifier, /postgres:', 'postgresql:/);
  assert.match(verifier, /SCHEMA_IDENTIFIER_PATTERN/);
  assert.match(verifier, /conflicting schema parameters/);
  assert.match(verifier, /sslmode', 'verify-full'/);
  assert.match(verifier, /must use sslmode=verify-full for a remote PostgreSQL host/);
  assert.match(verifier, /SET LOCAL search_path/);
  assert.match(verifier, /obrasaas-whatsapp-media-asset-migration-verifier/);
  assert.doesNotMatch(verifier, /console\.(?:log|error)\([^\n]*connectionString/);
});

test('media asset verifier catalogs the exact lifecycle, v2 fields and constraints', () => {
  assert.match(verifier, /20260728070000_whatsapp_media_asset_lifecycle/);
  assert.match(verifier, /FROM "_prisma_migrations"/);
  assert.match(verifier, /JOIN pg_enum/);
  assert.match(verifier, /FROM information_schema\.columns/);
  assert.match(verifier, /WhatsAppMediaAssetStatus:[\s\S]*UPLOADING[\s\S]*AVAILABLE[\s\S]*CLAIMED[\s\S]*DELETE_PENDING[\s\S]*DELETED[\s\S]*FAILED/);
  for (const field of [
    'fileName',
    'mimeType',
    'providerMediaIdHash',
    'providerMessageIdHash',
    'uploadLeaseToken',
    'nextUploadAttemptAt',
    'purgeEligibleAt',
    'deleteLeaseToken',
    'nextDeleteAttemptAt',
    'tombstoneSha256',
  ]) {
    assert.match(verifier, new RegExp(`${field}:`));
  }
  for (const constraint of [
    'WhatsAppMediaAsset_hashes_check',
    'WhatsAppMediaAsset_metadata_check',
    'WhatsAppMediaAsset_state_check',
    'WhatsAppMediaAsset_timestamps_check',
  ]) {
    assert.match(verifier, new RegExp(constraint));
    assert.match(migration, new RegExp(`CONSTRAINT "${constraint}"`));
  }
  assert.match(verifier, /check\.convalidated/);
});

test('media asset verifier governs partial purge and scoped RESTRICT ownership', () => {
  assert.match(verifier, /JOIN pg_index/);
  assert.match(verifier, /indisvalid/);
  assert.match(verifier, /indisready/);
  assert.match(verifier, /indnullsnotdistinct/);
  assert.match(verifier, /pg_get_expr\(index_state\.indpred/);
  assert.match(verifier, /WhatsAppMediaAsset_purge_available_idx:[\s\S]*predicateFragments:[\s\S]*available[\s\S]*is not null/);
  assert.match(verifier, /!predicate\.includes\('claimed'\)/);

  for (const constraint of [
    'WhatsAppMediaAsset_project_scope_fkey',
    'WhatsAppMediaAsset_webhook_event_scope_fkey',
    'WhatsAppMediaAsset_conversation_scope_fkey',
    'WhatsAppMediaAsset_message_scope_fkey',
  ]) {
    assert.match(verifier, new RegExp(`${constraint}:`));
  }
  assert.match(verifier, /foreignKey\.confdeltype === 'r'/);
  assert.match(verifier, /foreignKey\.confupdtype === 'c'/);
  assert.match(verifier, /!foreignKey\.condeferrable && !foreignKey\.condeferred/);
  assert.match(verifier, /source_attribute\.attname::text/);
  assert.match(verifier, /target_attribute\.attname::text/);
});

test('media asset verifier smoke is rollback-only and proves CLAIMED retention', () => {
  assert.match(verifier, /await client\.query\('BEGIN'\)/);
  assert.match(verifier, /SAVEPOINT/);
  assert.match(verifier, /ROLLBACK TO SAVEPOINT/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
  assert.doesNotMatch(verifier, /(?:await\s+client\.query\(|client\.query\()\s*['"]COMMIT['"]/);
  assert.match(verifier, /WhatsAppMediaAsset UPLOADING lease or backoff guard/);
  assert.match(verifier, /WhatsAppMediaAsset CLAIMED purge exclusion/);
  assert.match(verifier, /CLAIMED rows must remain outside purge candidates/);
  assert.match(verifier, /WhatsAppMediaAsset cross-tenant project scope/);
  assert.match(verifier, /WhatsAppMediaAsset cross-project webhook scope/);
  assert.match(verifier, /WhatsAppMediaAsset cross-project Message claim scope/);
  assert.match(verifier, /WhatsAppMediaAsset claimed Message retention policy/);
  assert.match(verifier, /WhatsAppMediaAsset durable WebhookEvent provenance/);
  assert.match(verifier, /WhatsAppMediaAsset CLAIMED terminal transition guard/);
  assert.match(verifier, /WhatsAppMediaAsset CLAIMED same-status immutability guard/);
  assert.match(verifier, /WhatsAppMediaAsset UPLOADING row retention guard/);
  assert.match(verifier, /WhatsAppMediaAsset AVAILABLE row retention guard/);
  assert.match(verifier, /WhatsAppMediaAsset CLAIMED row retention guard/);
  assert.match(verifier, /WhatsAppMediaAsset DELETE_PENDING row retention guard/);
  assert.match(verifier, /WhatsAppMediaAsset DELETED same-status immutability guard/);
  assert.match(verifier, /WhatsAppMediaAsset DELETED row retention guard/);
  assert.match(verifier, /WhatsAppMediaAsset FAILED row retention guard/);
  assert.match(verifier, /'23514'/);
  assert.match(verifier, /'23503'/);
  assert.match(verifier, /'23505'/);
});

test('media asset verifier catalogs and exercises the terminal transition trigger', () => {
  assert.match(verifier, /FROM pg_trigger AS trigger_record/);
  assert.match(verifier, /JOIN pg_proc AS procedure_record/);
  assert.match(verifier, /pg_get_triggerdef/);
  assert.match(verifier, /pg_get_functiondef/);
  assert.match(verifier, /trigger\.tgenabled === 'O'/);
  assert.match(verifier, /trigger\.prosecdef === false/);
  assert.match(verifier, /search_path=pg_catalog/);
  assert.match(verifier, /terminal guard must run before updates and deletes/);
  assert.match(verifier, /tg_op = 'delete'/);
  assert.match(verifier, /old\.status = 'uploading'/);
  assert.match(verifier, /old\.status = 'available'/);
  assert.match(verifier, /old\.status = 'delete_pending'/);
  assert.match(verifier, /whatsappmediaasset_transition_guard/);
  assert.match(verifier, /whatsappmediaasset_row_retention_guard/);
  assert.match(verifier, /whatsappmediaasset_terminal_immutability_guard/);
});

test('Vercel executes media asset verification after deploy and before generation', () => {
  assert.equal(
    packageJson.scripts['verify:whatsapp-media-asset-migration'],
    'node scripts/verify-whatsapp-media-asset-migration.mjs',
  );
  assert.match(build, /verify-whatsapp-media-asset-migration\.mjs/);
  assert.match(build, /WHATSAPP_MEDIA_ASSET_MIGRATION_DATABASE_URL/);
  assert.match(build, /WHATSAPP_MEDIA_ASSET_MIGRATION_SCHEMA: "public"/);
  const migrate = build.indexOf('[cliPaths.prisma, "migrate", "deploy"]');
  const verifierCall = build.indexOf('[cliPaths.whatsappMediaAssetVerifier]');
  const generate = build.indexOf('[cliPaths.prisma, "generate"]');
  assert.ok(migrate >= 0 && verifierCall > migrate && generate > verifierCall);
});
