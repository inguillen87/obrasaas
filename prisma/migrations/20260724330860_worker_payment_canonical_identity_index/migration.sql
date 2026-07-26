-- Keep the concurrent build isolated so Prisma executes it outside a transaction
-- block and PostgreSQL does not block payment-destination writes during the scan.
--
-- Database uniqueness is intentionally intra fingerprint-key epoch because HMACs
-- from different keys are not comparable. The service searches every accepted
-- key epoch under a tenant/person/purpose advisory lock to prevent cross-key
-- duplicates; this index closes same-epoch concurrency races.
CREATE UNIQUE INDEX CONCURRENTLY "WorkerPayment_canonical_identity_key"
  ON "WorkerPaymentDestination"(
    "organizationId",
    "personId",
    "purpose",
    "canonicalType",
    "canonicalFingerprintKeyId",
    "canonicalFingerprint"
  );
