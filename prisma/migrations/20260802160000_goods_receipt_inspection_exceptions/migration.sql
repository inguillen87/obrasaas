-- S12.1 records physical inspection separately from receipt documentation and
-- supplier-commitment reconciliation. Historical receipts are deliberately
-- left uninspected: there is no inferred acceptance, shortage or backfill.

CREATE TYPE "GoodsReceiptInspectionKind" AS ENUM (
  'FINALIZATION',
  'CORRECTION',
  'REVERSAL'
);

CREATE TYPE "GoodsReceiptDispositionQuality" AS ENUM (
  'ACCEPTED',
  'DAMAGED',
  'REJECTED',
  'QUARANTINED'
);

CREATE TYPE "SupplierCommitmentLineClosureKind" AS ENUM (
  'FINAL_DELIVERY',
  'REVERSAL'
);

ALTER TABLE "GoodsReceipt"
  ADD COLUMN "receivedById" TEXT;

CREATE INDEX "GoodsReceipt_receivedById_receivedAt_idx"
  ON "GoodsReceipt"("receivedById", "receivedAt");

ALTER TABLE "GoodsReceipt"
  ADD CONSTRAINT "GoodsReceipt_receivedById_fkey"
  FOREIGN KEY ("receivedById")
  REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- PostgreSQL NUMERIC accepts the special NaN value and treats NaN = NaN.
-- Every quantity used by the exact inspection/closure derivation must reject
-- it at rest, including rows created before this migration.
ALTER TABLE "GoodsReceiptLine"
  ADD CONSTRAINT "GRInspection_GoodsReceiptLine_finite_check"
  CHECK ("quantity" <> 'NaN'::numeric) NOT VALID;
ALTER TABLE "GoodsReceiptLine"
  VALIDATE CONSTRAINT "GRInspection_GoodsReceiptLine_finite_check";
ALTER TABLE "GoodsReceiptCommitmentAllocation"
  ADD CONSTRAINT "GRInspection_GRCAllocation_finite_check"
  CHECK ("quantity" <> 'NaN'::numeric) NOT VALID;
ALTER TABLE "GoodsReceiptCommitmentAllocation"
  VALIDATE CONSTRAINT "GRInspection_GRCAllocation_finite_check";
ALTER TABLE "SupplierCommitmentLine"
  ADD CONSTRAINT "GRInspection_SupplierCommitmentLine_finite_check"
  CHECK ("quantity" <> 'NaN'::numeric) NOT VALID;
ALTER TABLE "SupplierCommitmentLine"
  VALIDATE CONSTRAINT "GRInspection_SupplierCommitmentLine_finite_check";

CREATE TABLE "InventoryLocation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryLocation_code_check"
    CHECK (
      char_length("code") BETWEEN 1 AND 32
      AND "code" = btrim("code")
      AND "code" = upper("code")
      AND "code" ~ '^[A-Z0-9]+([._-][A-Z0-9]+)*$'
    ),
  CONSTRAINT "InventoryLocation_name_check"
    CHECK (
      char_length("name") BETWEEN 1 AND 160
      AND "name" = btrim("name")
    ),
  CONSTRAINT "InventoryLocation_revision_check" CHECK ("revision" >= 0)
);

CREATE UNIQUE INDEX "InventoryLocation_scope_id_key"
  ON "InventoryLocation"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "InventoryLocation_project_code_key"
  ON "InventoryLocation"("projectId", "code");
CREATE INDEX "InventoryLocation_project_active_name_idx"
  ON "InventoryLocation"("projectId", "active", "name");

ALTER TABLE "InventoryLocation"
  ADD CONSTRAINT "InventoryLocation_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "InventoryLocation"
  ADD CONSTRAINT "InventoryLocation_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE RESTRICT;

-- The operational selector is intentionally bounded. Keep the invariant in
-- PostgreSQL as well as the service so direct DML and concurrent writers
-- cannot make the active set unreachable from the UI.
CREATE FUNCTION "obrasaas_inventory_location_active_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  active_location_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
       OR OLD."projectId" IS DISTINCT FROM NEW."projectId"
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryLocation tenant and project scope are immutable';
  END IF;

  IF NOT NEW."active" OR (TG_OP = 'UPDATE' AND OLD."active") THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW."projectId", 0)
  );
  EXECUTE format(
    'SELECT count(*)
       FROM %I."InventoryLocation" AS location
      WHERE location."organizationId" = $1
        AND location."projectId" = $2
        AND location."active"
        AND location."id" <> $3',
    TG_TABLE_SCHEMA
  )
  INTO active_location_count
  USING NEW."organizationId", NEW."projectId", NEW."id";

  IF active_location_count >= 100 THEN
    RAISE EXCEPTION USING
      ERRCODE = '54000',
      MESSAGE = 'InventoryLocation active limit of 100 reached for project';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_numeric_quantity_finite_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  column_name TEXT;
  quantity_text TEXT;
BEGIN
  FOREACH column_name IN ARRAY TG_ARGV LOOP
    quantity_text := jsonb_extract_path_text(to_jsonb(NEW), column_name);
    IF quantity_text = 'NaN' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = TG_TABLE_NAME || '.' || column_name || ' must be finite';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- This key lets a disposition prove the entire receipt/allocation identity by
-- foreign key instead of trusting identifiers copied from an API payload.
CREATE UNIQUE INDEX "GRCAllocation_inspection_scope_key"
  ON "GoodsReceiptCommitmentAllocation"(
    "organizationId",
    "projectId",
    "purchaseOrderId",
    "purchaseOrderLineId",
    "goodsReceiptId",
    "goodsReceiptLineId",
    "id"
  );

CREATE TABLE "GoodsReceiptInspection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "goodsReceiptId" TEXT NOT NULL,
  "kind" "GoodsReceiptInspectionKind" NOT NULL,
  "version" INTEGER NOT NULL,
  "predecessorId" TEXT,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "inspectedById" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "locationCodeSnapshot" VARCHAR(32) NOT NULL,
  "locationNameSnapshot" VARCHAR(160) NOT NULL,
  "reason" VARCHAR(500),
  "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoodsReceiptInspection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoodsReceiptInspection_version_check" CHECK ("version" > 0),
  CONSTRAINT "GoodsReceiptInspection_operation_key_check"
    CHECK (char_length("operationKey") BETWEEN 1 AND 128),
  CONSTRAINT "GoodsReceiptInspection_request_fingerprint_check"
    CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "GoodsReceiptInspection_location_snapshot_check"
    CHECK (
      char_length("locationCodeSnapshot") BETWEEN 1 AND 32
      AND "locationCodeSnapshot" = btrim("locationCodeSnapshot")
      AND "locationCodeSnapshot" = upper("locationCodeSnapshot")
      AND "locationCodeSnapshot" ~ '^[A-Z0-9]+([._-][A-Z0-9]+)*$'
      AND char_length("locationNameSnapshot") BETWEEN 1 AND 160
      AND "locationNameSnapshot" = btrim("locationNameSnapshot")
    ),
  CONSTRAINT "GoodsReceiptInspection_reason_check"
    CHECK ("reason" IS NULL OR char_length(btrim("reason")) BETWEEN 1 AND 500)
);

CREATE UNIQUE INDEX "GoodsReceiptInspection_scope_id_key"
  ON "GoodsReceiptInspection"(
    "organizationId", "projectId", "purchaseOrderId", "goodsReceiptId", "id"
  );
CREATE UNIQUE INDEX "GoodsReceiptInspection_receipt_version_key"
  ON "GoodsReceiptInspection"("projectId", "goodsReceiptId", "version");
CREATE UNIQUE INDEX "GoodsReceiptInspection_predecessor_key"
  ON "GoodsReceiptInspection"(
    "organizationId", "projectId", "purchaseOrderId", "goodsReceiptId", "predecessorId"
  );
CREATE UNIQUE INDEX "GoodsReceiptInspection_operation_key"
  ON "GoodsReceiptInspection"("projectId", "operationKey");
CREATE INDEX "GoodsReceiptInspection_receipt_created_idx"
  ON "GoodsReceiptInspection"("projectId", "goodsReceiptId", "createdAt");

ALTER TABLE "GoodsReceiptInspection"
  ADD CONSTRAINT "GoodsReceiptInspection_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GoodsReceiptInspection"
  ADD CONSTRAINT "GoodsReceiptInspection_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GoodsReceiptInspection"
  ADD CONSTRAINT "GoodsReceiptInspection_receipt_fkey"
  FOREIGN KEY ("organizationId", "projectId", "purchaseOrderId", "goodsReceiptId")
  REFERENCES "GoodsReceipt"("organizationId", "projectId", "purchaseOrderId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GoodsReceiptInspection"
  ADD CONSTRAINT "GoodsReceiptInspection_location_fkey"
  FOREIGN KEY ("organizationId", "projectId", "locationId")
  REFERENCES "InventoryLocation"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GoodsReceiptInspection"
  ADD CONSTRAINT "GoodsReceiptInspection_inspectedById_fkey"
  FOREIGN KEY ("inspectedById")
  REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GoodsReceiptInspection"
  ADD CONSTRAINT "GoodsReceiptInspection_predecessor_fkey"
  FOREIGN KEY (
    "organizationId", "projectId", "purchaseOrderId", "goodsReceiptId", "predecessorId"
  )
  REFERENCES "GoodsReceiptInspection"(
    "organizationId", "projectId", "purchaseOrderId", "goodsReceiptId", "id"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "GoodsReceiptInspectionDisposition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "purchaseOrderLineId" TEXT NOT NULL,
  "goodsReceiptId" TEXT NOT NULL,
  "goodsReceiptLineId" TEXT NOT NULL,
  "inspectionId" TEXT NOT NULL,
  "allocationId" TEXT,
  "quality" "GoodsReceiptDispositionQuality" NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoodsReceiptInspectionDisposition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GRInspectionDisposition_quantity_positive_check"
    CHECK ("quantity" <> 'NaN'::numeric AND "quantity" > 0)
);

CREATE UNIQUE INDEX "GRInspectionDisposition_project_id_key"
  ON "GoodsReceiptInspectionDisposition"("projectId", "id");
CREATE UNIQUE INDEX "GRInspectionDisposition_alloc_quality_key"
  ON "GoodsReceiptInspectionDisposition"(
    "inspectionId", "goodsReceiptLineId", "allocationId", "quality"
  )
  WHERE "allocationId" IS NOT NULL;
CREATE UNIQUE INDEX "GRInspectionDisposition_unalloc_quality_key"
  ON "GoodsReceiptInspectionDisposition"(
    "inspectionId", "goodsReceiptLineId", "quality"
  )
  WHERE "allocationId" IS NULL;
CREATE INDEX "GRInspectionDisposition_inspection_line_idx"
  ON "GoodsReceiptInspectionDisposition"(
    "projectId", "inspectionId", "goodsReceiptLineId"
  );
CREATE INDEX "GRInspectionDisposition_allocation_idx"
  ON "GoodsReceiptInspectionDisposition"("projectId", "allocationId");

ALTER TABLE "GoodsReceiptInspectionDisposition"
  ADD CONSTRAINT "GRInspectionDisposition_inspection_fkey"
  FOREIGN KEY (
    "organizationId", "projectId", "purchaseOrderId", "goodsReceiptId", "inspectionId"
  )
  REFERENCES "GoodsReceiptInspection"(
    "organizationId", "projectId", "purchaseOrderId", "goodsReceiptId", "id"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GoodsReceiptInspectionDisposition"
  ADD CONSTRAINT "GRInspectionDisposition_receipt_line_fkey"
  FOREIGN KEY (
    "projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "goodsReceiptLineId"
  )
  REFERENCES "GoodsReceiptLine"(
    "projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "id"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GoodsReceiptInspectionDisposition"
  ADD CONSTRAINT "GRInspectionDisposition_allocation_fkey"
  FOREIGN KEY (
    "organizationId",
    "projectId",
    "purchaseOrderId",
    "purchaseOrderLineId",
    "goodsReceiptId",
    "goodsReceiptLineId",
    "allocationId"
  )
  REFERENCES "GoodsReceiptCommitmentAllocation"(
    "organizationId",
    "projectId",
    "purchaseOrderId",
    "purchaseOrderLineId",
    "goodsReceiptId",
    "goodsReceiptLineId",
    "id"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "SupplierCommitmentLineClosure" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "purchaseOrderLineId" TEXT NOT NULL,
  "supplierCommitmentId" TEXT NOT NULL,
  "kind" "SupplierCommitmentLineClosureKind" NOT NULL,
  "version" INTEGER NOT NULL,
  "predecessorId" TEXT,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "closedById" TEXT NOT NULL,
  "acceptedQuantity" DECIMAL(14,3),
  "shortageQuantity" DECIMAL(14,3),
  "reason" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierCommitmentLineClosure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierCommitmentLineClosure_version_check" CHECK ("version" > 0),
  CONSTRAINT "SupplierCommitmentLineClosure_operation_key_check"
    CHECK (char_length("operationKey") BETWEEN 1 AND 128),
  CONSTRAINT "SupplierCommitmentLineClosure_request_fingerprint_check"
    CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "SupplierCommitmentLineClosure_reason_check"
    CHECK ("reason" IS NULL OR char_length(btrim("reason")) BETWEEN 1 AND 500),
  CONSTRAINT "SupplierCommitmentLineClosure_quantity_shape_check"
    CHECK (
      (
        "kind" = 'FINAL_DELIVERY'
        AND "acceptedQuantity" IS NOT NULL
        AND "acceptedQuantity" >= 0
        AND "shortageQuantity" IS NOT NULL
        AND "shortageQuantity" >= 0
      )
      OR (
        "kind" = 'REVERSAL'
        AND "acceptedQuantity" IS NULL
        AND "shortageQuantity" IS NULL
      )
    ),
  CONSTRAINT "SupplierCommitmentLineClosure_finite_check"
    CHECK (
      ("acceptedQuantity" IS NULL OR "acceptedQuantity" <> 'NaN'::numeric)
      AND ("shortageQuantity" IS NULL OR "shortageQuantity" <> 'NaN'::numeric)
    )
);

CREATE UNIQUE INDEX "SupplierCommitmentLineClosure_scope_id_key"
  ON "SupplierCommitmentLineClosure"(
    "organizationId",
    "projectId",
    "purchaseOrderId",
    "supplierCommitmentId",
    "purchaseOrderLineId",
    "id"
  );
CREATE UNIQUE INDEX "SupplierCommitmentLineClosure_version_key"
  ON "SupplierCommitmentLineClosure"(
    "projectId", "supplierCommitmentId", "purchaseOrderLineId", "version"
  );
CREATE UNIQUE INDEX "SupplierCommitmentLineClosure_predecessor_key"
  ON "SupplierCommitmentLineClosure"(
    "organizationId",
    "projectId",
    "purchaseOrderId",
    "supplierCommitmentId",
    "purchaseOrderLineId",
    "predecessorId"
  );
CREATE UNIQUE INDEX "SupplierCommitmentLineClosure_operation_key"
  ON "SupplierCommitmentLineClosure"("projectId", "operationKey");
CREATE INDEX "SupplierCommitmentLineClosure_line_created_idx"
  ON "SupplierCommitmentLineClosure"(
    "projectId", "supplierCommitmentId", "purchaseOrderLineId", "createdAt"
  );

ALTER TABLE "SupplierCommitmentLineClosure"
  ADD CONSTRAINT "SupplierCommitmentLineClosure_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierCommitmentLineClosure"
  ADD CONSTRAINT "SupplierCommitmentLineClosure_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierCommitmentLineClosure"
  ADD CONSTRAINT "SupplierCommitmentLineClosure_commitment_fkey"
  FOREIGN KEY (
    "organizationId", "projectId", "purchaseOrderId", "supplierCommitmentId"
  )
  REFERENCES "SupplierCommitment"(
    "organizationId", "projectId", "purchaseOrderId", "id"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierCommitmentLineClosure"
  ADD CONSTRAINT "SupplierCommitmentLineClosure_line_fkey"
  FOREIGN KEY (
    "projectId", "purchaseOrderId", "supplierCommitmentId", "purchaseOrderLineId"
  )
  REFERENCES "SupplierCommitmentLine"(
    "projectId", "purchaseOrderId", "commitmentId", "purchaseOrderLineId"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierCommitmentLineClosure"
  ADD CONSTRAINT "SupplierCommitmentLineClosure_closedById_fkey"
  FOREIGN KEY ("closedById")
  REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SupplierCommitmentLineClosure"
  ADD CONSTRAINT "SupplierCommitmentLineClosure_predecessor_fkey"
  FOREIGN KEY (
    "organizationId",
    "projectId",
    "purchaseOrderId",
    "supplierCommitmentId",
    "purchaseOrderLineId",
    "predecessorId"
  )
  REFERENCES "SupplierCommitmentLineClosure"(
    "organizationId",
    "projectId",
    "purchaseOrderId",
    "supplierCommitmentId",
    "purchaseOrderLineId",
    "id"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Receipt attribution is nullable for legacy compatibility, but once present
-- it is server-owned, tenant-valid and immutable.
CREATE FUNCTION "obrasaas_goods_receipt_receiver_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  active_membership BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."receivedById" IS NOT NULL
     AND OLD."receivedById" IS DISTINCT FROM NEW."receivedById" THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'GoodsReceipt receivedById is immutable once attributed';
  END IF;

  IF NEW."receivedById" IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."TenantMembership" AS membership
        WHERE membership."organizationId" = $1
          AND membership."userId" = $2
          AND membership."status" = ''ACTIVE''
     )',
    TG_TABLE_SCHEMA
  )
  INTO active_membership
  USING NEW."organizationId", NEW."receivedById";

  IF NOT active_membership THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'GoodsReceipt receiver is not an active tenant member';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_goods_receipt_inspection_insert_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  receipt_status TEXT;
  location_active BOOLEAN;
  location_code TEXT;
  location_name TEXT;
  actor_active BOOLEAN;
  previous_id TEXT;
  previous_kind TEXT;
  previous_version INTEGER;
  previous_location_id TEXT;
  previous_location_code TEXT;
  previous_location_name TEXT;
  closed_line_exists BOOLEAN;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW."projectId", 0)
  );

  EXECUTE format(
    'SELECT receipt."status"::TEXT
       FROM %I."GoodsReceipt" AS receipt
      WHERE receipt."organizationId" = $1
        AND receipt."projectId" = $2
        AND receipt."purchaseOrderId" = $3
        AND receipt."id" = $4
      FOR UPDATE',
    TG_TABLE_SCHEMA
  )
  INTO receipt_status
  USING NEW."organizationId", NEW."projectId", NEW."purchaseOrderId", NEW."goodsReceiptId";

  IF receipt_status IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'GoodsReceiptInspection receipt scope is invalid';
  END IF;
  IF receipt_status <> 'POSTED' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'GoodsReceiptInspection requires a POSTED receipt';
  END IF;

  EXECUTE format(
    'SELECT location."active", location."code", location."name"
       FROM %I."InventoryLocation" AS location
      WHERE location."organizationId" = $1
        AND location."projectId" = $2
        AND location."id" = $3
      FOR UPDATE',
    TG_TABLE_SCHEMA
  )
  INTO location_active, location_code, location_name
  USING NEW."organizationId", NEW."projectId", NEW."locationId";
  IF location_active IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'GoodsReceiptInspection requires a scoped location';
  END IF;
  IF NEW."kind" <> 'REVERSAL' AND NOT location_active THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'GoodsReceiptInspection finalization or correction requires an active location';
  END IF;
  IF NEW."kind" <> 'REVERSAL'
     AND (
       NEW."locationCodeSnapshot" IS DISTINCT FROM location_code
       OR NEW."locationNameSnapshot" IS DISTINCT FROM location_name
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'GoodsReceiptInspection location snapshot must match the active location';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."TenantMembership" AS membership
        WHERE membership."organizationId" = $1
          AND membership."userId" = $2
          AND membership."status" = ''ACTIVE''
     )',
    TG_TABLE_SCHEMA
  )
  INTO actor_active
  USING NEW."organizationId", NEW."inspectedById";
  IF NOT actor_active THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'GoodsReceiptInspection inspector is not an active tenant member';
  END IF;

  -- Any active line closure must be reversed before an inspection snapshot can
  -- change its accepted quantity basis.
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."GoodsReceiptCommitmentAllocation" AS allocation
         JOIN LATERAL (
           SELECT closure."kind"::TEXT
             FROM %I."SupplierCommitmentLineClosure" AS closure
            WHERE closure."projectId" = allocation."projectId"
              AND closure."supplierCommitmentId" = allocation."supplierCommitmentId"
              AND closure."purchaseOrderLineId" = allocation."purchaseOrderLineId"
            ORDER BY closure."version" DESC
            LIMIT 1
         ) AS latest_closure ON latest_closure."kind" = ''FINAL_DELIVERY''
        WHERE allocation."organizationId" = $1
          AND allocation."projectId" = $2
          AND allocation."purchaseOrderId" = $3
          AND allocation."goodsReceiptId" = $4
     )',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO closed_line_exists
  USING NEW."organizationId", NEW."projectId", NEW."purchaseOrderId", NEW."goodsReceiptId";
  IF closed_line_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Supplier commitment line closure must be reversed before changing inspection';
  END IF;

  EXECUTE format(
    'SELECT inspection."id", inspection."kind"::TEXT, inspection."version",
            inspection."locationId", inspection."locationCodeSnapshot",
            inspection."locationNameSnapshot"
       FROM %I."GoodsReceiptInspection" AS inspection
      WHERE inspection."organizationId" = $1
        AND inspection."projectId" = $2
        AND inspection."purchaseOrderId" = $3
        AND inspection."goodsReceiptId" = $4
      ORDER BY inspection."version" DESC
      LIMIT 1
      FOR UPDATE',
    TG_TABLE_SCHEMA
  )
  INTO previous_id, previous_kind, previous_version,
       previous_location_id, previous_location_code, previous_location_name
  USING NEW."organizationId", NEW."projectId", NEW."purchaseOrderId", NEW."goodsReceiptId";

  IF previous_id IS NULL THEN
    IF NEW."kind" <> 'FINALIZATION' OR NEW."version" <> 1 OR NEW."predecessorId" IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'First GoodsReceiptInspection must be FINALIZATION version 1';
    END IF;
  ELSE
    IF NEW."version" <> previous_version + 1 OR NEW."predecessorId" IS DISTINCT FROM previous_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '40001',
        MESSAGE = 'GoodsReceiptInspection predecessor or version is stale';
    END IF;
    IF previous_kind = 'REVERSAL' AND NEW."kind" <> 'FINALIZATION' THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'A reversed GoodsReceiptInspection must restart with FINALIZATION';
    END IF;
    IF previous_kind <> 'REVERSAL' AND NEW."kind" NOT IN ('CORRECTION', 'REVERSAL') THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'An active GoodsReceiptInspection only allows CORRECTION or REVERSAL';
    END IF;
    IF NEW."kind" = 'REVERSAL'
       AND (
         NEW."locationId" IS DISTINCT FROM previous_location_id
         OR NEW."locationCodeSnapshot" IS DISTINCT FROM previous_location_code
         OR NEW."locationNameSnapshot" IS DISTINCT FROM previous_location_name
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'GoodsReceiptInspection reversal must preserve the historical location snapshot';
    END IF;
  END IF;

  IF NEW."kind" IN ('CORRECTION', 'REVERSAL') AND NEW."reason" IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'GoodsReceiptInspection correction or reversal requires reason';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_goods_receipt_disposition_insert_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  inspection_kind TEXT;
  closed_line_exists BOOLEAN;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW."projectId", 0)
  );
  EXECUTE format(
    'SELECT inspection."kind"::TEXT
       FROM %I."GoodsReceiptInspection" AS inspection
      WHERE inspection."organizationId" = $1
        AND inspection."projectId" = $2
        AND inspection."purchaseOrderId" = $3
        AND inspection."goodsReceiptId" = $4
        AND inspection."id" = $5',
    TG_TABLE_SCHEMA
  )
  INTO inspection_kind
  USING
    NEW."organizationId",
    NEW."projectId",
    NEW."purchaseOrderId",
    NEW."goodsReceiptId",
    NEW."inspectionId";
  IF inspection_kind IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'GoodsReceiptInspectionDisposition inspection scope is invalid';
  END IF;
  IF inspection_kind = 'REVERSAL' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A REVERSAL inspection cannot contain dispositions';
  END IF;

  -- Close the same-transaction ordering gap: a closure inserted after the
  -- inspection header but before its deferred disposition snapshot must make
  -- every later disposition fail, rather than commit a stale derived total.
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."GoodsReceiptCommitmentAllocation" AS allocation
         JOIN LATERAL (
           SELECT closure."kind"::TEXT
             FROM %I."SupplierCommitmentLineClosure" AS closure
            WHERE closure."organizationId" = allocation."organizationId"
              AND closure."projectId" = allocation."projectId"
              AND closure."purchaseOrderId" = allocation."purchaseOrderId"
              AND closure."supplierCommitmentId" = allocation."supplierCommitmentId"
              AND closure."purchaseOrderLineId" = allocation."purchaseOrderLineId"
            ORDER BY closure."version" DESC
            LIMIT 1
         ) AS latest_closure ON latest_closure."kind" = ''FINAL_DELIVERY''
        WHERE allocation."organizationId" = $1
          AND allocation."projectId" = $2
          AND allocation."purchaseOrderId" = $3
          AND allocation."goodsReceiptId" = $4
     )',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO closed_line_exists
  USING NEW."organizationId", NEW."projectId", NEW."purchaseOrderId", NEW."goodsReceiptId";
  IF closed_line_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Supplier commitment line closure must be reversed before adding inspection dispositions';
  END IF;
  RETURN NEW;
END;
$$;

-- Deferred because an inspection header and all of its exact disposition rows
-- are inserted atomically in one transaction. It also protects later direct
-- SQL inserts: positive append-only rows cannot alter an already exact snapshot.
CREATE FUNCTION "obrasaas_goods_receipt_inspection_snapshot_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  target_inspection_id TEXT;
  inspection_kind TEXT;
  inspection_project_id TEXT;
  inspection_receipt_id TEXT;
  inspection_reason TEXT;
  invalid_receipt_partition BOOLEAN;
  invalid_allocation_partition BOOLEAN;
  invalid_unallocated_partition BOOLEAN;
  disposition_exists BOOLEAN;
  exception_exists BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'GoodsReceiptInspection' THEN
    target_inspection_id := NEW."id";
  ELSE
    -- A trigger RECORD is typed to its source table. Resolve the disposition
    -- field without asking PL/pgSQL to compile it against the header shape.
    target_inspection_id := pg_catalog.jsonb_extract_path_text(
      pg_catalog.to_jsonb(NEW),
      'inspectionId'
    );
  END IF;

  EXECUTE format(
    'SELECT inspection."kind"::TEXT,
            inspection."projectId",
            inspection."goodsReceiptId",
            inspection."reason"
       FROM %I."GoodsReceiptInspection" AS inspection
      WHERE inspection."id" = $1',
    TG_TABLE_SCHEMA
  )
  INTO inspection_kind, inspection_project_id, inspection_receipt_id, inspection_reason
  USING target_inspection_id;
  IF inspection_kind IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'GoodsReceiptInspection snapshot no longer exists';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(inspection_project_id, 0)
  );

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."GoodsReceiptInspectionDisposition" AS disposition
        WHERE disposition."inspectionId" = $1
     )',
    TG_TABLE_SCHEMA
  )
  INTO disposition_exists
  USING target_inspection_id;

  IF inspection_kind = 'REVERSAL' THEN
    IF disposition_exists THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'A REVERSAL inspection must not contain dispositions';
    END IF;
    RETURN NULL;
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."GoodsReceiptLine" AS receipt_line
         LEFT JOIN %I."GoodsReceiptInspectionDisposition" AS disposition
           ON disposition."inspectionId" = $1
          AND disposition."goodsReceiptLineId" = receipt_line."id"
        WHERE receipt_line."projectId" = $2
          AND receipt_line."goodsReceiptId" = $3
        GROUP BY receipt_line."id", receipt_line."quantity"
       HAVING COALESCE(SUM(disposition."quantity"), 0) <> receipt_line."quantity"
     )',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO invalid_receipt_partition
  USING target_inspection_id, inspection_project_id, inspection_receipt_id;
  IF invalid_receipt_partition OR NOT disposition_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Inspection dispositions must exactly partition every receipt line';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."GoodsReceiptCommitmentAllocation" AS allocation
         LEFT JOIN %I."GoodsReceiptInspectionDisposition" AS disposition
           ON disposition."inspectionId" = $1
          AND disposition."allocationId" = allocation."id"
        WHERE allocation."projectId" = $2
          AND allocation."goodsReceiptId" = $3
        GROUP BY allocation."id", allocation."quantity"
       HAVING COALESCE(SUM(disposition."quantity"), 0) <> allocation."quantity"
     )',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO invalid_allocation_partition
  USING target_inspection_id, inspection_project_id, inspection_receipt_id;
  IF invalid_allocation_partition THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Inspection dispositions must exactly partition every receipt allocation';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."GoodsReceiptLine" AS receipt_line
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(allocation."quantity"), 0) AS quantity
             FROM %I."GoodsReceiptCommitmentAllocation" AS allocation
            WHERE allocation."projectId" = receipt_line."projectId"
              AND allocation."goodsReceiptLineId" = receipt_line."id"
         ) AS allocated ON true
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(disposition."quantity"), 0) AS quantity
             FROM %I."GoodsReceiptInspectionDisposition" AS disposition
            WHERE disposition."inspectionId" = $1
              AND disposition."goodsReceiptLineId" = receipt_line."id"
              AND disposition."allocationId" IS NULL
         ) AS unallocated ON true
        WHERE receipt_line."projectId" = $2
          AND receipt_line."goodsReceiptId" = $3
          AND unallocated.quantity <> receipt_line."quantity" - allocated.quantity
     )',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO invalid_unallocated_partition
  USING target_inspection_id, inspection_project_id, inspection_receipt_id;
  IF invalid_unallocated_partition THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Unallocated dispositions must equal the receipt quantity not assigned to commitments';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."GoodsReceiptInspectionDisposition" AS disposition
        WHERE disposition."inspectionId" = $1
          AND disposition."quality" <> ''ACCEPTED''
     )',
    TG_TABLE_SCHEMA
  )
  INTO exception_exists
  USING target_inspection_id;
  IF exception_exists AND inspection_reason IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'An inspection with quality exceptions requires reason';
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION "obrasaas_supplier_commitment_line_closure_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  commitment_quantity NUMERIC;
  commitment_kind TEXT;
  commitment_status TEXT;
  actor_active BOOLEAN;
  previous_id TEXT;
  previous_kind TEXT;
  previous_version INTEGER;
  accepted_quantity NUMERIC;
  shortage_quantity NUMERIC;
  uninspected_allocation_exists BOOLEAN;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW."projectId", 0)
  );

  EXECUTE format(
    'SELECT line."quantity", commitment."kind"::TEXT, commitment."status"::TEXT
       FROM %I."SupplierCommitmentLine" AS line
       JOIN %I."SupplierCommitment" AS commitment
         ON commitment."organizationId" = $1
        AND commitment."projectId" = line."projectId"
        AND commitment."purchaseOrderId" = line."purchaseOrderId"
        AND commitment."id" = line."commitmentId"
      WHERE line."projectId" = $2
        AND line."purchaseOrderId" = $3
        AND line."commitmentId" = $4
        AND line."purchaseOrderLineId" = $5
      FOR UPDATE OF line, commitment',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO commitment_quantity, commitment_kind, commitment_status
  USING
    NEW."organizationId",
    NEW."projectId",
    NEW."purchaseOrderId",
    NEW."supplierCommitmentId",
    NEW."purchaseOrderLineId";
  IF commitment_quantity IS NULL OR commitment_kind IS NULL OR commitment_status IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'SupplierCommitmentLineClosure scope is invalid';
  END IF;
  IF commitment_kind <> 'MATERIAL_DELIVERY'
     OR (NEW."kind" = 'FINAL_DELIVERY' AND commitment_status = 'CANCELLED') THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'SupplierCommitmentLineClosure requires an active material delivery';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."TenantMembership" AS membership
        WHERE membership."organizationId" = $1
          AND membership."userId" = $2
          AND membership."status" = ''ACTIVE''
     )',
    TG_TABLE_SCHEMA
  )
  INTO actor_active
  USING NEW."organizationId", NEW."closedById";
  IF NOT actor_active THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'SupplierCommitmentLineClosure actor is not an active tenant member';
  END IF;

  EXECUTE format(
    'SELECT closure."id", closure."kind"::TEXT, closure."version"
       FROM %I."SupplierCommitmentLineClosure" AS closure
      WHERE closure."organizationId" = $1
        AND closure."projectId" = $2
        AND closure."purchaseOrderId" = $3
        AND closure."supplierCommitmentId" = $4
        AND closure."purchaseOrderLineId" = $5
      ORDER BY closure."version" DESC
      LIMIT 1
      FOR UPDATE',
    TG_TABLE_SCHEMA
  )
  INTO previous_id, previous_kind, previous_version
  USING
    NEW."organizationId",
    NEW."projectId",
    NEW."purchaseOrderId",
    NEW."supplierCommitmentId",
    NEW."purchaseOrderLineId";

  IF previous_id IS NULL THEN
    IF NEW."kind" <> 'FINAL_DELIVERY' OR NEW."version" <> 1 OR NEW."predecessorId" IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'First SupplierCommitmentLineClosure must be FINAL_DELIVERY version 1';
    END IF;
  ELSE
    IF NEW."version" <> previous_version + 1 OR NEW."predecessorId" IS DISTINCT FROM previous_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '40001',
        MESSAGE = 'SupplierCommitmentLineClosure predecessor or version is stale';
    END IF;
    IF previous_kind = 'FINAL_DELIVERY' AND NEW."kind" <> 'REVERSAL' THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'An active SupplierCommitmentLineClosure must be reversed first';
    END IF;
    IF previous_kind = 'REVERSAL' AND NEW."kind" <> 'FINAL_DELIVERY' THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'A reversed SupplierCommitmentLineClosure must restart with FINAL_DELIVERY';
    END IF;
  END IF;

  IF NEW."kind" = 'REVERSAL' THEN
    IF NEW."reason" IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'SupplierCommitmentLineClosure reversal requires reason';
    END IF;
    RETURN NEW;
  END IF;

  -- A final-delivery shortage is meaningful only after every posted receipt
  -- allocation in this commitment line has an effective inspection head. An
  -- absent or reversed inspection remains pending review, never a shortage.
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."GoodsReceiptCommitmentAllocation" AS allocation
         JOIN %I."GoodsReceipt" AS receipt
           ON receipt."organizationId" = allocation."organizationId"
          AND receipt."projectId" = allocation."projectId"
          AND receipt."purchaseOrderId" = allocation."purchaseOrderId"
          AND receipt."id" = allocation."goodsReceiptId"
          AND receipt."status" = ''POSTED''
         LEFT JOIN LATERAL (
           SELECT inspection."kind"::TEXT
             FROM %I."GoodsReceiptInspection" AS inspection
            WHERE inspection."organizationId" = allocation."organizationId"
              AND inspection."projectId" = allocation."projectId"
              AND inspection."purchaseOrderId" = allocation."purchaseOrderId"
              AND inspection."goodsReceiptId" = allocation."goodsReceiptId"
            ORDER BY inspection."version" DESC
            LIMIT 1
         ) AS latest_inspection ON true
        WHERE allocation."organizationId" = $1
          AND allocation."projectId" = $2
          AND allocation."purchaseOrderId" = $3
          AND allocation."supplierCommitmentId" = $4
          AND allocation."purchaseOrderLineId" = $5
          AND (
            latest_inspection."kind" IS NULL
            OR latest_inspection."kind" = ''REVERSAL''
          )
     )',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO uninspected_allocation_exists
  USING
    NEW."organizationId",
    NEW."projectId",
    NEW."purchaseOrderId",
    NEW."supplierCommitmentId",
    NEW."purchaseOrderLineId";
  IF uninspected_allocation_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'FINAL_DELIVERY requires an active inspection for every posted allocation';
  END IF;

  EXECUTE format(
    'SELECT COALESCE(SUM(disposition."quantity"), 0)
       FROM %I."GoodsReceiptCommitmentAllocation" AS allocation
       JOIN %I."GoodsReceipt" AS receipt
         ON receipt."organizationId" = allocation."organizationId"
        AND receipt."projectId" = allocation."projectId"
        AND receipt."purchaseOrderId" = allocation."purchaseOrderId"
        AND receipt."id" = allocation."goodsReceiptId"
        AND receipt."status" = ''POSTED''
       JOIN LATERAL (
         SELECT inspection."id", inspection."kind"
           FROM %I."GoodsReceiptInspection" AS inspection
          WHERE inspection."organizationId" = allocation."organizationId"
            AND inspection."projectId" = allocation."projectId"
            AND inspection."purchaseOrderId" = allocation."purchaseOrderId"
            AND inspection."goodsReceiptId" = allocation."goodsReceiptId"
          ORDER BY inspection."version" DESC
          LIMIT 1
       ) AS latest_inspection ON latest_inspection."kind" <> ''REVERSAL''
       JOIN %I."GoodsReceiptInspectionDisposition" AS disposition
         ON disposition."inspectionId" = latest_inspection."id"
        AND disposition."allocationId" = allocation."id"
        AND disposition."quality" = ''ACCEPTED''
      WHERE allocation."organizationId" = $1
        AND allocation."projectId" = $2
        AND allocation."purchaseOrderId" = $3
        AND allocation."supplierCommitmentId" = $4
        AND allocation."purchaseOrderLineId" = $5',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO accepted_quantity
  USING
    NEW."organizationId",
    NEW."projectId",
    NEW."purchaseOrderId",
    NEW."supplierCommitmentId",
    NEW."purchaseOrderLineId";
  shortage_quantity := commitment_quantity - accepted_quantity;
  IF shortage_quantity < 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Accepted inspection quantity exceeds supplier commitment line';
  END IF;
  IF NEW."acceptedQuantity" IS DISTINCT FROM accepted_quantity
     OR NEW."shortageQuantity" IS DISTINCT FROM shortage_quantity THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'SupplierCommitmentLineClosure quantities do not match effective accepted inspections';
  END IF;
  IF shortage_quantity > 0 AND NEW."reason" IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A supplier delivery shortage requires reason';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inspected_allocation_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  latest_inspection_kind TEXT;
  latest_closure_kind TEXT;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW."projectId", 0)
  );
  EXECUTE format(
    'SELECT inspection."kind"::TEXT
       FROM %I."GoodsReceiptInspection" AS inspection
      WHERE inspection."organizationId" = $1
        AND inspection."projectId" = $2
        AND inspection."purchaseOrderId" = $3
        AND inspection."goodsReceiptId" = $4
      ORDER BY inspection."version" DESC
      LIMIT 1',
    TG_TABLE_SCHEMA
  )
  INTO latest_inspection_kind
  USING NEW."organizationId", NEW."projectId", NEW."purchaseOrderId", NEW."goodsReceiptId";
  IF latest_inspection_kind IS NOT NULL AND latest_inspection_kind <> 'REVERSAL' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'GoodsReceiptCommitmentAllocation is frozen by active inspection';
  END IF;

  EXECUTE format(
    'SELECT closure."kind"::TEXT
       FROM %I."SupplierCommitmentLineClosure" AS closure
      WHERE closure."organizationId" = $1
        AND closure."projectId" = $2
        AND closure."purchaseOrderId" = $3
        AND closure."supplierCommitmentId" = $4
        AND closure."purchaseOrderLineId" = $5
      ORDER BY closure."version" DESC
      LIMIT 1',
    TG_TABLE_SCHEMA
  )
  INTO latest_closure_kind
  USING
    NEW."organizationId",
    NEW."projectId",
    NEW."purchaseOrderId",
    NEW."supplierCommitmentId",
    NEW."purchaseOrderLineId";
  IF latest_closure_kind = 'FINAL_DELIVERY' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'GoodsReceiptCommitmentAllocation is frozen by final delivery closure';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inspected_goods_receipt_line_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  inspection_exists BOOLEAN;
  receipt_status TEXT;
  target_project_id TEXT;
  target_purchase_order_id TEXT;
  target_receipt_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       OLD."id" IS DISTINCT FROM NEW."id"
       OR OLD."projectId" IS DISTINCT FROM NEW."projectId"
       OR OLD."purchaseOrderId" IS DISTINCT FROM NEW."purchaseOrderId"
       OR OLD."goodsReceiptId" IS DISTINCT FROM NEW."goodsReceiptId"
       OR OLD."purchaseOrderLineId" IS DISTINCT FROM NEW."purchaseOrderLineId"
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'GoodsReceiptLine receipt identity is immutable';
  END IF;

  IF TG_OP = 'INSERT' THEN
    target_project_id := NEW."projectId";
    target_purchase_order_id := NEW."purchaseOrderId";
    target_receipt_id := NEW."goodsReceiptId";
  ELSE
    target_project_id := OLD."projectId";
    target_purchase_order_id := OLD."purchaseOrderId";
    target_receipt_id := OLD."goodsReceiptId";
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_project_id, 0)
  );
  EXECUTE format(
    'SELECT receipt."status"::TEXT,
            EXISTS (
              SELECT 1
                FROM %I."GoodsReceiptInspection" AS inspection
               WHERE inspection."projectId" = receipt."projectId"
                 AND inspection."purchaseOrderId" = receipt."purchaseOrderId"
                 AND inspection."goodsReceiptId" = receipt."id"
            )
       FROM %I."GoodsReceipt" AS receipt
      WHERE receipt."projectId" = $1
        AND receipt."purchaseOrderId" = $2
        AND receipt."id" = $3',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO receipt_status, inspection_exists
  USING target_project_id, target_purchase_order_id, target_receipt_id;
  IF receipt_status = 'VOIDED' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Voided GoodsReceiptLine is immutable';
  END IF;
  IF inspection_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Inspected GoodsReceiptLine is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Once an inspection exists or the receipt is voided, the supplier document
-- and attribution become evidence. Only the governed status transition and
-- its bookkeeping fields may change; reversal reopens reconciliation, not
-- source history.
CREATE FUNCTION "obrasaas_inspected_goods_receipt_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  inspection_exists BOOLEAN;
  evidence_locked BOOLEAN;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(OLD."projectId", 0)
  );
  evidence_locked := OLD."status" = 'VOIDED'
    OR (TG_OP = 'UPDATE' AND NEW."status" = 'VOIDED');
  IF NOT evidence_locked THEN
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1
           FROM %I."GoodsReceiptInspection" AS inspection
          WHERE inspection."organizationId" = $1
            AND inspection."projectId" = $2
            AND inspection."purchaseOrderId" = $3
            AND inspection."goodsReceiptId" = $4
       )',
      TG_TABLE_SCHEMA
    )
    INTO inspection_exists
    USING OLD."organizationId", OLD."projectId", OLD."purchaseOrderId", OLD."id";
    evidence_locked := inspection_exists;
  END IF;

  IF NOT evidence_locked THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Inspected GoodsReceipt source document is immutable';
  END IF;

  IF (
    to_jsonb(OLD) - 'status' - 'revision' - 'updatedAt'
  ) IS DISTINCT FROM (
    to_jsonb(NEW) - 'status' - 'revision' - 'updatedAt'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Inspected GoodsReceipt source document is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_closed_supplier_commitment_line_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  latest_closure_kind TEXT;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(OLD."projectId", 0)
  );
  EXECUTE format(
    'SELECT closure."kind"::TEXT
       FROM %I."SupplierCommitmentLineClosure" AS closure
      WHERE closure."projectId" = $1
        AND closure."supplierCommitmentId" = $2
        AND closure."purchaseOrderLineId" = $3
      ORDER BY closure."version" DESC
      LIMIT 1',
    TG_TABLE_SCHEMA
  )
  INTO latest_closure_kind
  USING OLD."projectId", OLD."commitmentId", OLD."purchaseOrderLineId";
  IF latest_closure_kind = 'FINAL_DELIVERY' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Closed SupplierCommitmentLine is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inspection_append_only"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = TG_TABLE_NAME || ' is append-only';
END;
$$;

-- Extend the existing receipt state guard: a final/corrected inspection must be
-- explicitly reversed before its source receipt can be voided.
CREATE OR REPLACE FUNCTION "obrasaas_goods_receipt_status_transition_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  latest_inspection_kind TEXT;
BEGIN
  IF OLD."status" IS NOT DISTINCT FROM NEW."status" THEN
    RETURN NEW;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(OLD."projectId", 0)
  );
  IF NOT (OLD."status" = 'POSTED' AND NEW."status" = 'VOIDED') THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'GoodsReceipt status transition is invalid';
  END IF;
  EXECUTE format(
    'SELECT inspection."kind"::TEXT
       FROM %I."GoodsReceiptInspection" AS inspection
      WHERE inspection."organizationId" = $1
        AND inspection."projectId" = $2
        AND inspection."purchaseOrderId" = $3
        AND inspection."goodsReceiptId" = $4
      ORDER BY inspection."version" DESC
      LIMIT 1',
    TG_TABLE_SCHEMA
  )
  INTO latest_inspection_kind
  USING OLD."organizationId", OLD."projectId", OLD."purchaseOrderId", OLD."id";
  IF latest_inspection_kind IS NOT NULL AND latest_inspection_kind <> 'REVERSAL' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'GoodsReceipt inspection must be reversed before voiding receipt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "GoodsReceiptLine_00_finite_guard"
BEFORE INSERT OR UPDATE OF "quantity" ON "GoodsReceiptLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_numeric_quantity_finite_guard"('quantity');
ALTER TABLE "GoodsReceiptLine" ENABLE ALWAYS TRIGGER "GoodsReceiptLine_00_finite_guard";

CREATE TRIGGER "GoodsReceiptCommitmentAllocation_00_finite_guard"
BEFORE INSERT OR UPDATE OF "quantity" ON "GoodsReceiptCommitmentAllocation"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_numeric_quantity_finite_guard"('quantity');
ALTER TABLE "GoodsReceiptCommitmentAllocation"
  ENABLE ALWAYS TRIGGER "GoodsReceiptCommitmentAllocation_00_finite_guard";

CREATE TRIGGER "SupplierCommitmentLine_00_finite_guard"
BEFORE INSERT OR UPDATE OF "quantity" ON "SupplierCommitmentLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_numeric_quantity_finite_guard"('quantity');
ALTER TABLE "SupplierCommitmentLine"
  ENABLE ALWAYS TRIGGER "SupplierCommitmentLine_00_finite_guard";

CREATE TRIGGER "GoodsReceiptInspectionDisposition_00_finite_guard"
BEFORE INSERT OR UPDATE OF "quantity" ON "GoodsReceiptInspectionDisposition"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_numeric_quantity_finite_guard"('quantity');
ALTER TABLE "GoodsReceiptInspectionDisposition"
  ENABLE ALWAYS TRIGGER "GoodsReceiptInspectionDisposition_00_finite_guard";

CREATE TRIGGER "SupplierCommitmentLineClosure_00_finite_guard"
BEFORE INSERT OR UPDATE OF "acceptedQuantity", "shortageQuantity"
ON "SupplierCommitmentLineClosure"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_numeric_quantity_finite_guard"(
  'acceptedQuantity', 'shortageQuantity'
);
ALTER TABLE "SupplierCommitmentLineClosure"
  ENABLE ALWAYS TRIGGER "SupplierCommitmentLineClosure_00_finite_guard";

CREATE TRIGGER "InventoryLocation_active_guard"
BEFORE INSERT OR UPDATE OF "active", "organizationId", "projectId" ON "InventoryLocation"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_location_active_guard"();
ALTER TABLE "InventoryLocation" ENABLE ALWAYS TRIGGER "InventoryLocation_active_guard";

CREATE TRIGGER "GoodsReceipt_inspection_document_guard"
BEFORE UPDATE OR DELETE ON "GoodsReceipt"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inspected_goods_receipt_guard"();
ALTER TABLE "GoodsReceipt" ENABLE ALWAYS TRIGGER "GoodsReceipt_inspection_document_guard";

CREATE TRIGGER "GoodsReceipt_receiver_guard"
BEFORE INSERT OR UPDATE OF "receivedById" ON "GoodsReceipt"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_goods_receipt_receiver_guard"();
ALTER TABLE "GoodsReceipt" ENABLE ALWAYS TRIGGER "GoodsReceipt_receiver_guard";

CREATE TRIGGER "GoodsReceiptInspection_insert_guard"
BEFORE INSERT ON "GoodsReceiptInspection"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_goods_receipt_inspection_insert_guard"();
CREATE TRIGGER "GoodsReceiptInspection_append_only"
BEFORE UPDATE OR DELETE ON "GoodsReceiptInspection"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inspection_append_only"();
CREATE TRIGGER "GoodsReceiptInspection_no_truncate"
BEFORE TRUNCATE ON "GoodsReceiptInspection"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_inspection_append_only"();
CREATE CONSTRAINT TRIGGER "GoodsReceiptInspection_snapshot_guard"
AFTER INSERT ON "GoodsReceiptInspection"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "obrasaas_goods_receipt_inspection_snapshot_guard"();
ALTER TABLE "GoodsReceiptInspection" ENABLE ALWAYS TRIGGER "GoodsReceiptInspection_insert_guard";
ALTER TABLE "GoodsReceiptInspection" ENABLE ALWAYS TRIGGER "GoodsReceiptInspection_append_only";
ALTER TABLE "GoodsReceiptInspection" ENABLE ALWAYS TRIGGER "GoodsReceiptInspection_no_truncate";
ALTER TABLE "GoodsReceiptInspection" ENABLE ALWAYS TRIGGER "GoodsReceiptInspection_snapshot_guard";

CREATE TRIGGER "GoodsReceiptInspectionDisposition_insert_guard"
BEFORE INSERT ON "GoodsReceiptInspectionDisposition"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_goods_receipt_disposition_insert_guard"();
CREATE TRIGGER "GoodsReceiptInspectionDisposition_append_only"
BEFORE UPDATE OR DELETE ON "GoodsReceiptInspectionDisposition"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inspection_append_only"();
CREATE TRIGGER "GoodsReceiptInspectionDisposition_no_truncate"
BEFORE TRUNCATE ON "GoodsReceiptInspectionDisposition"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_inspection_append_only"();
CREATE CONSTRAINT TRIGGER "GoodsReceiptInspectionDisposition_snapshot_guard"
AFTER INSERT ON "GoodsReceiptInspectionDisposition"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "obrasaas_goods_receipt_inspection_snapshot_guard"();
ALTER TABLE "GoodsReceiptInspectionDisposition" ENABLE ALWAYS TRIGGER "GoodsReceiptInspectionDisposition_insert_guard";
ALTER TABLE "GoodsReceiptInspectionDisposition" ENABLE ALWAYS TRIGGER "GoodsReceiptInspectionDisposition_append_only";
ALTER TABLE "GoodsReceiptInspectionDisposition" ENABLE ALWAYS TRIGGER "GoodsReceiptInspectionDisposition_no_truncate";
ALTER TABLE "GoodsReceiptInspectionDisposition" ENABLE ALWAYS TRIGGER "GoodsReceiptInspectionDisposition_snapshot_guard";

CREATE TRIGGER "SupplierCommitmentLineClosure_insert_guard"
BEFORE INSERT ON "SupplierCommitmentLineClosure"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_supplier_commitment_line_closure_guard"();
CREATE TRIGGER "SupplierCommitmentLineClosure_append_only"
BEFORE UPDATE OR DELETE ON "SupplierCommitmentLineClosure"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inspection_append_only"();
CREATE TRIGGER "SupplierCommitmentLineClosure_no_truncate"
BEFORE TRUNCATE ON "SupplierCommitmentLineClosure"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_inspection_append_only"();
ALTER TABLE "SupplierCommitmentLineClosure" ENABLE ALWAYS TRIGGER "SupplierCommitmentLineClosure_insert_guard";
ALTER TABLE "SupplierCommitmentLineClosure" ENABLE ALWAYS TRIGGER "SupplierCommitmentLineClosure_append_only";
ALTER TABLE "SupplierCommitmentLineClosure" ENABLE ALWAYS TRIGGER "SupplierCommitmentLineClosure_no_truncate";

CREATE TRIGGER "GRCAllocation_inspection_guard"
BEFORE INSERT ON "GoodsReceiptCommitmentAllocation"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inspected_allocation_guard"();
ALTER TABLE "GoodsReceiptCommitmentAllocation" ENABLE ALWAYS TRIGGER "GRCAllocation_inspection_guard";

CREATE TRIGGER "GoodsReceiptLine_inspection_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "GoodsReceiptLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inspected_goods_receipt_line_guard"();
ALTER TABLE "GoodsReceiptLine" ENABLE ALWAYS TRIGGER "GoodsReceiptLine_inspection_guard";

CREATE TRIGGER "SupplierCommitmentLine_closure_guard"
BEFORE UPDATE OR DELETE ON "SupplierCommitmentLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_closed_supplier_commitment_line_guard"();
ALTER TABLE "SupplierCommitmentLine" ENABLE ALWAYS TRIGGER "SupplierCommitmentLine_closure_guard";
