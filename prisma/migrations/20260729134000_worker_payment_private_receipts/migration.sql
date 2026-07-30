BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Fail closed if an earlier partial attempt created either half of this
-- contract. Prisma migrations are atomic; an independently modified schema is
-- not safe to complete by guessing which guards were installed.
DO $migration_preflight$
BEGIN
  IF to_regclass(
       format('%I.%I', current_schema(), 'WorkerPaymentPrivateReceipt')
     ) IS NOT NULL
    OR EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'WorkerPaymentFlowSession'
         AND column_name = 'receiptDeliveryRequested'
    )
  THEN
    RAISE EXCEPTION 'worker payment private receipt migration requires an unopened H4 dataset'
      USING ERRCODE = '55000';
  END IF;
END;
$migration_preflight$;

ALTER TABLE "WorkerPaymentFlowSession"
ADD COLUMN "receiptDeliveryRequested" BOOLEAN NOT NULL DEFAULT false;

-- A receipt is a short-lived, privacy-minimal view capability. The row never
-- stores a bank value, holder identity, ciphertext, provider payload, or raw
-- bearer token. Its hashes are commitments, not substitutes for those values.
CREATE TABLE "WorkerPaymentPrivateReceipt" (
  "id" UUID NOT NULL,
  "contentVersion" VARCHAR(64) NOT NULL
    DEFAULT 'worker-payment-private-receipt-v1',
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "flowSessionId" UUID NOT NULL,
  "workerId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "channelIdentityId" TEXT NOT NULL,
  "paymentPurpose" "WorkerPaymentPurpose" NOT NULL,
  "destinationId" TEXT NOT NULL,
  "sourceWebhookEventId" TEXT NOT NULL,
  "destinationType" "WorkerPaymentDestinationType" NOT NULL,
  "destinationLastFour" VARCHAR(4) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "contentSha256" CHAR(64) NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
    DEFAULT (statement_timestamp() + INTERVAL '15 minutes'),
  "accessCount" INTEGER NOT NULL DEFAULT 0,
  "firstAccessedAt" TIMESTAMP(3),
  "lastAccessedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "WorkerPaymentPrivateReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkerPaymentPrivateReceipt_contract_check" CHECK (
    "contentVersion" = 'worker-payment-private-receipt-v1'
    AND (
      (
        "destinationType"::text IN ('CBU', 'CVU')
        AND "destinationLastFour" ~ '^[0-9]{4}$'
      )
      OR
      (
        "destinationType"::text = 'ALIAS'
        AND "destinationLastFour" ~ '^[a-z0-9.-]{4}$'
      )
    )
    AND "contentSha256" ~ '^[0-9a-f]{64}$'
    AND "tokenHash" ~ '^[0-9a-f]{64}$'
    AND "expiresAt" = "issuedAt" + INTERVAL '15 minutes'
    AND "accessCount" >= 0
    AND "accessCount" <= 5
    AND (
      (
        "accessCount" = 0
        AND "firstAccessedAt" IS NULL
        AND "lastAccessedAt" IS NULL
      )
      OR
      (
        "accessCount" > 0
        AND "firstAccessedAt" IS NOT NULL
        AND "lastAccessedAt" IS NOT NULL
        AND "firstAccessedAt" >= "issuedAt"
        AND "lastAccessedAt" >= "firstAccessedAt"
        AND "lastAccessedAt" < "expiresAt"
      )
    )
    AND ("revokedAt" IS NULL OR "revokedAt" >= "issuedAt")
  )
);

-- Exactly one private receipt and one bearer-token commitment per terminal
-- Flow. A replay observes the existing receipt instead of minting another.
CREATE UNIQUE INDEX "WorkerPaymentPrivateReceipt_flowSessionId_key"
ON "WorkerPaymentPrivateReceipt"("flowSessionId");

CREATE UNIQUE INDEX "WorkerPaymentPrivateReceipt_tokenHash_key"
ON "WorkerPaymentPrivateReceipt"("tokenHash");

CREATE UNIQUE INDEX "WorkerPaymentPrivateReceipt_org_id_key"
ON "WorkerPaymentPrivateReceipt"("organizationId", "id");

CREATE INDEX "WorkerPaymentPrivateReceipt_org_person_issued_idx"
ON "WorkerPaymentPrivateReceipt"("organizationId", "personId", "issuedAt");

CREATE INDEX "WorkerPaymentPrivateReceipt_expiry_revocation_idx"
ON "WorkerPaymentPrivateReceipt"("expiresAt", "revokedAt");

CREATE INDEX "WorkerPaymentPrivateReceipt_webhook_idx"
ON "WorkerPaymentPrivateReceipt"("projectId", "sourceWebhookEventId");

ALTER TABLE "WorkerPaymentPrivateReceipt"
ADD CONSTRAINT "WorkerPaymentPrivateReceipt_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentPrivateReceipt"
ADD CONSTRAINT "WorkerPaymentPrivateReceipt_project_scope_fkey"
FOREIGN KEY ("organizationId", "projectId")
REFERENCES "Project"("organizationId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentPrivateReceipt"
ADD CONSTRAINT "WorkerPaymentPrivateReceipt_connection_scope_fkey"
FOREIGN KEY ("projectId", "connectionId")
REFERENCES "WhatsAppConnection"("projectId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentPrivateReceipt"
ADD CONSTRAINT "WorkerPaymentPrivateReceipt_flow_session_fkey"
FOREIGN KEY ("flowSessionId")
REFERENCES "WorkerPaymentFlowSession"("flowSessionId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentPrivateReceipt"
ADD CONSTRAINT "WorkerPaymentPrivateReceipt_worker_scope_fkey"
FOREIGN KEY ("organizationId", "personId", "projectId", "workerId")
REFERENCES "Worker"("organizationId", "personId", "projectId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentPrivateReceipt"
ADD CONSTRAINT "WorkerPaymentPrivateReceipt_person_scope_fkey"
FOREIGN KEY ("organizationId", "personId")
REFERENCES "WorkerPerson"("organizationId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentPrivateReceipt"
ADD CONSTRAINT "WorkerPaymentPrivateReceipt_channel_scope_fkey"
FOREIGN KEY ("organizationId", "personId", "channelIdentityId")
REFERENCES "WorkerChannelIdentity"("organizationId", "personId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentPrivateReceipt"
ADD CONSTRAINT "WorkerPaymentPrivateReceipt_destination_scope_fkey"
FOREIGN KEY ("organizationId", "personId", "paymentPurpose", "destinationId")
REFERENCES "WorkerPaymentDestination"("organizationId", "personId", "purpose", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkerPaymentPrivateReceipt"
ADD CONSTRAINT "WorkerPaymentPrivateReceipt_webhook_scope_fkey"
FOREIGN KEY ("projectId", "sourceWebhookEventId")
REFERENCES "WebhookEvent"("projectId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- The worker's receipt choice may be supplied on OPEN -> PROCESSING, but it
-- becomes immutable at the reservation linearization point. Raw INSERT cannot
-- preselect it before the worker submits the protected form.
CREATE OR REPLACE FUNCTION enforce_worker_payment_receipt_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW."receiptDeliveryRequested" IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'worker payment receipt delivery cannot be preselected'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD."receiptDeliveryRequested"
      IS DISTINCT FROM NEW."receiptDeliveryRequested"
    AND NOT (
      OLD."submissionStatus" = 'OPEN'
      AND NEW."submissionStatus" = 'PROCESSING'
    )
  THEN
    RAISE EXCEPTION 'worker payment receipt delivery choice is immutable after reservation'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "WorkerPaymentFlowSession_receipt_request_guard"
BEFORE INSERT OR UPDATE ON "WorkerPaymentFlowSession"
FOR EACH ROW EXECUTE FUNCTION enforce_worker_payment_receipt_request();

-- Mint only from one completed chain: exact specialized companion, exact base
-- session consumption, exact destination, and the exact durably leased Meta
-- webhook whose outcome will commit in the same outer transaction. All joined
-- rows are key-share locked for the duration of that issuing transaction.
CREATE OR REPLACE FUNCTION enforce_worker_payment_private_receipt_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  provenance RECORD;
  observed_at TIMESTAMP(3);
  public_last_four TEXT;
  received_at_text TEXT;
  issued_at_text TEXT;
  content_commitment TEXT;
  expected_content_sha256 TEXT;
BEGIN
  IF NEW."contentVersion" IS DISTINCT FROM 'worker-payment-private-receipt-v1'
    OR NEW."accessCount" <> 0
    OR NEW."firstAccessedAt" IS NOT NULL
    OR NEW."lastAccessedAt" IS NOT NULL
    OR NEW."revokedAt" IS NOT NULL
  THEN
    RAISE EXCEPTION 'worker payment private receipt must start unopened and unrevoked'
      USING ERRCODE = '55000';
  END IF;

  EXECUTE format(
    'SELECT
       payment_session."flowSessionId" AS flow_session_id,
       payment_session."organizationId" AS organization_id,
       payment_session."projectId" AS project_id,
       payment_session."connectionId" AS connection_id,
       payment_session."workerId" AS worker_id,
       payment_session."personId" AS person_id,
       payment_session."channelIdentityId" AS channel_identity_id,
       payment_session."paymentPurpose"::text AS payment_purpose,
       payment_session."destinationId" AS destination_id,
       payment_session."submissionStatus"::text AS submission_status,
       payment_session."receiptDeliveryRequested" AS receipt_delivery_requested,
       payment_session."submittedAt" AS submitted_at,
       base_session."organizationId" AS base_organization_id,
       base_session."projectId" AS base_project_id,
       base_session."workerId" AS base_worker_id,
       base_session."blueprintKey" AS base_blueprint_key,
       base_session."screenId" AS base_screen_id,
       base_session."flowType" AS base_flow_type,
       base_session."consumedAt" AS base_consumed_at,
       base_session."consumedExternalId" AS base_consumed_external_id,
       destination."organizationId" AS destination_organization_id,
       destination."personId" AS destination_person_id,
       destination."purpose"::text AS destination_purpose,
       destination."type"::text AS destination_type,
       destination."lastFour" AS destination_last_four,
       destination."submittedAt" AS destination_submitted_at,
       webhook_event."id" AS webhook_event_id,
       webhook_event."projectId" AS webhook_project_id,
       webhook_event."provider" AS webhook_provider,
       webhook_event."eventType" AS webhook_event_type,
       webhook_event."status"::text AS webhook_status,
       webhook_event."externalId" AS webhook_external_id,
       webhook_event."appliedAt" AS webhook_applied_at
     FROM %1$I."WorkerPaymentFlowSession" payment_session
     JOIN %1$I."WhatsAppFlowSession" base_session
       ON base_session."id" = payment_session."flowSessionId"
     JOIN %1$I."WorkerPaymentDestination" destination
       ON destination."id" = payment_session."destinationId"
      AND destination."organizationId" = payment_session."organizationId"
      AND destination."personId" = payment_session."personId"
      AND destination."purpose" = payment_session."paymentPurpose"
     JOIN %1$I."WebhookEvent" webhook_event
       ON webhook_event."id" = $2
      AND webhook_event."projectId" = payment_session."projectId"
    WHERE payment_session."flowSessionId" = $1
    FOR KEY SHARE OF payment_session, base_session, destination, webhook_event',
    TG_TABLE_SCHEMA
  )
  INTO provenance
  USING NEW."flowSessionId", NEW."sourceWebhookEventId";

  IF provenance.flow_session_id IS NULL THEN
    RAISE EXCEPTION 'worker payment private receipt provenance is missing'
      USING ERRCODE = '55000';
  END IF;

  IF provenance.submission_status IS DISTINCT FROM 'SUCCEEDED'
    OR provenance.receipt_delivery_requested IS DISTINCT FROM true
    OR provenance.submitted_at IS NULL
    OR provenance.organization_id IS DISTINCT FROM NEW."organizationId"
    OR provenance.project_id IS DISTINCT FROM NEW."projectId"
    OR provenance.connection_id IS DISTINCT FROM NEW."connectionId"
    OR provenance.worker_id IS DISTINCT FROM NEW."workerId"
    OR provenance.person_id IS DISTINCT FROM NEW."personId"
    OR provenance.channel_identity_id IS DISTINCT FROM NEW."channelIdentityId"
    OR provenance.payment_purpose IS DISTINCT FROM NEW."paymentPurpose"::text
    OR provenance.destination_id IS DISTINCT FROM NEW."destinationId"
    OR provenance.submitted_at IS DISTINCT FROM NEW."receivedAt"
    OR provenance.base_organization_id IS DISTINCT FROM NEW."organizationId"
    OR provenance.base_project_id IS DISTINCT FROM NEW."projectId"
    OR provenance.base_worker_id IS DISTINCT FROM NEW."workerId"
    OR provenance.base_blueprint_key IS DISTINCT FROM 'worker-payment-destination'
    OR provenance.base_screen_id IS DISTINCT FROM 'WORKER_PAYMENT_DESTINATION'
    OR provenance.base_flow_type IS DISTINCT FROM 'worker_payment_destination'
    OR provenance.base_consumed_at IS NULL
    OR provenance.base_consumed_external_id IS NULL
    OR provenance.destination_organization_id IS DISTINCT FROM NEW."organizationId"
    OR provenance.destination_person_id IS DISTINCT FROM NEW."personId"
    OR provenance.destination_purpose IS DISTINCT FROM NEW."paymentPurpose"::text
    OR provenance.destination_type IS DISTINCT FROM NEW."destinationType"::text
    OR provenance.destination_last_four IS DISTINCT FROM NEW."destinationLastFour"
    OR provenance.destination_submitted_at IS DISTINCT FROM provenance.submitted_at
    OR provenance.webhook_event_id IS DISTINCT FROM NEW."sourceWebhookEventId"
    OR provenance.webhook_project_id IS DISTINCT FROM NEW."projectId"
    OR provenance.webhook_provider IS DISTINCT FROM 'meta'
    OR provenance.webhook_event_type IS DISTINCT FROM 'message'
    OR provenance.webhook_status IS DISTINCT FROM 'PROCESSING'
    OR provenance.webhook_external_id IS DISTINCT FROM
      'project:' || NEW."projectId" || ':' || provenance.base_consumed_external_id
    OR provenance.webhook_applied_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'worker payment private receipt provenance is invalid'
      USING ERRCODE = '55000';
  END IF;

  -- Commit only to the public receipt projection. In particular, an alias
  -- fragment is never exposed directly or through a brute-forceable hash.
  public_last_four := CASE
    WHEN NEW."destinationType"::text IN ('CBU', 'CVU')
      THEN NEW."destinationLastFour"
    ELSE ''
  END;
  received_at_text := to_char(
    NEW."receivedAt",
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  issued_at_text := to_char(
    NEW."issuedAt",
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  content_commitment :=
      octet_length('obrasaas:worker-payment-private-receipt-content:v1')::text
        || ':obrasaas:worker-payment-private-receipt-content:v1|'
    || octet_length(NEW."contentVersion")::text || ':' || NEW."contentVersion" || '|'
    || octet_length(NEW."id"::text)::text || ':' || NEW."id"::text || '|'
    || octet_length(received_at_text)::text || ':' || received_at_text || '|'
    || octet_length(issued_at_text)::text || ':' || issued_at_text || '|'
    || octet_length(NEW."paymentPurpose"::text)::text || ':'
      || NEW."paymentPurpose"::text || '|'
    || octet_length(NEW."destinationType"::text)::text || ':'
      || NEW."destinationType"::text || '|'
    || octet_length(public_last_four)::text || ':' || public_last_four || '|'
    || octet_length('RECEIVED_FOR_REVIEW')::text || ':RECEIVED_FOR_REVIEW';
  expected_content_sha256 := encode(
    sha256(convert_to(content_commitment, 'UTF8')),
    'hex'
  );
  IF NEW."contentSha256" IS DISTINCT FROM expected_content_sha256 THEN
    RAISE EXCEPTION 'worker payment private receipt content hash is invalid'
      USING ERRCODE = '55000';
  END IF;

  observed_at := statement_timestamp();
  IF NEW."expiresAt" IS DISTINCT FROM NEW."issuedAt" + INTERVAL '15 minutes'
    OR NEW."issuedAt" < observed_at - INTERVAL '1 minute'
    OR NEW."issuedAt" > observed_at + INTERVAL '5 seconds'
  THEN
    RAISE EXCEPTION 'worker payment private receipt TTL is invalid'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "WorkerPaymentPrivateReceipt_insert_guard"
BEFORE INSERT ON "WorkerPaymentPrivateReceipt"
FOR EACH ROW EXECUTE FUNCTION enforce_worker_payment_private_receipt_insert();

-- Access and revocation are the only legal mutations. The database owns every
-- observed timestamp; a caller can request one CAS increment or revocation but
-- cannot backdate, extend, rebind, or resurrect a receipt.
CREATE OR REPLACE FUNCTION enforce_worker_payment_private_receipt_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  observed_at TIMESTAMP(3);
BEGIN
  IF OLD."id" IS DISTINCT FROM NEW."id"
    OR OLD."contentVersion" IS DISTINCT FROM NEW."contentVersion"
    OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
    OR OLD."projectId" IS DISTINCT FROM NEW."projectId"
    OR OLD."connectionId" IS DISTINCT FROM NEW."connectionId"
    OR OLD."flowSessionId" IS DISTINCT FROM NEW."flowSessionId"
    OR OLD."workerId" IS DISTINCT FROM NEW."workerId"
    OR OLD."personId" IS DISTINCT FROM NEW."personId"
    OR OLD."channelIdentityId" IS DISTINCT FROM NEW."channelIdentityId"
    OR OLD."paymentPurpose" IS DISTINCT FROM NEW."paymentPurpose"
    OR OLD."destinationId" IS DISTINCT FROM NEW."destinationId"
    OR OLD."sourceWebhookEventId" IS DISTINCT FROM NEW."sourceWebhookEventId"
    OR OLD."destinationType" IS DISTINCT FROM NEW."destinationType"
    OR OLD."destinationLastFour" IS DISTINCT FROM NEW."destinationLastFour"
    OR OLD."receivedAt" IS DISTINCT FROM NEW."receivedAt"
    OR OLD."contentSha256" IS DISTINCT FROM NEW."contentSha256"
    OR OLD."tokenHash" IS DISTINCT FROM NEW."tokenHash"
    OR OLD."issuedAt" IS DISTINCT FROM NEW."issuedAt"
    OR OLD."expiresAt" IS DISTINCT FROM NEW."expiresAt"
  THEN
    RAISE EXCEPTION 'worker payment private receipt immutable fields changed'
      USING ERRCODE = '55000';
  END IF;

  observed_at := statement_timestamp();
  IF NEW."accessCount" = OLD."accessCount" + 1
    AND NEW."revokedAt" IS NOT DISTINCT FROM OLD."revokedAt"
  THEN
    IF OLD."revokedAt" IS NOT NULL
      OR OLD."accessCount" >= 5
      OR observed_at >= OLD."expiresAt"
    THEN
      RAISE EXCEPTION 'worker payment private receipt is expired, revoked, or exhausted'
        USING ERRCODE = '55000';
    END IF;
    NEW."firstAccessedAt" := COALESCE(OLD."firstAccessedAt", observed_at);
    NEW."lastAccessedAt" := observed_at;
    RETURN NEW;
  END IF;

  IF OLD."revokedAt" IS NULL
    AND NEW."revokedAt" IS NOT NULL
    AND NEW."accessCount" = OLD."accessCount"
    AND NEW."firstAccessedAt" IS NOT DISTINCT FROM OLD."firstAccessedAt"
    AND NEW."lastAccessedAt" IS NOT DISTINCT FROM OLD."lastAccessedAt"
  THEN
    NEW."revokedAt" := observed_at;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'worker payment private receipt lifecycle transition is not allowed'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "WorkerPaymentPrivateReceipt_lifecycle_guard"
BEFORE UPDATE ON "WorkerPaymentPrivateReceipt"
FOR EACH ROW EXECUTE FUNCTION enforce_worker_payment_private_receipt_lifecycle();

CREATE OR REPLACE FUNCTION prevent_worker_payment_private_receipt_removal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'worker payment private receipts cannot be deleted or truncated; revoke them instead'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "WorkerPaymentPrivateReceipt_no_delete"
BEFORE DELETE ON "WorkerPaymentPrivateReceipt"
FOR EACH ROW EXECUTE FUNCTION prevent_worker_payment_private_receipt_removal();

CREATE TRIGGER "WorkerPaymentPrivateReceipt_no_truncate"
BEFORE TRUNCATE ON "WorkerPaymentPrivateReceipt"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_worker_payment_private_receipt_removal();

ALTER TABLE "WorkerPaymentFlowSession"
  ENABLE ALWAYS TRIGGER "WorkerPaymentFlowSession_receipt_request_guard";
ALTER TABLE "WorkerPaymentPrivateReceipt"
  ENABLE ALWAYS TRIGGER "WorkerPaymentPrivateReceipt_insert_guard";
ALTER TABLE "WorkerPaymentPrivateReceipt"
  ENABLE ALWAYS TRIGGER "WorkerPaymentPrivateReceipt_lifecycle_guard";
ALTER TABLE "WorkerPaymentPrivateReceipt"
  ENABLE ALWAYS TRIGGER "WorkerPaymentPrivateReceipt_no_delete";
ALTER TABLE "WorkerPaymentPrivateReceipt"
  ENABLE ALWAYS TRIGGER "WorkerPaymentPrivateReceipt_no_truncate";

COMMIT;
