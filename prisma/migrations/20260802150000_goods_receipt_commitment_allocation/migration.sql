-- A posted goods receipt and a supplier commitment are different business
-- facts. This immutable ledger records only explicit operator reconciliation;
-- historical rows are deliberately not inferred or backfilled.

CREATE UNIQUE INDEX "GoodsReceipt_org_project_order_id_key"
  ON "GoodsReceipt"("organizationId", "projectId", "purchaseOrderId", "id");
CREATE UNIQUE INDEX "GoodsReceiptLine_scope_key"
  ON "GoodsReceiptLine"("projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "id");
CREATE UNIQUE INDEX "SupplierCommitment_org_project_order_id_key"
  ON "SupplierCommitment"("organizationId", "projectId", "purchaseOrderId", "id");
CREATE UNIQUE INDEX "SupplierCommitmentLine_scope_key"
  ON "SupplierCommitmentLine"("projectId", "purchaseOrderId", "commitmentId", "purchaseOrderLineId");

CREATE TABLE "GoodsReceiptCommitmentAllocation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "purchaseOrderLineId" TEXT NOT NULL,
  "goodsReceiptId" TEXT NOT NULL,
  "goodsReceiptLineId" TEXT NOT NULL,
  "supplierCommitmentId" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "createdById" VARCHAR(190) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoodsReceiptCommitmentAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GRCAllocation_quantity_positive_check" CHECK ("quantity" > 0),
  CONSTRAINT "GRCAllocation_operation_key_check"
    CHECK (char_length("operationKey") BETWEEN 1 AND 128),
  CONSTRAINT "GRCAllocation_request_fingerprint_check"
    CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "GRCAllocation_project_id_key"
  ON "GoodsReceiptCommitmentAllocation"("projectId", "id");
CREATE UNIQUE INDEX "GRCAllocation_project_operation_key"
  ON "GoodsReceiptCommitmentAllocation"("projectId", "operationKey");
CREATE INDEX "GRCAllocation_receipt_line_idx"
  ON "GoodsReceiptCommitmentAllocation"("projectId", "goodsReceiptLineId");
CREATE INDEX "GRCAllocation_supplier_commitment_line_idx"
  ON "GoodsReceiptCommitmentAllocation"("projectId", "supplierCommitmentId", "purchaseOrderLineId");

ALTER TABLE "GoodsReceiptCommitmentAllocation"
  ADD CONSTRAINT "GRCAllocation_receipt_fkey"
  FOREIGN KEY ("organizationId", "projectId", "purchaseOrderId", "goodsReceiptId")
  REFERENCES "GoodsReceipt"("organizationId", "projectId", "purchaseOrderId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GoodsReceiptCommitmentAllocation"
  ADD CONSTRAINT "GRCAllocation_receipt_line_fkey"
  FOREIGN KEY ("projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "goodsReceiptLineId")
  REFERENCES "GoodsReceiptLine"("projectId", "purchaseOrderId", "goodsReceiptId", "purchaseOrderLineId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GoodsReceiptCommitmentAllocation"
  ADD CONSTRAINT "GRCAllocation_supplier_commitment_fkey"
  FOREIGN KEY ("organizationId", "projectId", "purchaseOrderId", "supplierCommitmentId")
  REFERENCES "SupplierCommitment"("organizationId", "projectId", "purchaseOrderId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GoodsReceiptCommitmentAllocation"
  ADD CONSTRAINT "GRCAllocation_supplier_commitment_line_fkey"
  FOREIGN KEY ("projectId", "purchaseOrderId", "supplierCommitmentId", "purchaseOrderLineId")
  REFERENCES "SupplierCommitmentLine"("projectId", "purchaseOrderId", "commitmentId", "purchaseOrderLineId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- The project advisory lock makes both exact aggregate limits serializable for
-- every writer, including direct SQL. The function is VOLATILE by default, so
-- each query after a contended lock observes the latest READ COMMITTED state.
CREATE FUNCTION "obrasaas_goods_receipt_commitment_allocation_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  receipt_status TEXT;
  receipt_line_quantity NUMERIC;
  commitment_kind TEXT;
  commitment_status TEXT;
  commitment_line_quantity NUMERIC;
  receipt_allocated NUMERIC;
  commitment_allocated NUMERIC;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW."projectId", 0)
  );

  IF NEW."quantity" <= 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'GoodsReceiptCommitmentAllocation quantity must be positive';
  END IF;

  EXECUTE format(
    'SELECT receipt."status"::TEXT, receipt_line."quantity"
       FROM %I."GoodsReceiptLine" AS receipt_line
       JOIN %I."GoodsReceipt" AS receipt
         ON receipt."organizationId" = $1
        AND receipt."projectId" = receipt_line."projectId"
        AND receipt."purchaseOrderId" = receipt_line."purchaseOrderId"
        AND receipt."id" = receipt_line."goodsReceiptId"
      WHERE receipt_line."projectId" = $2
        AND receipt_line."purchaseOrderId" = $3
        AND receipt_line."goodsReceiptId" = $4
        AND receipt_line."purchaseOrderLineId" = $5
        AND receipt_line."id" = $6
      FOR UPDATE OF receipt, receipt_line',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO receipt_status, receipt_line_quantity
  USING
    NEW."organizationId",
    NEW."projectId",
    NEW."purchaseOrderId",
    NEW."goodsReceiptId",
    NEW."purchaseOrderLineId",
    NEW."goodsReceiptLineId";

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'GoodsReceiptCommitmentAllocation receipt line scope is invalid';
  END IF;
  IF receipt_status <> 'POSTED' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'GoodsReceiptCommitmentAllocation requires a POSTED receipt';
  END IF;

  EXECUTE format(
    'SELECT commitment."kind"::TEXT,
            commitment."status"::TEXT,
            commitment_line."quantity"
       FROM %I."SupplierCommitmentLine" AS commitment_line
       JOIN %I."SupplierCommitment" AS commitment
         ON commitment."organizationId" = $1
        AND commitment."projectId" = commitment_line."projectId"
        AND commitment."purchaseOrderId" = commitment_line."purchaseOrderId"
        AND commitment."id" = commitment_line."commitmentId"
      WHERE commitment_line."projectId" = $2
        AND commitment_line."purchaseOrderId" = $3
        AND commitment_line."commitmentId" = $4
        AND commitment_line."purchaseOrderLineId" = $5
      FOR UPDATE OF commitment, commitment_line',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO commitment_kind, commitment_status, commitment_line_quantity
  USING
    NEW."organizationId",
    NEW."projectId",
    NEW."purchaseOrderId",
    NEW."supplierCommitmentId",
    NEW."purchaseOrderLineId";

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'GoodsReceiptCommitmentAllocation commitment line scope is invalid';
  END IF;
  IF commitment_kind <> 'MATERIAL_DELIVERY' OR commitment_status = 'CANCELLED' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'GoodsReceiptCommitmentAllocation requires an active material delivery commitment';
  END IF;

  EXECUTE format(
    'SELECT COALESCE(SUM(allocation."quantity"), 0)
       FROM %I."GoodsReceiptCommitmentAllocation" AS allocation
      WHERE allocation."projectId" = $1
        AND allocation."goodsReceiptLineId" = $2',
    TG_TABLE_SCHEMA
  )
  INTO receipt_allocated
  USING NEW."projectId", NEW."goodsReceiptLineId";

  IF receipt_allocated + NEW."quantity" > receipt_line_quantity THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'GoodsReceiptCommitmentAllocation exceeds receipt line quantity';
  END IF;

  -- VOIDED receipts remain immutable evidence but no longer consume current
  -- supplier-commitment coverage.
  EXECUTE format(
    'SELECT COALESCE(SUM(allocation."quantity"), 0)
       FROM %I."GoodsReceiptCommitmentAllocation" AS allocation
       JOIN %I."GoodsReceipt" AS receipt
         ON receipt."organizationId" = allocation."organizationId"
        AND receipt."projectId" = allocation."projectId"
        AND receipt."purchaseOrderId" = allocation."purchaseOrderId"
        AND receipt."id" = allocation."goodsReceiptId"
      WHERE allocation."projectId" = $1
        AND allocation."supplierCommitmentId" = $2
        AND allocation."purchaseOrderLineId" = $3
        AND receipt."status" = ''POSTED''',
    TG_TABLE_SCHEMA,
    TG_TABLE_SCHEMA
  )
  INTO commitment_allocated
  USING NEW."projectId", NEW."supplierCommitmentId", NEW."purchaseOrderLineId";

  IF commitment_allocated + NEW."quantity" > commitment_line_quantity THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'GoodsReceiptCommitmentAllocation exceeds commitment line quantity';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_goods_receipt_commitment_allocation_append_only"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'GoodsReceiptCommitmentAllocation is append-only';
END;
$$;

-- A VOIDED receipt is terminal. Serializing the transition with allocation
-- inserts prevents a concurrent insert from observing a stale POSTED state,
-- and prevents direct SQL from restoring coverage after it was released.
CREATE FUNCTION "obrasaas_goods_receipt_status_transition_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
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

  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_allocated_goods_receipt_line_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  allocation_exists BOOLEAN;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(OLD."projectId", 0)
  );
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."GoodsReceiptCommitmentAllocation" AS allocation
        WHERE allocation."projectId" = $1
          AND allocation."goodsReceiptLineId" = $2
     )',
    TG_TABLE_SCHEMA
  )
  INTO allocation_exists
  USING OLD."projectId", OLD."id";

  IF TG_OP = 'DELETE' THEN
    IF allocation_exists THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Allocated GoodsReceiptLine cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF allocation_exists AND (
    OLD."id",
    OLD."projectId",
    OLD."purchaseOrderId",
    OLD."goodsReceiptId",
    OLD."purchaseOrderLineId",
    OLD."quantity"
  ) IS DISTINCT FROM (
    NEW."id",
    NEW."projectId",
    NEW."purchaseOrderId",
    NEW."goodsReceiptId",
    NEW."purchaseOrderLineId",
    NEW."quantity"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Allocated GoodsReceiptLine identity and quantity are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_allocated_supplier_commitment_line_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  allocation_exists BOOLEAN;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(OLD."projectId", 0)
  );
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
         FROM %I."GoodsReceiptCommitmentAllocation" AS allocation
        WHERE allocation."projectId" = $1
          AND allocation."supplierCommitmentId" = $2
          AND allocation."purchaseOrderLineId" = $3
     )',
    TG_TABLE_SCHEMA
  )
  INTO allocation_exists
  USING OLD."projectId", OLD."commitmentId", OLD."purchaseOrderLineId";

  IF TG_OP = 'DELETE' THEN
    IF allocation_exists THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Allocated SupplierCommitmentLine cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF allocation_exists AND (
    OLD."commitmentId",
    OLD."projectId",
    OLD."purchaseOrderId",
    OLD."purchaseOrderLineId",
    OLD."quantity"
  ) IS DISTINCT FROM (
    NEW."commitmentId",
    NEW."projectId",
    NEW."purchaseOrderId",
    NEW."purchaseOrderLineId",
    NEW."quantity"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Allocated SupplierCommitmentLine identity and quantity are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "GoodsReceiptCommitmentAllocation_insert_guard"
BEFORE INSERT ON "GoodsReceiptCommitmentAllocation"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_goods_receipt_commitment_allocation_guard"();
CREATE TRIGGER "GoodsReceiptCommitmentAllocation_append_only"
BEFORE UPDATE OR DELETE ON "GoodsReceiptCommitmentAllocation"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_goods_receipt_commitment_allocation_append_only"();
CREATE TRIGGER "GoodsReceiptCommitmentAllocation_no_truncate"
BEFORE TRUNCATE ON "GoodsReceiptCommitmentAllocation"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_goods_receipt_commitment_allocation_append_only"();
ALTER TABLE "GoodsReceiptCommitmentAllocation"
  ENABLE ALWAYS TRIGGER "GoodsReceiptCommitmentAllocation_insert_guard";
ALTER TABLE "GoodsReceiptCommitmentAllocation"
  ENABLE ALWAYS TRIGGER "GoodsReceiptCommitmentAllocation_append_only";
ALTER TABLE "GoodsReceiptCommitmentAllocation"
  ENABLE ALWAYS TRIGGER "GoodsReceiptCommitmentAllocation_no_truncate";

CREATE TRIGGER "GoodsReceipt_status_transition_guard"
BEFORE UPDATE OF "status" ON "GoodsReceipt"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_goods_receipt_status_transition_guard"();
ALTER TABLE "GoodsReceipt"
  ENABLE ALWAYS TRIGGER "GoodsReceipt_status_transition_guard";

CREATE TRIGGER "GoodsReceiptLine_allocation_guard"
BEFORE UPDATE OR DELETE ON "GoodsReceiptLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_allocated_goods_receipt_line_guard"();
ALTER TABLE "GoodsReceiptLine"
  ENABLE ALWAYS TRIGGER "GoodsReceiptLine_allocation_guard";

CREATE TRIGGER "SupplierCommitmentLine_allocation_guard"
BEFORE UPDATE OR DELETE ON "SupplierCommitmentLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_allocated_supplier_commitment_line_guard"();
ALTER TABLE "SupplierCommitmentLine"
  ENABLE ALWAYS TRIGGER "SupplierCommitmentLine_allocation_guard";
