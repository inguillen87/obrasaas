import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  PRIVACY_DISCOVERY_CATALOG_SHA256,
  PRIVACY_DISCOVERY_CATALOG_VERSION,
} from '../src/lib/privacy-discovery.js';

const root = new URL('../', import.meta.url);
const schema = await readFile(new URL('prisma/schema.prisma', root), 'utf8');
const migration = await readFile(new URL(
  'prisma/migrations/20260729140000_data_subject_discovery_foundation/migration.sql',
  root,
), 'utf8');

function model(name) {
  const match = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, 'm').exec(schema);
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[1];
}

test('PRO-05A schema stores only tenant-scoped cases, commitments and policy codes', () => {
  const request = model('DataSubjectRequest');
  const manifest = model('DataSubjectDiscoveryManifest');
  const item = model('DataSubjectDiscoveryItem');
  assert.match(schema, /enum DataSubjectRequestStatus[\s\S]*DISCOVERY_BLOCKED[\s\S]*DISCOVERY_FAILED/);
  assert.match(request, /operationKeyHash\s+String\s+@db\.Char\(64\)/);
  assert.match(request, /requestFingerprint\s+String\s+@db\.Char\(64\)/);
  assert.match(request, /fields: \[organizationId, workerPersonId\][\s\S]*onDelete: Restrict/);
  assert.match(
    request,
    /@@index\(\[organizationId, receivedAt\], map: "DataSubjectRequest_org_received_idx"\)/,
  );
  assert.doesNotMatch(manifest, /^\s+updatedAt\s+/m);
  assert.doesNotMatch(item, /^\s+(?:payload|metadata|content|body|locator|email|phone|cuil|cbu|cvu|alias)\s+/mi);
  assert.doesNotMatch(item, /\bJson\b|@db\.Text/);
  for (const field of ['locatorFingerprintHmac', 'recordFingerprintHmac']) {
    assert.match(item, new RegExp(`${field}\\s+String\\?\\s+@db\\.Char\\(64\\)`));
  }
});

test('PRO-05A migration enforces exact subjects, tenant FKs and a deferred child-first seal', () => {
  assert.match(migration, /DataSubjectRequest_exact_subject_check[\s\S]*TENANT_MEMBER[\s\S]*WORKER_PERSON/);
  for (const constraint of [
    'DataSubjectRequest_subject_membership_fkey',
    'DataSubjectRequest_worker_person_fkey',
    'DataSubjectRequest_received_by_fkey',
    'DataSubjectRequest_attested_by_fkey',
    'DataSubjectRequest_completed_by_fkey',
    'DataSubjectDiscoveryManifest_request_fkey',
    'DataSubjectDiscoveryManifest_sealed_by_fkey',
    'DataSubjectDiscoveryItem_manifest_fkey',
  ]) {
    assert.match(migration, new RegExp(`${constraint}[\\s\\S]{0,350}ON DELETE RESTRICT`));
  }
  assert.match(migration, /DataSubjectDiscoveryItem_manifest_fkey[\s\S]{0,500}DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /"itemCount" <= 1024/);
  assert.match(migration, /"ordinal" BETWEEN 0 AND 1023/);
  assert.match(migration, /DataSubjectDiscoveryManifest_catalog_v1_pin_check[\s\S]{0,350}"outcome" = 'BLOCKED'/);
  assert.match(migration, /DataSubjectRequest_org_actor_received_idx/);
  assert.match(
    migration,
    /CREATE INDEX "DataSubjectRequest_org_received_idx"\s+ON "DataSubjectRequest"\("organizationId", "receivedAt"\)/,
  );
  assert.ok(migration.includes(PRIVACY_DISCOVERY_CATALOG_VERSION));
  assert.ok(migration.includes(PRIVACY_DISCOVERY_CATALOG_SHA256));
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*data-subject-manifest/);
  assert.match(migration, /DataSubjectDiscoveryItem_before_seal/);
  assert.match(migration, /DataSubjectDiscoveryManifest_seal/);
  assert.match(migration, /DataSubjectDiscoveryManifest_terminal_check[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
});

test('PRO-05A migration makes lifecycle and sealed evidence fail-closed at the database', () => {
  assert.match(migration, /^\s*--[\s\S]*\nBEGIN;/);
  assert.match(migration, /SET LOCAL lock_timeout = '5s';/);
  assert.match(migration, /SET LOCAL statement_timeout = '30s';/);
  assert.match(migration, /COMMIT;\s*$/);
  for (const transition of [
    "'RECEIVED' AND NEW.\"status\"::TEXT = 'AUTHORITY_ATTESTED'",
    "'AUTHORITY_ATTESTED' AND NEW.\"status\"::TEXT = 'DISCOVERING'",
    "'DISCOVERING'",
    "'DISCOVERED'",
    "'DISCOVERY_BLOCKED'",
    "'DISCOVERY_FAILED'",
  ]) assert.ok(migration.includes(transition), transition);
  assert.match(migration, /sha256\(convert_to\(canonical_manifest, 'UTF8'\)\)/);
  assert.match(migration, /"sourceSnapshotAt" TIMESTAMPTZ\(3\)/);
  assert.match(migration, /"observedAt" AT TIME ZONE 'UTC'/);
  assert.match(migration, /NEW\."sourceSnapshotAt" AT TIME ZONE 'UTC'/);
  assert.match(migration, /NEW\."manifestSha256"::TEXT IS DISTINCT FROM expected_manifest_sha256/);
  assert.match(migration, /actual_item_count[\s\S]*actual_blocker_count/);
  assert.match(migration, /NEW\."operationKeyHash"::TEXT IS DISTINCT FROM request_operation_key_hash/);
  assert.match(migration, /NEW\."requestFingerprint"::TEXT IS DISTINCT FROM request_fingerprint/);
  assert.match(migration, /actual_min_ordinal <> 0/);
  assert.match(migration, /actual_max_ordinal <> actual_item_count - 1/);
  assert.match(migration, /actual_snapshot_mismatch_count <> 0/);
  assert.match(migration, /actual_required_blocker_count <> 8/);
  assert.match(migration, /DataSubjectDiscoveryItem_org_manifest_blocker_key/);
  assert.match(migration, /NEW\."createdAt" := observed_at/);
  assert.match(migration, /DataSubjectDiscoveryItem_kind_check[\s\S]*COVERAGE_BLOCKER/);
  assert.match(migration, /DataSubjectDiscoveryItem_disposition_check[\s\S]*REVIEW_REQUIRED/);
  assert.match(migration, /ERRCODE = '55000'/);

  for (const trigger of [
    'DataSubjectRequest_insert_guard',
    'DataSubjectRequest_lifecycle_guard',
    'DataSubjectRequest_no_delete',
    'DataSubjectRequest_no_truncate',
    'DataSubjectDiscoveryManifest_seal',
    'DataSubjectDiscoveryManifest_terminal_check',
    'DataSubjectDiscoveryManifest_append_only',
    'DataSubjectDiscoveryManifest_no_truncate',
    'DataSubjectDiscoveryItem_before_seal',
    'DataSubjectDiscoveryItem_append_only',
    'DataSubjectDiscoveryItem_no_truncate',
  ]) {
    assert.match(migration, new RegExp(`ENABLE ALWAYS TRIGGER "${trigger}"`));
  }
});

test('public privacy copy no longer promises unimplemented universal 30/90-day deletion', async () => {
  const deletionPage = await readFile(new URL('src/app/data-deletion/page.js', root), 'utf8');
  const privacyPage = await readFile(new URL('src/app/privacy/page.js', root), 'utf8');
  for (const source of [deletionPage, privacyPage]) {
    assert.doesNotMatch(source, /datos operativos dentro de 30 días/i);
    assert.doesNotMatch(source, /normalmente dentro de 90 días/i);
  }
  assert.match(deletionPage, /No declaramos la solicitud completada/);
  assert.match(privacyPage, /no declaramos un borrado global/);
  for (const right of ['acceso', 'corrección', 'restricción', 'oposición', 'portabilidad', 'eliminación']) {
    assert.match(deletionPage, new RegExp(right, 'i'));
    assert.match(privacyPage, new RegExp(right, 'i'));
  }
  assert.match(deletionPage, /updatedAt="29 de julio de 2026"/);
  assert.match(privacyPage, /updatedAt="29 de julio de 2026"/);
  assert.doesNotMatch(deletionPage, /ciclos contractuales aprobados/i);
  assert.doesNotMatch(privacyPage, /mecanismos contractuales aprobados/i);
});
