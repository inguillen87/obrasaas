import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schemaUrl = new URL('../prisma/schema.prisma', import.meta.url);
const migrationUrl = new URL(
  '../prisma/migrations/20260726143000_visual_progress_assessments/migration.sql',
  import.meta.url,
);

function modelBlock(schema, name) {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Missing Prisma model ${name}.`);
  return match[1];
}

test('visual assessment Prisma contract is provider-neutral, scoped and review governed', async () => {
  const schema = await readFile(schemaUrl, 'utf8');
  const assessment = modelBlock(schema, 'VisualProgressAssessment');

  assert.match(schema, /enum VisualProgressAssessmentStatus \{[\s\S]*?PENDING[\s\S]*?RUNNING[\s\S]*?COMPLETED[\s\S]*?ABSTAINED[\s\S]*?FAILED[\s\S]*?\}/);
  assert.match(schema, /enum VisualProgressAssessmentReviewStatus \{[\s\S]*?PENDING[\s\S]*?APPROVED[\s\S]*?CORRECTED[\s\S]*?REJECTED[\s\S]*?\}/);
  assert.match(assessment, /task\s+Task\s+@relation\(fields: \[projectId, taskId\], references: \[projectId, id\], onDelete: Restrict/);
  assert.match(assessment, /evidence\s+ProgressEvidence\s+@relation\(fields: \[projectId, evidenceId\], references: \[projectId, id\], onDelete: Restrict/);
  assert.match(assessment, /operationKeyHash\s+String\s+@db\.Char\(64\)/);
  assert.match(assessment, /requestFingerprint\s+String\s+@db\.Char\(64\)/);
  assert.match(assessment, /inputSha256\s+String\s+@db\.Char\(64\)/);
  assert.match(assessment, /baselineHash\s+String\s+@db\.Char\(64\)/);
  assert.match(assessment, /providerModel\s+String\s+@db\.VarChar\(120\)/);
  assert.match(assessment, /taskRevisionAtRequest\s+Int/);
  assert.match(assessment, /evidenceRevisionAtRequest\s+Int/);
  assert.match(assessment, /leaseExpiresAt\s+DateTime\?/);
  assert.match(assessment, /attemptCount\s+Int\s+@default\(0\)/);
  assert.match(assessment, /reviewStatus\s+VisualProgressAssessmentReviewStatus\?/);
  assert.match(assessment, /reviewedBy\s+PlatformUser\?\s+@relation\("VisualProgressAssessmentReviewer"/);
  assert.match(assessment, /revision\s+Int\s+@default\(0\)/);
  assert.match(assessment, /@@unique\(\[projectId, operationKeyHash\], map: "VisualProgressAssessment_project_operation_key"\)/);
  assert.match(assessment, /@@index\(\[projectId, requestFingerprint\], map: "VisualProgressAssessment_project_fingerprint_idx"\)/);
  assert.match(assessment, /@@index\(\[projectId, status, leaseExpiresAt\], map: "VPA_project_status_lease_idx"\)/);
  assert.doesNotMatch(assessment, /@@unique\(\[projectId, requestFingerprint\]/);

  assert.doesNotMatch(assessment, /\b(?:prompt|rawResponse|imageBase64|accessToken|apiKey)\b/i);
});

test('visual assessment migration enforces hashes, result states and human review invariants', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /CREATE TABLE "VisualProgressAssessment"/);
  assert.match(sql, /"operationKeyHash" CHAR\(64\) NOT NULL/);
  assert.match(sql, /"requestFingerprint" CHAR\(64\) NOT NULL/);
  assert.match(sql, /"inputSha256" CHAR\(64\) NOT NULL/);
  assert.match(sql, /"baselineHash" CHAR\(64\) NOT NULL/);
  assert.match(sql, /"leaseExpiresAt" TIMESTAMP\(3\)/);
  assert.match(sql, /"attemptCount" INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql, /"operationKeyHash" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(sql, /CREATE INDEX "VisualProgressAssessment_project_fingerprint_idx"[\s\S]*?\("projectId", "requestFingerprint"\)/);
  assert.doesNotMatch(sql, /CREATE UNIQUE INDEX "VisualProgressAssessment_project_fingerprint/);
  assert.match(sql, /CONSTRAINT "VisualProgressAssessment_result_state_check" CHECK/);
  assert.match(sql, /CONSTRAINT "VisualProgressAssessment_lease_state_check" CHECK/);
  assert.match(sql, /"status" = 'RUNNING'[\s\S]*?"leaseExpiresAt" IS NOT NULL[\s\S]*?"attemptCount" >= 1/);
  assert.match(sql, /"status" IN \('COMPLETED', 'ABSTAINED', 'FAILED'\)[\s\S]*?"leaseExpiresAt" IS NULL/);
  assert.match(sql, /CREATE INDEX "VPA_project_status_lease_idx"[\s\S]*?\("projectId", "status", "leaseExpiresAt"\)/);
  assert.match(sql, /CREATE UNIQUE INDEX "VPA_project_evidence_open_key"[\s\S]*?\("projectId", "evidenceId"\)[\s\S]*?WHERE \([\s\S]*?"status" IN \('PENDING', 'RUNNING'\)[\s\S]*?"reviewStatus" = 'PENDING'/);
  assert.match(sql, /"status" = 'COMPLETED'[\s\S]*?"summary" IS NOT NULL[\s\S]*?"progressMin" IS NOT NULL[\s\S]*?"progressMax" IS NOT NULL/);
  assert.match(sql, /"status" = 'ABSTAINED'[\s\S]*?jsonb_array_length\("limitations"\) > 0/);
  assert.match(sql, /"status" = 'FAILED'[\s\S]*?"failureCode" IS NOT NULL/);
  assert.match(sql, /CONSTRAINT "VisualProgressAssessment_review_state_check" CHECK/);
  assert.match(sql, /"reviewStatus" = 'CORRECTED'[\s\S]*?"reviewNote" IS NOT NULL[\s\S]*?"correctedProgressMin" IS NOT NULL[\s\S]*?"correctedProgressMax" IS NOT NULL[\s\S]*?"correctedProgressMin" <= "correctedProgressMax"/);
  assert.match(sql, /"reviewStatus" = 'REJECTED'[\s\S]*?"reviewNote" IS NOT NULL[\s\S]*?char_length\(btrim\("reviewNote"\)\) > 0/);
  assert.match(sql, /CONSTRAINT "VisualProgressAssessment_timestamps_check" CHECK/);
  assert.match(sql, /FOREIGN KEY \("projectId", "taskId"\) REFERENCES "Task"\("projectId", "id"\)/);
  assert.match(sql, /FOREIGN KEY \("projectId", "evidenceId"\) REFERENCES "ProgressEvidence"\("projectId", "id"\)/);
  assert.match(sql, /FOREIGN KEY \("reviewedById"\) REFERENCES "PlatformUser"\("id"\)[\s\S]*?ON DELETE RESTRICT/);

  assert.doesNotMatch(sql, /\b(?:prompt|rawResponse|imageBase64|accessToken|apiKey)\b/i);
});
