-- PostgreSQL dynamic EXECUTE does not update PL/pgSQL FOUND. Replace the
-- allocation guard so an empty scoped lookup is detected from the selected
-- non-null values themselves before composite FKs run.

CREATE OR REPLACE FUNCTION "obrasaas_goods_receipt_commitment_allocation_guard"()
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

  IF receipt_status IS NULL OR receipt_line_quantity IS NULL THEN
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

  IF commitment_kind IS NULL
     OR commitment_status IS NULL
     OR commitment_line_quantity IS NULL THEN
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
