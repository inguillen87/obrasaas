-- Phase 3: validate after all low-lock guards and candidate keys exist. These
-- operations use PostgreSQL's validation lock level rather than rebuilding hot
-- indexes under a write-blocking SHARE lock.
ALTER TABLE "ProgressEvidence"
  VALIDATE CONSTRAINT "ProgressEvidence_source_bundle_check";
ALTER TABLE "ProgressEvidence"
  VALIDATE CONSTRAINT "ProgressEvidence_source_operation_hash_check";
ALTER TABLE "ProgressEvidence"
  VALIDATE CONSTRAINT "ProgressEvidence_source_fingerprint_check";
ALTER TABLE "ProgressEvidence"
  VALIDATE CONSTRAINT "ProgressEvidence_source_conversation_scope_fkey";
ALTER TABLE "ProgressEvidence"
  VALIDATE CONSTRAINT "ProgressEvidence_source_message_scope_fkey";
