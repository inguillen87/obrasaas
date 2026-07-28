import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const schema = await readFile(new URL('prisma/schema.prisma', root), 'utf8');
const migration = await readFile(
  new URL(
    'prisma/migrations/20260728070000_whatsapp_media_asset_lifecycle/migration.sql',
    root,
  ),
  'utf8',
);

function modelBlock(name) {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[1];
}

test('WhatsAppMediaAsset Prisma contract is tenant/project scoped and provider neutral', () => {
  const asset = modelBlock('WhatsAppMediaAsset');
  const webhook = modelBlock('WebhookEvent');

  assert.match(
    schema,
    /enum WhatsAppMediaAssetStatus \{[\s\S]*?UPLOADING[\s\S]*?AVAILABLE[\s\S]*?CLAIMED[\s\S]*?DELETE_PENDING[\s\S]*?DELETED[\s\S]*?FAILED[\s\S]*?\}/,
  );
  assert.match(asset, /project\s+Project\s+@relation\(fields: \[organizationId, projectId\], references: \[organizationId, id\], onDelete: Restrict/);
  assert.match(asset, /webhookEvent\s+WebhookEvent\s+@relation\(fields: \[projectId, webhookEventId\], references: \[projectId, id\], onDelete: Restrict/);
  assert.match(asset, /messageConversation\s+Conversation\?\s+@relation\("WhatsAppMediaAssetConversation", fields: \[projectId, messageConversationId\], references: \[projectId, id\], onDelete: Restrict/);
  assert.match(asset, /message\s+Message\?\s+@relation\("WhatsAppMediaAssetMessage", fields: \[messageConversationId, messageId\], references: \[conversationId, id\], onDelete: Restrict/);
  assert.match(webhook, /@@unique\(\[projectId, id\], map: "WebhookEvent_projectId_id_key"\)/);

  for (const field of [
    'providerMediaIdHash',
    'providerMessageIdHash',
    'operationKeyHash',
    'requestFingerprint',
    'storageLocatorHash',
    'contentSha256',
    'fileName',
    'mimeType',
    'uploadLeaseToken',
    'uploadLeaseExpiresAt',
    'nextUploadAttemptAt',
    'purgeEligibleAt',
    'claimFingerprint',
    'deleteOperationKeyHash',
    'deleteRequestFingerprint',
    'deleteLeaseToken',
    'deleteLeaseExpiresAt',
    'nextDeleteAttemptAt',
    'tombstoneSha256',
  ]) {
    assert.match(asset, new RegExp(`\\b${field}\\b`));
  }
  assert.match(asset, /mediaKind\s+MessageKind/);
  assert.match(asset, /@@unique\(\[projectId, operationKeyHash\], map: "WhatsAppMediaAsset_project_operation_key"\)/);
  assert.match(asset, /@@unique\(\[projectId, providerMessageIdHash, providerMediaIdHash\], map: "WhatsAppMediaAsset_project_provider_identity_key"\)/);
  assert.match(asset, /@@unique\(\[projectId, messageConversationId, messageId\], map: "WhatsAppMediaAsset_project_message_key"\)/);
});

test('migration enforces deterministic upload intent, canonical media and terminal tombstones', () => {
  assert.match(migration, /CREATE TYPE "WhatsAppMediaAssetStatus" AS ENUM/);
  assert.match(migration, /CREATE TABLE "WhatsAppMediaAsset"/);
  assert.match(migration, /"fileName" VARCHAR\(255\)/);
  assert.match(migration, /"mimeType" VARCHAR\(120\)/);
  assert.match(migration, /CONSTRAINT "WhatsAppMediaAsset_hashes_check" CHECK/);
  assert.match(migration, /CONSTRAINT "WhatsAppMediaAsset_metadata_check" CHECK/);
  assert.match(migration, /CONSTRAINT "WhatsAppMediaAsset_state_check" CHECK/);
  assert.match(migration, /CONSTRAINT "WhatsAppMediaAsset_timestamps_check" CHECK/);

  assert.match(migration, /"status" = 'UPLOADING'[\s\S]*?"storageProvider" IS NOT NULL[\s\S]*?"storage" IS NOT NULL[\s\S]*?"storageLocatorHash" IS NOT NULL[\s\S]*?"contentSha256" IS NOT NULL[\s\S]*?"sizeBytes" IS NOT NULL[\s\S]*?"purgeEligibleAt" IS NOT NULL/);
  assert.match(migration, /"status" = 'AVAILABLE'[\s\S]*?"fileName" IS NOT NULL[\s\S]*?"mimeType" IS NOT NULL[\s\S]*?"contentSha256" IS NOT NULL/);
  assert.match(migration, /"status" = 'CLAIMED'[\s\S]*?"purgeEligibleAt" IS NULL[\s\S]*?"messageConversationId" IS NOT NULL[\s\S]*?"messageId" IS NOT NULL[\s\S]*?"claimFingerprint" IS NOT NULL/);
  assert.match(migration, /"status" = 'DELETED'[\s\S]*?"storage" IS NULL[\s\S]*?"tombstoneSha256" IS NOT NULL/);
  assert.match(migration, /"status" = 'FAILED'[\s\S]*?"storageProvider" IS NULL[\s\S]*?"storage" IS NULL[\s\S]*?"lastErrorCode" IS NOT NULL/);
});

test('migration keeps CLAIMED outside purge and makes provenance deletion restrictive', () => {
  assert.match(
    migration,
    /CREATE INDEX "WhatsAppMediaAsset_purge_available_idx"[\s\S]*?WHERE "status" = 'AVAILABLE' AND "purgeEligibleAt" IS NOT NULL/,
  );
  const purgeIndex = migration.match(
    /CREATE INDEX "WhatsAppMediaAsset_purge_available_idx"[\s\S]*?;/,
  )?.[0];
  assert.ok(purgeIndex);
  assert.doesNotMatch(purgeIndex, /CLAIMED/);

  for (const constraint of [
    'WhatsAppMediaAsset_project_scope_fkey',
    'WhatsAppMediaAsset_webhook_event_scope_fkey',
    'WhatsAppMediaAsset_conversation_scope_fkey',
    'WhatsAppMediaAsset_message_scope_fkey',
  ]) {
    assert.match(
      migration,
      new RegExp(`CONSTRAINT "${constraint}"[\\s\\S]*?ON DELETE RESTRICT ON UPDATE CASCADE`),
    );
  }
  assert.match(migration, /CREATE UNIQUE INDEX "WebhookEvent_projectId_id_key"[\s\S]*?\("projectId", "id"\)/);
});

test('database transition trigger makes CLAIMED and DELETED terminal', () => {
  assert.match(migration, /CREATE FUNCTION "enforce_whatsapp_media_asset_transition"\(\)/);
  assert.match(migration, /SET search_path = pg_catalog/);
  assert.match(
    migration,
    /OLD\."status" = 'UPLOADING' AND NEW\."status" IN \('AVAILABLE', 'DELETE_PENDING', 'FAILED'\)/,
  );
  assert.match(
    migration,
    /OLD\."status" = 'AVAILABLE' AND NEW\."status" IN \('CLAIMED', 'DELETE_PENDING'\)/,
  );
  assert.match(
    migration,
    /OLD\."status" = 'DELETE_PENDING' AND NEW\."status" = 'DELETED'/,
  );
  assert.match(
    migration,
    /USING ERRCODE = '23514', CONSTRAINT = 'WhatsAppMediaAsset_transition_guard'/,
  );
  assert.match(
    migration,
    /CREATE TRIGGER "WhatsAppMediaAsset_transition_guard"[\s\S]*?BEFORE UPDATE OR DELETE ON "WhatsAppMediaAsset"[\s\S]*?FOR EACH ROW/,
  );
  assert.match(migration, /TG_OP = 'DELETE'[\s\S]*?WhatsAppMediaAsset_row_retention_guard/);
  const deleteBranch = migration.match(/IF TG_OP = 'DELETE'[\s\S]*?END IF;/)?.[0];
  assert.ok(deleteBranch);
  assert.doesNotMatch(deleteBranch, /OLD\."status"/);
  assert.doesNotMatch(deleteBranch, /RETURN OLD/);
  assert.match(migration, /OLD\."status" IN \('CLAIMED', 'DELETED'\)[\s\S]*?WhatsAppMediaAsset_terminal_immutability_guard/);
});
