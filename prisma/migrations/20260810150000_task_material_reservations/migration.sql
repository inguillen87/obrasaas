-- S12.2C reserves and releases one immutable task-material bundle exactly.
-- Supplier promises, photos, OCR, email and legacy stockpiles never create
-- availability. InventoryAvailability is a database-owned projection whose
-- row is the concurrency authority; advisory locks only complement row locks.

CREATE TYPE "TaskMaterialReservationTransactionType" AS ENUM (
  'RESERVE',
  'RELEASE'
);

ALTER TABLE "Project"
  ADD COLUMN "materialReservationEligible" BOOLEAN
  GENERATED ALWAYS AS (
    "status" NOT IN ('COMPLETED', 'ARCHIVED')
  ) STORED NOT NULL;

CREATE UNIQUE INDEX "Project_material_reservation_identity_key"
  ON "Project"("organizationId", "id", "materialReservationEligible");

CREATE TABLE "InventoryAvailability" (
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "onHand" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "reserved" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "available" DECIMAL(14,3)
    GENERATED ALWAYS AS ("onHand" - "reserved") STORED NOT NULL,
  "onHandRevision" INTEGER NOT NULL DEFAULT 0,
  "reservationRevision" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryAvailability_pkey" PRIMARY KEY (
    "organizationId", "projectId", "inventoryItemId", "locationId"
  ),
  CONSTRAINT "InventoryAvailability_quantities_check" CHECK (
    "onHand" <> 'NaN'::numeric
    AND "reserved" <> 'NaN'::numeric
    AND "onHand" >= 0::numeric
    AND "reserved" >= 0::numeric
    AND "reserved" <= "onHand"
  ),
  CONSTRAINT "InventoryAvailability_revisions_check" CHECK (
    "onHandRevision" >= 0 AND "reservationRevision" >= 0
  )
);

CREATE TABLE "TaskMaterialReservationTransaction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "requirementRevisionId" TEXT NOT NULL,
  "transactionType" "TaskMaterialReservationTransactionType" NOT NULL,
  "version" INTEGER NOT NULL,
  "predecessorId" TEXT,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "actorId" TEXT NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskMaterialReservationTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskMaterialReservationTransaction_version_check" CHECK ("version" >= 1),
  CONSTRAINT "TaskMaterialReservationTransaction_operation_key_check" CHECK (
    char_length("operationKey") BETWEEN 8 AND 128
    AND "operationKey" = btrim("operationKey")
    AND "operationKey" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  ),
  CONSTRAINT "TaskMaterialReservationTransaction_fingerprint_check" CHECK (
    "requestFingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "TaskMaterialReservationTransaction_reason_check" CHECK (
    char_length("reason") BETWEEN 3 AND 500
    AND "reason" = btrim("reason")
    AND "reason" ~ '^[^[:cntrl:]]+$'
  )
);

-- Exactly one row exists per task while its global reservation head is
-- RESERVE. The generated Project snapshot FK is the RI authority for the
-- close-versus-reserve race in both commit orders.
CREATE TABLE "TaskMaterialActiveReservation" (
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "reservationTransactionId" TEXT NOT NULL,
  "requirementRevisionId" TEXT NOT NULL,
  "projectReservationEligibleSnapshot" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskMaterialActiveReservation_pkey" PRIMARY KEY (
    "organizationId", "projectId", "taskId"
  ),
  CONSTRAINT "TaskMaterialActiveReservation_project_snapshot_check" CHECK (
    "projectReservationEligibleSnapshot" IS TRUE
  )
);

CREATE TABLE "TaskMaterialReservationBalance" (
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "requirementRevisionId" TEXT NOT NULL,
  "requirementLineId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "requiredQuantity" DECIMAL(14,3) NOT NULL,
  "reservedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskMaterialReservationBalance_pkey" PRIMARY KEY (
    "organizationId", "projectId", "taskId", "requirementRevisionId", "requirementLineId"
  ),
  CONSTRAINT "TaskMaterialReservationBalance_quantities_check" CHECK (
    "requiredQuantity" <> 'NaN'::numeric
    AND "reservedQuantity" <> 'NaN'::numeric
    AND "requiredQuantity" > 0::numeric
    AND "reservedQuantity" >= 0::numeric
    AND "reservedQuantity" <= "requiredQuantity"
  ),
  CONSTRAINT "TaskMaterialReservationBalance_revision_check" CHECK ("revision" >= 0)
);

CREATE TABLE "TaskMaterialReservationEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "requirementRevisionId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "requirementLineId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "unitSnapshot" VARCHAR(32) NOT NULL,
  "quantityDelta" DECIMAL(14,3) NOT NULL,
  "reversesEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskMaterialReservationEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskMaterialReservationEntry_quantity_check" CHECK (
    "quantityDelta" <> 0::numeric AND "quantityDelta" <> 'NaN'::numeric
  ),
  CONSTRAINT "TaskMaterialReservationEntry_unit_check" CHECK (
    char_length("unitSnapshot") BETWEEN 1 AND 32
    AND "unitSnapshot" = btrim("unitSnapshot")
    AND "unitSnapshot" ~ '^[^[:cntrl:]]+$'
  )
);

CREATE UNIQUE INDEX "TaskMaterialReservationTransaction_scope_id_key"
  ON "TaskMaterialReservationTransaction"("organizationId", "projectId", "taskId", "id");
CREATE UNIQUE INDEX "TaskMaterialReservationTransaction_task_version_key"
  ON "TaskMaterialReservationTransaction"("projectId", "taskId", "version");
CREATE UNIQUE INDEX "TaskMaterialReservationTransaction_predecessor_key"
  ON "TaskMaterialReservationTransaction"("organizationId", "projectId", "taskId", "predecessorId");
CREATE UNIQUE INDEX "TaskMaterialReservationTransaction_operation_key"
  ON "TaskMaterialReservationTransaction"("projectId", "operationKey");
CREATE UNIQUE INDEX "TaskMaterialReservationTransaction_root_key"
  ON "TaskMaterialReservationTransaction"("organizationId", "projectId", "taskId")
  WHERE "predecessorId" IS NULL;
CREATE INDEX "TaskMaterialReservationTransaction_revision_idx"
  ON "TaskMaterialReservationTransaction"(
    "projectId", "taskId", "requirementRevisionId", "occurredAt"
  );

CREATE UNIQUE INDEX "TaskMaterialActiveReservation_transaction_key"
  ON "TaskMaterialActiveReservation"(
    "organizationId", "projectId", "taskId", "reservationTransactionId"
  );
CREATE UNIQUE INDEX "TaskMaterialActiveReservation_task_key"
  ON "TaskMaterialActiveReservation"("projectId", "taskId");
CREATE INDEX "TaskMaterialActiveReservation_revision_idx"
  ON "TaskMaterialActiveReservation"("projectId", "requirementRevisionId");

CREATE UNIQUE INDEX "TaskMaterialReservationBalance_line_item_key"
  ON "TaskMaterialReservationBalance"(
    "organizationId", "projectId", "taskId", "requirementRevisionId",
    "requirementLineId", "inventoryItemId"
  );
CREATE INDEX "TaskMaterialReservationBalance_revision_reserved_idx"
  ON "TaskMaterialReservationBalance"(
    "projectId", "taskId", "requirementRevisionId", "reservedQuantity"
  );

CREATE UNIQUE INDEX "TaskMaterialReservationEntry_scope_id_key"
  ON "TaskMaterialReservationEntry"("organizationId", "projectId", "taskId", "id");
CREATE UNIQUE INDEX "TaskMaterialReservationEntry_allocation_key"
  ON "TaskMaterialReservationEntry"(
    "projectId", "transactionId", "requirementLineId", "locationId"
  );
CREATE UNIQUE INDEX "TaskMaterialReservationEntry_reversal_key"
  ON "TaskMaterialReservationEntry"(
    "organizationId", "projectId", "taskId", "reversesEntryId"
  );
CREATE INDEX "TaskMaterialReservationEntry_line_idx"
  ON "TaskMaterialReservationEntry"(
    "projectId", "requirementRevisionId", "requirementLineId"
  );
CREATE INDEX "TaskMaterialReservationEntry_availability_idx"
  ON "TaskMaterialReservationEntry"(
    "projectId", "inventoryItemId", "locationId", "createdAt"
  );

CREATE INDEX "InventoryAvailability_item_available_idx"
  ON "InventoryAvailability"("projectId", "inventoryItemId", "available");
CREATE INDEX "InventoryAvailability_location_available_idx"
  ON "InventoryAvailability"("projectId", "locationId", "available");

ALTER TABLE "InventoryAvailability"
  ADD CONSTRAINT "InventoryAvailability_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryAvailability"
  ADD CONSTRAINT "InventoryAvailability_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryAvailability"
  ADD CONSTRAINT "InventoryAvailability_item_fkey"
  FOREIGN KEY ("organizationId", "projectId", "inventoryItemId")
  REFERENCES "InventoryItem"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryAvailability"
  ADD CONSTRAINT "InventoryAvailability_location_fkey"
  FOREIGN KEY ("organizationId", "projectId", "locationId")
  REFERENCES "InventoryLocation"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryAvailability"
  ADD CONSTRAINT "InventoryAvailability_balance_fkey"
  FOREIGN KEY ("organizationId", "projectId", "inventoryItemId", "locationId")
  REFERENCES "InventoryBalance"("organizationId", "projectId", "inventoryItemId", "locationId")
  ON DELETE RESTRICT ON UPDATE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "TaskMaterialReservationTransaction"
  ADD CONSTRAINT "TaskMaterialReservationTransaction_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationTransaction"
  ADD CONSTRAINT "TaskMaterialReservationTransaction_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationTransaction"
  ADD CONSTRAINT "TaskMaterialReservationTransaction_task_fkey"
  FOREIGN KEY ("projectId", "taskId") REFERENCES "Task"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationTransaction"
  ADD CONSTRAINT "TaskMaterialReservationTransaction_revision_fkey"
  FOREIGN KEY ("organizationId", "projectId", "taskId", "requirementRevisionId")
  REFERENCES "TaskMaterialRequirementRevision"(
    "organizationId", "projectId", "taskId", "id"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "TaskMaterialActiveReservation"
  ADD CONSTRAINT "TaskMaterialActiveReservation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialActiveReservation"
  ADD CONSTRAINT "TaskMaterialActiveReservation_project_fkey"
  FOREIGN KEY (
    "organizationId", "projectId", "projectReservationEligibleSnapshot"
  ) REFERENCES "Project"(
    "organizationId", "id", "materialReservationEligible"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialActiveReservation"
  ADD CONSTRAINT "TaskMaterialActiveReservation_task_fkey"
  FOREIGN KEY ("projectId", "taskId") REFERENCES "Task"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialActiveReservation"
  ADD CONSTRAINT "TaskMaterialActiveReservation_transaction_fkey"
  FOREIGN KEY (
    "organizationId", "projectId", "taskId", "reservationTransactionId"
  ) REFERENCES "TaskMaterialReservationTransaction"(
    "organizationId", "projectId", "taskId", "id"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialActiveReservation"
  ADD CONSTRAINT "TaskMaterialActiveReservation_revision_fkey"
  FOREIGN KEY (
    "organizationId", "projectId", "taskId", "requirementRevisionId"
  ) REFERENCES "TaskMaterialRequirementRevision"(
    "organizationId", "projectId", "taskId", "id"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationTransaction"
  ADD CONSTRAINT "TaskMaterialReservationTransaction_actor_fkey"
  FOREIGN KEY ("actorId") REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationTransaction"
  ADD CONSTRAINT "TaskMaterialReservationTransaction_predecessor_fkey"
  FOREIGN KEY ("organizationId", "projectId", "taskId", "predecessorId")
  REFERENCES "TaskMaterialReservationTransaction"(
    "organizationId", "projectId", "taskId", "id"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "TaskMaterialReservationBalance"
  ADD CONSTRAINT "TaskMaterialReservationBalance_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationBalance"
  ADD CONSTRAINT "TaskMaterialReservationBalance_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationBalance"
  ADD CONSTRAINT "TaskMaterialReservationBalance_task_fkey"
  FOREIGN KEY ("projectId", "taskId") REFERENCES "Task"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationBalance"
  ADD CONSTRAINT "TaskMaterialReservationBalance_revision_fkey"
  FOREIGN KEY ("organizationId", "projectId", "taskId", "requirementRevisionId")
  REFERENCES "TaskMaterialRequirementRevision"(
    "organizationId", "projectId", "taskId", "id"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationBalance"
  ADD CONSTRAINT "TaskMaterialReservationBalance_line_fkey"
  FOREIGN KEY (
    "organizationId", "projectId", "taskId", "requirementRevisionId", "requirementLineId"
  ) REFERENCES "TaskMaterialRequirementLine"(
    "organizationId", "projectId", "taskId", "revisionId", "id"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationBalance"
  ADD CONSTRAINT "TaskMaterialReservationBalance_item_fkey"
  FOREIGN KEY ("organizationId", "projectId", "inventoryItemId")
  REFERENCES "InventoryItem"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "TaskMaterialReservationEntry"
  ADD CONSTRAINT "TaskMaterialReservationEntry_transaction_fkey"
  FOREIGN KEY ("organizationId", "projectId", "taskId", "transactionId")
  REFERENCES "TaskMaterialReservationTransaction"(
    "organizationId", "projectId", "taskId", "id"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationEntry"
  ADD CONSTRAINT "TaskMaterialReservationEntry_line_fkey"
  FOREIGN KEY (
    "organizationId", "projectId", "taskId", "requirementRevisionId", "requirementLineId"
  ) REFERENCES "TaskMaterialRequirementLine"(
    "organizationId", "projectId", "taskId", "revisionId", "id"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationEntry"
  ADD CONSTRAINT "TaskMaterialReservationEntry_line_balance_fkey"
  FOREIGN KEY (
    "organizationId", "projectId", "taskId", "requirementRevisionId",
    "requirementLineId", "inventoryItemId"
  ) REFERENCES "TaskMaterialReservationBalance"(
    "organizationId", "projectId", "taskId", "requirementRevisionId",
    "requirementLineId", "inventoryItemId"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationEntry"
  ADD CONSTRAINT "TaskMaterialReservationEntry_item_fkey"
  FOREIGN KEY ("organizationId", "projectId", "inventoryItemId")
  REFERENCES "InventoryItem"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationEntry"
  ADD CONSTRAINT "TaskMaterialReservationEntry_location_fkey"
  FOREIGN KEY ("organizationId", "projectId", "locationId")
  REFERENCES "InventoryLocation"("organizationId", "projectId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationEntry"
  ADD CONSTRAINT "TaskMaterialReservationEntry_availability_fkey"
  FOREIGN KEY ("organizationId", "projectId", "inventoryItemId", "locationId")
  REFERENCES "InventoryAvailability"(
    "organizationId", "projectId", "inventoryItemId", "locationId"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialReservationEntry"
  ADD CONSTRAINT "TaskMaterialReservationEntry_reverses_fkey"
  FOREIGN KEY ("organizationId", "projectId", "taskId", "reversesEntryId")
  REFERENCES "TaskMaterialReservationEntry"(
    "organizationId", "projectId", "taskId", "id"
  ) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Existing physical stock becomes the deterministic zero-reservation baseline.
INSERT INTO "InventoryAvailability" (
  "organizationId", "projectId", "inventoryItemId", "locationId",
  "onHand", "reserved", "onHandRevision", "reservationRevision", "updatedAt"
)
SELECT balance."organizationId", balance."projectId", balance."inventoryItemId",
       balance."locationId", balance."onHand", 0::numeric, balance."revision", 0,
       clock_timestamp()
  FROM "InventoryBalance" AS balance
 ORDER BY balance."organizationId", balance."projectId",
          balance."inventoryItemId", balance."locationId";

-- Every existing BOM line receives a deterministic, zero-reserved projection.
INSERT INTO "TaskMaterialReservationBalance" (
  "organizationId", "projectId", "taskId", "requirementRevisionId",
  "requirementLineId", "inventoryItemId", "requiredQuantity",
  "reservedQuantity", "revision", "updatedAt"
)
SELECT line."organizationId", line."projectId", line."taskId", line."revisionId",
       line."id", line."inventoryItemId", line."requiredQuantity",
       0::numeric, 0, clock_timestamp()
  FROM "TaskMaterialRequirementLine" AS line
 ORDER BY line."organizationId", line."projectId", line."taskId",
          line."revisionId", line."id";

CREATE FUNCTION "obrasaas_task_material_reservation_append_only"()
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

CREATE FUNCTION "obrasaas_task_material_reservation_no_truncate"()
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

CREATE FUNCTION "obrasaas_task_material_reservation_balance_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  exact_line RECORD;
BEGIN
  IF pg_catalog.pg_trigger_depth() <> 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'TaskMaterialReservationBalance is database-owned';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'TaskMaterialReservationBalance is a retained projection';
  END IF;

  SELECT line."inventoryItemId", line."requiredQuantity"
    INTO exact_line
    FROM "public"."TaskMaterialRequirementLine" AS line
   WHERE line."organizationId" = NEW."organizationId"
     AND line."projectId" = NEW."projectId"
     AND line."taskId" = NEW."taskId"
     AND line."revisionId" = NEW."requirementRevisionId"
     AND line."id" = NEW."requirementLineId";
  IF NOT FOUND
     OR NEW."inventoryItemId" IS DISTINCT FROM exact_line."inventoryItemId"
     OR NEW."requiredQuantity" IS DISTINCT FROM exact_line."requiredQuantity" THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID line balance is not authoritative';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."reservedQuantity" <> 0::numeric OR NEW."revision" <> 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID line balance must start empty';
    END IF;
  ELSE
    IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
       OR OLD."projectId" IS DISTINCT FROM NEW."projectId"
       OR OLD."taskId" IS DISTINCT FROM NEW."taskId"
       OR OLD."requirementRevisionId" IS DISTINCT FROM NEW."requirementRevisionId"
       OR OLD."requirementLineId" IS DISTINCT FROM NEW."requirementLineId"
       OR OLD."inventoryItemId" IS DISTINCT FROM NEW."inventoryItemId"
       OR OLD."requiredQuantity" IS DISTINCT FROM NEW."requiredQuantity"
       OR NEW."revision" <> OLD."revision" + 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'TaskMaterialReservationBalance projection transition is invalid';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_task_material_reservation_line_initialize"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  INSERT INTO "public"."TaskMaterialReservationBalance" (
    "organizationId", "projectId", "taskId", "requirementRevisionId",
    "requirementLineId", "inventoryItemId", "requiredQuantity",
    "reservedQuantity", "revision", "updatedAt"
  ) VALUES (
    NEW."organizationId", NEW."projectId", NEW."taskId", NEW."revisionId",
    NEW."id", NEW."inventoryItemId", NEW."requiredQuantity",
    0::numeric, 0, clock_timestamp()
  );
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inventory_availability_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  balance_on_hand NUMERIC(14,3);
  balance_revision INTEGER;
BEGIN
  IF pg_catalog.pg_trigger_depth() <> 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryAvailability is database-owned and rejects direct writes';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryAvailability is a retained projection';
  END IF;

  SELECT balance."onHand", balance."revision"
    INTO balance_on_hand, balance_revision
    FROM "public"."InventoryBalance" AS balance
   WHERE balance."organizationId" = NEW."organizationId"
     AND balance."projectId" = NEW."projectId"
     AND balance."inventoryItemId" = NEW."inventoryItemId"
     AND balance."locationId" = NEW."locationId";
  IF NOT FOUND
     OR NEW."onHand" IS DISTINCT FROM balance_on_hand
     OR NEW."onHandRevision" IS DISTINCT FROM balance_revision THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryAvailability must exactly project InventoryBalance';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."reserved" <> 0::numeric OR NEW."reservationRevision" <> 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'InventoryAvailability must start without reservations';
    END IF;
  ELSE
    IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
       OR OLD."projectId" IS DISTINCT FROM NEW."projectId"
       OR OLD."inventoryItemId" IS DISTINCT FROM NEW."inventoryItemId"
       OR OLD."locationId" IS DISTINCT FROM NEW."locationId" THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'InventoryAvailability scope is immutable';
    END IF;
    IF NEW."reserved" IS DISTINCT FROM OLD."reserved" THEN
      IF NEW."onHand" IS DISTINCT FROM OLD."onHand"
         OR NEW."onHandRevision" IS DISTINCT FROM OLD."onHandRevision"
         OR NEW."reservationRevision" <> OLD."reservationRevision" + 1 THEN
        RAISE EXCEPTION USING
          ERRCODE = '55000',
          MESSAGE = 'InventoryAvailability reservation transition is invalid';
      END IF;
    ELSIF NEW."reservationRevision" IS DISTINCT FROM OLD."reservationRevision" THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'InventoryAvailability reservation revision drifted';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inventory_ledger_reserved_floor_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  availability RECORD;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inventory-availability:' || NEW."organizationId" || ':' || NEW."projectId"
      || ':' || NEW."inventoryItemId" || ':' || NEW."locationId",
      0
    )
  );
  SELECT row."onHand", row."reserved"
    INTO availability
    FROM "public"."InventoryAvailability" AS row
   WHERE row."organizationId" = NEW."organizationId"
     AND row."projectId" = NEW."projectId"
     AND row."inventoryItemId" = NEW."inventoryItemId"
     AND row."locationId" = NEW."locationId"
     FOR UPDATE;
  IF FOUND AND availability."onHand" + NEW."quantityDelta" < availability."reserved" THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK InventoryLedgerEntry_reserved_floor_conflict';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_inventory_availability_project_on_hand"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  balance RECORD;
  affected_rows INTEGER;
BEGIN
  SELECT row."onHand", row."revision"
    INTO balance
    FROM "public"."InventoryBalance" AS row
   WHERE row."organizationId" = NEW."organizationId"
     AND row."projectId" = NEW."projectId"
     AND row."inventoryItemId" = NEW."inventoryItemId"
     AND row."locationId" = NEW."locationId"
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'InventoryAvailability cannot project a missing InventoryBalance';
  END IF;

  INSERT INTO "public"."InventoryAvailability" AS availability (
    "organizationId", "projectId", "inventoryItemId", "locationId",
    "onHand", "reserved", "onHandRevision", "reservationRevision", "updatedAt"
  ) VALUES (
    NEW."organizationId", NEW."projectId", NEW."inventoryItemId", NEW."locationId",
    balance."onHand", 0::numeric, balance."revision", 0, clock_timestamp()
  )
  ON CONFLICT ON CONSTRAINT "InventoryAvailability_pkey" DO UPDATE
    SET "onHand" = EXCLUDED."onHand",
        "onHandRevision" = EXCLUDED."onHandRevision",
        "updatedAt" = clock_timestamp()
  WHERE availability."reserved" <= EXCLUDED."onHand";
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK InventoryLedgerEntry_reserved_floor_conflict';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_task_material_reservation_entry_insert_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  transaction_row RECORD;
  line_row RECORD;
  original_entry RECORD;
  affected_rows INTEGER;
BEGIN
  IF current_setting('obrasaas.task_material_reservation_transaction_id', true)
       IS DISTINCT FROM NEW."transactionId" THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'TaskMaterialReservationEntry requires a governed command';
  END IF;

  SELECT transaction."transactionType", transaction."requirementRevisionId"
    INTO transaction_row
    FROM "public"."TaskMaterialReservationTransaction" AS transaction
   WHERE transaction."organizationId" = NEW."organizationId"
     AND transaction."projectId" = NEW."projectId"
     AND transaction."taskId" = NEW."taskId"
     AND transaction."id" = NEW."transactionId";
  IF NOT FOUND OR transaction_row."requirementRevisionId" IS DISTINCT FROM NEW."requirementRevisionId" THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID transaction scope';
  END IF;

  SELECT line."inventoryItemId", line."unitSnapshot"
    INTO line_row
    FROM "public"."TaskMaterialRequirementLine" AS line
   WHERE line."organizationId" = NEW."organizationId"
     AND line."projectId" = NEW."projectId"
     AND line."taskId" = NEW."taskId"
     AND line."revisionId" = NEW."requirementRevisionId"
     AND line."id" = NEW."requirementLineId";
  IF NOT FOUND
     OR NEW."inventoryItemId" IS DISTINCT FROM line_row."inventoryItemId"
     OR NEW."unitSnapshot" IS DISTINCT FROM line_row."unitSnapshot" THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID requirement line snapshot';
  END IF;

  IF transaction_row."transactionType" = 'RESERVE' THEN
    IF NEW."quantityDelta" <= 0::numeric OR NEW."reversesEntryId" IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE reserve entry shape';
    END IF;
  ELSE
    IF NEW."quantityDelta" >= 0::numeric OR NEW."reversesEntryId" IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID release entry shape';
    END IF;
    SELECT entry."organizationId", entry."projectId", entry."taskId",
           entry."requirementRevisionId", entry."requirementLineId",
           entry."inventoryItemId", entry."locationId", entry."unitSnapshot",
           entry."quantityDelta", transaction."transactionType"
      INTO original_entry
      FROM "public"."TaskMaterialReservationEntry" AS entry
      JOIN "public"."TaskMaterialReservationTransaction" AS transaction
        ON transaction."organizationId" = entry."organizationId"
       AND transaction."projectId" = entry."projectId"
       AND transaction."taskId" = entry."taskId"
       AND transaction."id" = entry."transactionId"
     WHERE entry."organizationId" = NEW."organizationId"
       AND entry."projectId" = NEW."projectId"
       AND entry."taskId" = NEW."taskId"
       AND entry."id" = NEW."reversesEntryId";
    IF NOT FOUND OR original_entry."transactionType" <> 'RESERVE'
       OR NEW."requirementRevisionId" IS DISTINCT FROM original_entry."requirementRevisionId"
       OR NEW."requirementLineId" IS DISTINCT FROM original_entry."requirementLineId"
       OR NEW."inventoryItemId" IS DISTINCT FROM original_entry."inventoryItemId"
       OR NEW."locationId" IS DISTINCT FROM original_entry."locationId"
       OR NEW."unitSnapshot" IS DISTINCT FROM original_entry."unitSnapshot"
       OR NEW."quantityDelta" IS DISTINCT FROM -original_entry."quantityDelta" THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID release must mirror reserve entry';
    END IF;
  END IF;

  -- The line balance row is the bundle authority; advisory locks never replace
  -- this conditional row update.
  UPDATE "public"."TaskMaterialReservationBalance" AS balance
     SET "reservedQuantity" = balance."reservedQuantity" + NEW."quantityDelta",
         "revision" = balance."revision" + 1,
         "updatedAt" = clock_timestamp()
   WHERE balance."organizationId" = NEW."organizationId"
     AND balance."projectId" = NEW."projectId"
     AND balance."taskId" = NEW."taskId"
     AND balance."requirementRevisionId" = NEW."requirementRevisionId"
     AND balance."requirementLineId" = NEW."requirementLineId"
     AND balance."inventoryItemId" = NEW."inventoryItemId"
     AND balance."reservedQuantity" + NEW."quantityDelta" >= 0::numeric
     AND balance."reservedQuantity" + NEW."quantityDelta" <= balance."requiredQuantity";
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = CASE WHEN transaction_row."transactionType" = 'RESERVE'
        THEN 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE line capacity'
        ELSE 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID line balance' END;
  END IF;

  -- InventoryAvailability is the stock concurrency authority. There is no SUM
  -- over either ledger on this hot path and no automatic retry.
  UPDATE "public"."InventoryAvailability" AS availability
     SET "reserved" = availability."reserved" + NEW."quantityDelta",
         "reservationRevision" = availability."reservationRevision" + 1,
         "updatedAt" = clock_timestamp()
   WHERE availability."organizationId" = NEW."organizationId"
     AND availability."projectId" = NEW."projectId"
     AND availability."inventoryItemId" = NEW."inventoryItemId"
     AND availability."locationId" = NEW."locationId"
     AND availability."reserved" + NEW."quantityDelta" >= 0::numeric
     AND availability."reserved" + NEW."quantityDelta" <= availability."onHand";
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = CASE WHEN transaction_row."transactionType" = 'RESERVE'
        THEN 'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK availability row'
        ELSE 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID availability row' END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_task_material_reservation_transaction_insert_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  predecessor_type TEXT;
  predecessor_version INTEGER;
  predecessor_revision_id TEXT;
  predecessor_has_successor BOOLEAN;
  project_status TEXT;
  actor_active BOOLEAN;
  revision_kind TEXT;
  revision_has_successor BOOLEAN;
  task_status TEXT;
  task_material_identity BOOLEAN;
BEGIN
  IF current_setting('obrasaas.task_material_reservation_transaction_id', true)
       IS DISTINCT FROM NEW."id" THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'TaskMaterialReservationTransaction requires a governed command';
  END IF;

  SELECT project."status"::text
    INTO project_status
    FROM "public"."Project" AS project
   WHERE project."organizationId" = NEW."organizationId"
     AND project."id" = NEW."projectId";
  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID project scope';
  END IF;
  IF project_status IN ('COMPLETED', 'ARCHIVED') THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_PROJECT_READ_ONLY project is closed';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM "public"."TenantMembership" AS membership
     WHERE membership."organizationId" = NEW."organizationId"
       AND membership."userId" = NEW."actorId"
       AND membership."status" = 'ACTIVE'
  ) INTO actor_active;
  IF NOT actor_active THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_ACTOR_FORBIDDEN actor is not active';
  END IF;

  SELECT revision."kind"::text,
         EXISTS (
           SELECT 1
             FROM "public"."TaskMaterialRequirementRevision" AS successor
            WHERE successor."organizationId" = revision."organizationId"
              AND successor."projectId" = revision."projectId"
              AND successor."taskId" = revision."taskId"
              AND successor."predecessorId" = revision."id"
         ), task."status"::text, task."materialRequirementEligible"
    INTO revision_kind, revision_has_successor, task_status,
         task_material_identity
    FROM "public"."TaskMaterialRequirementRevision" AS revision
    JOIN "public"."Task" AS task
      ON task."projectId" = revision."projectId"
     AND task."id" = revision."taskId"
   WHERE revision."organizationId" = NEW."organizationId"
     AND revision."projectId" = NEW."projectId"
     AND revision."taskId" = NEW."taskId"
     AND revision."id" = NEW."requirementRevisionId";
  IF NOT FOUND OR revision_kind <> 'MATERIALS_REQUIRED' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID requirement revision';
  END IF;

  IF NEW."predecessorId" IS NULL THEN
    IF NEW."version" <> 1 OR EXISTS (
      SELECT 1 FROM "public"."TaskMaterialReservationTransaction" AS prior
       WHERE prior."organizationId" = NEW."organizationId"
         AND prior."projectId" = NEW."projectId"
         AND prior."taskId" = NEW."taskId"
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '40001',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_HEAD_STALE root transaction';
    END IF;
  ELSE
    SELECT prior."transactionType"::text, prior."version",
           prior."requirementRevisionId",
           EXISTS (
             SELECT 1 FROM "public"."TaskMaterialReservationTransaction" AS successor
              WHERE successor."organizationId" = prior."organizationId"
                AND successor."projectId" = prior."projectId"
                AND successor."taskId" = prior."taskId"
                AND successor."predecessorId" = prior."id"
           ) AS has_successor
      INTO predecessor_type, predecessor_version, predecessor_revision_id,
           predecessor_has_successor
      FROM "public"."TaskMaterialReservationTransaction" AS prior
     WHERE prior."organizationId" = NEW."organizationId"
       AND prior."projectId" = NEW."projectId"
       AND prior."taskId" = NEW."taskId"
       AND prior."id" = NEW."predecessorId"
     FOR UPDATE;
    IF NOT FOUND OR predecessor_has_successor
       OR NEW."version" <> predecessor_version + 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '40001',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_HEAD_STALE predecessor is not the head';
    END IF;
  END IF;

  IF NEW."transactionType" = 'RESERVE' THEN
    IF task_status = 'DONE' OR task_material_identity IS NOT TRUE THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_TASK_NOT_RESERVABLE task must be active and canonical';
    END IF;
    IF revision_has_successor OR (
      NEW."predecessorId" IS NOT NULL AND predecessor_type <> 'RELEASE'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '40001',
        MESSAGE = 'TASK_MATERIAL_REQUIREMENT_HEAD_STALE reserve requires current BOM after release';
    END IF;
  ELSE
    IF NEW."predecessorId" IS NULL
       OR predecessor_type <> 'RESERVE'
       OR predecessor_revision_id IS DISTINCT FROM NEW."requirementRevisionId" THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID release must follow active reserve';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- The active row is a database-owned projection of the global task reservation
-- head. Its composite FK to Project(..., materialReservationEligible=true) is
-- the structural close-versus-reserve authority; the advisory locks only make
-- the expected winner/error easier for callers to understand.
CREATE FUNCTION "obrasaas_task_material_active_reservation_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  command_transaction RECORD;
  governed_transaction_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE' OR pg_catalog.pg_trigger_depth() <> 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'TaskMaterialActiveReservation is a database-owned projection';
  END IF;

  governed_transaction_id := NULLIF(
    current_setting('obrasaas.task_material_reservation_transaction_id', true),
    ''
  );
  SELECT transaction."organizationId", transaction."projectId",
         transaction."taskId", transaction."requirementRevisionId",
         transaction."transactionType"::text AS transaction_type,
         transaction."predecessorId"
    INTO command_transaction
    FROM "public"."TaskMaterialReservationTransaction" AS transaction
   WHERE transaction."id" = governed_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'TaskMaterialActiveReservation requires a governed command';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF command_transaction.transaction_type <> 'RESERVE'
       OR NEW."organizationId" IS DISTINCT FROM command_transaction."organizationId"
       OR NEW."projectId" IS DISTINCT FROM command_transaction."projectId"
       OR NEW."taskId" IS DISTINCT FROM command_transaction."taskId"
       OR NEW."requirementRevisionId" IS DISTINCT FROM command_transaction."requirementRevisionId"
       OR NEW."reservationTransactionId" IS DISTINCT FROM governed_transaction_id
       OR NEW."projectReservationEligibleSnapshot" IS NOT TRUE THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID active reservation insert';
    END IF;
    RETURN NEW;
  END IF;

  IF command_transaction.transaction_type <> 'RELEASE'
     OR OLD."organizationId" IS DISTINCT FROM command_transaction."organizationId"
     OR OLD."projectId" IS DISTINCT FROM command_transaction."projectId"
     OR OLD."taskId" IS DISTINCT FROM command_transaction."taskId"
     OR OLD."requirementRevisionId" IS DISTINCT FROM command_transaction."requirementRevisionId"
     OR OLD."reservationTransactionId" IS DISTINCT FROM command_transaction."predecessorId" THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID active reservation delete';
  END IF;
  RETURN OLD;
END;
$$;

CREATE FUNCTION "obrasaas_task_material_active_reservation_project"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  IF NEW."transactionType" = 'RESERVE' THEN
    INSERT INTO "public"."TaskMaterialActiveReservation" (
      "organizationId", "projectId", "taskId", "reservationTransactionId",
      "requirementRevisionId", "projectReservationEligibleSnapshot", "createdAt"
    ) VALUES (
      NEW."organizationId", NEW."projectId", NEW."taskId", NEW."id",
      NEW."requirementRevisionId", TRUE, NEW."occurredAt"
    );
  ELSE
    DELETE FROM "public"."TaskMaterialActiveReservation" AS active
     WHERE active."organizationId" = NEW."organizationId"
       AND active."projectId" = NEW."projectId"
       AND active."taskId" = NEW."taskId"
       AND active."reservationTransactionId" = NEW."predecessorId"
       AND active."requirementRevisionId" = NEW."requirementRevisionId";
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID active reservation missing';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_task_material_reservation_bundle_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  required_lines INTEGER;
  covered_lines INTEGER;
  allocation_rows INTEGER;
  mirrored_rows INTEGER;
  transaction_is_head BOOLEAN;
BEGIN
  SELECT revision."lineCount"
    INTO required_lines
    FROM "public"."TaskMaterialRequirementRevision" AS revision
   WHERE revision."organizationId" = NEW."organizationId"
     AND revision."projectId" = NEW."projectId"
     AND revision."taskId" = NEW."taskId"
     AND revision."id" = NEW."requirementRevisionId";

  SELECT count(*)::integer, count(DISTINCT entry."requirementLineId")::integer
    INTO allocation_rows, covered_lines
    FROM "public"."TaskMaterialReservationEntry" AS entry
   WHERE entry."organizationId" = NEW."organizationId"
     AND entry."projectId" = NEW."projectId"
     AND entry."taskId" = NEW."taskId"
     AND entry."transactionId" = NEW."id";

  IF NEW."transactionType" = 'RESERVE' THEN
    IF required_lines IS NULL OR required_lines < 1 OR allocation_rows < required_lines
       OR covered_lines <> required_lines OR EXISTS (
         SELECT 1
           FROM "public"."TaskMaterialRequirementLine" AS line
           LEFT JOIN "public"."TaskMaterialReservationEntry" AS entry
             ON entry."organizationId" = line."organizationId"
            AND entry."projectId" = line."projectId"
            AND entry."taskId" = line."taskId"
            AND entry."requirementRevisionId" = line."revisionId"
            AND entry."requirementLineId" = line."id"
            AND entry."transactionId" = NEW."id"
          WHERE line."organizationId" = NEW."organizationId"
            AND line."projectId" = NEW."projectId"
            AND line."taskId" = NEW."taskId"
            AND line."revisionId" = NEW."requirementRevisionId"
          GROUP BY line."id", line."requiredQuantity"
         HAVING COALESCE(sum(entry."quantityDelta"), 0::numeric)
                  IS DISTINCT FROM line."requiredQuantity"
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE full bundle required';
    END IF;
  ELSE
    SELECT count(*)::integer
      INTO mirrored_rows
      FROM "public"."TaskMaterialReservationEntry" AS original
      JOIN "public"."TaskMaterialReservationEntry" AS reversal
        ON reversal."organizationId" = original."organizationId"
       AND reversal."projectId" = original."projectId"
       AND reversal."taskId" = original."taskId"
       AND reversal."reversesEntryId" = original."id"
       AND reversal."transactionId" = NEW."id"
       AND reversal."quantityDelta" = -original."quantityDelta"
     WHERE original."organizationId" = NEW."organizationId"
       AND original."projectId" = NEW."projectId"
       AND original."taskId" = NEW."taskId"
       AND original."transactionId" = NEW."predecessorId";
    IF allocation_rows < 1 OR mirrored_rows <> allocation_rows OR mirrored_rows <> (
      SELECT count(*)::integer
        FROM "public"."TaskMaterialReservationEntry" AS original
       WHERE original."organizationId" = NEW."organizationId"
         AND original."projectId" = NEW."projectId"
         AND original."taskId" = NEW."taskId"
         AND original."transactionId" = NEW."predecessorId"
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID full mirror required';
    END IF;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1
      FROM "public"."TaskMaterialReservationTransaction" AS successor
     WHERE successor."organizationId" = NEW."organizationId"
       AND successor."projectId" = NEW."projectId"
       AND successor."taskId" = NEW."taskId"
       AND successor."predecessorId" = NEW."id"
  ) INTO transaction_is_head;
  IF transaction_is_head AND NEW."transactionType" = 'RESERVE' AND NOT EXISTS (
    SELECT 1
      FROM "public"."TaskMaterialActiveReservation" AS active
     WHERE active."organizationId" = NEW."organizationId"
       AND active."projectId" = NEW."projectId"
       AND active."taskId" = NEW."taskId"
       AND active."reservationTransactionId" = NEW."id"
       AND active."requirementRevisionId" = NEW."requirementRevisionId"
       AND active."projectReservationEligibleSnapshot" IS TRUE
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE active reservation projection missing';
  ELSIF transaction_is_head AND NEW."transactionType" = 'RELEASE' AND EXISTS (
    SELECT 1
      FROM "public"."TaskMaterialActiveReservation" AS active
     WHERE active."organizationId" = NEW."organizationId"
       AND active."projectId" = NEW."projectId"
       AND active."taskId" = NEW."taskId"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID active reservation projection remains';
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION "obrasaas_task_material_requirement_reservation_fence"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  has_active_reservation BOOLEAN;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'task-material-requirement:' || NEW."projectId" || ':' || NEW."taskId",
      0
    )
  );
  SELECT EXISTS (
    SELECT 1
      FROM "public"."TaskMaterialActiveReservation" AS active
     WHERE active."organizationId" = NEW."organizationId"
       AND active."projectId" = NEW."projectId"
       AND active."taskId" = NEW."taskId"
  ) INTO has_active_reservation;
  IF has_active_reservation THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID release active bundle before publishing a new BOM';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_project_reservation_close_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  has_active_reservation BOOLEAN;
BEGIN
  IF NEW."status" IN ('COMPLETED', 'ARCHIVED')
     AND OLD."status" NOT IN ('COMPLETED', 'ARCHIVED') THEN
    -- Same project lock as project-write-policy.js. Reserve/release acquire it
    -- before their task lock, so close versus reserve cannot strand stock.
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(NEW."id", 0)
    );
    SELECT EXISTS (
      SELECT 1
        FROM "public"."TaskMaterialActiveReservation" AS active
       WHERE active."organizationId" = NEW."organizationId"
         AND active."projectId" = NEW."id"
    ) INTO has_active_reservation;
    IF has_active_reservation THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'TASK_MATERIAL_RESERVATION_PROJECT_READ_ONLY active reservation prevents project closure';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "TaskMaterialRequirementRevision_reservation_fence"
BEFORE INSERT ON "TaskMaterialRequirementRevision"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_requirement_reservation_fence"();

CREATE TRIGGER "Project_reservation_close_guard"
BEFORE UPDATE OF "status" ON "Project"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_project_reservation_close_guard"();

CREATE TRIGGER "TaskMaterialRequirementLine_reservation_balance_initialize"
AFTER INSERT ON "TaskMaterialRequirementLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_reservation_line_initialize"();

CREATE TRIGGER "TaskMaterialReservationBalance_projection_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "TaskMaterialReservationBalance"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_reservation_balance_guard"();
CREATE TRIGGER "TaskMaterialReservationBalance_no_truncate"
BEFORE TRUNCATE ON "TaskMaterialReservationBalance"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_task_material_reservation_no_truncate"();

CREATE TRIGGER "InventoryAvailability_projection_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "InventoryAvailability"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_availability_guard"();
CREATE TRIGGER "InventoryAvailability_no_truncate"
BEFORE TRUNCATE ON "InventoryAvailability"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_task_material_reservation_no_truncate"();

CREATE TRIGGER "InventoryLedgerEntry_05_reserved_floor_guard"
BEFORE INSERT ON "InventoryLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_ledger_reserved_floor_guard"();
CREATE TRIGGER "InventoryLedgerEntry_zz_availability_project"
AFTER INSERT ON "InventoryLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_inventory_availability_project_on_hand"();

CREATE TRIGGER "TaskMaterialReservationTransaction_insert_guard"
BEFORE INSERT ON "TaskMaterialReservationTransaction"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_reservation_transaction_insert_guard"();
CREATE TRIGGER "TaskMaterialReservationTransaction_active_project"
AFTER INSERT ON "TaskMaterialReservationTransaction"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_active_reservation_project"();
CREATE TRIGGER "TaskMaterialReservationTransaction_append_only"
BEFORE UPDATE OR DELETE ON "TaskMaterialReservationTransaction"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_reservation_append_only"();
CREATE TRIGGER "TaskMaterialReservationTransaction_no_truncate"
BEFORE TRUNCATE ON "TaskMaterialReservationTransaction"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_task_material_reservation_no_truncate"();
CREATE CONSTRAINT TRIGGER "TaskMaterialReservationTransaction_bundle_guard"
AFTER INSERT ON "TaskMaterialReservationTransaction"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_reservation_bundle_guard"();

CREATE TRIGGER "TaskMaterialActiveReservation_projection_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "TaskMaterialActiveReservation"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_active_reservation_guard"();
CREATE TRIGGER "TaskMaterialActiveReservation_no_truncate"
BEFORE TRUNCATE ON "TaskMaterialActiveReservation"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_task_material_reservation_no_truncate"();

CREATE TRIGGER "TaskMaterialReservationEntry_insert_guard"
BEFORE INSERT ON "TaskMaterialReservationEntry"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_reservation_entry_insert_guard"();
CREATE TRIGGER "TaskMaterialReservationEntry_append_only"
BEFORE UPDATE OR DELETE ON "TaskMaterialReservationEntry"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_reservation_append_only"();
CREATE TRIGGER "TaskMaterialReservationEntry_no_truncate"
BEFORE TRUNCATE ON "TaskMaterialReservationEntry"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_task_material_reservation_no_truncate"();

ALTER TABLE "TaskMaterialRequirementRevision"
  ENABLE ALWAYS TRIGGER "TaskMaterialRequirementRevision_reservation_fence";
ALTER TABLE "Project"
  ENABLE ALWAYS TRIGGER "Project_reservation_close_guard";
ALTER TABLE "TaskMaterialRequirementLine"
  ENABLE ALWAYS TRIGGER "TaskMaterialRequirementLine_reservation_balance_initialize";
ALTER TABLE "TaskMaterialReservationBalance"
  ENABLE ALWAYS TRIGGER "TaskMaterialReservationBalance_projection_guard";
ALTER TABLE "TaskMaterialReservationBalance"
  ENABLE ALWAYS TRIGGER "TaskMaterialReservationBalance_no_truncate";
ALTER TABLE "InventoryAvailability"
  ENABLE ALWAYS TRIGGER "InventoryAvailability_projection_guard";
ALTER TABLE "InventoryAvailability"
  ENABLE ALWAYS TRIGGER "InventoryAvailability_no_truncate";
ALTER TABLE "InventoryLedgerEntry"
  ENABLE ALWAYS TRIGGER "InventoryLedgerEntry_05_reserved_floor_guard";
ALTER TABLE "InventoryLedgerEntry"
  ENABLE ALWAYS TRIGGER "InventoryLedgerEntry_zz_availability_project";
ALTER TABLE "TaskMaterialReservationTransaction"
  ENABLE ALWAYS TRIGGER "TaskMaterialReservationTransaction_insert_guard";
ALTER TABLE "TaskMaterialReservationTransaction"
  ENABLE ALWAYS TRIGGER "TaskMaterialReservationTransaction_active_project";
ALTER TABLE "TaskMaterialReservationTransaction"
  ENABLE ALWAYS TRIGGER "TaskMaterialReservationTransaction_append_only";
ALTER TABLE "TaskMaterialReservationTransaction"
  ENABLE ALWAYS TRIGGER "TaskMaterialReservationTransaction_no_truncate";
ALTER TABLE "TaskMaterialReservationTransaction"
  ENABLE ALWAYS TRIGGER "TaskMaterialReservationTransaction_bundle_guard";
ALTER TABLE "TaskMaterialActiveReservation"
  ENABLE ALWAYS TRIGGER "TaskMaterialActiveReservation_projection_guard";
ALTER TABLE "TaskMaterialActiveReservation"
  ENABLE ALWAYS TRIGGER "TaskMaterialActiveReservation_no_truncate";
ALTER TABLE "TaskMaterialReservationEntry"
  ENABLE ALWAYS TRIGGER "TaskMaterialReservationEntry_insert_guard";
ALTER TABLE "TaskMaterialReservationEntry"
  ENABLE ALWAYS TRIGGER "TaskMaterialReservationEntry_append_only";
ALTER TABLE "TaskMaterialReservationEntry"
  ENABLE ALWAYS TRIGGER "TaskMaterialReservationEntry_no_truncate";

CREATE FUNCTION "obrasaas_task_material_reservation_result"(
  p_transaction_id TEXT,
  p_replayed BOOLEAN
)
RETURNS TABLE (
  transaction_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  task_id TEXT,
  requirement_revision_id TEXT,
  transaction_type TEXT,
  transaction_version INTEGER,
  predecessor_id TEXT,
  actor_id TEXT,
  operation_key TEXT,
  request_fingerprint TEXT,
  reason TEXT,
  occurred_at TIMESTAMPTZ,
  required_line_count INTEGER,
  covered_line_count INTEGER,
  allocation_count INTEGER,
  readiness_state TEXT,
  available BOOLEAN,
  replayed BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  WITH transaction_row AS (
    SELECT transaction.*
      FROM "public"."TaskMaterialReservationTransaction" AS transaction
     WHERE transaction."id" = p_transaction_id
  ), counts AS (
    SELECT revision."lineCount"::integer AS required_lines,
           count(balance."requirementLineId")::integer AS balance_lines,
           count(balance."requirementLineId") FILTER (
             WHERE balance."reservedQuantity" = balance."requiredQuantity"
           )::integer AS covered_lines
      FROM transaction_row AS transaction
      JOIN "public"."TaskMaterialRequirementRevision" AS revision
        ON revision."organizationId" = transaction."organizationId"
       AND revision."projectId" = transaction."projectId"
       AND revision."taskId" = transaction."taskId"
       AND revision."id" = transaction."requirementRevisionId"
      LEFT JOIN "public"."TaskMaterialReservationBalance" AS balance
        ON balance."organizationId" = revision."organizationId"
       AND balance."projectId" = revision."projectId"
       AND balance."taskId" = revision."taskId"
       AND balance."requirementRevisionId" = revision."id"
     GROUP BY revision."lineCount"
  ), allocations AS (
    SELECT count(*)::integer AS allocation_rows
      FROM transaction_row AS transaction
      LEFT JOIN "public"."TaskMaterialReservationEntry" AS entry
        ON entry."organizationId" = transaction."organizationId"
       AND entry."projectId" = transaction."projectId"
       AND entry."taskId" = transaction."taskId"
        AND entry."transactionId" = transaction."id"
     WHERE entry."id" IS NOT NULL
  ), positive_allocations AS (
    SELECT entry."organizationId", entry."projectId", entry."inventoryItemId",
           entry."locationId", sum(entry."quantityDelta") AS reserved_quantity,
           count(*)::integer AS entry_rows
      FROM transaction_row AS transaction
      JOIN "public"."TaskMaterialReservationEntry" AS entry
        ON entry."organizationId" = transaction."organizationId"
       AND entry."projectId" = transaction."projectId"
       AND entry."taskId" = transaction."taskId"
       AND entry."transactionId" = transaction."id"
       AND entry."quantityDelta" > 0::numeric
     GROUP BY entry."organizationId", entry."projectId", entry."inventoryItemId",
              entry."locationId"
  ), projection_health AS (
    SELECT COALESCE(sum(allocation.entry_rows), 0)::integer AS positive_entry_rows,
           COALESCE(bool_and(
             item."id" IS NOT NULL
             AND item."active" IS TRUE
             AND location."id" IS NOT NULL
             AND location."active" IS TRUE
             AND availability."organizationId" IS NOT NULL
             AND inventory_balance."organizationId" IS NOT NULL
             AND availability."onHand" IS NOT DISTINCT FROM inventory_balance."onHand"
             AND availability."onHandRevision" IS NOT DISTINCT FROM inventory_balance."revision"
             AND availability."reserved" >= allocation.reserved_quantity
             AND availability."reserved" <= availability."onHand"
             AND availability."available" = availability."onHand" - availability."reserved"
           ), false) AS projection_healthy
      FROM positive_allocations AS allocation
      LEFT JOIN "public"."InventoryItem" AS item
        ON item."organizationId" = allocation."organizationId"
       AND item."projectId" = allocation."projectId"
       AND item."id" = allocation."inventoryItemId"
      LEFT JOIN "public"."InventoryLocation" AS location
        ON location."organizationId" = allocation."organizationId"
       AND location."projectId" = allocation."projectId"
       AND location."id" = allocation."locationId"
      LEFT JOIN "public"."InventoryAvailability" AS availability
        ON availability."organizationId" = allocation."organizationId"
       AND availability."projectId" = allocation."projectId"
       AND availability."inventoryItemId" = allocation."inventoryItemId"
       AND availability."locationId" = allocation."locationId"
      LEFT JOIN "public"."InventoryBalance" AS inventory_balance
        ON inventory_balance."organizationId" = allocation."organizationId"
       AND inventory_balance."projectId" = allocation."projectId"
       AND inventory_balance."inventoryItemId" = allocation."inventoryItemId"
       AND inventory_balance."locationId" = allocation."locationId"
  ), active_state AS (
    SELECT EXISTS (
      SELECT 1
        FROM transaction_row AS transaction
        JOIN "public"."TaskMaterialActiveReservation" AS active
          ON active."organizationId" = transaction."organizationId"
         AND active."projectId" = transaction."projectId"
         AND active."taskId" = transaction."taskId"
         AND active."reservationTransactionId" = transaction."id"
         AND active."requirementRevisionId" = transaction."requirementRevisionId"
         AND active."projectReservationEligibleSnapshot" IS TRUE
    ) AS matches_transaction
  )
  SELECT transaction."id",
         transaction."organizationId",
         transaction."projectId",
         transaction."taskId",
         transaction."requirementRevisionId",
         transaction."transactionType"::text,
         transaction."version",
         transaction."predecessorId",
         transaction."actorId",
         transaction."operationKey"::text,
         transaction."requestFingerprint"::text,
         transaction."reason"::text,
         transaction."occurredAt" AT TIME ZONE 'UTC',
         counts.required_lines,
         counts.covered_lines,
         allocations.allocation_rows,
         CASE
           WHEN counts.balance_lines <> counts.required_lines THEN 'REVIEW_REQUIRED'
           WHEN counts.required_lines > 0 AND counts.covered_lines = counts.required_lines
             THEN CASE WHEN transaction."transactionType" = 'RESERVE'
                         AND projection_health.positive_entry_rows = allocations.allocation_rows
                         AND projection_health.projection_healthy
                         AND active_state.matches_transaction
                       THEN 'AVAILABLE'
                       ELSE 'REVIEW_REQUIRED'
                  END
           ELSE 'DEFINED_UNRESERVED'
         END,
         counts.balance_lines = counts.required_lines
           AND counts.required_lines > 0
           AND counts.covered_lines = counts.required_lines
           AND transaction."transactionType" = 'RESERVE'
           AND projection_health.positive_entry_rows = allocations.allocation_rows
           AND projection_health.projection_healthy
           AND active_state.matches_transaction,
         p_replayed
    FROM transaction_row AS transaction
    CROSS JOIN counts
    CROSS JOIN allocations
    CROSS JOIN projection_health
    CROSS JOIN active_state;
$$;

-- Full-bundle reserve. There is deliberately no retry loop: serialization or
-- conditional-update conflicts return one stable error to the caller.
CREATE FUNCTION "obrasaas_task_material_reserve"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_task_id TEXT,
  p_requirement_revision_id TEXT,
  p_expected_reservation_head_id TEXT,
  p_actor_id TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_reason TEXT,
  p_allocations JSONB
)
RETURNS TABLE (
  transaction_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  task_id TEXT,
  requirement_revision_id TEXT,
  transaction_type TEXT,
  transaction_version INTEGER,
  predecessor_id TEXT,
  actor_id TEXT,
  operation_key TEXT,
  request_fingerprint TEXT,
  reason TEXT,
  occurred_at TIMESTAMPTZ,
  required_line_count INTEGER,
  covered_line_count INTEGER,
  allocation_count INTEGER,
  readiness_state TEXT,
  available BOOLEAN,
  replayed BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  existing_transaction RECORD;
  reservation_head RECORD;
  revision_row RECORD;
  allocation_rows INTEGER;
  joined_rows INTEGER;
  covered_lines INTEGER;
  duplicate_rows INTEGER;
  transaction_id_value TEXT;
  transaction_version_value INTEGER;
  operation_now TIMESTAMP(3);
BEGIN
  IF p_organization_id IS NULL OR btrim(p_organization_id) = ''
     OR p_project_id IS NULL OR btrim(p_project_id) = ''
     OR p_task_id IS NULL OR btrim(p_task_id) = ''
     OR p_requirement_revision_id IS NULL OR btrim(p_requirement_revision_id) = ''
     OR p_actor_id IS NULL OR btrim(p_actor_id) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID required identity';
  END IF;
  IF p_operation_key IS NULL
     OR p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     OR p_request_fingerprint IS NULL
     OR p_request_fingerprint !~ '^[0-9a-f]{64}$'
     OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 500
     OR p_reason <> btrim(p_reason) OR p_reason !~ '^[^[:cntrl:]]+$' THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID command metadata';
  END IF;
  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE allocations array';
  END IF;
  IF jsonb_array_length(p_allocations) < 1
     OR jsonb_array_length(p_allocations) > 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE allocations array';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_project_id, 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'task-material-requirement:' || p_project_id || ':' || p_task_id,
      0
    )
  );

  SELECT transaction.*
    INTO existing_transaction
    FROM "public"."TaskMaterialReservationTransaction" AS transaction
   WHERE transaction."projectId" = p_project_id
     AND transaction."operationKey" = p_operation_key
   FOR UPDATE;
  IF FOUND THEN
    IF existing_transaction."organizationId" IS DISTINCT FROM p_organization_id
       OR existing_transaction."taskId" IS DISTINCT FROM p_task_id
       OR existing_transaction."requirementRevisionId" IS DISTINCT FROM p_requirement_revision_id
       OR existing_transaction."transactionType" <> 'RESERVE'
       OR existing_transaction."predecessorId" IS DISTINCT FROM p_expected_reservation_head_id
       OR existing_transaction."actorId" IS DISTINCT FROM p_actor_id
       OR existing_transaction."requestFingerprint" IS DISTINCT FROM p_request_fingerprint
       OR existing_transaction."reason" IS DISTINCT FROM p_reason THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'IDEMPOTENCY_REPLAY_MUTATED reservation replay changed';
    END IF;
    RETURN QUERY
      SELECT * FROM "public"."obrasaas_task_material_reservation_result"(
        existing_transaction."id", true
      );
    RETURN;
  END IF;

  SELECT transaction."id", transaction."version", transaction."transactionType"::text
    INTO reservation_head
    FROM "public"."TaskMaterialReservationTransaction" AS transaction
   WHERE transaction."organizationId" = p_organization_id
     AND transaction."projectId" = p_project_id
     AND transaction."taskId" = p_task_id
   ORDER BY transaction."version" DESC
   LIMIT 1
   FOR UPDATE;
  IF (reservation_head."id" IS NULL AND p_expected_reservation_head_id IS NOT NULL)
     OR (reservation_head."id" IS NOT NULL
       AND reservation_head."id" IS DISTINCT FROM p_expected_reservation_head_id) THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_HEAD_STALE expected head mismatch';
  END IF;
  IF reservation_head."transactionType" = 'RESERVE' THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_HEAD_STALE active reservation exists';
  END IF;

  SELECT revision."kind"::text, revision."lineCount",
         EXISTS (
           SELECT 1 FROM "public"."TaskMaterialRequirementRevision" AS successor
            WHERE successor."organizationId" = revision."organizationId"
              AND successor."projectId" = revision."projectId"
              AND successor."taskId" = revision."taskId"
              AND successor."predecessorId" = revision."id"
         ) AS has_successor
    INTO revision_row
    FROM "public"."TaskMaterialRequirementRevision" AS revision
   WHERE revision."organizationId" = p_organization_id
     AND revision."projectId" = p_project_id
     AND revision."taskId" = p_task_id
     AND revision."id" = p_requirement_revision_id
   FOR UPDATE;
  IF NOT FOUND OR revision_row."kind" <> 'MATERIALS_REQUIRED' THEN
    RAISE EXCEPTION USING ERRCODE = '23503',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID requirement revision';
  END IF;
  IF revision_row.has_successor THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'TASK_MATERIAL_REQUIREMENT_HEAD_STALE requirement revision changed';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_allocations) AS allocation(value)
     WHERE jsonb_typeof(allocation.value) <> 'object'
        OR NOT allocation.value ?& ARRAY['requirementLineId', 'locationId', 'quantity']
        OR allocation.value - ARRAY['requirementLineId', 'locationId', 'quantity'] <> '{}'::jsonb
        OR jsonb_typeof(allocation.value->'requirementLineId') <> 'string'
        OR jsonb_typeof(allocation.value->'locationId') <> 'string'
        OR jsonb_typeof(allocation.value->'quantity') <> 'string'
        OR allocation.value->>'requirementLineId' = ''
        OR allocation.value->>'locationId' = ''
        OR allocation.value->>'quantity' !~ '^(0|[1-9][0-9]{0,10})[.][0-9]{3}$'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE allocation shape';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_allocations) AS allocation(value)
     WHERE (allocation.value->>'quantity')::numeric(14,3) <= 0::numeric
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE allocation quantity';
  END IF;

  WITH allocations AS (
    SELECT value->>'requirementLineId' AS line_id,
           value->>'locationId' AS location_id,
           (value->>'quantity')::numeric(14,3) AS quantity
      FROM jsonb_array_elements(p_allocations) AS allocation(value)
  )
  SELECT count(*)::integer,
         count(*)::integer - count(DISTINCT (line_id, location_id))::integer
    INTO allocation_rows, duplicate_rows
    FROM allocations;
  IF duplicate_rows <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE duplicate allocation';
  END IF;

  WITH allocations AS (
    SELECT value->>'requirementLineId' AS line_id,
           value->>'locationId' AS location_id,
           (value->>'quantity')::numeric(14,3) AS quantity
      FROM jsonb_array_elements(p_allocations) AS allocation(value)
  )
  SELECT count(*)::integer
    INTO joined_rows
    FROM allocations
    JOIN "public"."TaskMaterialRequirementLine" AS line
      ON line."organizationId" = p_organization_id
     AND line."projectId" = p_project_id
     AND line."taskId" = p_task_id
     AND line."revisionId" = p_requirement_revision_id
     AND line."id" = allocations.line_id
    JOIN "public"."InventoryLocation" AS location
      ON location."organizationId" = line."organizationId"
     AND location."projectId" = line."projectId"
     AND location."id" = allocations.location_id
     AND location."active" IS TRUE
    JOIN "public"."InventoryItem" AS item
      ON item."organizationId" = line."organizationId"
     AND item."projectId" = line."projectId"
     AND item."id" = line."inventoryItemId"
     AND item."baseUnit" = line."unitSnapshot"
     AND item."active" IS TRUE
    JOIN "public"."InventoryAvailability" AS availability
      ON availability."organizationId" = line."organizationId"
     AND availability."projectId" = line."projectId"
     AND availability."inventoryItemId" = line."inventoryItemId"
     AND availability."locationId" = allocations.location_id;
  IF joined_rows <> allocation_rows THEN
    RAISE EXCEPTION USING ERRCODE = '23503',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID allocation scope';
  END IF;

  WITH allocations AS (
    SELECT value->>'requirementLineId' AS line_id,
           (value->>'quantity')::numeric(14,3) AS quantity
      FROM jsonb_array_elements(p_allocations) AS allocation(value)
  ), coverage AS (
    SELECT line."id", line."requiredQuantity", COALESCE(sum(allocations.quantity), 0::numeric) AS allocated
      FROM "public"."TaskMaterialRequirementLine" AS line
      LEFT JOIN allocations ON allocations.line_id = line."id"
     WHERE line."organizationId" = p_organization_id
       AND line."projectId" = p_project_id
       AND line."taskId" = p_task_id
       AND line."revisionId" = p_requirement_revision_id
     GROUP BY line."id", line."requiredQuantity"
  )
  SELECT count(*) FILTER (WHERE allocated = "requiredQuantity")::integer
    INTO covered_lines
    FROM coverage;
  IF covered_lines IS DISTINCT FROM revision_row."lineCount" THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_BUNDLE_INCOMPLETE exact quantities required';
  END IF;

  transaction_id_value := gen_random_uuid()::text;
  transaction_version_value := COALESCE(reservation_head."version", 0) + 1;
  operation_now := clock_timestamp();
  PERFORM set_config(
    'obrasaas.task_material_reservation_transaction_id', transaction_id_value, true
  );
  INSERT INTO "public"."TaskMaterialReservationTransaction" (
    "id", "organizationId", "projectId", "taskId", "requirementRevisionId",
    "transactionType", "version", "predecessorId", "operationKey",
    "requestFingerprint", "actorId", "reason", "occurredAt", "createdAt"
  ) VALUES (
    transaction_id_value, p_organization_id, p_project_id, p_task_id,
    p_requirement_revision_id, 'RESERVE', transaction_version_value,
    reservation_head."id", p_operation_key, p_request_fingerprint, p_actor_id,
    p_reason, operation_now, operation_now
  );

  INSERT INTO "public"."TaskMaterialReservationEntry" (
    "id", "organizationId", "projectId", "taskId", "requirementRevisionId",
    "transactionId", "requirementLineId", "inventoryItemId", "locationId",
    "unitSnapshot", "quantityDelta", "reversesEntryId", "createdAt"
  )
  SELECT gen_random_uuid()::text, p_organization_id, p_project_id, p_task_id,
         p_requirement_revision_id, transaction_id_value, line."id",
         line."inventoryItemId", allocation.location_id, line."unitSnapshot",
         allocation.quantity, NULL, operation_now
    FROM (
      SELECT value->>'requirementLineId' AS line_id,
             value->>'locationId' AS location_id,
             (value->>'quantity')::numeric(14,3) AS quantity
        FROM jsonb_array_elements(p_allocations) AS item(value)
    ) AS allocation
    JOIN "public"."TaskMaterialRequirementLine" AS line
      ON line."organizationId" = p_organization_id
     AND line."projectId" = p_project_id
     AND line."taskId" = p_task_id
     AND line."revisionId" = p_requirement_revision_id
     AND line."id" = allocation.line_id
   ORDER BY line."inventoryItemId", allocation.location_id, line."id";

  PERFORM set_config('obrasaas.task_material_reservation_transaction_id', '', true);
  RETURN QUERY
    SELECT * FROM "public"."obrasaas_task_material_reservation_result"(
      transaction_id_value, false
    );
END;
$$;

CREATE FUNCTION "obrasaas_task_material_release"(
  p_organization_id TEXT,
  p_project_id TEXT,
  p_task_id TEXT,
  p_requirement_revision_id TEXT,
  p_expected_reservation_head_id TEXT,
  p_actor_id TEXT,
  p_operation_key TEXT,
  p_request_fingerprint TEXT,
  p_reason TEXT
)
RETURNS TABLE (
  transaction_id TEXT,
  organization_id TEXT,
  project_id TEXT,
  task_id TEXT,
  requirement_revision_id TEXT,
  transaction_type TEXT,
  transaction_version INTEGER,
  predecessor_id TEXT,
  actor_id TEXT,
  operation_key TEXT,
  request_fingerprint TEXT,
  reason TEXT,
  occurred_at TIMESTAMPTZ,
  required_line_count INTEGER,
  covered_line_count INTEGER,
  allocation_count INTEGER,
  readiness_state TEXT,
  available BOOLEAN,
  replayed BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  existing_transaction RECORD;
  reservation_head RECORD;
  transaction_id_value TEXT;
  operation_now TIMESTAMP(3);
BEGIN
  IF p_organization_id IS NULL OR btrim(p_organization_id) = ''
     OR p_project_id IS NULL OR btrim(p_project_id) = ''
     OR p_task_id IS NULL OR btrim(p_task_id) = ''
     OR p_requirement_revision_id IS NULL OR btrim(p_requirement_revision_id) = ''
     OR p_expected_reservation_head_id IS NULL OR btrim(p_expected_reservation_head_id) = ''
     OR p_actor_id IS NULL OR btrim(p_actor_id) = ''
     OR p_operation_key IS NULL
     OR p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     OR p_request_fingerprint IS NULL
     OR p_request_fingerprint !~ '^[0-9a-f]{64}$'
     OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 500
     OR p_reason <> btrim(p_reason) OR p_reason !~ '^[^[:cntrl:]]+$' THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_SCOPE_INVALID release input';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_project_id, 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'task-material-requirement:' || p_project_id || ':' || p_task_id,
      0
    )
  );

  SELECT transaction.*
    INTO existing_transaction
    FROM "public"."TaskMaterialReservationTransaction" AS transaction
   WHERE transaction."projectId" = p_project_id
     AND transaction."operationKey" = p_operation_key
   FOR UPDATE;
  IF FOUND THEN
    IF existing_transaction."organizationId" IS DISTINCT FROM p_organization_id
       OR existing_transaction."taskId" IS DISTINCT FROM p_task_id
       OR existing_transaction."requirementRevisionId" IS DISTINCT FROM p_requirement_revision_id
       OR existing_transaction."transactionType" <> 'RELEASE'
       OR existing_transaction."predecessorId" IS DISTINCT FROM p_expected_reservation_head_id
       OR existing_transaction."actorId" IS DISTINCT FROM p_actor_id
       OR existing_transaction."requestFingerprint" IS DISTINCT FROM p_request_fingerprint
       OR existing_transaction."reason" IS DISTINCT FROM p_reason THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'IDEMPOTENCY_REPLAY_MUTATED release replay changed';
    END IF;
    RETURN QUERY
      SELECT * FROM "public"."obrasaas_task_material_reservation_result"(
        existing_transaction."id", true
      );
    RETURN;
  END IF;

  SELECT transaction."id", transaction."version", transaction."transactionType"::text,
         transaction."requirementRevisionId"
    INTO reservation_head
    FROM "public"."TaskMaterialReservationTransaction" AS transaction
   WHERE transaction."organizationId" = p_organization_id
     AND transaction."projectId" = p_project_id
     AND transaction."taskId" = p_task_id
   ORDER BY transaction."version" DESC
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND
     OR reservation_head."id" IS DISTINCT FROM p_expected_reservation_head_id
     OR reservation_head."transactionType" <> 'RESERVE'
     OR reservation_head."requirementRevisionId" IS DISTINCT FROM p_requirement_revision_id THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID active head mismatch';
  END IF;

  transaction_id_value := gen_random_uuid()::text;
  operation_now := clock_timestamp();
  PERFORM set_config(
    'obrasaas.task_material_reservation_transaction_id', transaction_id_value, true
  );
  INSERT INTO "public"."TaskMaterialReservationTransaction" (
    "id", "organizationId", "projectId", "taskId", "requirementRevisionId",
    "transactionType", "version", "predecessorId", "operationKey",
    "requestFingerprint", "actorId", "reason", "occurredAt", "createdAt"
  ) VALUES (
    transaction_id_value, p_organization_id, p_project_id, p_task_id,
    p_requirement_revision_id, 'RELEASE', reservation_head."version" + 1,
    reservation_head."id", p_operation_key, p_request_fingerprint, p_actor_id,
    p_reason, operation_now, operation_now
  );

  INSERT INTO "public"."TaskMaterialReservationEntry" (
    "id", "organizationId", "projectId", "taskId", "requirementRevisionId",
    "transactionId", "requirementLineId", "inventoryItemId", "locationId",
    "unitSnapshot", "quantityDelta", "reversesEntryId", "createdAt"
  )
  SELECT gen_random_uuid()::text, original."organizationId", original."projectId",
         original."taskId", original."requirementRevisionId", transaction_id_value,
         original."requirementLineId", original."inventoryItemId", original."locationId",
         original."unitSnapshot", -original."quantityDelta", original."id", operation_now
    FROM "public"."TaskMaterialReservationEntry" AS original
   WHERE original."organizationId" = p_organization_id
     AND original."projectId" = p_project_id
     AND original."taskId" = p_task_id
     AND original."transactionId" = reservation_head."id"
   ORDER BY original."inventoryItemId", original."locationId", original."requirementLineId";

  IF EXISTS (
    SELECT 1
      FROM "public"."TaskMaterialReservationBalance" AS balance
     WHERE balance."organizationId" = p_organization_id
       AND balance."projectId" = p_project_id
       AND balance."taskId" = p_task_id
       AND balance."requirementRevisionId" = p_requirement_revision_id
       AND balance."reservedQuantity" <> 0::numeric
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'TASK_MATERIAL_RESERVATION_RELEASE_INVALID nonzero line balance';
  END IF;

  PERFORM set_config('obrasaas.task_material_reservation_transaction_id', '', true);
  RETURN QUERY
    SELECT * FROM "public"."obrasaas_task_material_reservation_result"(
      transaction_id_value, false
    );
END;
$$;
