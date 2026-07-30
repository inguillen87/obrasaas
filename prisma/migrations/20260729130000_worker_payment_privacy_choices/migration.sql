BEGIN;

CREATE TYPE "WorkerPrivacyChoicePurpose" AS ENUM (
  'PAYMENT_DESTINATION_CAPTURE'
);

CREATE TYPE "WorkerPrivacyChoiceChannel" AS ENUM (
  'TENANT_DASHBOARD',
  'WHATSAPP_FLOW'
);

CREATE TYPE "WorkerPrivacyChoiceAction" AS ENUM (
  'ADMIN_ATTESTED',
  'WORKER_ACKNOWLEDGED'
);

CREATE TYPE "WorkerPaymentSubmissionContractVersion" AS ENUM (
  'LEGACY_REATTESTATION_REQUIRED',
  'ATTESTED_V1'
);

CREATE TABLE "WorkerPrivacyChoiceEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "purpose" "WorkerPrivacyChoicePurpose" NOT NULL DEFAULT 'PAYMENT_DESTINATION_CAPTURE',
  "paymentPurpose" "WorkerPaymentPurpose" NOT NULL,
  "channel" "WorkerPrivacyChoiceChannel" NOT NULL,
  "action" "WorkerPrivacyChoiceAction" NOT NULL,
  "actorMembershipId" TEXT,
  "channelIdentityId" TEXT,
  "noticeVersion" VARCHAR(64) NOT NULL,
  "noticeContentSha256" CHAR(64) NOT NULL,
  "presentedAt" TIMESTAMP(3) NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkerPrivacyChoiceEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkerPrivacyChoice_evidence_check" CHECK (
    "purpose" = 'PAYMENT_DESTINATION_CAPTURE'
    AND "noticeVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND "noticeContentSha256" ~ '^[0-9a-f]{64}$'
    AND "operationKey" ~ '^wpc:[0-9a-f]{64}$'
    AND "requestFingerprint" ~ '^[0-9a-f]{64}$'
    AND "presentedAt" <= "decidedAt"
    AND "decidedAt" <= "createdAt"
  ),
  CONSTRAINT "WorkerPrivacyChoice_actor_check" CHECK (
    (
      "channel" = 'TENANT_DASHBOARD'
      AND "action" = 'ADMIN_ATTESTED'
      AND "actorMembershipId" IS NOT NULL
      AND "channelIdentityId" IS NULL
    )
    OR
    (
      "channel" = 'WHATSAPP_FLOW'
      AND "action" = 'WORKER_ACKNOWLEDGED'
      AND "actorMembershipId" IS NULL
      AND "channelIdentityId" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "WorkerPrivacyChoice_org_id_key"
  ON "WorkerPrivacyChoiceEvent"("organizationId", "id");
CREATE UNIQUE INDEX "WorkerPrivacyChoice_org_operation_key"
  ON "WorkerPrivacyChoiceEvent"("organizationId", "operationKey");
CREATE UNIQUE INDEX "WorkerPrivacyChoice_payment_scope_key"
  ON "WorkerPrivacyChoiceEvent"("organizationId", "personId", "paymentPurpose", "id");
CREATE INDEX "WorkerPrivacyChoice_org_person_purpose_decided_idx"
  ON "WorkerPrivacyChoiceEvent"("organizationId", "personId", "purpose", "decidedAt");
CREATE INDEX "WorkerPrivacyChoice_membership_decided_idx"
  ON "WorkerPrivacyChoiceEvent"("actorMembershipId", "decidedAt");
CREATE INDEX "WorkerPrivacyChoice_channel_decided_idx"
  ON "WorkerPrivacyChoiceEvent"("channelIdentityId", "decidedAt");

ALTER TABLE "WorkerPrivacyChoiceEvent"
  ADD CONSTRAINT "WorkerPrivacyChoice_organization_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "WorkerPrivacyChoice_person_scope_fkey"
  FOREIGN KEY ("organizationId", "personId")
  REFERENCES "WorkerPerson"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "WorkerPrivacyChoice_membership_actor_fkey"
  FOREIGN KEY ("organizationId", "actorMembershipId")
  REFERENCES "TenantMembership"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "WorkerPrivacyChoice_channel_actor_fkey"
  FOREIGN KEY ("organizationId", "personId", "channelIdentityId")
  REFERENCES "WorkerChannelIdentity"("organizationId", "personId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "WorkerPaymentDestination"
  ADD COLUMN "submissionContractVersion" "WorkerPaymentSubmissionContractVersion"
    NOT NULL DEFAULT 'LEGACY_REATTESTATION_REQUIRED',
  ADD COLUMN "privacyChoiceEventId" TEXT;

CREATE UNIQUE INDEX "WorkerPaymentDestination_privacyChoiceEventId_key"
  ON "WorkerPaymentDestination"("privacyChoiceEventId");
CREATE UNIQUE INDEX "WorkerPayment_privacy_choice_relation_key"
  ON "WorkerPaymentDestination"(
    "organizationId", "personId", "purpose", "privacyChoiceEventId"
  );

ALTER TABLE "WorkerPaymentDestination"
  ADD CONSTRAINT "WorkerPayment_privacy_contract_check" CHECK (
    (
      "submissionContractVersion" = 'LEGACY_REATTESTATION_REQUIRED'
      AND "privacyChoiceEventId" IS NULL
    )
    OR
    (
      "submissionContractVersion" = 'ATTESTED_V1'
      AND "privacyChoiceEventId" IS NOT NULL
    )
  ) NOT VALID,
  ADD CONSTRAINT "WorkerPayment_privacy_choice_scope_fkey"
  FOREIGN KEY ("organizationId", "personId", "purpose", "privacyChoiceEventId")
  REFERENCES "WorkerPrivacyChoiceEvent"("organizationId", "personId", "paymentPurpose", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

CREATE FUNCTION "obrasaas_worker_privacy_choice_authorize_insert"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMP(3) := statement_timestamp();
  person_verified BOOLEAN;
  actor_authorized BOOLEAN;
BEGIN
  -- The database owns the decision/creation instant. `presentedAt` remains the
  -- earlier server-observed UI/Flow event and is bounded to the active capture.
  NEW."decidedAt" := observed_at;
  NEW."createdAt" := observed_at;

  IF NEW."purpose" <> 'PAYMENT_DESTINATION_CAPTURE'
    OR NEW."noticeVersion" <> 'worker-payment-capture-v1'
    OR NEW."noticeContentSha256" <> '76a909dfb5f5e0ffc6c3f80335ed5097d552647c9be805ebf6ba61afdbd2752b'
    OR NEW."presentedAt" > observed_at
    OR NEW."presentedAt" < observed_at - INTERVAL '1 hour'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Worker privacy choice notice or timestamp is not authoritative';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."WorkerPerson"
        WHERE "id" = $1
          AND "organizationId" = $2
          AND "status" = ''ACTIVE''
          AND "identityStatus" = ''VERIFIED''
     )',
    TG_TABLE_SCHEMA
  )
  INTO person_verified
  USING NEW."personId", NEW."organizationId";
  IF person_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Worker privacy choice person is not verified';
  END IF;

  IF NEW."channel" = 'TENANT_DASHBOARD' AND NEW."action" = 'ADMIN_ATTESTED' THEN
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM %I."TenantMembership"
          WHERE "id" = $1
            AND "organizationId" = $2
            AND "status" = ''ACTIVE''
            AND "tenantRole" IN (''ADMIN'', ''FINANCE'')
       )',
      TG_TABLE_SCHEMA
    )
    INTO actor_authorized
    USING NEW."actorMembershipId", NEW."organizationId";
  ELSIF NEW."channel" = 'WHATSAPP_FLOW' AND NEW."action" = 'WORKER_ACKNOWLEDGED' THEN
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM %I."WorkerChannelIdentity"
          WHERE "id" = $1
            AND "organizationId" = $2
            AND "personId" = $3
            AND "provider" = ''WHATSAPP''
            AND "status" = ''VERIFIED''
            AND "revokedAt" IS NULL
       )',
      TG_TABLE_SCHEMA
    )
    INTO actor_authorized
    USING NEW."channelIdentityId", NEW."organizationId", NEW."personId";
  ELSE
    actor_authorized := FALSE;
  END IF;

  IF actor_authorized IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Worker privacy choice actor is not authorized';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "WorkerPrivacyChoiceEvent_authorize_insert"
BEFORE INSERT ON "WorkerPrivacyChoiceEvent"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_worker_privacy_choice_authorize_insert"();

CREATE FUNCTION "obrasaas_worker_privacy_choice_append_only"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'WorkerPrivacyChoiceEvent is append-only';
END;
$$;

CREATE TRIGGER "WorkerPrivacyChoiceEvent_append_only"
BEFORE UPDATE OR DELETE ON "WorkerPrivacyChoiceEvent"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_worker_privacy_choice_append_only"();

CREATE TRIGGER "WorkerPrivacyChoiceEvent_no_truncate"
BEFORE TRUNCATE ON "WorkerPrivacyChoiceEvent"
FOR EACH STATEMENT
EXECUTE FUNCTION "obrasaas_worker_privacy_choice_append_only"();

ALTER TABLE "WorkerPrivacyChoiceEvent"
  ENABLE ALWAYS TRIGGER "WorkerPrivacyChoiceEvent_authorize_insert";
ALTER TABLE "WorkerPrivacyChoiceEvent"
  ENABLE ALWAYS TRIGGER "WorkerPrivacyChoiceEvent_append_only";
ALTER TABLE "WorkerPrivacyChoiceEvent"
  ENABLE ALWAYS TRIGGER "WorkerPrivacyChoiceEvent_no_truncate";

CREATE FUNCTION "obrasaas_worker_payment_validate_privacy_choice"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  choice_record RECORD;
BEGIN
  -- Expand-compatible rollout: instances from the previous release still
  -- insert the legacy default while this migration is applied before the new
  -- Vercel build becomes active. New application code writes ATTESTED_V1 and
  -- the legacy state remains unusable. A later contract migration may reject
  -- legacy inserts only after every previous instance has drained.

  IF TG_OP = 'UPDATE' AND (
    OLD."submissionContractVersion" IS DISTINCT FROM NEW."submissionContractVersion"
    OR OLD."privacyChoiceEventId" IS DISTINCT FROM NEW."privacyChoiceEventId"
  ) AND NOT (
    OLD."submissionContractVersion" = 'LEGACY_REATTESTATION_REQUIRED'
    AND OLD."privacyChoiceEventId" IS NULL
    AND NEW."submissionContractVersion" = 'ATTESTED_V1'
    AND NEW."privacyChoiceEventId" IS NOT NULL
    AND OLD."status" = NEW."status"
    AND OLD."status" IN ('PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Worker payment privacy provenance cannot be replaced';
  END IF;

  IF NEW."submissionContractVersion" = 'LEGACY_REATTESTATION_REQUIRED' THEN
    IF NEW."status" IN ('VERIFIED', 'ACTIVE')
      AND (TG_OP = 'INSERT' OR OLD."status" IS DISTINCT FROM NEW."status") THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Legacy worker payment destinations require re-attestation';
    END IF;
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT "id", "purpose"::text, "paymentPurpose"::text, "channel"::text, "action"::text,
            "actorMembershipId", "channelIdentityId", "presentedAt", "decidedAt"
       FROM %I."WorkerPrivacyChoiceEvent"
      WHERE "id" = $1 AND "organizationId" = $2 AND "personId" = $3
        AND "paymentPurpose" = $4',
    TG_TABLE_SCHEMA
  )
  INTO choice_record
  USING NEW."privacyChoiceEventId", NEW."organizationId", NEW."personId", NEW."purpose";

  IF choice_record."id" IS NULL
    OR choice_record."purpose" <> 'PAYMENT_DESTINATION_CAPTURE'
    OR choice_record."presentedAt" > choice_record."decidedAt"
    OR (TG_OP = 'INSERT' AND choice_record."decidedAt" > NEW."submittedAt")
    OR (
      TG_OP = 'INSERT'
      AND (
        (
          NEW."submissionSource" = 'TENANT_MEMBERSHIP'
          AND NOT (
            choice_record."channel" = 'TENANT_DASHBOARD'
            AND choice_record."action" = 'ADMIN_ATTESTED'
            AND choice_record."actorMembershipId" = NEW."submittedByMembershipId"
            AND choice_record."channelIdentityId" IS NULL
          )
        )
        OR (
          NEW."submissionSource" = 'WORKER_CHANNEL'
          AND NOT (
            choice_record."channel" = 'WHATSAPP_FLOW'
            AND choice_record."action" = 'WORKER_ACKNOWLEDGED'
            AND choice_record."actorMembershipId" IS NULL
            AND choice_record."channelIdentityId" = NEW."submittedByChannelIdentityId"
          )
        )
      )
    )
    OR (
      TG_OP = 'UPDATE'
      AND OLD."submissionContractVersion" = 'LEGACY_REATTESTATION_REQUIRED'
      AND NEW."submissionContractVersion" = 'ATTESTED_V1'
      AND (
        NOT (
          (
            choice_record."channel" = 'TENANT_DASHBOARD'
            AND choice_record."action" = 'ADMIN_ATTESTED'
            AND choice_record."actorMembershipId" IS NOT NULL
            AND choice_record."channelIdentityId" IS NULL
          )
          OR (
            choice_record."channel" = 'WHATSAPP_FLOW'
            AND choice_record."action" = 'WORKER_ACKNOWLEDGED'
            AND choice_record."actorMembershipId" IS NULL
            AND choice_record."channelIdentityId" IS NOT NULL
          )
        )
        OR (
          OLD."status" = 'ACTIVE'
          AND choice_record."channel" <> 'WHATSAPP_FLOW'
        )
      )
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Worker payment privacy choice is stale or out of scope';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "WorkerPayment_privacy_choice_validate"
BEFORE INSERT OR UPDATE OF "submissionContractVersion", "privacyChoiceEventId", "status"
ON "WorkerPaymentDestination"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_worker_payment_validate_privacy_choice"();

ALTER TABLE "WorkerPaymentDestination"
  ENABLE ALWAYS TRIGGER "WorkerPayment_privacy_choice_validate";

CREATE FUNCTION "obrasaas_worker_payment_destination_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  allowed_fields TEXT[];
  privacy_changed BOOLEAN;
  wrapper_changed BOOLEAN;
BEGIN
  privacy_changed := OLD."submissionContractVersion" IS DISTINCT FROM NEW."submissionContractVersion"
    OR OLD."privacyChoiceEventId" IS DISTINCT FROM NEW."privacyChoiceEventId";
  wrapper_changed := OLD."encryptedPayload" IS DISTINCT FROM NEW."encryptedPayload"
    OR OLD."wrappingKeyId" IS DISTINCT FROM NEW."wrappingKeyId"
    OR OLD."resolvedEncryptedPayload" IS DISTINCT FROM NEW."resolvedEncryptedPayload"
    OR OLD."resolvedWrappingKeyId" IS DISTINCT FROM NEW."resolvedWrappingKeyId";

  IF OLD."status" = NEW."status" THEN
    IF privacy_changed AND wrapper_changed THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'Privacy re-attestation and key rewrap must be separate operations';
    END IF;

    IF privacy_changed THEN
      allowed_fields := ARRAY[
        'submissionContractVersion', 'privacyChoiceEventId', 'revision', 'updatedAt'
      ];
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

CREATE TRIGGER "WorkerPayment_destination_guard"
BEFORE UPDATE ON "WorkerPaymentDestination"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_worker_payment_destination_guard"();

ALTER TABLE "WorkerPaymentDestination"
  ENABLE ALWAYS TRIGGER "WorkerPayment_destination_guard";

CREATE FUNCTION "obrasaas_worker_payment_destination_no_remove"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'WorkerPaymentDestination cannot be deleted or truncated; revoke it instead';
END;
$$;

CREATE TRIGGER "WorkerPaymentDestination_no_delete"
BEFORE DELETE ON "WorkerPaymentDestination"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_worker_payment_destination_no_remove"();

CREATE TRIGGER "WorkerPaymentDestination_no_truncate"
BEFORE TRUNCATE ON "WorkerPaymentDestination"
FOR EACH STATEMENT
EXECUTE FUNCTION "obrasaas_worker_payment_destination_no_remove"();

ALTER TABLE "WorkerPaymentDestination"
  ENABLE ALWAYS TRIGGER "WorkerPaymentDestination_no_delete";
ALTER TABLE "WorkerPaymentDestination"
  ENABLE ALWAYS TRIGGER "WorkerPaymentDestination_no_truncate";

COMMIT;
