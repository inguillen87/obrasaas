BEGIN;

-- Terminal payment-destination Flow companion. The generic Flow session keeps
-- the signed bearer-token commitment and delivery journal; this table binds
-- that transport context to one verified worker identity and stores only a
-- keyed submission commitment plus tenant-scoped outcome references.
CREATE TYPE "WorkerPaymentFlowSubmissionStatus" AS ENUM (
  'OPEN',
  'PROCESSING',
  'SUCCEEDED',
  'UNCERTAIN'
);

CREATE TABLE "WorkerPaymentFlowSession" (
  "flowSessionId" UUID NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "channelIdentityId" TEXT NOT NULL,
  "noticeVersion" VARCHAR(64) NOT NULL,
  "noticeContentSha256" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  -- Evidence that INIT served the pinned notice. This is not evidence that the
  -- recipient read or understood it.
  "privacyPresentedAt" TIMESTAMP(3),
  "submissionStatus" "WorkerPaymentFlowSubmissionStatus" NOT NULL DEFAULT 'OPEN',
  "submissionFingerprintKeyId" VARCHAR(64),
  -- HMAC-SHA-256 under a dedicated secret. Never a plain hash of a bank value.
  "submissionFingerprintHmac" CHAR(64),
  "submissionReservationId" UUID,
  "submissionReservedAt" TIMESTAMP(3),
  "paymentPurpose" "WorkerPaymentPurpose",
  "privacyChoiceEventId" TEXT,
  "destinationId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "submissionUncertainAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkerPaymentFlowSession_pkey" PRIMARY KEY ("flowSessionId"),
  CONSTRAINT "WorkerPaymentFlowSession_contract_check" CHECK (
    "noticeVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND "noticeContentSha256" ~ '^[0-9a-f]{64}$'
    AND "revision" >= 0
    AND "expiresAt" > "createdAt"
    AND (
      "privacyPresentedAt" IS NULL
      OR "privacyPresentedAt" >= "createdAt"
    )
    AND (
      "privacyPresentedAt" IS NULL
      OR "privacyPresentedAt" < "expiresAt"
    )
  ),
  CONSTRAINT "WorkerPaymentFlowSession_submission_shape_check" CHECK (
    (
      "submissionStatus" = 'OPEN'
      AND "submissionFingerprintKeyId" IS NULL
      AND "submissionFingerprintHmac" IS NULL
      AND "submissionReservationId" IS NULL
      AND "submissionReservedAt" IS NULL
      AND "paymentPurpose" IS NULL
      AND "privacyChoiceEventId" IS NULL
      AND "destinationId" IS NULL
      AND "submittedAt" IS NULL
      AND "submissionUncertainAt" IS NULL
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
      AND "paymentPurpose" IS NULL
      AND "privacyChoiceEventId" IS NULL
      AND "destinationId" IS NULL
      AND "submittedAt" IS NULL
      AND "submissionUncertainAt" IS NULL
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
      AND "privacyChoiceEventId" IS NOT NULL
      AND "destinationId" IS NOT NULL
      AND "submittedAt" IS NOT NULL
      AND "submittedAt" >= "submissionReservedAt"
      AND "submissionUncertainAt" IS NULL
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
      AND "paymentPurpose" IS NULL
      AND "privacyChoiceEventId" IS NULL
      AND "destinationId" IS NULL
      AND "submittedAt" IS NULL
      AND "submissionUncertainAt" IS NOT NULL
      AND "submissionUncertainAt" >= "submissionReservedAt"
    )
  )
);

CREATE UNIQUE INDEX "WorkerPaymentFlowSession_submissionReservationId_key"
ON "WorkerPaymentFlowSession"("submissionReservationId");

CREATE UNIQUE INDEX "WorkerPaymentFlowSession_privacyChoiceEventId_key"
ON "WorkerPaymentFlowSession"("privacyChoiceEventId");

CREATE UNIQUE INDEX "WorkerPaymentFlowSession_destinationId_key"
ON "WorkerPaymentFlowSession"("destinationId");

CREATE UNIQUE INDEX "WorkerPaymentFlowSession_privacy_choice_relation_key"
ON "WorkerPaymentFlowSession"(
  "organizationId", "personId", "paymentPurpose", "privacyChoiceEventId"
);

CREATE UNIQUE INDEX "WorkerPaymentFlowSession_destination_relation_key"
ON "WorkerPaymentFlowSession"(
  "organizationId", "personId", "paymentPurpose", "destinationId"
);

CREATE INDEX "WorkerPaymentFlowSession_org_expires_idx"
ON "WorkerPaymentFlowSession"("organizationId", "expiresAt");

CREATE INDEX "WorkerPaymentFlowSession_project_worker_expires_idx"
ON "WorkerPaymentFlowSession"("projectId", "workerId", "expiresAt");

CREATE INDEX "WorkerPaymentFlowSession_channel_expires_idx"
ON "WorkerPaymentFlowSession"("channelIdentityId", "expiresAt");

CREATE INDEX "WorkerPaymentFlowSession_submission_status_idx"
ON "WorkerPaymentFlowSession"("submissionStatus", "submissionReservedAt");

CREATE INDEX "WorkerPaymentFlowSession_hmac_key_status_expiry_idx"
ON "WorkerPaymentFlowSession"(
  "submissionFingerprintKeyId", "submissionStatus", "expiresAt"
);

ALTER TABLE "WorkerPaymentFlowSession"
ADD CONSTRAINT "WorkerPaymentFlowSession_flow_session_fkey"
FOREIGN KEY ("flowSessionId") REFERENCES "WhatsAppFlowSession"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentFlowSession"
ADD CONSTRAINT "WorkerPaymentFlowSession_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentFlowSession"
ADD CONSTRAINT "WorkerPaymentFlowSession_project_scope_fkey"
FOREIGN KEY ("organizationId", "projectId")
REFERENCES "Project"("organizationId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentFlowSession"
ADD CONSTRAINT "WorkerPaymentFlowSession_connection_scope_fkey"
FOREIGN KEY ("projectId", "connectionId")
REFERENCES "WhatsAppConnection"("projectId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentFlowSession"
ADD CONSTRAINT "WorkerPaymentFlowSession_worker_scope_fkey"
FOREIGN KEY ("organizationId", "personId", "projectId", "workerId")
REFERENCES "Worker"("organizationId", "personId", "projectId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentFlowSession"
ADD CONSTRAINT "WorkerPaymentFlowSession_person_scope_fkey"
FOREIGN KEY ("organizationId", "personId")
REFERENCES "WorkerPerson"("organizationId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentFlowSession"
ADD CONSTRAINT "WorkerPaymentFlowSession_channel_scope_fkey"
FOREIGN KEY ("organizationId", "personId", "channelIdentityId")
REFERENCES "WorkerChannelIdentity"("organizationId", "personId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentFlowSession"
ADD CONSTRAINT "WorkerPaymentFlowSession_privacy_choice_scope_fkey"
FOREIGN KEY (
  "organizationId", "personId", "paymentPurpose", "privacyChoiceEventId"
)
REFERENCES "WorkerPrivacyChoiceEvent"(
  "organizationId", "personId", "paymentPurpose", "id"
)
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentFlowSession"
ADD CONSTRAINT "WorkerPaymentFlowSession_destination_scope_fkey"
FOREIGN KEY ("organizationId", "personId", "paymentPurpose", "destinationId")
REFERENCES "WorkerPaymentDestination"("organizationId", "personId", "purpose", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Validate the transport/session binding and trusted identity only at insert.
-- Later revocation must not make the immutable journal un-updatable; the
-- application revalidates current identity and channel state before reserve.
CREATE OR REPLACE FUNCTION enforce_worker_payment_flow_session_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  base_session RECORD;
  connection_phone VARCHAR(40);
  active_connection BOOLEAN;
  verified_identity_scope BOOLEAN;
  observed_at TIMESTAMP(3);
BEGIN
  EXECUTE format(
    'SELECT * FROM %I."WhatsAppFlowSession" WHERE "id" = $1',
    TG_TABLE_SCHEMA
  )
  INTO base_session
  USING NEW."flowSessionId";

  IF base_session."id" IS NULL THEN
    RAISE EXCEPTION 'worker payment Flow base session is missing'
      USING ERRCODE = '23503';
  END IF;

  IF base_session."organizationId" IS DISTINCT FROM NEW."organizationId"
    OR base_session."projectId" IS DISTINCT FROM NEW."projectId"
    OR base_session."workerId" IS DISTINCT FROM NEW."workerId"
    OR base_session."blueprintKey" IS DISTINCT FROM 'worker-payment-destination'
    OR base_session."screenId" IS DISTINCT FROM 'WORKER_PAYMENT_DESTINATION'
    OR base_session."flowType" IS DISTINCT FROM 'worker_payment_destination'
    OR base_session."expiresAt" IS DISTINCT FROM NEW."expiresAt"
  THEN
    RAISE EXCEPTION 'worker payment Flow base session scope mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT'
    AND (
      NEW."submissionStatus" IS DISTINCT FROM 'OPEN'
      OR NEW."privacyPresentedAt" IS NOT NULL
      OR NEW."revision" <> 0
    )
  THEN
    RAISE EXCEPTION 'worker payment Flow session must start unopened and at revision zero'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD."privacyPresentedAt" IS NULL
    AND NEW."privacyPresentedAt" IS NOT NULL
  THEN
    observed_at := statement_timestamp();
    IF base_session."deliveryAttemptedAt" IS NULL
      OR base_session."deliveryRejectedAt" IS NOT NULL
      OR base_session."consumedAt" IS NOT NULL
      OR observed_at < base_session."deliveryAttemptedAt"
      OR observed_at >= base_session."expiresAt"
    THEN
      RAISE EXCEPTION 'worker payment Flow privacy presentation requires a live delivered session'
        USING ERRCODE = '55000';
    END IF;
    -- The database owns the observed instant. Callers can request this
    -- transition, but cannot backdate or future-date its evidence.
    NEW."privacyPresentedAt" := observed_at;
    NEW."updatedAt" := observed_at;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD."submissionStatus" = 'OPEN'
    AND NEW."submissionStatus" = 'PROCESSING'
  THEN
    observed_at := statement_timestamp();
    IF base_session."deliveryAttemptedAt" IS NULL
      OR base_session."deliveryRejectedAt" IS NOT NULL
      OR base_session."consumedAt" IS NOT NULL
      OR observed_at < base_session."deliveryAttemptedAt"
      OR observed_at + INTERVAL '1 minute' >= base_session."expiresAt"
    THEN
      RAISE EXCEPTION 'worker payment Flow reservation requires a safe live delivery window'
        USING ERRCODE = '55000';
    END IF;
    -- OPEN -> PROCESSING is the acceptance linearization point. The database
    -- owns it so host clock skew cannot backdate an already expired request.
    NEW."submissionReservedAt" := observed_at;
    NEW."updatedAt" := observed_at;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD."submissionStatus" = 'PROCESSING'
    AND NEW."submissionStatus" = 'UNCERTAIN'
  THEN
    observed_at := statement_timestamp();
    NEW."submissionUncertainAt" := observed_at;
    NEW."updatedAt" := observed_at;
  END IF;

  EXECUTE format(
    'SELECT "phoneNumberId"
       FROM %I."WhatsAppConnection"
      WHERE "id" = $1 AND "projectId" = $2',
    TG_TABLE_SCHEMA
  )
  INTO connection_phone
  USING NEW."connectionId", NEW."projectId";

  IF connection_phone IS NULL OR connection_phone IS DISTINCT FROM base_session."phoneNumberId" THEN
    RAISE EXCEPTION 'worker payment Flow connection scope mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM %I."WhatsAppConnection"
          WHERE "id" = $1
            AND "projectId" = $2
            AND "enabled" = TRUE
            AND "connectionStatus" = ''CONNECTED''
       )',
      TG_TABLE_SCHEMA
    )
    INTO active_connection
    USING NEW."connectionId", NEW."projectId";
    IF active_connection IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'worker payment Flow connection is not active'
        USING ERRCODE = '23514';
    END IF;

    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1
           FROM %1$I."Worker" worker
           JOIN %1$I."Project" project
             ON project."organizationId" = worker."organizationId"
            AND project."id" = worker."projectId"
           JOIN %1$I."WorkerPerson" person
             ON person."organizationId" = worker."organizationId"
            AND person."id" = worker."personId"
           JOIN %1$I."WorkerChannelIdentity" channel
             ON channel."organizationId" = person."organizationId"
            AND channel."personId" = person."id"
          WHERE worker."id" = $1
            AND worker."organizationId" = $2
            AND worker."projectId" = $3
            AND worker."personId" = $4
            AND worker."active" = TRUE
            AND project."status" = ''ACTIVE''
            AND person."status" = ''ACTIVE''
            AND person."identityStatus" = ''VERIFIED''
            AND channel."id" = $5
            AND channel."provider" = ''WHATSAPP''
            AND channel."status" = ''VERIFIED''
            AND channel."revokedAt" IS NULL
       )',
      TG_TABLE_SCHEMA
    )
    INTO verified_identity_scope
    USING
      NEW."workerId",
      NEW."organizationId",
      NEW."projectId",
      NEW."personId",
      NEW."channelIdentityId";
    IF verified_identity_scope IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'worker payment Flow identity scope is not verified'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "WorkerPaymentFlowSession_scope_guard"
BEFORE INSERT OR UPDATE ON "WorkerPaymentFlowSession"
FOR EACH ROW EXECUTE FUNCTION enforce_worker_payment_flow_session_scope();

-- The companion is append-forward. It cannot be rebound, reset after a
-- reservation, or retried automatically after an uncertain outcome.
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
    AND NEW."revision" = OLD."revision" + 1
  THEN
    RETURN NEW;
  END IF;

  IF OLD."submissionStatus" = 'PROCESSING'
    AND NEW."submissionStatus" IN ('SUCCEEDED', 'UNCERTAIN')
    AND NEW."privacyPresentedAt" IS NOT DISTINCT FROM OLD."privacyPresentedAt"
    AND NEW."submissionFingerprintKeyId" IS NOT DISTINCT FROM OLD."submissionFingerprintKeyId"
    AND NEW."submissionFingerprintHmac" IS NOT DISTINCT FROM OLD."submissionFingerprintHmac"
    AND NEW."submissionReservationId" IS NOT DISTINCT FROM OLD."submissionReservationId"
    AND NEW."submissionReservedAt" IS NOT DISTINCT FROM OLD."submissionReservedAt"
    AND NEW."revision" = OLD."revision" + 1
  THEN
    IF NEW."submissionStatus" = 'SUCCEEDED' THEN
      EXECUTE format(
        'SELECT
           destination."status"::text AS destination_status,
           destination."submissionContractVersion"::text AS destination_contract,
           destination."privacyChoiceEventId" AS destination_privacy_choice_id,
           choice."purpose"::text AS privacy_purpose,
           choice."paymentPurpose"::text AS privacy_payment_purpose,
           choice."channel"::text AS privacy_channel,
           choice."action"::text AS privacy_action,
           choice."actorMembershipId" AS privacy_membership_id,
           choice."channelIdentityId" AS privacy_channel_identity_id,
           choice."noticeVersion" AS privacy_notice_version,
           choice."noticeContentSha256" AS privacy_notice_sha256,
           choice."presentedAt" AS privacy_presented_at,
           choice."decidedAt" AS privacy_decided_at
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
          AND choice."id" = $5',
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
        OR success_provenance.destination_contract <> 'ATTESTED_V1'
        OR success_provenance.destination_status NOT IN ('PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE')
        OR success_provenance.destination_privacy_choice_id IS DISTINCT FROM NEW."privacyChoiceEventId"
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

CREATE TRIGGER "WorkerPaymentFlowSession_transition_guard"
BEFORE UPDATE ON "WorkerPaymentFlowSession"
FOR EACH ROW EXECUTE FUNCTION enforce_worker_payment_flow_session_transition();

CREATE OR REPLACE FUNCTION prevent_worker_payment_flow_session_removal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'worker payment Flow sessions cannot be deleted or truncated'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "WorkerPaymentFlowSession_no_delete"
BEFORE DELETE ON "WorkerPaymentFlowSession"
FOR EACH ROW EXECUTE FUNCTION prevent_worker_payment_flow_session_removal();

CREATE TRIGGER "WorkerPaymentFlowSession_no_truncate"
BEFORE TRUNCATE ON "WorkerPaymentFlowSession"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_worker_payment_flow_session_removal();

-- Once specialized, the generic transport claims that are signed into the
-- bearer token must remain immutable. Delivery/consumption journal fields stay
-- mutable under their existing CAS service.
CREATE OR REPLACE FUNCTION prevent_worker_payment_flow_base_rebinding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  has_payment_companion BOOLEAN;
BEGIN
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."WorkerPaymentFlowSession" WHERE "flowSessionId" = $1
     )',
    TG_TABLE_SCHEMA
  )
  INTO has_payment_companion
  USING OLD."id";

  IF has_payment_companion AND (
    OLD."id" IS DISTINCT FROM NEW."id"
    OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
    OR OLD."projectId" IS DISTINCT FROM NEW."projectId"
    OR OLD."workerId" IS DISTINCT FROM NEW."workerId"
    OR OLD."phoneNumberId" IS DISTINCT FROM NEW."phoneNumberId"
    OR OLD."recipientPhone" IS DISTINCT FROM NEW."recipientPhone"
    OR OLD."blueprintKey" IS DISTINCT FROM NEW."blueprintKey"
    OR OLD."flowId" IS DISTINCT FROM NEW."flowId"
    OR OLD."screenId" IS DISTINCT FROM NEW."screenId"
    OR OLD."flowType" IS DISTINCT FROM NEW."flowType"
    OR OLD."sourceExternalId" IS DISTINCT FROM NEW."sourceExternalId"
    OR OLD."tokenSha256" IS DISTINCT FROM NEW."tokenSha256"
    OR OLD."expiresAt" IS DISTINCT FROM NEW."expiresAt"
  ) THEN
    RAISE EXCEPTION 'specialized worker payment Flow base claims cannot change'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "WhatsAppFlowSession_worker_payment_binding_guard"
BEFORE UPDATE ON "WhatsAppFlowSession"
FOR EACH ROW EXECUTE FUNCTION prevent_worker_payment_flow_base_rebinding();

ALTER TABLE "WorkerPaymentFlowSession"
  ENABLE ALWAYS TRIGGER "WorkerPaymentFlowSession_scope_guard";
ALTER TABLE "WorkerPaymentFlowSession"
  ENABLE ALWAYS TRIGGER "WorkerPaymentFlowSession_transition_guard";
ALTER TABLE "WorkerPaymentFlowSession"
  ENABLE ALWAYS TRIGGER "WorkerPaymentFlowSession_no_delete";
ALTER TABLE "WorkerPaymentFlowSession"
  ENABLE ALWAYS TRIGGER "WorkerPaymentFlowSession_no_truncate";
ALTER TABLE "WhatsAppFlowSession"
  ENABLE ALWAYS TRIGGER "WhatsAppFlowSession_worker_payment_binding_guard";

COMMIT;
