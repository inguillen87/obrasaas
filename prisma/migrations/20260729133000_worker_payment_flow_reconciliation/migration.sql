BEGIN;

-- This migration is part of the same pre-release H4 expand as 13000-13200.
-- There is no safe way to reconstruct operation keys for an already reserved
-- row without replaying sensitive input, so fail closed if 13200 was allowed
-- to receive terminal traffic before this contract is installed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "WorkerPaymentFlowSession"
     WHERE "submissionStatus" <> 'OPEN'
  ) THEN
    RAISE EXCEPTION 'worker payment Flow reconciliation requires an unopened H4 dataset'
      USING ERRCODE = '55000';
  END IF;
END;
$$;

CREATE TYPE "WorkerPaymentFlowReconciliationMethod" AS ENUM (
  'OPERATION_PROVENANCE_V1'
);

ALTER TABLE "WorkerPaymentFlowSession"
  ADD COLUMN "expectedDestinationType" "WorkerPaymentDestinationType",
  ADD COLUMN "expectedDestinationFingerprintKeyId" VARCHAR(100),
  ADD COLUMN "expectedDestinationFingerprint" CHAR(64),
  ADD COLUMN "expectedPrivacyOperationKey" VARCHAR(190),
  ADD COLUMN "expectedDestinationOperationKey" VARCHAR(190),
  ADD COLUMN "submissionReconciledAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationMethod" "WorkerPaymentFlowReconciliationMethod";

CREATE INDEX "WorkerPaymentFlowSession_uncertain_reconcile_idx"
ON "WorkerPaymentFlowSession"("submissionStatus", "submissionUncertainAt", "flowSessionId");

ALTER TABLE "WorkerPaymentDestination"
  ADD COLUMN "flowSubmissionReservationId" UUID,
  ADD COLUMN "flowSubmissionFingerprintKeyId" VARCHAR(64),
  ADD COLUMN "flowSubmissionFingerprintHmac" CHAR(64);

CREATE UNIQUE INDEX "WorkerPaymentDestination_flowSubmissionReservationId_key"
ON "WorkerPaymentDestination"("flowSubmissionReservationId");

ALTER TABLE "WorkerPaymentDestination"
ADD CONSTRAINT "WorkerPayment_flow_reservation_fkey"
FOREIGN KEY ("flowSubmissionReservationId")
REFERENCES "WorkerPaymentFlowSession"("submissionReservationId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentDestination"
ADD CONSTRAINT "WorkerPayment_flow_provenance_shape_check" CHECK (
  (
    "flowSubmissionReservationId" IS NULL
    AND "flowSubmissionFingerprintKeyId" IS NULL
    AND "flowSubmissionFingerprintHmac" IS NULL
  )
  OR
  (
    "flowSubmissionReservationId" IS NOT NULL
    AND "flowSubmissionFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND "flowSubmissionFingerprintHmac" ~ '^[0-9a-f]{64}$'
    AND "submissionSource" = 'WORKER_CHANNEL'
    AND "submittedByMembershipId" IS NULL
    AND "submittedByChannelIdentityId" IS NOT NULL
    AND "submissionContractVersion" = 'ATTESTED_V1'
    AND "privacyChoiceEventId" IS NOT NULL
    AND "submittedAt" IS NOT NULL
  )
);

ALTER TABLE "WorkerPaymentFlowSession"
DROP CONSTRAINT "WorkerPaymentFlowSession_submission_shape_check";

ALTER TABLE "WorkerPaymentFlowSession"
ADD CONSTRAINT "WorkerPaymentFlowSession_submission_shape_check" CHECK (
  (
    "submissionStatus" = 'OPEN'
    AND "submissionFingerprintKeyId" IS NULL
    AND "submissionFingerprintHmac" IS NULL
    AND "submissionReservationId" IS NULL
    AND "submissionReservedAt" IS NULL
    AND "paymentPurpose" IS NULL
    AND "expectedDestinationType" IS NULL
    AND "expectedDestinationFingerprintKeyId" IS NULL
    AND "expectedDestinationFingerprint" IS NULL
    AND "expectedPrivacyOperationKey" IS NULL
    AND "expectedDestinationOperationKey" IS NULL
    AND "privacyChoiceEventId" IS NULL
    AND "destinationId" IS NULL
    AND "submittedAt" IS NULL
    AND "submissionUncertainAt" IS NULL
    AND "submissionReconciledAt" IS NULL
    AND "reconciliationMethod" IS NULL
  )
  OR
  (
    "submissionStatus" = 'PROCESSING'
    AND "privacyPresentedAt" IS NOT NULL
    AND "submissionFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND "submissionFingerprintHmac" ~ '^[0-9a-f]{64}$'
    AND "submissionReservationId" IS NOT NULL
    AND "submissionReservedAt" IS NOT NULL
    AND "submissionReservedAt" >= "privacyPresentedAt"
    AND "submissionReservedAt" < "expiresAt"
    AND "paymentPurpose" IS NOT NULL
    AND "expectedDestinationType" IS NOT NULL
    AND "expectedDestinationFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    AND "expectedDestinationFingerprint" ~ '^[0-9a-f]{64}$'
    AND "expectedPrivacyOperationKey" ~ '^wpc:[0-9a-f]{64}$'
    AND "expectedDestinationOperationKey" ~ '^wp:submit:[0-9a-f]{64}$'
    AND "privacyChoiceEventId" IS NULL
    AND "destinationId" IS NULL
    AND "submittedAt" IS NULL
    AND "submissionUncertainAt" IS NULL
    AND "submissionReconciledAt" IS NULL
    AND "reconciliationMethod" IS NULL
  )
  OR
  (
    "submissionStatus" = 'SUCCEEDED'
    AND "privacyPresentedAt" IS NOT NULL
    AND "submissionFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND "submissionFingerprintHmac" ~ '^[0-9a-f]{64}$'
    AND "submissionReservationId" IS NOT NULL
    AND "submissionReservedAt" IS NOT NULL
    AND "submissionReservedAt" >= "privacyPresentedAt"
    AND "paymentPurpose" IS NOT NULL
    AND "expectedDestinationType" IS NOT NULL
    AND "expectedDestinationFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    AND "expectedDestinationFingerprint" ~ '^[0-9a-f]{64}$'
    AND "expectedPrivacyOperationKey" ~ '^wpc:[0-9a-f]{64}$'
    AND "expectedDestinationOperationKey" ~ '^wp:submit:[0-9a-f]{64}$'
    AND "privacyChoiceEventId" IS NOT NULL
    AND "destinationId" IS NOT NULL
    AND "submittedAt" IS NOT NULL
    AND "submittedAt" >= "submissionReservedAt"
    AND (
      (
        "submissionUncertainAt" IS NULL
        AND "submissionReconciledAt" IS NULL
        AND "reconciliationMethod" IS NULL
      )
      OR
      (
        "submissionUncertainAt" IS NOT NULL
        AND "submissionUncertainAt" >= "submissionReservedAt"
        AND "submissionReconciledAt" IS NOT NULL
        AND "submissionReconciledAt" >= "submissionUncertainAt"
        AND "reconciliationMethod" = 'OPERATION_PROVENANCE_V1'
      )
    )
  )
  OR
  (
    "submissionStatus" = 'UNCERTAIN'
    AND "privacyPresentedAt" IS NOT NULL
    AND "submissionFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND "submissionFingerprintHmac" ~ '^[0-9a-f]{64}$'
    AND "submissionReservationId" IS NOT NULL
    AND "submissionReservedAt" IS NOT NULL
    AND "submissionReservedAt" >= "privacyPresentedAt"
    AND "paymentPurpose" IS NOT NULL
    AND "expectedDestinationType" IS NOT NULL
    AND "expectedDestinationFingerprintKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    AND "expectedDestinationFingerprint" ~ '^[0-9a-f]{64}$'
    AND "expectedPrivacyOperationKey" ~ '^wpc:[0-9a-f]{64}$'
    AND "expectedDestinationOperationKey" ~ '^wp:submit:[0-9a-f]{64}$'
    AND "privacyChoiceEventId" IS NULL
    AND "destinationId" IS NULL
    AND "submittedAt" IS NULL
    AND "submissionUncertainAt" IS NOT NULL
    AND "submissionUncertainAt" >= "submissionReservedAt"
    AND "submissionReconciledAt" IS NULL
    AND "reconciliationMethod" IS NULL
  )
);

-- A destination can acquire Flow provenance once (creation or legacy
-- re-attestation). Thereafter the evidence is immutable while ordinary
-- verification/activation state may continue to advance.
CREATE OR REPLACE FUNCTION enforce_worker_payment_destination_flow_provenance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  flow_provenance RECORD;
  had_flow_provenance BOOLEAN;
  has_flow_provenance BOOLEAN;
BEGIN
  had_flow_provenance := TG_OP = 'UPDATE' AND (
    OLD."flowSubmissionReservationId" IS NOT NULL
    OR OLD."flowSubmissionFingerprintKeyId" IS NOT NULL
    OR OLD."flowSubmissionFingerprintHmac" IS NOT NULL
  );
  has_flow_provenance := (
    NEW."flowSubmissionReservationId" IS NOT NULL
    OR NEW."flowSubmissionFingerprintKeyId" IS NOT NULL
    OR NEW."flowSubmissionFingerprintHmac" IS NOT NULL
  );

  IF had_flow_provenance THEN
    IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
      OR OLD."personId" IS DISTINCT FROM NEW."personId"
      OR OLD."purpose" IS DISTINCT FROM NEW."purpose"
      OR OLD."operationKey" IS DISTINCT FROM NEW."operationKey"
      OR OLD."submissionSource" IS DISTINCT FROM NEW."submissionSource"
      OR OLD."submittedAt" IS DISTINCT FROM NEW."submittedAt"
      OR OLD."submittedByMembershipId" IS DISTINCT FROM NEW."submittedByMembershipId"
      OR OLD."submittedByChannelIdentityId" IS DISTINCT FROM NEW."submittedByChannelIdentityId"
      OR OLD."submissionContractVersion" IS DISTINCT FROM NEW."submissionContractVersion"
      OR OLD."privacyChoiceEventId" IS DISTINCT FROM NEW."privacyChoiceEventId"
      OR OLD."flowSubmissionReservationId" IS DISTINCT FROM NEW."flowSubmissionReservationId"
      OR OLD."flowSubmissionFingerprintKeyId" IS DISTINCT FROM NEW."flowSubmissionFingerprintKeyId"
      OR OLD."flowSubmissionFingerprintHmac" IS DISTINCT FROM NEW."flowSubmissionFingerprintHmac"
    THEN
      RAISE EXCEPTION 'worker payment destination Flow provenance is immutable'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT has_flow_provenance THEN
    RETURN NEW;
  END IF;

  IF NEW."flowSubmissionReservationId" IS NULL
    OR NEW."flowSubmissionFingerprintKeyId" IS NULL
    OR NEW."flowSubmissionFingerprintHmac" IS NULL
  THEN
    RAISE EXCEPTION 'worker payment destination Flow provenance is incomplete'
      USING ERRCODE = '23514';
  END IF;

  EXECUTE format(
    'SELECT
       payment_session."organizationId" AS session_organization_id,
       payment_session."personId" AS session_person_id,
       payment_session."channelIdentityId" AS session_channel_identity_id,
       payment_session."noticeVersion" AS session_notice_version,
       payment_session."noticeContentSha256" AS session_notice_sha256,
       payment_session."privacyPresentedAt" AS session_privacy_presented_at,
       payment_session."submissionStatus"::text AS session_status,
       payment_session."submissionFingerprintKeyId" AS session_fingerprint_key_id,
       payment_session."submissionFingerprintHmac" AS session_fingerprint_hmac,
       payment_session."submissionReservedAt" AS session_reserved_at,
       payment_session."paymentPurpose"::text AS session_payment_purpose,
       payment_session."expectedDestinationType"::text AS session_destination_type,
       payment_session."expectedDestinationFingerprintKeyId" AS session_destination_fingerprint_key_id,
       payment_session."expectedDestinationFingerprint" AS session_destination_fingerprint,
       payment_session."expectedPrivacyOperationKey" AS session_privacy_operation_key,
       payment_session."expectedDestinationOperationKey" AS session_destination_operation_key,
       choice."purpose"::text AS privacy_purpose,
       choice."paymentPurpose"::text AS privacy_payment_purpose,
       choice."channel"::text AS privacy_channel,
       choice."action"::text AS privacy_action,
       choice."actorMembershipId" AS privacy_membership_id,
       choice."channelIdentityId" AS privacy_channel_identity_id,
       choice."noticeVersion" AS privacy_notice_version,
       choice."noticeContentSha256" AS privacy_notice_sha256,
       choice."presentedAt" AS privacy_presented_at,
       choice."decidedAt" AS privacy_decided_at,
       choice."operationKey" AS privacy_operation_key
     FROM %1$I."WorkerPaymentFlowSession" payment_session
     JOIN %1$I."WorkerPrivacyChoiceEvent" choice
       ON choice."id" = $2
      AND choice."organizationId" = payment_session."organizationId"
      AND choice."personId" = payment_session."personId"
      AND choice."paymentPurpose" = payment_session."paymentPurpose"
    WHERE payment_session."submissionReservationId" = $1
    FOR KEY SHARE OF payment_session, choice',
    TG_TABLE_SCHEMA
  )
  INTO flow_provenance
  USING NEW."flowSubmissionReservationId", NEW."privacyChoiceEventId";

  IF flow_provenance.session_status IS DISTINCT FROM 'PROCESSING'
    OR flow_provenance.session_organization_id IS DISTINCT FROM NEW."organizationId"
    OR flow_provenance.session_person_id IS DISTINCT FROM NEW."personId"
    OR flow_provenance.session_payment_purpose IS DISTINCT FROM NEW."purpose"::text
    OR flow_provenance.session_destination_type IS DISTINCT FROM NEW."type"::text
    OR flow_provenance.session_destination_fingerprint_key_id IS DISTINCT FROM NEW."fingerprintKeyId"
    OR flow_provenance.session_destination_fingerprint IS DISTINCT FROM NEW."fingerprint"
    OR flow_provenance.session_channel_identity_id IS DISTINCT FROM NEW."submittedByChannelIdentityId"
    OR flow_provenance.session_fingerprint_key_id IS DISTINCT FROM NEW."flowSubmissionFingerprintKeyId"
    OR flow_provenance.session_fingerprint_hmac IS DISTINCT FROM NEW."flowSubmissionFingerprintHmac"
    OR flow_provenance.session_destination_operation_key IS DISTINCT FROM NEW."operationKey"
    OR flow_provenance.session_privacy_operation_key IS DISTINCT FROM flow_provenance.privacy_operation_key
    OR NEW."submissionSource"::text IS DISTINCT FROM 'WORKER_CHANNEL'
    OR NEW."submittedByMembershipId" IS NOT NULL
    OR NEW."submissionContractVersion"::text IS DISTINCT FROM 'ATTESTED_V1'
    OR NEW."status"::text NOT IN ('PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE')
    OR flow_provenance.privacy_purpose IS DISTINCT FROM 'PAYMENT_DESTINATION_CAPTURE'
    OR flow_provenance.privacy_payment_purpose IS DISTINCT FROM NEW."purpose"::text
    OR flow_provenance.privacy_channel IS DISTINCT FROM 'WHATSAPP_FLOW'
    OR flow_provenance.privacy_action IS DISTINCT FROM 'WORKER_ACKNOWLEDGED'
    OR flow_provenance.privacy_membership_id IS NOT NULL
    OR flow_provenance.privacy_channel_identity_id IS DISTINCT FROM NEW."submittedByChannelIdentityId"
    OR flow_provenance.privacy_notice_version IS DISTINCT FROM flow_provenance.session_notice_version
    OR flow_provenance.privacy_notice_sha256 IS DISTINCT FROM flow_provenance.session_notice_sha256
    OR flow_provenance.privacy_presented_at IS DISTINCT FROM flow_provenance.session_privacy_presented_at
    OR flow_provenance.privacy_decided_at IS DISTINCT FROM NEW."submittedAt"
    OR flow_provenance.privacy_decided_at < flow_provenance.session_reserved_at
  THEN
    RAISE EXCEPTION 'worker payment destination Flow provenance is invalid'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "WorkerPaymentDestination_flow_provenance_guard"
BEFORE INSERT OR UPDATE ON "WorkerPaymentDestination"
FOR EACH ROW EXECUTE FUNCTION enforce_worker_payment_destination_flow_provenance();

ALTER TABLE "WorkerPaymentDestination"
  ENABLE ALWAYS TRIGGER "WorkerPaymentDestination_flow_provenance_guard";

-- The original destination guard intentionally freezes operation identity. A
-- legacy re-attestation may acquire its one Flow proof only while the privacy
-- evidence advances in the same row update; every other mutation keeps the
-- original allowlist unchanged.
CREATE OR REPLACE FUNCTION "obrasaas_worker_payment_destination_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  allowed_fields TEXT[];
  privacy_changed BOOLEAN;
  wrapper_changed BOOLEAN;
  flow_provenance_added BOOLEAN;
BEGIN
  privacy_changed := OLD."submissionContractVersion" IS DISTINCT FROM NEW."submissionContractVersion"
    OR OLD."privacyChoiceEventId" IS DISTINCT FROM NEW."privacyChoiceEventId";
  wrapper_changed := OLD."encryptedPayload" IS DISTINCT FROM NEW."encryptedPayload"
    OR OLD."wrappingKeyId" IS DISTINCT FROM NEW."wrappingKeyId"
    OR OLD."resolvedEncryptedPayload" IS DISTINCT FROM NEW."resolvedEncryptedPayload"
    OR OLD."resolvedWrappingKeyId" IS DISTINCT FROM NEW."resolvedWrappingKeyId";
  flow_provenance_added := OLD."flowSubmissionReservationId" IS NULL
    AND OLD."flowSubmissionFingerprintKeyId" IS NULL
    AND OLD."flowSubmissionFingerprintHmac" IS NULL
    AND NEW."flowSubmissionReservationId" IS NOT NULL
    AND NEW."flowSubmissionFingerprintKeyId" IS NOT NULL
    AND NEW."flowSubmissionFingerprintHmac" IS NOT NULL;

  IF OLD."status" = NEW."status" THEN
    IF privacy_changed AND wrapper_changed THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'Privacy re-attestation and key rewrap must be separate operations';
    END IF;

    IF privacy_changed THEN
      IF flow_provenance_added THEN
        allowed_fields := ARRAY[
          'submissionContractVersion', 'privacyChoiceEventId',
          'operationKey', 'requestFingerprint', 'submissionSource', 'submittedAt',
          'submittedByMembershipId', 'submittedByChannelIdentityId',
          'flowSubmissionReservationId', 'flowSubmissionFingerprintKeyId',
          'flowSubmissionFingerprintHmac', 'revision', 'updatedAt'
        ];
      ELSE
        allowed_fields := ARRAY[
          'submissionContractVersion', 'privacyChoiceEventId', 'revision', 'updatedAt'
        ];
      END IF;
      IF NEW."revision" <> OLD."revision" + 1 THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'Privacy re-attestation requires one revision increment';
      END IF;
    ELSIF wrapper_changed THEN
      allowed_fields := ARRAY[
        'encryptedPayload', 'wrappingKeyId',
        'resolvedEncryptedPayload', 'resolvedWrappingKeyId', 'updatedAt'
      ];
      IF NEW."revision" <> OLD."revision"
        OR split_part(OLD."encryptedPayload", '.', 1) <> split_part(NEW."encryptedPayload", '.', 1)
        OR split_part(OLD."encryptedPayload", '.', 2) <> split_part(NEW."encryptedPayload", '.', 2)
        OR split_part(OLD."encryptedPayload", '.', 3) <> split_part(NEW."encryptedPayload", '.', 3)
        OR split_part(OLD."encryptedPayload", '.', 4) <> split_part(NEW."encryptedPayload", '.', 4)
        OR (
          OLD."resolvedEncryptedPayload" IS NOT NULL
          AND (
            NEW."resolvedEncryptedPayload" IS NULL
            OR split_part(OLD."resolvedEncryptedPayload", '.', 1) <> split_part(NEW."resolvedEncryptedPayload", '.', 1)
            OR split_part(OLD."resolvedEncryptedPayload", '.', 2) <> split_part(NEW."resolvedEncryptedPayload", '.', 2)
            OR split_part(OLD."resolvedEncryptedPayload", '.', 3) <> split_part(NEW."resolvedEncryptedPayload", '.', 3)
            OR split_part(OLD."resolvedEncryptedPayload", '.', 4) <> split_part(NEW."resolvedEncryptedPayload", '.', 4)
          )
        )
        OR (OLD."resolvedEncryptedPayload" IS NULL AND NEW."resolvedEncryptedPayload" IS NOT NULL)
      THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'Worker payment key rewrap changed authenticated payload data';
      END IF;
    ELSE
      allowed_fields := ARRAY['updatedAt'];
    END IF;
  ELSIF OLD."status" = 'PENDING_VERIFICATION' AND NEW."status" = 'VERIFIED' THEN
    allowed_fields := ARRAY[
      'status', 'revision', 'updatedAt', 'rail',
      'resolvedType', 'resolvedEncryptedPayload', 'resolvedFingerprint',
      'resolvedFingerprintKeyId', 'resolvedWrappingKeyId', 'resolvedRecordVersion',
      'canonicalType', 'canonicalFingerprint', 'canonicalFingerprintKeyId',
      'verificationProvider', 'providerReferenceHash', 'verificationEvidenceHash',
      'verifiedAt', 'verifiedById', 'verifiedByMembershipId'
    ];
  ELSIF OLD."status" = 'PENDING_VERIFICATION' AND NEW."status" = 'REJECTED' THEN
    allowed_fields := ARRAY[
      'status', 'revision', 'updatedAt', 'rejectedAt',
      'rejectedByMembershipId', 'rejectionReason'
    ];
  ELSIF OLD."status" = 'VERIFIED' AND NEW."status" = 'ACTIVE' THEN
    allowed_fields := ARRAY[
      'status', 'revision', 'updatedAt', 'activeSlot', 'activatedAt',
      'activatedByMembershipId', 'availableFrom'
    ];
  ELSIF OLD."status" IN ('VERIFIED', 'ACTIVE') AND NEW."status" = 'REVOKED' THEN
    allowed_fields := ARRAY[
      'status', 'revision', 'updatedAt', 'activeSlot', 'revokedAt',
      'revokedByMembershipId', 'revocationReason'
    ];
  ELSIF OLD."status" = 'ACTIVE' AND NEW."status" = 'SUPERSEDED' THEN
    allowed_fields := ARRAY['status', 'revision', 'updatedAt', 'activeSlot'];
  ELSE
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Worker payment destination transition is not allowed';
  END IF;

  IF OLD."status" IS DISTINCT FROM NEW."status" AND NEW."revision" <> OLD."revision" + 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'Worker payment destination transition requires one revision increment';
  END IF;

  IF (to_jsonb(OLD) - allowed_fields) IS DISTINCT FROM (to_jsonb(NEW) - allowed_fields) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Worker payment destination immutable fields changed';
  END IF;

  RETURN NEW;
END;
$$;

-- This trigger deliberately sorts before the existing scope/transition guards.
-- The database, not a host clock, owns the reconciliation evidence time.
CREATE OR REPLACE FUNCTION stamp_worker_payment_flow_reconciliation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF OLD."submissionStatus" = 'UNCERTAIN'
    AND NEW."submissionStatus" = 'SUCCEEDED'
  THEN
    NEW."submissionReconciledAt" := statement_timestamp();
    NEW."reconciliationMethod" := 'OPERATION_PROVENANCE_V1';
    NEW."updatedAt" := NEW."submissionReconciledAt";
  ELSIF OLD."submissionReconciledAt" IS DISTINCT FROM NEW."submissionReconciledAt"
    OR OLD."reconciliationMethod" IS DISTINCT FROM NEW."reconciliationMethod"
  THEN
    RAISE EXCEPTION 'worker payment Flow reconciliation evidence is database-owned'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "WorkerPaymentFlowSession_00_reconciliation_clock"
BEFORE UPDATE ON "WorkerPaymentFlowSession"
FOR EACH ROW EXECUTE FUNCTION stamp_worker_payment_flow_reconciliation();

ALTER TABLE "WorkerPaymentFlowSession"
  ENABLE ALWAYS TRIGGER "WorkerPaymentFlowSession_00_reconciliation_clock";

-- Keep the original append-forward contract and add exactly one recovery edge:
-- UNCERTAIN -> SUCCEEDED with an already committed, reservation-bound outcome.
CREATE OR REPLACE FUNCTION enforce_worker_payment_flow_session_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  success_provenance RECORD;
BEGIN
  IF OLD."flowSessionId" IS DISTINCT FROM NEW."flowSessionId"
    OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
    OR OLD."projectId" IS DISTINCT FROM NEW."projectId"
    OR OLD."connectionId" IS DISTINCT FROM NEW."connectionId"
    OR OLD."workerId" IS DISTINCT FROM NEW."workerId"
    OR OLD."personId" IS DISTINCT FROM NEW."personId"
    OR OLD."channelIdentityId" IS DISTINCT FROM NEW."channelIdentityId"
    OR OLD."noticeVersion" IS DISTINCT FROM NEW."noticeVersion"
    OR OLD."noticeContentSha256" IS DISTINCT FROM NEW."noticeContentSha256"
    OR OLD."expiresAt" IS DISTINCT FROM NEW."expiresAt"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  THEN
    RAISE EXCEPTION 'worker payment Flow immutable binding cannot change'
      USING ERRCODE = '55000';
  END IF;

  IF OLD."submissionStatus" = 'OPEN'
    AND NEW."submissionStatus" = 'OPEN'
    AND OLD."privacyPresentedAt" IS NULL
    AND NEW."privacyPresentedAt" IS NOT NULL
    AND NEW."revision" = OLD."revision" + 1
  THEN
    RETURN NEW;
  END IF;

  IF OLD."submissionStatus" = 'OPEN'
    AND NEW."submissionStatus" = 'PROCESSING'
    AND OLD."privacyPresentedAt" IS NOT NULL
    AND NEW."privacyPresentedAt" IS NOT DISTINCT FROM OLD."privacyPresentedAt"
    AND OLD."paymentPurpose" IS NULL
    AND OLD."expectedDestinationType" IS NULL
    AND OLD."expectedDestinationFingerprintKeyId" IS NULL
    AND OLD."expectedDestinationFingerprint" IS NULL
    AND OLD."expectedPrivacyOperationKey" IS NULL
    AND OLD."expectedDestinationOperationKey" IS NULL
    AND NEW."paymentPurpose" IS NOT NULL
    AND NEW."expectedDestinationType" IS NOT NULL
    AND NEW."expectedDestinationFingerprintKeyId" IS NOT NULL
    AND NEW."expectedDestinationFingerprint" IS NOT NULL
    AND NEW."expectedPrivacyOperationKey" IS NOT NULL
    AND NEW."expectedDestinationOperationKey" IS NOT NULL
    AND NEW."revision" = OLD."revision" + 1
  THEN
    RETURN NEW;
  END IF;

  IF (
      (
        OLD."submissionStatus" = 'PROCESSING'
        AND NEW."submissionStatus" IN ('SUCCEEDED', 'UNCERTAIN')
      )
      OR
      (
        OLD."submissionStatus" = 'UNCERTAIN'
        AND NEW."submissionStatus" = 'SUCCEEDED'
        AND NEW."submissionUncertainAt" IS NOT DISTINCT FROM OLD."submissionUncertainAt"
      )
    )
    AND NEW."privacyPresentedAt" IS NOT DISTINCT FROM OLD."privacyPresentedAt"
    AND NEW."submissionFingerprintKeyId" IS NOT DISTINCT FROM OLD."submissionFingerprintKeyId"
    AND NEW."submissionFingerprintHmac" IS NOT DISTINCT FROM OLD."submissionFingerprintHmac"
    AND NEW."submissionReservationId" IS NOT DISTINCT FROM OLD."submissionReservationId"
    AND NEW."submissionReservedAt" IS NOT DISTINCT FROM OLD."submissionReservedAt"
    AND NEW."paymentPurpose" IS NOT DISTINCT FROM OLD."paymentPurpose"
    AND NEW."expectedDestinationType" IS NOT DISTINCT FROM OLD."expectedDestinationType"
    AND NEW."expectedDestinationFingerprintKeyId" IS NOT DISTINCT FROM OLD."expectedDestinationFingerprintKeyId"
    AND NEW."expectedDestinationFingerprint" IS NOT DISTINCT FROM OLD."expectedDestinationFingerprint"
    AND NEW."expectedPrivacyOperationKey" IS NOT DISTINCT FROM OLD."expectedPrivacyOperationKey"
    AND NEW."expectedDestinationOperationKey" IS NOT DISTINCT FROM OLD."expectedDestinationOperationKey"
    AND NEW."revision" = OLD."revision" + 1
  THEN
    IF NEW."submissionStatus" = 'SUCCEEDED' THEN
      EXECUTE format(
        'SELECT
           destination."status"::text AS destination_status,
           destination."submissionSource"::text AS destination_source,
           destination."submissionContractVersion"::text AS destination_contract,
           destination."submittedAt" AS destination_submitted_at,
           destination."submittedByMembershipId" AS destination_membership_id,
           destination."submittedByChannelIdentityId" AS destination_channel_identity_id,
           destination."operationKey" AS destination_operation_key,
           destination."type"::text AS destination_type,
           destination."fingerprintKeyId" AS destination_value_fingerprint_key_id,
           destination."fingerprint" AS destination_value_fingerprint,
           destination."privacyChoiceEventId" AS destination_privacy_choice_id,
           destination."flowSubmissionReservationId" AS destination_reservation_id,
           destination."flowSubmissionFingerprintKeyId" AS destination_fingerprint_key_id,
           destination."flowSubmissionFingerprintHmac" AS destination_fingerprint_hmac,
           choice."purpose"::text AS privacy_purpose,
           choice."paymentPurpose"::text AS privacy_payment_purpose,
           choice."channel"::text AS privacy_channel,
           choice."action"::text AS privacy_action,
           choice."actorMembershipId" AS privacy_membership_id,
           choice."channelIdentityId" AS privacy_channel_identity_id,
           choice."noticeVersion" AS privacy_notice_version,
           choice."noticeContentSha256" AS privacy_notice_sha256,
           choice."presentedAt" AS privacy_presented_at,
           choice."decidedAt" AS privacy_decided_at,
           choice."operationKey" AS privacy_operation_key
         FROM %1$I."WorkerPaymentDestination" destination
         JOIN %1$I."WorkerPrivacyChoiceEvent" choice
           ON choice."id" = destination."privacyChoiceEventId"
          AND choice."organizationId" = destination."organizationId"
          AND choice."personId" = destination."personId"
          AND choice."paymentPurpose" = destination."purpose"
        WHERE destination."id" = $1
          AND destination."organizationId" = $2
          AND destination."personId" = $3
          AND destination."purpose" = $4
          AND choice."id" = $5
        FOR KEY SHARE OF destination, choice',
        TG_TABLE_SCHEMA
      )
      INTO success_provenance
      USING
        NEW."destinationId",
        NEW."organizationId",
        NEW."personId",
        NEW."paymentPurpose",
        NEW."privacyChoiceEventId";

      IF success_provenance.destination_privacy_choice_id IS NULL
        OR success_provenance.destination_contract IS DISTINCT FROM 'ATTESTED_V1'
        OR success_provenance.destination_source IS DISTINCT FROM 'WORKER_CHANNEL'
        OR success_provenance.destination_membership_id IS NOT NULL
        OR success_provenance.destination_channel_identity_id IS DISTINCT FROM NEW."channelIdentityId"
        OR success_provenance.destination_operation_key IS DISTINCT FROM NEW."expectedDestinationOperationKey"
        OR success_provenance.destination_type IS DISTINCT FROM NEW."expectedDestinationType"::text
        OR success_provenance.destination_value_fingerprint_key_id IS DISTINCT FROM NEW."expectedDestinationFingerprintKeyId"
        OR success_provenance.destination_value_fingerprint IS DISTINCT FROM NEW."expectedDestinationFingerprint"
        OR success_provenance.destination_reservation_id IS DISTINCT FROM NEW."submissionReservationId"
        OR success_provenance.destination_fingerprint_key_id IS DISTINCT FROM NEW."submissionFingerprintKeyId"
        OR success_provenance.destination_fingerprint_hmac IS DISTINCT FROM NEW."submissionFingerprintHmac"
        OR success_provenance.destination_privacy_choice_id IS DISTINCT FROM NEW."privacyChoiceEventId"
        OR success_provenance.destination_submitted_at IS DISTINCT FROM NEW."submittedAt"
        OR success_provenance.privacy_purpose IS DISTINCT FROM 'PAYMENT_DESTINATION_CAPTURE'
        OR success_provenance.privacy_payment_purpose IS DISTINCT FROM NEW."paymentPurpose"::text
        OR success_provenance.privacy_channel IS DISTINCT FROM 'WHATSAPP_FLOW'
        OR success_provenance.privacy_action IS DISTINCT FROM 'WORKER_ACKNOWLEDGED'
        OR success_provenance.privacy_membership_id IS NOT NULL
        OR success_provenance.privacy_channel_identity_id IS DISTINCT FROM NEW."channelIdentityId"
        OR success_provenance.privacy_notice_version IS DISTINCT FROM NEW."noticeVersion"
        OR success_provenance.privacy_notice_sha256 IS DISTINCT FROM NEW."noticeContentSha256"
        OR success_provenance.privacy_presented_at IS DISTINCT FROM OLD."privacyPresentedAt"
        OR success_provenance.privacy_decided_at IS DISTINCT FROM NEW."submittedAt"
        OR success_provenance.privacy_decided_at < OLD."submissionReservedAt"
        OR success_provenance.privacy_operation_key IS DISTINCT FROM NEW."expectedPrivacyOperationKey"
      THEN
        RAISE EXCEPTION 'worker payment Flow success provenance is invalid'
          USING ERRCODE = '55000';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'worker payment Flow state transition is not allowed'
    USING ERRCODE = '55000';
END;
$$;

COMMIT;
