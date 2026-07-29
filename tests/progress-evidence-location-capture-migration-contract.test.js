import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const schema = await readFile(new URL('prisma/schema.prisma', root), 'utf8');
const migration = await readFile(
  new URL(
    'prisma/migrations/20260729100000_progress_evidence_location_capture/migration.sql',
    root,
  ),
  'utf8',
);
const rateLimitMigration = await readFile(
  new URL(
    'prisma/migrations/20260729110000_progress_evidence_location_rate_limit/migration.sql',
    root,
  ),
  'utf8',
);
const verifier = await readFile(
  new URL('scripts/verify-progress-evidence-location-capture-migration.mjs', root),
  'utf8',
);
const build = await readFile(new URL('scripts/vercel-build.mjs', root), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

function model(name) {
  const match = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, 'm').exec(schema);
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[1];
}

test('Prisma models photo-bound, tenant-scoped location capture sessions', () => {
  assert.match(
    schema,
    /enum ProgressEvidenceCaptureStatus\s*\{\s*AWAITING_LOCATION\s*LOCATION_CAPTURED\s*CONSUMED\s*EXPIRED\s*CANCELLED\s*\}/,
  );
  assert.match(
    schema,
    /enum ProgressEvidenceLocationSource\s*\{\s*WEBVIEW_GEOLOCATION\s*WHATSAPP_DECLARED\s*\}/,
  );
  assert.match(
    schema,
    /enum ProgressEvidenceLocationVerification\s*\{\s*IN_GEOFENCE\s*REVIEW_REQUIRED\s*DECLARED_ONLY\s*\}/,
  );

  const session = model('ProgressEvidenceCaptureSession');
  assert.match(session, /mediaAssetId\s+String\s*$/m);
  assert.doesNotMatch(session, /mediaAssetId\s+String\?/);
  assert.match(session, /project\s+Project\s+@relation\(fields: \[organizationId, projectId\], references: \[organizationId, id\], onDelete: Restrict/);
  assert.match(session, /worker\s+Worker\s+@relation\(fields: \[projectId, workerId\], references: \[projectId, id\], onDelete: Restrict/);
  assert.match(session, /connection\s+WhatsAppConnection\s+@relation\(fields: \[projectId, connectionId\], references: \[projectId, id\], onDelete: Restrict/);
  assert.match(session, /mediaAsset\s+WhatsAppMediaAsset\s+@relation\(fields: \[projectId, mediaAssetId\], references: \[projectId, id\], onDelete: Restrict/);
  assert.match(session, /tokenHash\s+String\s+@unique[\s\S]*@db\.Char\(64\)/);
  assert.match(session, /privacyNoticeVersion\s+String\s+@db\.VarChar\(64\)/);
  assert.match(session, /privacyNoticeContentSha256\s+String\s+@db\.Char\(64\)/);
  assert.match(session, /privacyAcceptedAt\s+DateTime\?/);
  assert.match(session, /operationKeyHash\s+String\?\s+@db\.Char\(64\)/);
  assert.match(session, /requestFingerprint\s+String\?\s+@db\.Char\(64\)/);
  assert.match(session, /@@unique\(\[projectId, mediaAssetId\], map: "ProgressEvidenceCaptureSession_project_media_asset_key"\)/);
  assert.match(session, /@@unique\(\[projectId, operationKeyHash\], map: "ProgressEvidenceCaptureSession_project_operation_key"\)/);
  assert.doesNotMatch(session, /one_active_worker_connection/);
});

test('rate-limit buckets are tenant-scoped, bounded and expirable without per-request audit rows', () => {
  assert.match(
    schema,
    /enum ProgressEvidenceLocationRateScope\s*\{\s*ACTIVE_SESSION\s*ACTIVE_ORGANIZATION\s*INACTIVE_SESSION\s*INACTIVE_ORGANIZATION\s*\}/,
  );
  const bucket = model('ProgressEvidenceLocationRateBucket');
  assert.match(bucket, /organization\s+Organization\s+@relation\(fields: \[organizationId\], references: \[id\], onDelete: Cascade\)/);
  assert.match(bucket, /scopeKeyHash\s+String\s+@db\.Char\(64\)/);
  assert.match(bucket, /windowBuckets\s+Json/);
  assert.match(bucket, /blockedCount\s+BigInt\s+@default\(0\)/);
  assert.match(bucket, /@@unique\(\[organizationId, scope, scopeKeyHash\], map: "PELRateBucket_scope_key"\)/);
  assert.match(bucket, /@@index\(\[organizationId, expiresAt, id\], map: "PELRateBucket_org_expiry_idx"\)/);
  assert.match(bucket, /@@index\(\[expiresAt, id\], map: "PELRateBucket_expiry_idx"\)/);
  assert.match(model('Organization'), /progressEvidenceLocationRateBuckets\s+ProgressEvidenceLocationRateBucket\[\]/);

  assert.match(rateLimitMigration, /CREATE TYPE "ProgressEvidenceLocationRateScope"[\s\S]*?'ACTIVE_SESSION'[\s\S]*?'ACTIVE_ORGANIZATION'[\s\S]*?'INACTIVE_SESSION'[\s\S]*?'INACTIVE_ORGANIZATION'/);
  assert.match(rateLimitMigration, /CREATE TABLE "ProgressEvidenceLocationRateBucket"/);
  assert.match(rateLimitMigration, /jsonb_typeof\("windowBuckets"\) = 'array'/);
  assert.match(rateLimitMigration, /jsonb_array_length\("windowBuckets"\) <= 60/);
  assert.match(rateLimitMigration, /CREATE UNIQUE INDEX "PELRateBucket_scope_key"[\s\S]*?\("organizationId", "scope", "scopeKeyHash"\)/);
  assert.match(rateLimitMigration, /CREATE INDEX "PELRateBucket_org_expiry_idx"[\s\S]*?\("organizationId", "expiresAt", "id"\)/);
  assert.match(rateLimitMigration, /CONSTRAINT "PELRateBucket_organization_fkey"[\s\S]*?ON DELETE CASCADE ON UPDATE CASCADE/);
  assert.match(verifier, /EXPECTED_RATE_BUCKET_COLUMNS/);
  assert.match(verifier, /ProgressEvidenceLocationRateBucket/);
  assert.match(verifier, /PELRateBucket_scope_key/);
});

test('canonical evidence keeps a unique scoped capture link and copied provenance', () => {
  const evidence = model('ProgressEvidence');
  assert.match(evidence, /locationCaptureSessionId\s+String\?\s*$/m);
  assert.doesNotMatch(evidence, /locationCaptureSessionId\s+String\?[^\n]*@unique/);
  assert.match(evidence, /locationCaptureSession\s+ProgressEvidenceCaptureSession\?\s+@relation\("ProgressEvidenceLocationCapture", fields: \[projectId, locationCaptureSessionId\], references: \[projectId, id\], onDelete: Restrict/);
  assert.match(evidence, /locationCapturedAt\s+DateTime\?/);
  assert.match(evidence, /locationSource\s+ProgressEvidenceLocationSource\?/);
  assert.match(evidence, /locationVerification\s+ProgressEvidenceLocationVerification\?/);
  assert.match(evidence, /@@unique\(\[projectId, locationCaptureSessionId\]/);

  for (const parent of [
    'Organization',
    'Project',
    'Worker',
    'WhatsAppConnection',
  ]) {
    assert.match(model(parent), /progressEvidenceCaptureSessions\s+ProgressEvidenceCaptureSession\[\]/);
  }
  assert.match(model('WhatsAppMediaAsset'), /progressEvidenceCaptureSession\s+ProgressEvidenceCaptureSession\?/);
});

test('migration keeps one scoped relation index and an explicit deployment lock gate', () => {
  assert.doesNotMatch(
    migration,
    /CREATE UNIQUE INDEX "ProgressEvidence_location_capture_session_key"/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "ProgressEvidence_project_location_capture_session_key"[\s\S]*?\("projectId", "locationCaptureSessionId"\)/,
  );
  assert.doesNotMatch(migration, /CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY/i);
  assert.match(migration, /Preview rollout must[\s\S]*?measure lock\/scan[\s\S]*?approved write window/);
  assert.match(verifier, /redundant unscoped unique locationCaptureSessionId index/);
});

test('migration binds every session to one exact pre-existing photo without worker-wide locking', () => {
  assert.match(migration, /"mediaAssetId" TEXT NOT NULL/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "ProgressEvidenceCaptureSession_project_media_asset_key"[\s\S]*?\("projectId", "mediaAssetId"\)/,
  );
  assert.doesNotMatch(migration, /one_active_worker_connection/);
  assert.doesNotMatch(migration, /WHERE "status" IN \('AWAITING_LOCATION', 'LOCATION_CAPTURED'\)/);
  for (const constraint of [
    'ProgressEvidenceCaptureSession_project_scope_fkey',
    'ProgressEvidenceCaptureSession_worker_scope_fkey',
    'ProgressEvidenceCaptureSession_connection_scope_fkey',
    'ProgressEvidenceCaptureSession_media_asset_scope_fkey',
    'ProgressEvidence_location_capture_scope_fkey',
  ]) {
    assert.match(migration, new RegExp(`CONSTRAINT "${constraint}"[\\s\\S]*?ON DELETE RESTRICT ON UPDATE CASCADE`));
  }
});

test('device-geolocation bundle is consented, short-lived and conservative without a project geofence', () => {
  assert.match(migration, /ProgressEvidenceCaptureSession_location_bundle_check/);
  assert.match(migration, /"privacyAcceptedAt" >= "issuedAt"/);
  assert.match(migration, /"locationReceivedAt" <= "expiresAt"/);
  assert.match(migration, /"locationCapturedAt" >= "issuedAt" - INTERVAL '2 minutes'/);
  assert.match(migration, /"latitude" BETWEEN -90 AND 90/);
  assert.match(migration, /"longitude" BETWEEN -180 AND 180/);
  assert.match(migration, /"distanceMeters" \+ "accuracyMeters" <= "geofenceRadiusMeters"/);
  assert.match(
    migration,
    /"locationVerification" = 'REVIEW_REQUIRED'[\s\S]*?"distanceMeters" IS NULL AND "geofenceRadiusMeters" IS NULL/,
  );
  assert.match(
    migration,
    /"locationSource" = 'WHATSAPP_DECLARED'[\s\S]*?"accuracyMeters" IS NULL[\s\S]*?"locationVerification" = 'DECLARED_ONLY'/,
  );
  assert.match(migration, /"expiresAt" <= "issuedAt" \+ INTERVAL '30 minutes'/);
});

test('capture lifecycle allows late consumption and only cancels sessions without location', () => {
  assert.match(migration, /"status" = 'EXPIRED'\s+AND "locationCapturedAt" IS NULL/);
  assert.match(migration, /"status" = 'CANCELLED'\s+AND "locationCapturedAt" IS NULL/);
  assert.match(
    migration,
    /OLD\."status" = 'LOCATION_CAPTURED'\s+AND NEW\."status" = 'CONSUMED'/,
  );
  assert.doesNotMatch(
    migration,
    /OLD\."status" = 'LOCATION_CAPTURED'[\s\S]{0,120}NEW\."status" (?:IN \([^)]*|= )(?:'EXPIRED'|'CANCELLED')/,
  );
  assert.match(migration, /"consumedAt" >= "locationReceivedAt"/);
  assert.doesNotMatch(migration, /"consumedAt" <= "expiresAt"/);
  assert.match(migration, /"locationCapturedAt" IS NULL\) = \("operationKeyHash" IS NULL\)/);
});

test('database triggers freeze consent and location and require an exact canonical copy', () => {
  assert.match(migration, /CREATE FUNCTION "enforce_progress_evidence_capture_session_transition"\(\)/);
  assert.match(migration, /SET search_path = pg_catalog/g);
  assert.match(migration, /ProgressEvidenceCaptureSession_location_immutability_guard/);
  assert.match(migration, /ProgressEvidenceCaptureSession_operation_immutability_guard/);
  assert.match(migration, /ProgressEvidenceCaptureSession_terminal_immutability_guard/);
  assert.match(migration, /ProgressEvidenceCaptureSession_consumed_delete_guard/);
  assert.match(migration, /ProgressEvidence_location_delete_guard/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "ProgressEvidenceCaptureSession"/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "ProgressEvidence"/);
  assert.match(migration, /NEW\."revision" <> OLD\."revision" \+ 1/);
  assert.match(migration, /CREATE FUNCTION "validate_progress_evidence_location_capture_link"\(\)/);
  assert.match(migration, /current_session\."status" = 'CONSUMED'/);
  assert.match(migration, /canonical evidence does not exactly copy capture provenance/);
  assert.match(migration, /CREATE CONSTRAINT TRIGGER "ProgressEvidenceCaptureSession_evidence_link_guard"[\s\S]*?DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /CREATE CONSTRAINT TRIGGER "ProgressEvidence_capture_session_link_guard"[\s\S]*?DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /ProgressEvidence_location_immutability_guard/);
});

test('legacy evidence is not rewritten or assigned invented location provenance', () => {
  assert.match(
    migration,
    /ADD CONSTRAINT "ProgressEvidence_location_capture_bundle_check"[\s\S]*?\) NOT VALID;/,
  );
  assert.doesNotMatch(migration, /UPDATE\s+"ProgressEvidence"/);
  assert.doesNotMatch(migration, /ALTER COLUMN "locationCaptureSessionId" SET NOT NULL/);
});

test('semantic verifier is schema-bound, TLS-hardened and rollback-only', () => {
  assert.match(verifier, /PROGRESS_EVIDENCE_LOCATION_CAPTURE_MIGRATION_DATABASE_URL/);
  assert.match(verifier, /PROGRESS_EVIDENCE_LOCATION_CAPTURE_MIGRATION_SCHEMA/);
  assert.match(verifier, /DATABASE_URL is intentionally ignored/);
  assert.match(verifier, /conflicting schema parameters/);
  assert.match(verifier, /sslmode', 'verify-full'/);
  assert.match(verifier, /SET LOCAL search_path/);
  assert.match(verifier, /20260729100000_progress_evidence_location_capture/);
  assert.match(verifier, /20260729110000_progress_evidence_location_rate_limit/);
  assert.match(verifier, /FROM "_prisma_migrations"/);
  assert.match(verifier, /JOIN pg_enum/);
  assert.match(verifier, /FROM information_schema\.columns/);
  assert.match(verifier, /JOIN pg_index/);
  assert.match(verifier, /FROM pg_constraint/);
  assert.match(verifier, /FROM pg_trigger/);
  assert.match(verifier, /Progress evidence location exact photo binding/);
  assert.match(verifier, /Progress evidence geolocation expiry guard/);
  assert.match(verifier, /Progress evidence conservative geofence guard/);
  assert.match(verifier, /Progress evidence consumed session requires canonical evidence/);
  assert.match(verifier, /Progress evidence exact capture copy guard/);
  assert.match(verifier, /Progress evidence linked location immutability/);
  assert.match(verifier, /Progress evidence canonical location delete guard/);
  assert.match(verifier, /Progress evidence consumed capture delete guard/);
  assert.match(verifier, /Progress evidence captured location cancellation guard/);
  assert.match(verifier, /SET CONSTRAINTS ALL IMMEDIATE/);
  assert.match(verifier, /await client\.query\('BEGIN'\)/);
  assert.match(verifier, /SAVEPOINT/);
  assert.match(verifier, /ROLLBACK TO SAVEPOINT/);
  assert.match(verifier, /await client\.query\('ROLLBACK'\)/);
  assert.doesNotMatch(verifier, /client\.query\(['"]COMMIT['"]\)/);
});

test('Vercel runs location capture verification after migration and before generation', () => {
  assert.equal(
    packageJson.scripts['verify:progress-evidence-location-capture-migration'],
    'node scripts/verify-progress-evidence-location-capture-migration.mjs',
  );
  assert.match(build, /verify-progress-evidence-location-capture-migration\.mjs/);
  assert.match(build, /PROGRESS_EVIDENCE_LOCATION_CAPTURE_MIGRATION_DATABASE_URL/);
  assert.match(build, /PROGRESS_EVIDENCE_LOCATION_CAPTURE_MIGRATION_SCHEMA: "public"/);
  const migrate = build.indexOf('[cliPaths.prisma, "migrate", "deploy"]');
  const verify = build.indexOf('[cliPaths.progressEvidenceLocationCaptureVerifier]');
  const generate = build.indexOf('[cliPaths.prisma, "generate"]');
  assert.ok(migrate >= 0 && verify > migrate && generate > verify);
});
