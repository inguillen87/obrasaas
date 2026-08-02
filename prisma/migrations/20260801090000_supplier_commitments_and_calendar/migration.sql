-- Supplier commitments are the canonical bridge between procurement and the WBS.
-- Civil dates remain DATE values; the tenant timezone snapshot is used only to
-- derive provider reminder instants.
CREATE TYPE "SupplierCommitmentKind" AS ENUM (
  'MATERIAL_DELIVERY',
  'SERVICE_EXECUTION'
);

CREATE TYPE "SupplierCommitmentStatus" AS ENUM (
  'TENTATIVE',
  'CONFIRMED',
  'AT_RISK',
  'FULFILLED',
  'CANCELLED'
);

CREATE TYPE "SupplierCommitmentTaskRelation" AS ENUM (
  'REQUIRED_BEFORE_START',
  'EXECUTES_TASK'
);

CREATE TYPE "SupplierCommitmentEventType" AS ENUM (
  'CREATED',
  'CONFIRMED',
  'RESCHEDULED',
  'MARKED_AT_RISK',
  'FULFILLED',
  'CANCELLED'
);

CREATE TYPE "SupplierReminderDeliveryStatus" AS ENUM (
  'PENDING',
  'CLAIMED',
  'DISPATCHING',
  'PROVIDER_ACCEPTED',
  'DELIVERY_DELAYED',
  'DELIVERED',
  'FAILED',
  'DEAD_LETTER',
  'CANCELLED',
  'UNCERTAIN',
  'CONFLICT',
  'BOUNCED',
  'COMPLAINED',
  'DELIVERY_FAILED',
  'SUPPRESSED'
);

CREATE TYPE "SupplierReminderKind" AS ENUM (
  'UPCOMING',
  'LATE_SCHEDULED',
  'RESCHEDULED',
  'CANCELLED'
);

-- Repair the procurement scope drift before adding more relations. These
-- composite keys make project/order mismatches impossible through direct DML.
ALTER TABLE "Supplier" ALTER COLUMN "email" TYPE VARCHAR(254);
CREATE UNIQUE INDEX "PurchaseOrder_organizationId_projectId_id_key"
  ON "PurchaseOrder"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "PurchaseOrder_organizationId_projectId_supplierId_id_key"
  ON "PurchaseOrder"("organizationId", "projectId", "supplierId", "id");
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_project_fkey";
ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PurchaseOrderLine_projectId_purchaseOrderId_id_key"
  ON "PurchaseOrderLine"("projectId", "purchaseOrderId", "id");
ALTER TABLE "PurchaseOrderLine" DROP CONSTRAINT "PurchaseOrderLine_order_fkey";
ALTER TABLE "PurchaseOrderLine"
  ADD CONSTRAINT "PurchaseOrderLine_order_fkey"
  FOREIGN KEY ("projectId", "purchaseOrderId")
  REFERENCES "PurchaseOrder"("projectId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Supplier invoices must not point at a project, supplier or purchase order
-- outside their own tenant scope, even through direct SQL.
ALTER TABLE "SupplierInvoice" DROP CONSTRAINT "SupplierInvoice_project_fkey";
ALTER TABLE "SupplierInvoice" DROP CONSTRAINT "SupplierInvoice_order_fkey";
ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_order_fkey"
  FOREIGN KEY ("organizationId", "projectId", "supplierId", "purchaseOrderId")
  REFERENCES "PurchaseOrder"("organizationId", "projectId", "supplierId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "Task"
     WHERE "metadata"->>'source' = 'canonical-task-v1'
       AND (
         ("startsAt" IS NOT NULL AND "startsAt" <> date_trunc('day', "startsAt"))
         OR ("endsAt" IS NOT NULL AND "endsAt" <> date_trunc('day', "endsAt"))
       )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Canonical Task dates contain a time component';
  END IF;
END;
$$;
ALTER TABLE "Task"
  ADD CONSTRAINT "Task_canonical_startsAt_civil_check" CHECK (
    "metadata"->>'source' IS DISTINCT FROM 'canonical-task-v1'
    OR "startsAt" IS NULL
    OR "startsAt" = date_trunc('day', "startsAt")
  );
ALTER TABLE "Task"
  ADD CONSTRAINT "Task_canonical_endsAt_civil_check" CHECK (
    "metadata"->>'source' IS DISTINCT FROM 'canonical-task-v1'
    OR "endsAt" IS NULL
    OR "endsAt" = date_trunc('day', "endsAt")
  );

ALTER TABLE "GoodsReceipt" ADD COLUMN "organizationId" TEXT;
UPDATE "GoodsReceipt" AS receipt
   SET "organizationId" = project."organizationId"
  FROM "Project" AS project
 WHERE project."id" = receipt."projectId";
ALTER TABLE "GoodsReceipt" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE UNIQUE INDEX "GoodsReceipt_projectId_purchaseOrderId_id_key"
  ON "GoodsReceipt"("projectId", "purchaseOrderId", "id");
ALTER TABLE "GoodsReceipt" DROP CONSTRAINT "GoodsReceipt_project_fkey";
ALTER TABLE "GoodsReceipt" DROP CONSTRAINT "GoodsReceipt_order_fkey";
ALTER TABLE "GoodsReceipt"
  ADD CONSTRAINT "GoodsReceipt_organization_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt"
  ADD CONSTRAINT "GoodsReceipt_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt"
  ADD CONSTRAINT "GoodsReceipt_order_fkey"
  FOREIGN KEY ("organizationId", "projectId", "purchaseOrderId")
  REFERENCES "PurchaseOrder"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsReceiptLine"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "purchaseOrderId" TEXT;
UPDATE "GoodsReceiptLine" AS receipt_line
   SET "projectId" = receipt."projectId",
       "purchaseOrderId" = receipt."purchaseOrderId"
  FROM "GoodsReceipt" AS receipt
 WHERE receipt."id" = receipt_line."goodsReceiptId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "GoodsReceiptLine" AS receipt_line
      JOIN "PurchaseOrderLine" AS order_line
        ON order_line."id" = receipt_line."purchaseOrderLineId"
     WHERE order_line."projectId" IS DISTINCT FROM receipt_line."projectId"
        OR order_line."purchaseOrderId" IS DISTINCT FROM receipt_line."purchaseOrderId"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'GoodsReceiptLine contains a cross-project or cross-order link';
  END IF;
END;
$$;

ALTER TABLE "GoodsReceiptLine" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "GoodsReceiptLine" ALTER COLUMN "purchaseOrderId" SET NOT NULL;
ALTER TABLE "GoodsReceiptLine" DROP CONSTRAINT "GoodsReceiptLine_receipt_fkey";
ALTER TABLE "GoodsReceiptLine" DROP CONSTRAINT "GoodsReceiptLine_orderLine_fkey";
ALTER TABLE "GoodsReceiptLine"
  ADD CONSTRAINT "GoodsReceiptLine_receipt_fkey"
  FOREIGN KEY ("projectId", "purchaseOrderId", "goodsReceiptId")
  REFERENCES "GoodsReceipt"("projectId", "purchaseOrderId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptLine"
  ADD CONSTRAINT "GoodsReceiptLine_orderLine_fkey"
  FOREIGN KEY ("projectId", "purchaseOrderId", "purchaseOrderLineId")
  REFERENCES "PurchaseOrderLine"("projectId", "purchaseOrderId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "GoodsReceiptLine_projectId_purchaseOrderId_idx"
  ON "GoodsReceiptLine"("projectId", "purchaseOrderId");

CREATE TABLE "SupplierCommitment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "purchaseOrderId" TEXT,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "kind" "SupplierCommitmentKind" NOT NULL,
  "status" "SupplierCommitmentStatus" NOT NULL DEFAULT 'CONFIRMED',
  "title" VARCHAR(220) NOT NULL,
  "notes" TEXT,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL,
  "timezone" VARCHAR(64) NOT NULL,
  "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
  "reminderDaysBefore" INTEGER NOT NULL DEFAULT 7,
  "reminderEmail" VARCHAR(254),
  "reminderEmailConfirmedAt" TIMESTAMP(3),
  "reminderEmailConfirmedById" VARCHAR(190),
  "scheduleRevision" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "fulfilledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierCommitment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierCommitment_dates_check" CHECK ("startsOn" <= "endsOn"),
  CONSTRAINT "SupplierCommitment_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "SupplierCommitment_schedule_revision_check" CHECK ("scheduleRevision" >= 0),
  CONSTRAINT "SupplierCommitment_reminder_days_check"
    CHECK ("reminderDaysBefore" BETWEEN 1 AND 30),
  CONSTRAINT "SupplierCommitment_reminder_bundle_check"
    CHECK (
      NOT "reminderEnabled"
      OR (
        "reminderEmail" IS NOT NULL
        AND "reminderEmailConfirmedAt" IS NOT NULL
        AND "reminderEmailConfirmedById" IS NOT NULL
      )
    ),
  CONSTRAINT "SupplierCommitment_fulfilled_bundle_check"
    CHECK (("status" = 'FULFILLED') = ("fulfilledAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "SupplierCommitment_projectId_id_key"
  ON "SupplierCommitment"("projectId", "id");
CREATE UNIQUE INDEX "SupplierCommitment_organizationId_projectId_id_key"
  ON "SupplierCommitment"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "SupplierCommitment_projectId_purchaseOrderId_id_key"
  ON "SupplierCommitment"("projectId", "purchaseOrderId", "id");
CREATE UNIQUE INDEX "SupplierCommitment_projectId_operationKey_key"
  ON "SupplierCommitment"("projectId", "operationKey");
CREATE INDEX "SupplierCommitment_projectId_startsOn_status_idx"
  ON "SupplierCommitment"("projectId", "startsOn", "status");
CREATE INDEX "SupplierCommitment_organizationId_supplierId_startsOn_idx"
  ON "SupplierCommitment"("organizationId", "supplierId", "startsOn");
CREATE INDEX "SupplierCommitment_projectId_purchaseOrderId_idx"
  ON "SupplierCommitment"("projectId", "purchaseOrderId");
ALTER TABLE "SupplierCommitment"
  ADD CONSTRAINT "SupplierCommitment_organization_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierCommitment"
  ADD CONSTRAINT "SupplierCommitment_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierCommitment"
  ADD CONSTRAINT "SupplierCommitment_supplier_fkey"
  FOREIGN KEY ("organizationId", "supplierId")
  REFERENCES "Supplier"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierCommitment"
  ADD CONSTRAINT "SupplierCommitment_purchaseOrder_fkey"
  FOREIGN KEY ("organizationId", "projectId", "supplierId", "purchaseOrderId")
  REFERENCES "PurchaseOrder"("organizationId", "projectId", "supplierId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SupplierCommitmentLine" (
  "commitmentId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "purchaseOrderLineId" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierCommitmentLine_pkey"
    PRIMARY KEY ("commitmentId", "purchaseOrderLineId"),
  CONSTRAINT "SupplierCommitmentLine_quantity_check" CHECK ("quantity" > 0)
);
CREATE INDEX "SupplierCommitmentLine_projectId_purchaseOrderLineId_idx"
  ON "SupplierCommitmentLine"("projectId", "purchaseOrderLineId");
ALTER TABLE "SupplierCommitmentLine"
  ADD CONSTRAINT "SupplierCommitmentLine_commitment_fkey"
  FOREIGN KEY ("projectId", "purchaseOrderId", "commitmentId")
  REFERENCES "SupplierCommitment"("projectId", "purchaseOrderId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierCommitmentLine"
  ADD CONSTRAINT "SupplierCommitmentLine_purchaseOrderLine_fkey"
  FOREIGN KEY ("projectId", "purchaseOrderId", "purchaseOrderLineId")
  REFERENCES "PurchaseOrderLine"("projectId", "purchaseOrderId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SupplierCommitmentTaskLink" (
  "commitmentId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "relation" "SupplierCommitmentTaskRelation" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierCommitmentTaskLink_pkey" PRIMARY KEY ("commitmentId", "taskId")
);
CREATE INDEX "SupplierCommitmentTaskLink_projectId_taskId_idx"
  ON "SupplierCommitmentTaskLink"("projectId", "taskId");
ALTER TABLE "SupplierCommitmentTaskLink"
  ADD CONSTRAINT "SupplierCommitmentTaskLink_commitment_fkey"
  FOREIGN KEY ("projectId", "commitmentId")
  REFERENCES "SupplierCommitment"("projectId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierCommitmentTaskLink"
  ADD CONSTRAINT "SupplierCommitmentTaskLink_task_fkey"
  FOREIGN KEY ("projectId", "taskId")
  REFERENCES "Task"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SupplierCommitmentEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "commitmentId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "type" "SupplierCommitmentEventType" NOT NULL,
  "actorId" VARCHAR(190) NOT NULL,
  "reason" VARCHAR(500),
  "previousState" JSONB,
  "nextState" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierCommitmentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierCommitmentEvent_sequence_check" CHECK ("sequence" >= 0)
);
CREATE UNIQUE INDEX "SupplierCommitmentEvent_projectId_commitmentId_sequence_key"
  ON "SupplierCommitmentEvent"("projectId", "commitmentId", "sequence");
CREATE UNIQUE INDEX "SupplierCommitmentEvent_projectId_operationKey_key"
  ON "SupplierCommitmentEvent"("projectId", "operationKey");
CREATE INDEX "SupplierCommitmentEvent_organizationId_createdAt_idx"
  ON "SupplierCommitmentEvent"("organizationId", "createdAt");
ALTER TABLE "SupplierCommitmentEvent"
  ADD CONSTRAINT "SupplierCommitmentEvent_commitment_fkey"
  FOREIGN KEY ("organizationId", "projectId", "commitmentId")
  REFERENCES "SupplierCommitment"("organizationId", "projectId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SupplierReminderDelivery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "commitmentId" TEXT NOT NULL,
  "scheduleRevision" INTEGER NOT NULL,
  "eventKey" VARCHAR(190) NOT NULL,
  "providerIdempotencyKey" VARCHAR(256) NOT NULL,
  "kind" "SupplierReminderKind" NOT NULL,
  "status" "SupplierReminderDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "recipientEmail" VARCHAR(254) NOT NULL,
  "subject" VARCHAR(220) NOT NULL,
  "textBody" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leasedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "provider" VARCHAR(32),
  "providerMessageId" VARCHAR(190),
  "providerStatusAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierReminderDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierReminderDelivery_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "SupplierReminderDelivery_revision_check" CHECK ("scheduleRevision" >= 0),
  CONSTRAINT "SupplierReminderDelivery_lease_bundle_check" CHECK (
    ("status" IN ('CLAIMED', 'DISPATCHING')) = ("leasedAt" IS NOT NULL)
  ),
  CONSTRAINT "SupplierReminderDelivery_provider_bundle_check" CHECK (
    "status" NOT IN (
      'PROVIDER_ACCEPTED', 'DELIVERY_DELAYED', 'DELIVERED', 'BOUNCED',
      'COMPLAINED', 'DELIVERY_FAILED', 'SUPPRESSED'
    ) OR (
      "provider" IS NOT NULL
      AND "providerMessageId" IS NOT NULL
      AND "providerStatusAt" IS NOT NULL
      AND "sentAt" IS NOT NULL
    )
  )
);
CREATE UNIQUE INDEX "SupplierReminderDelivery_organizationId_eventKey_key"
  ON "SupplierReminderDelivery"("organizationId", "eventKey");
CREATE UNIQUE INDEX "SupplierReminderDelivery_providerIdempotencyKey_key"
  ON "SupplierReminderDelivery"("providerIdempotencyKey");
CREATE UNIQUE INDEX "SupplierReminderDelivery_organizationId_projectId_id_key"
  ON "SupplierReminderDelivery"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "SupplierReminderDelivery_provider_providerMessageId_key"
  ON "SupplierReminderDelivery"("provider", "providerMessageId");
CREATE INDEX "SupplierReminderDelivery_status_nextAttemptAt_createdAt_idx"
  ON "SupplierReminderDelivery"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "SupplierReminderDelivery_projectId_commitmentId_scheduleRevision_idx"
  ON "SupplierReminderDelivery"("projectId", "commitmentId", "scheduleRevision");
ALTER TABLE "SupplierReminderDelivery"
  ADD CONSTRAINT "SupplierReminderDelivery_organization_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SupplierReminderWebhookEvent" (
  "id" VARCHAR(190) NOT NULL,
  "providerMessageId" VARCHAR(190) NOT NULL,
  "type" VARCHAR(64) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierReminderWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupplierReminderWebhookEvent_providerMessageId_occurredAt_idx"
  ON "SupplierReminderWebhookEvent"("providerMessageId", "occurredAt");
ALTER TABLE "SupplierReminderDelivery"
  ADD CONSTRAINT "SupplierReminderDelivery_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SupplierReminderWebhookApplication" (
  "eventId" VARCHAR(190) NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "appliedStatus" "SupplierReminderDeliveryStatus",
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierReminderWebhookApplication_pkey" PRIMARY KEY ("eventId")
);
CREATE INDEX "SupplierReminderWebhookApplication_organizationId_appliedAt_idx"
  ON "SupplierReminderWebhookApplication"("organizationId", "appliedAt");
CREATE INDEX "SupplierReminderWebhookApplication_projectId_deliveryId_appliedAt_idx"
  ON "SupplierReminderWebhookApplication"("projectId", "deliveryId", "appliedAt");
ALTER TABLE "SupplierReminderWebhookApplication"
  ADD CONSTRAINT "SupplierReminderWebhookApplication_event_fkey"
  FOREIGN KEY ("eventId") REFERENCES "SupplierReminderWebhookEvent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierReminderWebhookApplication"
  ADD CONSTRAINT "SupplierReminderWebhookApplication_delivery_fkey"
  FOREIGN KEY ("organizationId", "projectId", "deliveryId")
  REFERENCES "SupplierReminderDelivery"("organizationId", "projectId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierReminderDelivery"
  ADD CONSTRAINT "SupplierReminderDelivery_commitment_fkey"
  FOREIGN KEY ("organizationId", "projectId", "commitmentId")
  REFERENCES "SupplierCommitment"("organizationId", "projectId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Every commitment revision must have one immutable event by commit time.
CREATE FUNCTION "obrasaas_supplier_commitment_revision_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" IN ('FULFILLED', 'CANCELLED')
       OR NEW."revision" <> OLD."revision" + 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'SupplierCommitment terminal state or revision transition is invalid';
    END IF;
    IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
       OR OLD."projectId" IS DISTINCT FROM NEW."projectId"
       OR OLD."supplierId" IS DISTINCT FROM NEW."supplierId"
       OR OLD."purchaseOrderId" IS DISTINCT FROM NEW."purchaseOrderId"
       OR OLD."operationKey" IS DISTINCT FROM NEW."operationKey"
       OR OLD."requestFingerprint" IS DISTINCT FROM NEW."requestFingerprint"
       OR OLD."kind" IS DISTINCT FROM NEW."kind"
       OR OLD."timezone" IS DISTINCT FROM NEW."timezone" THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'SupplierCommitment immutable identity changed';
    END IF;
    IF NEW."scheduleRevision" NOT IN (OLD."scheduleRevision", OLD."scheduleRevision" + 1) THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'SupplierCommitment schedule revision transition is invalid';
    END IF;
    IF (
      OLD."startsOn" IS DISTINCT FROM NEW."startsOn"
      OR OLD."endsOn" IS DISTINCT FROM NEW."endsOn"
      OR OLD."timezone" IS DISTINCT FROM NEW."timezone"
      OR OLD."reminderEnabled" IS DISTINCT FROM NEW."reminderEnabled"
      OR OLD."reminderDaysBefore" IS DISTINCT FROM NEW."reminderDaysBefore"
      OR OLD."reminderEmail" IS DISTINCT FROM NEW."reminderEmail"
      OR OLD."reminderEmailConfirmedAt" IS DISTINCT FROM NEW."reminderEmailConfirmedAt"
      OR OLD."reminderEmailConfirmedById" IS DISTINCT FROM NEW."reminderEmailConfirmedById"
    ) <> (NEW."scheduleRevision" = OLD."scheduleRevision" + 1) THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'SupplierCommitment schedule changes require one schedule revision';
    END IF;
    IF NOT (
      (OLD."status" = 'TENTATIVE' AND NEW."status" = 'TENTATIVE' AND NEW."scheduleRevision" = OLD."scheduleRevision" + 1)
      OR (OLD."status" = 'TENTATIVE' AND NEW."status" = 'CONFIRMED' AND NEW."scheduleRevision" = OLD."scheduleRevision")
      OR (OLD."status" = 'TENTATIVE' AND NEW."status" = 'CANCELLED' AND NEW."scheduleRevision" = OLD."scheduleRevision")
      OR (OLD."status" = 'CONFIRMED' AND NEW."status" = 'CONFIRMED' AND NEW."scheduleRevision" = OLD."scheduleRevision" + 1)
      OR (OLD."status" = 'CONFIRMED' AND NEW."status" IN ('AT_RISK', 'FULFILLED', 'CANCELLED') AND NEW."scheduleRevision" = OLD."scheduleRevision")
      OR (OLD."status" = 'AT_RISK' AND NEW."status" = 'AT_RISK' AND NEW."scheduleRevision" = OLD."scheduleRevision" + 1)
      OR (OLD."status" = 'AT_RISK' AND NEW."status" IN ('FULFILLED', 'CANCELLED') AND NEW."scheduleRevision" = OLD."scheduleRevision")
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'SupplierCommitment status transition is invalid';
    END IF;
  ELSIF NEW."revision" <> 0 OR NEW."scheduleRevision" <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'SupplierCommitment must start at revision zero';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_supplier_commitment_event_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  event_exists BOOLEAN;
  next_expected JSONB;
  previous_expected JSONB;
  expected_type TEXT;
  reason_required BOOLEAN;
BEGIN
  next_expected := jsonb_build_object(
    'kind', NEW."kind"::TEXT,
    'status', NEW."status"::TEXT,
    'title', NEW."title",
    'startsOn', to_char(NEW."startsOn", 'YYYY-MM-DD'),
    'endsOn', to_char(NEW."endsOn", 'YYYY-MM-DD'),
    'reminderEnabled', NEW."reminderEnabled",
    'reminderDaysBefore', NEW."reminderDaysBefore",
    'reminderEmailConfigured', NEW."reminderEmail" IS NOT NULL,
    'reminderEmailConfirmed', NEW."reminderEmailConfirmedAt" IS NOT NULL,
    'scheduleRevision', NEW."scheduleRevision",
    'revision', NEW."revision"
  );
  IF TG_OP = 'INSERT' THEN
    previous_expected := NULL;
    expected_type := 'CREATED';
  ELSE
    previous_expected := jsonb_build_object(
      'kind', OLD."kind"::TEXT,
      'status', OLD."status"::TEXT,
      'title', OLD."title",
      'startsOn', to_char(OLD."startsOn", 'YYYY-MM-DD'),
      'endsOn', to_char(OLD."endsOn", 'YYYY-MM-DD'),
      'reminderEnabled', OLD."reminderEnabled",
      'reminderDaysBefore', OLD."reminderDaysBefore",
      'reminderEmailConfigured', OLD."reminderEmail" IS NOT NULL,
      'reminderEmailConfirmed', OLD."reminderEmailConfirmedAt" IS NOT NULL,
      'scheduleRevision', OLD."scheduleRevision",
      'revision', OLD."revision"
    );
    expected_type := CASE
      WHEN NEW."scheduleRevision" = OLD."scheduleRevision" + 1 THEN 'RESCHEDULED'
      WHEN NEW."status" = 'CONFIRMED' THEN 'CONFIRMED'
      WHEN NEW."status" = 'AT_RISK' THEN 'MARKED_AT_RISK'
      WHEN NEW."status" = 'FULFILLED' THEN 'FULFILLED'
      WHEN NEW."status" = 'CANCELLED' THEN 'CANCELLED'
      ELSE NULL
    END;
  END IF;
  reason_required := expected_type IN ('RESCHEDULED', 'CANCELLED')
    OR (expected_type = 'FULFILLED' AND NEW."kind" = 'MATERIAL_DELIVERY');
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."SupplierCommitmentEvent" AS event
        WHERE event."projectId" = $1
          AND event."commitmentId" = $2
          AND event."sequence" = $3
          AND event."organizationId" = $4
          AND event."nextState" = $5
          AND event."previousState" IS NOT DISTINCT FROM $6
          AND event."type"::TEXT = $7
          AND (NOT $8 OR NULLIF(btrim(event."reason"), '''') IS NOT NULL)
     )',
    TG_TABLE_SCHEMA
  ) INTO event_exists
  USING
    NEW."projectId",
    NEW."id",
    NEW."revision",
    NEW."organizationId",
    next_expected,
    previous_expected,
    expected_type,
    reason_required;
  IF NOT event_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'SupplierCommitment revision requires an immutable event';
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION "obrasaas_supplier_commitment_event_append_only"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'SupplierCommitmentEvent is append-only';
END;
$$;

CREATE FUNCTION "obrasaas_supplier_reminder_no_delete"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'SupplierReminderDelivery cannot be deleted or truncated';
END;
$$;

CREATE TRIGGER "SupplierCommitment_revision_guard"
BEFORE INSERT OR UPDATE ON "SupplierCommitment"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_supplier_commitment_revision_guard"();
ALTER TABLE "SupplierCommitment"
  ENABLE ALWAYS TRIGGER "SupplierCommitment_revision_guard";

CREATE CONSTRAINT TRIGGER "SupplierCommitment_event_guard"
AFTER INSERT OR UPDATE ON "SupplierCommitment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "obrasaas_supplier_commitment_event_guard"();
ALTER TABLE "SupplierCommitment"
  ENABLE ALWAYS TRIGGER "SupplierCommitment_event_guard";

CREATE TRIGGER "SupplierCommitmentEvent_append_only"
BEFORE UPDATE OR DELETE ON "SupplierCommitmentEvent"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_supplier_commitment_event_append_only"();
CREATE TRIGGER "SupplierCommitmentEvent_no_truncate"
BEFORE TRUNCATE ON "SupplierCommitmentEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_supplier_commitment_event_append_only"();
ALTER TABLE "SupplierCommitmentEvent"
  ENABLE ALWAYS TRIGGER "SupplierCommitmentEvent_append_only";
ALTER TABLE "SupplierCommitmentEvent"
  ENABLE ALWAYS TRIGGER "SupplierCommitmentEvent_no_truncate";

CREATE TRIGGER "SupplierReminderWebhookEvent_append_only"
BEFORE UPDATE OR DELETE ON "SupplierReminderWebhookEvent"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_supplier_commitment_event_append_only"();
CREATE TRIGGER "SupplierReminderWebhookEvent_no_truncate"
BEFORE TRUNCATE ON "SupplierReminderWebhookEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_supplier_commitment_event_append_only"();
ALTER TABLE "SupplierReminderWebhookEvent"
  ENABLE ALWAYS TRIGGER "SupplierReminderWebhookEvent_append_only";
ALTER TABLE "SupplierReminderWebhookEvent"
  ENABLE ALWAYS TRIGGER "SupplierReminderWebhookEvent_no_truncate";

CREATE TRIGGER "SupplierReminderWebhookApplication_append_only"
BEFORE UPDATE OR DELETE ON "SupplierReminderWebhookApplication"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_supplier_commitment_event_append_only"();
CREATE TRIGGER "SupplierReminderWebhookApplication_no_truncate"
BEFORE TRUNCATE ON "SupplierReminderWebhookApplication"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_supplier_commitment_event_append_only"();
ALTER TABLE "SupplierReminderWebhookApplication"
  ENABLE ALWAYS TRIGGER "SupplierReminderWebhookApplication_append_only";
ALTER TABLE "SupplierReminderWebhookApplication"
  ENABLE ALWAYS TRIGGER "SupplierReminderWebhookApplication_no_truncate";

CREATE TRIGGER "SupplierReminderDelivery_no_delete"
BEFORE DELETE ON "SupplierReminderDelivery"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_supplier_reminder_no_delete"();
CREATE TRIGGER "SupplierReminderDelivery_no_truncate"
BEFORE TRUNCATE ON "SupplierReminderDelivery"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_supplier_reminder_no_delete"();
ALTER TABLE "SupplierReminderDelivery"
  ENABLE ALWAYS TRIGGER "SupplierReminderDelivery_no_delete";
ALTER TABLE "SupplierReminderDelivery"
  ENABLE ALWAYS TRIGGER "SupplierReminderDelivery_no_truncate";

-- Provider outcomes are monotonic. In particular UNCERTAIN can never return to
-- a retryable state without a future, audited manual-resolution contract.
CREATE FUNCTION "obrasaas_supplier_reminder_transition_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF OLD."eventKey" IS DISTINCT FROM NEW."eventKey"
     OR OLD."providerIdempotencyKey" IS DISTINCT FROM NEW."providerIdempotencyKey"
     OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
     OR OLD."projectId" IS DISTINCT FROM NEW."projectId"
     OR OLD."commitmentId" IS DISTINCT FROM NEW."commitmentId"
     OR OLD."scheduleRevision" IS DISTINCT FROM NEW."scheduleRevision"
     OR OLD."kind" IS DISTINCT FROM NEW."kind"
     OR OLD."recipientEmail" IS DISTINCT FROM NEW."recipientEmail"
     OR OLD."subject" IS DISTINCT FROM NEW."subject"
     OR OLD."textBody" IS DISTINCT FROM NEW."textBody"
     OR OLD."scheduledFor" IS DISTINCT FROM NEW."scheduledFor" THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'SupplierReminderDelivery immutable dispatch data changed';
  END IF;
  IF (OLD."provider" IS NOT NULL AND OLD."provider" IS DISTINCT FROM NEW."provider")
     OR (OLD."providerMessageId" IS NOT NULL AND OLD."providerMessageId" IS DISTINCT FROM NEW."providerMessageId")
     OR (OLD."sentAt" IS NOT NULL AND OLD."sentAt" IS DISTINCT FROM NEW."sentAt") THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'SupplierReminderDelivery provider identity is immutable once assigned';
  END IF;
  IF OLD."status" = NEW."status" THEN
    RETURN NEW;
  END IF;
  IF NOT ((OLD."status" = 'PENDING' AND NEW."status" IN ('CLAIMED', 'CANCELLED'))
     OR (OLD."status" = 'FAILED' AND NEW."status" IN ('CLAIMED', 'CANCELLED', 'DEAD_LETTER'))
     OR (OLD."status" = 'CLAIMED' AND NEW."status" IN ('PENDING', 'DISPATCHING', 'CANCELLED'))
     OR (OLD."status" = 'DISPATCHING' AND NEW."status" IN ('PROVIDER_ACCEPTED', 'FAILED', 'DEAD_LETTER', 'UNCERTAIN', 'CONFLICT', 'CANCELLED'))
     OR (OLD."status" = 'PROVIDER_ACCEPTED' AND NEW."status" IN ('DELIVERY_DELAYED', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'DELIVERY_FAILED', 'SUPPRESSED'))
     OR (OLD."status" = 'DELIVERY_DELAYED' AND NEW."status" IN ('DELIVERED', 'BOUNCED', 'COMPLAINED', 'DELIVERY_FAILED', 'SUPPRESSED'))
     OR (OLD."status" = 'DELIVERED' AND NEW."status" IN ('BOUNCED', 'COMPLAINED', 'DELIVERY_FAILED', 'SUPPRESSED'))
     OR (OLD."status" IN ('BOUNCED', 'COMPLAINED', 'DELIVERY_FAILED', 'SUPPRESSED')
       AND NEW."status" IN ('BOUNCED', 'COMPLAINED', 'DELIVERY_FAILED', 'SUPPRESSED'))) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'SupplierReminderDelivery transition is invalid';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "SupplierReminderDelivery_transition_guard"
BEFORE UPDATE ON "SupplierReminderDelivery"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_supplier_reminder_transition_guard"();
ALTER TABLE "SupplierReminderDelivery"
  ENABLE ALWAYS TRIGGER "SupplierReminderDelivery_transition_guard";
