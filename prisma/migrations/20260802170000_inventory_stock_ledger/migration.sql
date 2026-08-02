-- S12.2A establishes the canonical physical-stock ledger. Existing project
-- snapshot stockpiles are deliberately not backfilled: an inspected receipt is
-- not available stock until an explicit, audited putaway is posted.

CREATE TYPE "InventoryTransactionKind" AS ENUM (
  'RECEIPT_PUTAWAY',
  'REVERSAL'
);

CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "baseUnit" VARCHAR(32) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryItem_code_check" CHECK (
    char_length("code") BETWEEN 1 AND 32
    AND "code" = btrim("code")
    AND "code" = upper("code")
    AND "code" ~ '^[A-Z0-9]+([._-][A-Z0-9]+)*$'
  ),
  CONSTRAINT "InventoryItem_name_check" CHECK (
    char_length("name") BETWEEN 1 AND 160
    AND "name" = btrim("name")
  ),
  CONSTRAINT "InventoryItem_base_unit_check" CHECK (
    char_length("baseUnit") BETWEEN 1 AND 32
    AND "baseUnit" = btrim("baseUnit")
    AND "baseUnit" ~ '^[^[:cntrl:]]+$'
  ),
  CONSTRAINT "InventoryItem_revision_check" CHECK ("revision" >= 0)
);

CREATE UNIQUE INDEX "InventoryItem_scope_id_key"
  ON "InventoryItem"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "InventoryItem_scope_unit_key"
  ON "InventoryItem"("organizationId", "projectId", "id", "baseUnit");
CREATE UNIQUE INDEX "InventoryItem_project_code_key"
  ON "InventoryItem"("projectId", "code");
CREATE INDEX "InventoryItem_project_active_name_idx"
  ON "InventoryItem"("projectId", "active", "name");

CREATE TABLE "PurchaseOrderLineInventoryBinding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "purchaseOrderLineId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "unitSnapshot" VARCHAR(32) NOT NULL,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "boundById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderLineInventoryBinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "POLInventoryBinding_unit_check" CHECK (
    char_length("unitSnapshot") BETWEEN 1 AND 32
    AND "unitSnapshot" = btrim("unitSnapshot")
    AND "unitSnapshot" ~ '^[^[:cntrl:]]+$'
  ),
  CONSTRAINT "POLInventoryBinding_operation_key_check" CHECK (
    char_length("operationKey") BETWEEN 1 AND 190
    AND "operationKey" = btrim("operationKey")
  ),
  CONSTRAINT "POLInventoryBinding_fingerprint_check" CHECK (
    "requestFingerprint" ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX "POLInventoryBinding_scope_id_key"
  ON "PurchaseOrderLineInventoryBinding"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "POLInventoryBinding_purchase_line_key"
  ON "PurchaseOrderLineInventoryBinding"("projectId", "purchaseOrderId", "purchaseOrderLineId");
CREATE UNIQUE INDEX "POLInventoryBinding_purchase_line_unit_key"
  ON "PurchaseOrderLineInventoryBinding"(
    "projectId", "purchaseOrderId", "purchaseOrderLineId", "unitSnapshot"
  );
CREATE UNIQUE INDEX "POLInventoryBinding_operation_key"
  ON "PurchaseOrderLineInventoryBinding"("projectId", "operationKey");
CREATE INDEX "POLInventoryBinding_item_idx"
  ON "PurchaseOrderLineInventoryBinding"("projectId", "inventoryItemId");

CREATE TABLE "InventoryTransaction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "kind" "InventoryTransactionKind" NOT NULL,
  "purchaseOrderId" TEXT,
  "goodsReceiptId" TEXT,
  "sourceInspectionId" TEXT,
  "reversesTransactionId" TEXT,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "actorId" TEXT NOT NULL,
  "reason" VARCHAR(500),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryTransaction_operation_key_check" CHECK (
    char_length("operationKey") BETWEEN 1 AND 190
    AND "operationKey" = btrim("operationKey")
  ),
  CONSTRAINT "InventoryTransaction_fingerprint_check" CHECK (
    "requestFingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "InventoryTransaction_reason_check" CHECK (
    "reason" IS NULL OR (
      char_length("reason") BETWEEN 1 AND 500
      AND "reason" = btrim("reason")
    )
  ),
  CONSTRAINT "InventoryTransaction_source_shape_check" CHECK (
    (
      "kind" = 'RECEIPT_PUTAWAY'
      AND "purchaseOrderId" IS NOT NULL
      AND "goodsReceiptId" IS NOT NULL
      AND "sourceInspectionId" IS NOT NULL
      AND "reversesTransactionId" IS NULL
    )
    OR
    (
      "kind" = 'REVERSAL'
      AND "purchaseOrderId" IS NULL
      AND "goodsReceiptId" IS NULL
      AND "sourceInspectionId" IS NULL
      AND "reversesTransactionId" IS NOT NULL
      AND "reason" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "InventoryTransaction_scope_id_key"
  ON "InventoryTransaction"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "InventoryTransaction_operation_key"
  ON "InventoryTransaction"("projectId", "operationKey");
CREATE UNIQUE INDEX "InventoryTransaction_source_inspection_key"
  ON "InventoryTransaction"("projectId", "sourceInspectionId");
CREATE UNIQUE INDEX "InventoryTransaction_reversal_key"
  ON "InventoryTransaction"("organizationId", "projectId", "reversesTransactionId");
CREATE INDEX "InventoryTransaction_project_occurred_idx"
  ON "InventoryTransaction"("projectId", "occurredAt", "id");

CREATE TABLE "InventoryLedgerEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "purchaseLineBindingId" TEXT,
  "inspectionDispositionId" TEXT,
  "reversesEntryId" TEXT,
  "quantityDelta" DECIMAL(14,3) NOT NULL,
  "itemCodeSnapshot" VARCHAR(32) NOT NULL,
  "itemNameSnapshot" VARCHAR(160) NOT NULL,
  "unitSnapshot" VARCHAR(32) NOT NULL,
  "locationCodeSnapshot" VARCHAR(32) NOT NULL,
  "locationNameSnapshot" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryLedgerEntry_quantity_check" CHECK (
    "quantityDelta" <> 0::numeric
    AND "quantityDelta" <> 'NaN'::numeric
  ),
  CONSTRAINT "InventoryLedgerEntry_source_shape_check" CHECK (
    (
      "purchaseLineBindingId" IS NOT NULL
      AND "inspectionDispositionId" IS NOT NULL
      AND "reversesEntryId" IS NULL
    )
    OR
    (
      "purchaseLineBindingId" IS NULL
      AND "inspectionDispositionId" IS NULL
      AND "reversesEntryId" IS NOT NULL
    )
  ),
  CONSTRAINT "InventoryLedgerEntry_item_snapshot_check" CHECK (
    char_length("itemCodeSnapshot") BETWEEN 1 AND 32
    AND "itemCodeSnapshot" = btrim("itemCodeSnapshot")
    AND char_length("itemNameSnapshot") BETWEEN 1 AND 160
    AND "itemNameSnapshot" = btrim("itemNameSnapshot")
    AND char_length("unitSnapshot") BETWEEN 1 AND 32
    AND "unitSnapshot" = btrim("unitSnapshot")
    AND "unitSnapshot" ~ '^[^[:cntrl:]]+$'
  ),
  CONSTRAINT "InventoryLedgerEntry_location_snapshot_check" CHECK (
    char_length("locationCodeSnapshot") BETWEEN 1 AND 32
    AND "locationCodeSnapshot" = btrim("locationCodeSnapshot")
    AND char_length("locationNameSnapshot") BETWEEN 1 AND 160
    AND "locationNameSnapshot" = btrim("locationNameSnapshot")
  )
);

CREATE UNIQUE INDEX "InventoryLedgerEntry_scope_id_key"
  ON "InventoryLedgerEntry"("organizationId", "projectId", "id");
CREATE UNIQUE INDEX "InventoryLedgerEntry_disposition_key"
  ON "InventoryLedgerEntry"("projectId", "inspectionDispositionId");
CREATE UNIQUE INDEX "InventoryLedgerEntry_reversal_key"
  ON "InventoryLedgerEntry"("organizationId", "projectId", "reversesEntryId");
CREATE INDEX "InventoryLedgerEntry_balance_idx"
  ON "InventoryLedgerEntry"("projectId", "inventoryItemId", "locationId", "createdAt");
CREATE INDEX "InventoryLedgerEntry_transaction_idx"
  ON "InventoryLedgerEntry"("projectId", "transactionId");

-- This table is a database-maintained projection. Its guard recomputes every
-- accepted write from the immutable ledger, so application code cannot invent
-- or adjust an on-hand balance independently.
CREATE TABLE "InventoryBalance" (
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "onHand" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY (
    "organizationId", "projectId", "inventoryItemId", "locationId"
  ),
  CONSTRAINT "InventoryBalance_on_hand_check" CHECK (
    "onHand" >= 0::numeric
    AND "onHand" <> 'NaN'::numeric
  ),
  CONSTRAINT "InventoryBalance_revision_check" CHECK ("revision" >= 0)
);

CREATE INDEX "InventoryBalance_item_on_hand_idx"
  ON "InventoryBalance"("projectId", "inventoryItemId", "onHand");
CREATE INDEX "InventoryBalance_location_on_hand_idx"
  ON "InventoryBalance"("projectId", "locationId", "onHand");

CREATE UNIQUE INDEX "PurchaseOrderLine_inventory_unit_key"
  ON "PurchaseOrderLine"("projectId", "purchaseOrderId", "id", "unit");

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "PurchaseOrderLineInventoryBinding"
  ADD CONSTRAINT "POLInventoryBinding_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseOrderLineInventoryBinding"
  ADD CONSTRAINT "POLInventoryBinding_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseOrderLineInventoryBinding"
  ADD CONSTRAINT "POLInventoryBinding_purchase_line_fkey"
  FOREIGN KEY ("projectId", "purchaseOrderId", "purchaseOrderLineId", "unitSnapshot")
  REFERENCES "PurchaseOrderLine"("projectId", "purchaseOrderId", "id", "unit")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseOrderLineInventoryBinding"
  ADD CONSTRAINT "POLInventoryBinding_item_fkey"
  FOREIGN KEY ("organizationId", "projectId", "inventoryItemId", "unitSnapshot")
  REFERENCES "InventoryItem"("organizationId", "projectId", "id", "baseUnit")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseOrderLineInventoryBinding"
  ADD CONSTRAINT "POLInventoryBinding_boundById_fkey"
  FOREIGN KEY ("boundById") REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_source_inspection_fkey"
  FOREIGN KEY (
    "organizationId", "projectId", "purchaseOrderId", "goodsReceiptId", "sourceInspectionId"
  ) REFERENCES "GoodsReceiptInspection"(
    "organizationId", "projectId", "purchaseOrderId", "goodsReceiptId", "id"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_reverses_fkey"
  FOREIGN KEY ("organizationId", "projectId", "reversesTransactionId")
  REFERENCES "InventoryTransaction"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "InventoryLedgerEntry"
  ADD CONSTRAINT "InventoryLedgerEntry_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryLedgerEntry"
  ADD CONSTRAINT "InventoryLedgerEntry_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryLedgerEntry"
  ADD CONSTRAINT "InventoryLedgerEntry_transaction_fkey"
  FOREIGN KEY ("organizationId", "projectId", "transactionId")
  REFERENCES "InventoryTransaction"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryLedgerEntry"
  ADD CONSTRAINT "InventoryLedgerEntry_item_fkey"
  FOREIGN KEY ("organizationId", "projectId", "inventoryItemId")
  REFERENCES "InventoryItem"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryLedgerEntry"
  ADD CONSTRAINT "InventoryLedgerEntry_location_fkey"
  FOREIGN KEY ("organizationId", "projectId", "locationId")
  REFERENCES "InventoryLocation"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryLedgerEntry"
  ADD CONSTRAINT "InventoryLedgerEntry_binding_fkey"
  FOREIGN KEY ("organizationId", "projectId", "purchaseLineBindingId")
  REFERENCES "PurchaseOrderLineInventoryBinding"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryLedgerEntry"
  ADD CONSTRAINT "InventoryLedgerEntry_disposition_fkey"
  FOREIGN KEY ("projectId", "inspectionDispositionId")
  REFERENCES "GoodsReceiptInspectionDisposition"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryLedgerEntry"
  ADD CONSTRAINT "InventoryLedgerEntry_reverses_fkey"
  FOREIGN KEY ("organizationId", "projectId", "reversesEntryId")
  REFERENCES "InventoryLedgerEntry"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_item_fkey"
  FOREIGN KEY ("organizationId", "projectId", "inventoryItemId")
  REFERENCES "InventoryItem"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_location_fkey"
  FOREIGN KEY ("organizationId", "projectId", "locationId")
  REFERENCES "InventoryLocation"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION "obrasaas_inventory_item_mutation_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  binding_exists BOOLEAN;
  entry_exists BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryItem is retained; deactivate it instead of deleting it';
  END IF;

  IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
     OR OLD."projectId" IS DISTINCT FROM NEW."projectId" THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryItem tenant and project scope are immutable';
  END IF;

  IF OLD."baseUnit" IS DISTINCT FROM NEW."baseUnit" THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'inventory-item:' || OLD."projectId" || ':' || OLD."id",
        0
      )
    );
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."PurchaseOrderLineInventoryBinding"
       WHERE "organizationId" = $1 AND "projectId" = $2 AND "inventoryItemId" = $3
     )',
    TG_TABLE_SCHEMA
  ) INTO binding_exists USING OLD."organizationId", OLD."projectId", OLD."id";
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."InventoryLedgerEntry"
       WHERE "organizationId" = $1 AND "projectId" = $2 AND "inventoryItemId" = $3
     )',
    TG_TABLE_SCHEMA
  ) INTO entry_exists USING OLD."organizationId", OLD."projectId", OLD."id";

  IF OLD."baseUnit" IS DISTINCT FROM NEW."baseUnit"
     AND (binding_exists OR entry_exists) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryItem base unit is immutable after binding or posting';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inventory_item_active_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  active_item_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
    OR OLD."projectId" IS DISTINCT FROM NEW."projectId"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryItem tenant and project scope are immutable';
  END IF;
  IF NOT NEW."active" OR (TG_OP = 'UPDATE' AND OLD."active") THEN
    RETURN NEW;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('inventory-items:' || NEW."projectId", 0)
  );
  EXECUTE format(
    'SELECT count(*)::integer FROM %I."InventoryItem"
      WHERE "organizationId" = $1 AND "projectId" = $2
        AND "active" AND "id" <> $3',
    TG_TABLE_SCHEMA
  ) INTO active_item_count
  USING NEW."organizationId", NEW."projectId", NEW."id";
  IF active_item_count >= 500 THEN
    RAISE EXCEPTION USING
      ERRCODE = '54000',
      MESSAGE = 'InventoryItem active limit of 500 reached for project';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inventory_append_only"()
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

CREATE FUNCTION "obrasaas_inventory_no_truncate"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = TG_TABLE_NAME || ' cannot be truncated';
END;
$$;

CREATE FUNCTION "obrasaas_inventory_binding_insert_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  purchase_unit TEXT;
  item_unit TEXT;
  item_active BOOLEAN;
  actor_is_active BOOLEAN;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inventory-binding:' || NEW."projectId" || ':' || NEW."purchaseOrderLineId",
      0
    )
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inventory-item:' || NEW."projectId" || ':' || NEW."inventoryItemId",
      0
    )
  );

  EXECUTE format(
    'SELECT line."unit", item."baseUnit", item."active"
       FROM %I."PurchaseOrderLine" AS line
       JOIN %I."PurchaseOrder" AS purchase_order
         ON purchase_order."projectId" = line."projectId"
        AND purchase_order."id" = line."purchaseOrderId"
       JOIN %I."InventoryItem" AS item
         ON item."organizationId" = purchase_order."organizationId"
        AND item."projectId" = line."projectId"
        AND item."id" = $5
      WHERE purchase_order."organizationId" = $1
        AND line."projectId" = $2
        AND line."purchaseOrderId" = $3
        AND line."id" = $4',
    TG_TABLE_SCHEMA, TG_TABLE_SCHEMA, TG_TABLE_SCHEMA
  ) INTO purchase_unit, item_unit, item_active
  USING NEW."organizationId", NEW."projectId", NEW."purchaseOrderId",
        NEW."purchaseOrderLineId", NEW."inventoryItemId";

  IF purchase_unit IS NULL OR item_unit IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'PurchaseOrderLineInventoryBinding scope is invalid';
  END IF;
  IF NOT item_active THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'PurchaseOrderLineInventoryBinding requires an active inventory item';
  END IF;
  IF purchase_unit IS DISTINCT FROM item_unit
     OR NEW."unitSnapshot" IS DISTINCT FROM purchase_unit THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Purchase order line, inventory item and binding units must match exactly';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."TenantMembership"
       WHERE "organizationId" = $1 AND "userId" = $2 AND "status" = ''ACTIVE''
     )',
    TG_TABLE_SCHEMA
  ) INTO actor_is_active USING NEW."organizationId", NEW."boundById";
  IF NOT actor_is_active THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Inventory binding actor is not an active tenant member';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_purchase_order_line_inventory_unit_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  binding_exists BOOLEAN;
BEGIN
  IF OLD."unit" IS NOT DISTINCT FROM NEW."unit" THEN
    RETURN NEW;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inventory-binding:' || OLD."projectId" || ':' || OLD."id",
      0
    )
  );
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."PurchaseOrderLineInventoryBinding"
       WHERE "projectId" = $1
         AND "purchaseOrderId" = $2
         AND "purchaseOrderLineId" = $3
     )',
    TG_TABLE_SCHEMA
  ) INTO binding_exists
  USING OLD."projectId", OLD."purchaseOrderId", OLD."id";
  IF binding_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'PurchaseOrderLine unit is immutable after inventory binding';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inventory_transaction_insert_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  source_is_head BOOLEAN;
  original_kind TEXT;
  actor_is_active BOOLEAN;
BEGIN
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."TenantMembership"
       WHERE "organizationId" = $1 AND "userId" = $2 AND "status" = ''ACTIVE''
     )',
    TG_TABLE_SCHEMA
  ) INTO actor_is_active USING NEW."organizationId", NEW."actorId";
  IF NOT actor_is_active THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Inventory transaction actor is not an active tenant member';
  END IF;

  IF NEW."kind" = 'RECEIPT_PUTAWAY' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'inventory-putaway:' || NEW."projectId" || ':' || NEW."sourceInspectionId",
        0
      )
    );
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1
         FROM %I."GoodsReceiptInspection" AS inspection
         JOIN %I."GoodsReceipt" AS receipt
           ON receipt."organizationId" = inspection."organizationId"
          AND receipt."projectId" = inspection."projectId"
          AND receipt."purchaseOrderId" = inspection."purchaseOrderId"
          AND receipt."id" = inspection."goodsReceiptId"
         WHERE inspection."organizationId" = $1
           AND inspection."projectId" = $2
           AND inspection."purchaseOrderId" = $3
           AND inspection."goodsReceiptId" = $4
           AND inspection."id" = $5
           AND receipt."status" = ''POSTED''
           AND inspection."kind" IN (''FINALIZATION'', ''CORRECTION'')
           AND NOT EXISTS (
             SELECT 1
             FROM %I."GoodsReceiptInspection" AS successor
             WHERE successor."organizationId" = inspection."organizationId"
               AND successor."projectId" = inspection."projectId"
               AND successor."purchaseOrderId" = inspection."purchaseOrderId"
               AND successor."goodsReceiptId" = inspection."goodsReceiptId"
               AND successor."predecessorId" = inspection."id"
           )
       )',
      TG_TABLE_SCHEMA, TG_TABLE_SCHEMA, TG_TABLE_SCHEMA
    ) INTO source_is_head
    USING NEW."organizationId", NEW."projectId", NEW."purchaseOrderId",
          NEW."goodsReceiptId", NEW."sourceInspectionId";
    IF NOT source_is_head THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Inventory putaway requires the active accepted inspection head';
    END IF;
  ELSE
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'inventory-reversal:' || NEW."projectId" || ':' || NEW."reversesTransactionId",
        0
      )
    );
    EXECUTE format(
      'SELECT original."kind"::text
       FROM %I."InventoryTransaction" AS original
       WHERE original."organizationId" = $1
         AND original."projectId" = $2
         AND original."id" = $3',
      TG_TABLE_SCHEMA
    ) INTO original_kind
    USING NEW."organizationId", NEW."projectId", NEW."reversesTransactionId";
    IF original_kind IS DISTINCT FROM 'RECEIPT_PUTAWAY' THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Inventory reversal must target a receipt putaway';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inventory_ledger_entry_insert_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  transaction_record RECORD;
  source_record RECORD;
  current_on_hand NUMERIC(14,3);
BEGIN
  EXECUTE format(
    'SELECT transaction_row."kind", transaction_row."sourceInspectionId",
            transaction_row."reversesTransactionId"
       FROM %I."InventoryTransaction" AS transaction_row
      WHERE transaction_row."organizationId" = $1
        AND transaction_row."projectId" = $2
        AND transaction_row."id" = $3',
    TG_TABLE_SCHEMA
  ) INTO transaction_record
  USING NEW."organizationId", NEW."projectId", NEW."transactionId";
  IF transaction_record."kind" IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'InventoryLedgerEntry transaction scope is invalid';
  END IF;

  IF transaction_record."kind" = 'RECEIPT_PUTAWAY' THEN
    IF NEW."quantityDelta" <= 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Receipt putaway quantity must be positive';
    END IF;
    EXECUTE format(
      'SELECT disposition."quantity" AS disposition_quantity,
              binding."inventoryItemId" AS binding_item_id,
              binding."unitSnapshot" AS binding_unit,
              item."code" AS item_code,
              item."name" AS item_name,
              item."baseUnit" AS item_unit,
              item."active" AS item_active,
              inspection."locationId" AS inspection_location_id,
              inspection."locationCodeSnapshot" AS location_code,
              inspection."locationNameSnapshot" AS location_name,
              location."active" AS location_active,
              purchase_line."unit" AS purchase_unit
         FROM %I."GoodsReceiptInspectionDisposition" AS disposition
         JOIN %I."GoodsReceiptInspection" AS inspection
           ON inspection."organizationId" = disposition."organizationId"
          AND inspection."projectId" = disposition."projectId"
          AND inspection."purchaseOrderId" = disposition."purchaseOrderId"
          AND inspection."goodsReceiptId" = disposition."goodsReceiptId"
          AND inspection."id" = disposition."inspectionId"
         JOIN %I."PurchaseOrderLineInventoryBinding" AS binding
           ON binding."organizationId" = disposition."organizationId"
          AND binding."projectId" = disposition."projectId"
          AND binding."purchaseOrderId" = disposition."purchaseOrderId"
          AND binding."purchaseOrderLineId" = disposition."purchaseOrderLineId"
          AND binding."id" = $5
         JOIN %I."PurchaseOrderLine" AS purchase_line
           ON purchase_line."projectId" = binding."projectId"
          AND purchase_line."purchaseOrderId" = binding."purchaseOrderId"
          AND purchase_line."id" = binding."purchaseOrderLineId"
         JOIN %I."InventoryItem" AS item
           ON item."organizationId" = binding."organizationId"
          AND item."projectId" = binding."projectId"
          AND item."id" = binding."inventoryItemId"
         JOIN %I."InventoryLocation" AS location
           ON location."organizationId" = inspection."organizationId"
          AND location."projectId" = inspection."projectId"
          AND location."id" = inspection."locationId"
        WHERE disposition."organizationId" = $1
          AND disposition."projectId" = $2
          AND disposition."id" = $3
          AND disposition."inspectionId" = $4
          AND disposition."quality" = ''ACCEPTED''',
      TG_TABLE_SCHEMA, TG_TABLE_SCHEMA, TG_TABLE_SCHEMA,
      TG_TABLE_SCHEMA, TG_TABLE_SCHEMA, TG_TABLE_SCHEMA
    ) INTO source_record
    USING NEW."organizationId", NEW."projectId", NEW."inspectionDispositionId",
          transaction_record."sourceInspectionId", NEW."purchaseLineBindingId";
    IF source_record.disposition_quantity IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Inventory putaway entry requires a scoped ACCEPTED disposition and binding';
    END IF;
    IF NOT source_record.item_active OR NOT source_record.location_active THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Inventory putaway requires an active item and location';
    END IF;
    IF NEW."inventoryItemId" IS DISTINCT FROM source_record.binding_item_id
       OR NEW."locationId" IS DISTINCT FROM source_record.inspection_location_id
       OR NEW."quantityDelta" IS DISTINCT FROM source_record.disposition_quantity
       OR source_record.purchase_unit IS DISTINCT FROM source_record.item_unit
       OR source_record.binding_unit IS DISTINCT FROM source_record.item_unit
       OR NEW."unitSnapshot" IS DISTINCT FROM source_record.item_unit
       OR NEW."itemCodeSnapshot" IS DISTINCT FROM source_record.item_code
       OR NEW."itemNameSnapshot" IS DISTINCT FROM source_record.item_name
       OR NEW."locationCodeSnapshot" IS DISTINCT FROM source_record.location_code
       OR NEW."locationNameSnapshot" IS DISTINCT FROM source_record.location_name THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Inventory putaway entry must exactly match its accepted inspection, binding and snapshots';
    END IF;
  ELSE
    IF NEW."quantityDelta" >= 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Inventory reversal quantity must be negative';
    END IF;
    EXECUTE format(
      'SELECT original."transactionId", original."inventoryItemId", original."locationId",
              original."quantityDelta", original."itemCodeSnapshot",
              original."itemNameSnapshot", original."unitSnapshot",
              original."locationCodeSnapshot", original."locationNameSnapshot"
       FROM %I."InventoryLedgerEntry" AS original
       WHERE original."organizationId" = $1
         AND original."projectId" = $2
         AND original."id" = $3',
      TG_TABLE_SCHEMA
    ) INTO source_record
    USING NEW."organizationId", NEW."projectId", NEW."reversesEntryId";
    IF source_record."quantityDelta" IS NULL
       OR source_record."transactionId" IS DISTINCT FROM transaction_record."reversesTransactionId"
       OR NEW."inventoryItemId" IS DISTINCT FROM source_record."inventoryItemId"
       OR NEW."locationId" IS DISTINCT FROM source_record."locationId"
       OR NEW."quantityDelta" IS DISTINCT FROM -source_record."quantityDelta"
       OR NEW."itemCodeSnapshot" IS DISTINCT FROM source_record."itemCodeSnapshot"
       OR NEW."itemNameSnapshot" IS DISTINCT FROM source_record."itemNameSnapshot"
       OR NEW."unitSnapshot" IS DISTINCT FROM source_record."unitSnapshot"
       OR NEW."locationCodeSnapshot" IS DISTINCT FROM source_record."locationCodeSnapshot"
       OR NEW."locationNameSnapshot" IS DISTINCT FROM source_record."locationNameSnapshot" THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Inventory reversal entry must be the exact opposite of its original entry';
    END IF;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inventory-stock:' || NEW."projectId" || ':' || NEW."inventoryItemId" || ':' || NEW."locationId",
      0
    )
  );
  EXECUTE format(
    'SELECT balance."onHand"
       FROM %I."InventoryBalance" AS balance
      WHERE balance."organizationId" = $1
        AND balance."projectId" = $2
        AND balance."inventoryItemId" = $3
        AND balance."locationId" = $4',
    TG_TABLE_SCHEMA
  ) INTO current_on_hand
  USING NEW."organizationId", NEW."projectId", NEW."inventoryItemId", NEW."locationId";
  IF COALESCE(current_on_hand, 0::numeric) + NEW."quantityDelta" < 0::numeric THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Inventory transaction would make on-hand stock negative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inventory_balance_project"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  updated_rows BIGINT;
  exact_on_hand NUMERIC(14,3);
  exact_revision INTEGER;
BEGIN
  EXECUTE format(
    'SELECT COALESCE(sum(entry."quantityDelta"), 0::numeric), count(*)::integer
       FROM %I."InventoryLedgerEntry" AS entry
      WHERE entry."organizationId" = $1
        AND entry."projectId" = $2
        AND entry."inventoryItemId" = $3
        AND entry."locationId" = $4',
    TG_TABLE_SCHEMA
  ) INTO exact_on_hand, exact_revision
  USING NEW."organizationId", NEW."projectId", NEW."inventoryItemId", NEW."locationId";

  EXECUTE format(
    'UPDATE %I."InventoryBalance"
        SET "onHand" = $5,
            "revision" = $6,
            "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = $1
        AND "projectId" = $2
        AND "inventoryItemId" = $3
        AND "locationId" = $4',
    TG_TABLE_SCHEMA
  ) USING NEW."organizationId", NEW."projectId", NEW."inventoryItemId",
          NEW."locationId", exact_on_hand, exact_revision;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows = 0 THEN
    EXECUTE format(
      'INSERT INTO %I."InventoryBalance" (
         "organizationId", "projectId", "inventoryItemId", "locationId",
         "onHand", "revision", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
      TG_TABLE_SCHEMA
    ) USING NEW."organizationId", NEW."projectId", NEW."inventoryItemId",
            NEW."locationId", exact_on_hand, exact_revision;
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inventory_balance_projection_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  exact_on_hand NUMERIC(14,3);
  exact_revision INTEGER;
BEGIN
  IF pg_catalog.pg_trigger_depth() <> 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryBalance is database-owned and rejects direct writes';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryBalance is a database-owned projection';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
    OR OLD."projectId" IS DISTINCT FROM NEW."projectId"
    OR OLD."inventoryItemId" IS DISTINCT FROM NEW."inventoryItemId"
    OR OLD."locationId" IS DISTINCT FROM NEW."locationId"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryBalance projection scope is immutable';
  END IF;

  EXECUTE format(
    'SELECT COALESCE(sum(entry."quantityDelta"), 0::numeric), count(*)::integer
       FROM %I."InventoryLedgerEntry" AS entry
      WHERE entry."organizationId" = $1
        AND entry."projectId" = $2
        AND entry."inventoryItemId" = $3
        AND entry."locationId" = $4',
    TG_TABLE_SCHEMA
  ) INTO exact_on_hand, exact_revision
  USING NEW."organizationId", NEW."projectId", NEW."inventoryItemId", NEW."locationId";
  IF NEW."onHand" IS DISTINCT FROM exact_on_hand
     OR NEW."revision" IS DISTINCT FROM exact_revision THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryBalance must exactly project the immutable ledger',
      DETAIL = format(
        'expected onHand=%s revision=%s; received onHand=%s revision=%s',
        exact_on_hand, exact_revision, NEW."onHand", NEW."revision"
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inventory_transaction_snapshot_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  transaction_id TEXT;
  transaction_record RECORD;
  entry_count INTEGER;
  source_count INTEGER;
  source_is_head BOOLEAN;
  mismatch_exists BOOLEAN;
BEGIN
  transaction_id := jsonb_extract_path_text(
    to_jsonb(NEW),
    CASE WHEN TG_TABLE_NAME = 'InventoryTransaction' THEN 'id' ELSE 'transactionId' END
  );
  EXECUTE format(
    'SELECT * FROM %I."InventoryTransaction"
      WHERE "organizationId" = $1 AND "projectId" = $2 AND "id" = $3',
    TG_TABLE_SCHEMA
  ) INTO transaction_record
  USING NEW."organizationId", NEW."projectId", transaction_id;
  IF transaction_record."kind" IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Inventory transaction snapshot no longer exists';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('inventory-transaction:' || NEW."projectId" || ':' || transaction_id, 0)
  );
  EXECUTE format(
    'SELECT count(*)::integer FROM %I."InventoryLedgerEntry" WHERE "projectId" = $1 AND "transactionId" = $2',
    TG_TABLE_SCHEMA
  ) INTO entry_count USING NEW."projectId", transaction_id;
  IF entry_count = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Inventory transaction requires at least one ledger entry';
  END IF;

  IF transaction_record."kind" = 'RECEIPT_PUTAWAY' THEN
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM %I."GoodsReceiptInspection" AS inspection
         JOIN %I."GoodsReceipt" AS receipt
           ON receipt."organizationId" = inspection."organizationId"
          AND receipt."projectId" = inspection."projectId"
          AND receipt."purchaseOrderId" = inspection."purchaseOrderId"
          AND receipt."id" = inspection."goodsReceiptId"
         WHERE inspection."organizationId" = $1
           AND inspection."projectId" = $2
           AND inspection."id" = $3
           AND inspection."kind" IN (''FINALIZATION'', ''CORRECTION'')
           AND receipt."status" = ''POSTED''
           AND NOT EXISTS (
             SELECT 1 FROM %I."GoodsReceiptInspection" AS successor
             WHERE successor."organizationId" = inspection."organizationId"
               AND successor."projectId" = inspection."projectId"
               AND successor."purchaseOrderId" = inspection."purchaseOrderId"
               AND successor."goodsReceiptId" = inspection."goodsReceiptId"
               AND successor."predecessorId" = inspection."id"
           )
       )',
      TG_TABLE_SCHEMA, TG_TABLE_SCHEMA, TG_TABLE_SCHEMA
    ) INTO source_is_head
    USING transaction_record."organizationId", transaction_record."projectId",
          transaction_record."sourceInspectionId";
    IF NOT source_is_head THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Inventory putaway source inspection is no longer the active head';
    END IF;
    EXECUTE format(
      'SELECT count(*)::integer
         FROM %I."GoodsReceiptInspectionDisposition"
        WHERE "organizationId" = $1
          AND "projectId" = $2
          AND "inspectionId" = $3
          AND "quality" = ''ACCEPTED''',
      TG_TABLE_SCHEMA
    ) INTO source_count
    USING transaction_record."organizationId", transaction_record."projectId",
          transaction_record."sourceInspectionId";
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1
         FROM %I."GoodsReceiptInspectionDisposition" AS disposition
         LEFT JOIN %I."InventoryLedgerEntry" AS entry
           ON entry."projectId" = disposition."projectId"
          AND entry."transactionId" = $4
          AND entry."inspectionDispositionId" = disposition."id"
         WHERE disposition."organizationId" = $1
           AND disposition."projectId" = $2
           AND disposition."inspectionId" = $3
           AND disposition."quality" = ''ACCEPTED''
           AND entry."id" IS NULL
       )',
      TG_TABLE_SCHEMA, TG_TABLE_SCHEMA
    ) INTO mismatch_exists
    USING transaction_record."organizationId", transaction_record."projectId",
          transaction_record."sourceInspectionId", transaction_id;
    IF source_count = 0 OR source_count <> entry_count OR mismatch_exists THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Inventory putaway must post every ACCEPTED disposition exactly once';
    END IF;
  ELSE
    EXECUTE format(
      'SELECT count(*)::integer
         FROM %I."InventoryLedgerEntry"
        WHERE "organizationId" = $1
          AND "projectId" = $2
          AND "transactionId" = $3',
      TG_TABLE_SCHEMA
    ) INTO source_count
    USING transaction_record."organizationId", transaction_record."projectId",
          transaction_record."reversesTransactionId";
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1
         FROM %I."InventoryLedgerEntry" AS original
         LEFT JOIN %I."InventoryLedgerEntry" AS reversal
           ON reversal."projectId" = original."projectId"
          AND reversal."transactionId" = $4
          AND reversal."reversesEntryId" = original."id"
         WHERE original."organizationId" = $1
           AND original."projectId" = $2
           AND original."transactionId" = $3
           AND reversal."id" IS NULL
       )',
      TG_TABLE_SCHEMA, TG_TABLE_SCHEMA
    ) INTO mismatch_exists
    USING transaction_record."organizationId", transaction_record."projectId",
          transaction_record."reversesTransactionId", transaction_id;
    IF source_count = 0 OR source_count <> entry_count OR mismatch_exists THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Inventory reversal must exactly reverse every original ledger entry';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION "obrasaas_inventory_inspection_active_putaway_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  active_putaway_exists BOOLEAN;
BEGIN
  IF NEW."kind" NOT IN ('CORRECTION', 'REVERSAL') OR NEW."predecessorId" IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inventory-putaway:' || NEW."projectId" || ':' || NEW."predecessorId",
      0
    )
  );
  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
       FROM %I."InventoryTransaction" AS putaway
       WHERE putaway."organizationId" = $1
         AND putaway."projectId" = $2
         AND putaway."sourceInspectionId" = $3
         AND putaway."kind" = ''RECEIPT_PUTAWAY''
         AND NOT EXISTS (
           SELECT 1
           FROM %I."InventoryTransaction" AS reversal
           WHERE reversal."organizationId" = putaway."organizationId"
             AND reversal."projectId" = putaway."projectId"
             AND reversal."reversesTransactionId" = putaway."id"
         )
     )',
    TG_TABLE_SCHEMA, TG_TABLE_SCHEMA
  ) INTO active_putaway_exists
  USING NEW."organizationId", NEW."projectId", NEW."predecessorId";
  IF active_putaway_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Inventory putaway must be reversed before correcting or reversing its inspection';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "InventoryItem_mutation_guard"
BEFORE UPDATE OR DELETE ON "InventoryItem"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_item_mutation_guard"();
CREATE TRIGGER "InventoryItem_active_guard"
BEFORE INSERT OR UPDATE OF "active", "organizationId", "projectId" ON "InventoryItem"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_item_active_guard"();
CREATE TRIGGER "InventoryItem_no_truncate"
BEFORE TRUNCATE ON "InventoryItem"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_inventory_no_truncate"();

CREATE TRIGGER "PurchaseOrderLine_inventory_unit_guard"
BEFORE UPDATE OF "unit" ON "PurchaseOrderLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_purchase_order_line_inventory_unit_guard"();

CREATE TRIGGER "PurchaseOrderLineInventoryBinding_insert_guard"
BEFORE INSERT ON "PurchaseOrderLineInventoryBinding"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_binding_insert_guard"();
CREATE TRIGGER "PurchaseOrderLineInventoryBinding_append_only"
BEFORE UPDATE OR DELETE ON "PurchaseOrderLineInventoryBinding"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_append_only"();
CREATE TRIGGER "PurchaseOrderLineInventoryBinding_no_truncate"
BEFORE TRUNCATE ON "PurchaseOrderLineInventoryBinding"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_inventory_no_truncate"();

CREATE TRIGGER "InventoryTransaction_insert_guard"
BEFORE INSERT ON "InventoryTransaction"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_transaction_insert_guard"();
CREATE TRIGGER "InventoryTransaction_append_only"
BEFORE UPDATE OR DELETE ON "InventoryTransaction"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_append_only"();
CREATE TRIGGER "InventoryTransaction_no_truncate"
BEFORE TRUNCATE ON "InventoryTransaction"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_inventory_no_truncate"();
CREATE CONSTRAINT TRIGGER "InventoryTransaction_snapshot_guard"
AFTER INSERT ON "InventoryTransaction"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_transaction_snapshot_guard"();

CREATE TRIGGER "InventoryLedgerEntry_00_finite_guard"
BEFORE INSERT OR UPDATE OF "quantityDelta" ON "InventoryLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_numeric_quantity_finite_guard"('quantityDelta');
CREATE TRIGGER "InventoryLedgerEntry_insert_guard"
BEFORE INSERT ON "InventoryLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_ledger_entry_insert_guard"();
CREATE TRIGGER "InventoryLedgerEntry_append_only"
BEFORE UPDATE OR DELETE ON "InventoryLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_append_only"();
CREATE TRIGGER "InventoryLedgerEntry_no_truncate"
BEFORE TRUNCATE ON "InventoryLedgerEntry"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_inventory_no_truncate"();
CREATE TRIGGER "InventoryLedgerEntry_balance_project"
AFTER INSERT ON "InventoryLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_balance_project"();
CREATE CONSTRAINT TRIGGER "InventoryLedgerEntry_snapshot_guard"
AFTER INSERT ON "InventoryLedgerEntry"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_transaction_snapshot_guard"();

CREATE TRIGGER "InventoryBalance_projection_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "InventoryBalance"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_balance_projection_guard"();
CREATE TRIGGER "InventoryBalance_no_truncate"
BEFORE TRUNCATE ON "InventoryBalance"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_inventory_no_truncate"();

CREATE TRIGGER "GoodsReceiptInspection_inventory_putaway_guard"
BEFORE INSERT ON "GoodsReceiptInspection"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_inspection_active_putaway_guard"();

ALTER TABLE "InventoryItem" ENABLE ALWAYS TRIGGER "InventoryItem_mutation_guard";
ALTER TABLE "InventoryItem" ENABLE ALWAYS TRIGGER "InventoryItem_active_guard";
ALTER TABLE "InventoryItem" ENABLE ALWAYS TRIGGER "InventoryItem_no_truncate";
ALTER TABLE "PurchaseOrderLine" ENABLE ALWAYS TRIGGER "PurchaseOrderLine_inventory_unit_guard";
ALTER TABLE "PurchaseOrderLineInventoryBinding" ENABLE ALWAYS TRIGGER "PurchaseOrderLineInventoryBinding_insert_guard";
ALTER TABLE "PurchaseOrderLineInventoryBinding" ENABLE ALWAYS TRIGGER "PurchaseOrderLineInventoryBinding_append_only";
ALTER TABLE "PurchaseOrderLineInventoryBinding" ENABLE ALWAYS TRIGGER "PurchaseOrderLineInventoryBinding_no_truncate";
ALTER TABLE "InventoryTransaction" ENABLE ALWAYS TRIGGER "InventoryTransaction_insert_guard";
ALTER TABLE "InventoryTransaction" ENABLE ALWAYS TRIGGER "InventoryTransaction_append_only";
ALTER TABLE "InventoryTransaction" ENABLE ALWAYS TRIGGER "InventoryTransaction_no_truncate";
ALTER TABLE "InventoryTransaction" ENABLE ALWAYS TRIGGER "InventoryTransaction_snapshot_guard";
ALTER TABLE "InventoryLedgerEntry" ENABLE ALWAYS TRIGGER "InventoryLedgerEntry_00_finite_guard";
ALTER TABLE "InventoryLedgerEntry" ENABLE ALWAYS TRIGGER "InventoryLedgerEntry_insert_guard";
ALTER TABLE "InventoryLedgerEntry" ENABLE ALWAYS TRIGGER "InventoryLedgerEntry_append_only";
ALTER TABLE "InventoryLedgerEntry" ENABLE ALWAYS TRIGGER "InventoryLedgerEntry_no_truncate";
ALTER TABLE "InventoryLedgerEntry" ENABLE ALWAYS TRIGGER "InventoryLedgerEntry_balance_project";
ALTER TABLE "InventoryLedgerEntry" ENABLE ALWAYS TRIGGER "InventoryLedgerEntry_snapshot_guard";
ALTER TABLE "InventoryBalance" ENABLE ALWAYS TRIGGER "InventoryBalance_projection_guard";
ALTER TABLE "InventoryBalance" ENABLE ALWAYS TRIGGER "InventoryBalance_no_truncate";
ALTER TABLE "GoodsReceiptInspection" ENABLE ALWAYS TRIGGER "GoodsReceiptInspection_inventory_putaway_guard";
