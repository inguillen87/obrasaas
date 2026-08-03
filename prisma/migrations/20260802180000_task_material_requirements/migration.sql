-- S12.2B publishes an immutable, versioned bill of materials per canonical
-- task. It deliberately does not infer requirements from purchase orders,
-- supplier commitments, descriptions, photos, AI, email or legacy stockpiles.
-- Reservations and AVAILABLE remain outside this migration.

CREATE TYPE "TaskMaterialRequirementKind" AS ENUM (
  'MATERIALS_REQUIRED',
  'NO_MATERIALS_REQUIRED'
);

-- Referential integrity, rather than trigger snapshot visibility, is the
-- authoritative fence that keeps requirement history attached to a canonical
-- task identity under concurrent direct SQL writes.
ALTER TABLE "Task"
  ADD COLUMN "materialRequirementEligible" BOOLEAN
  GENERATED ALWAYS AS (
    "type" = 'TASK'
    AND COALESCE("metadata"->>'source', '') = 'canonical-task-v1'
  ) STORED;

CREATE UNIQUE INDEX "Task_material_requirement_identity_key"
  ON "Task"("projectId", "id", "materialRequirementEligible");

CREATE TABLE "TaskMaterialRequirementRevision" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "taskIdentitySnapshot" BOOLEAN NOT NULL DEFAULT TRUE,
  "kind" "TaskMaterialRequirementKind" NOT NULL,
  "version" INTEGER NOT NULL,
  "lineCount" INTEGER NOT NULL,
  "taskRevisionSnapshot" INTEGER NOT NULL,
  "taskCodeSnapshot" VARCHAR(64),
  "taskTitleSnapshot" VARCHAR(160) NOT NULL,
  "taskStartsAtSnapshot" TIMESTAMP(3),
  "taskEndsAtSnapshot" TIMESTAMP(3),
  "predecessorId" TEXT,
  "operationKey" VARCHAR(190) NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "authoredById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskMaterialRequirementRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskMaterialRequirementRevision_version_check" CHECK (
    "version" >= 1
    AND "taskRevisionSnapshot" >= 0
  ),
  CONSTRAINT "TaskMaterialRequirementRevision_task_identity_check" CHECK (
    "taskIdentitySnapshot" IS TRUE
  ),
  CONSTRAINT "TaskMaterialRequirementRevision_shape_check" CHECK (
    (
      "kind" = 'MATERIALS_REQUIRED'
      AND "lineCount" BETWEEN 1 AND 200
    )
    OR
    (
      "kind" = 'NO_MATERIALS_REQUIRED'
      AND "lineCount" = 0
    )
  ),
  CONSTRAINT "TaskMaterialRequirementRevision_task_snapshot_check" CHECK (
    ("taskCodeSnapshot" IS NULL OR (
      char_length("taskCodeSnapshot") BETWEEN 1 AND 64
      AND "taskCodeSnapshot" = btrim("taskCodeSnapshot")
    ))
    AND char_length("taskTitleSnapshot") BETWEEN 1 AND 160
    AND "taskTitleSnapshot" = btrim("taskTitleSnapshot")
    AND (
      "taskStartsAtSnapshot" IS NULL
      OR "taskEndsAtSnapshot" IS NULL
      OR "taskEndsAtSnapshot" >= "taskStartsAtSnapshot"
    )
  ),
  CONSTRAINT "TaskMaterialRequirementRevision_operation_key_check" CHECK (
    char_length("operationKey") BETWEEN 8 AND 128
    AND "operationKey" = btrim("operationKey")
    AND "operationKey" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  ),
  CONSTRAINT "TaskMaterialRequirementRevision_fingerprint_check" CHECK (
    "requestFingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "TaskMaterialRequirementRevision_reason_check" CHECK (
    char_length("reason") BETWEEN 3 AND 500
    AND "reason" = btrim("reason")
    AND "reason" ~ '^[^[:cntrl:]]+$'
  )
);

CREATE TABLE "TaskMaterialRequirementLine" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "requiredQuantity" DECIMAL(14,3) NOT NULL,
  "itemCodeSnapshot" VARCHAR(32) NOT NULL,
  "itemNameSnapshot" VARCHAR(160) NOT NULL,
  "unitSnapshot" VARCHAR(32) NOT NULL,
  "notes" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskMaterialRequirementLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskMaterialRequirementLine_quantity_check" CHECK (
    "requiredQuantity" > 0::numeric
    AND "requiredQuantity" <> 'NaN'::numeric
  ),
  CONSTRAINT "TaskMaterialRequirementLine_item_snapshot_check" CHECK (
    char_length("itemCodeSnapshot") BETWEEN 1 AND 32
    AND "itemCodeSnapshot" = btrim("itemCodeSnapshot")
    AND char_length("itemNameSnapshot") BETWEEN 1 AND 160
    AND "itemNameSnapshot" = btrim("itemNameSnapshot")
    AND char_length("unitSnapshot") BETWEEN 1 AND 32
    AND "unitSnapshot" = btrim("unitSnapshot")
    AND "unitSnapshot" ~ '^[^[:cntrl:]]+$'
  ),
  CONSTRAINT "TaskMaterialRequirementLine_notes_check" CHECK (
    "notes" IS NULL OR (
      char_length("notes") BETWEEN 1 AND 500
      AND "notes" = btrim("notes")
      AND "notes" ~ '^[^[:cntrl:]]+$'
    )
  )
);

CREATE UNIQUE INDEX "TaskMaterialRequirementRevision_scope_id_key"
  ON "TaskMaterialRequirementRevision"("organizationId", "projectId", "taskId", "id");
CREATE UNIQUE INDEX "TaskMaterialRequirementRevision_task_version_key"
  ON "TaskMaterialRequirementRevision"("projectId", "taskId", "version");
CREATE UNIQUE INDEX "TaskMaterialRequirementRevision_predecessor_key"
  ON "TaskMaterialRequirementRevision"(
    "organizationId", "projectId", "taskId", "predecessorId"
  );
CREATE UNIQUE INDEX "TaskMaterialRequirementRevision_operation_key"
  ON "TaskMaterialRequirementRevision"("projectId", "operationKey");
CREATE UNIQUE INDEX "TaskMaterialRequirementRevision_root_key"
  ON "TaskMaterialRequirementRevision"("organizationId", "projectId", "taskId")
  WHERE "predecessorId" IS NULL;
CREATE INDEX "TaskMaterialRequirementRevision_task_created_idx"
  ON "TaskMaterialRequirementRevision"("projectId", "taskId", "createdAt");

CREATE UNIQUE INDEX "TaskMaterialRequirementLine_scope_id_key"
  ON "TaskMaterialRequirementLine"(
    "organizationId", "projectId", "taskId", "revisionId", "id"
  );
CREATE UNIQUE INDEX "TaskMaterialRequirementLine_revision_item_key"
  ON "TaskMaterialRequirementLine"("projectId", "revisionId", "inventoryItemId");
CREATE INDEX "TaskMaterialRequirementLine_task_item_idx"
  ON "TaskMaterialRequirementLine"("projectId", "taskId", "inventoryItemId");

ALTER TABLE "TaskMaterialRequirementRevision"
  ADD CONSTRAINT "TaskMaterialRequirementRevision_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialRequirementRevision"
  ADD CONSTRAINT "TaskMaterialRequirementRevision_project_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialRequirementRevision"
  ADD CONSTRAINT "TaskMaterialRequirementRevision_task_fkey"
  FOREIGN KEY ("projectId", "taskId", "taskIdentitySnapshot")
  REFERENCES "Task"("projectId", "id", "materialRequirementEligible")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialRequirementRevision"
  ADD CONSTRAINT "TaskMaterialRequirementRevision_authoredById_fkey"
  FOREIGN KEY ("authoredById") REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialRequirementRevision"
  ADD CONSTRAINT "TaskMaterialRequirementRevision_predecessor_fkey"
  FOREIGN KEY ("organizationId", "projectId", "taskId", "predecessorId")
  REFERENCES "TaskMaterialRequirementRevision"(
    "organizationId", "projectId", "taskId", "id"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "TaskMaterialRequirementLine"
  ADD CONSTRAINT "TaskMaterialRequirementLine_revision_fkey"
  FOREIGN KEY ("organizationId", "projectId", "taskId", "revisionId")
  REFERENCES "TaskMaterialRequirementRevision"(
    "organizationId", "projectId", "taskId", "id"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TaskMaterialRequirementLine"
  ADD CONSTRAINT "TaskMaterialRequirementLine_item_fkey"
  FOREIGN KEY ("organizationId", "projectId", "inventoryItemId", "unitSnapshot")
  REFERENCES "InventoryItem"("organizationId", "projectId", "id", "baseUnit")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION "obrasaas_task_material_requirement_append_only"()
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

CREATE FUNCTION "obrasaas_task_material_requirement_no_truncate"()
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

CREATE FUNCTION "obrasaas_task_material_requirement_revision_insert_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  task_revision INTEGER;
  task_code TEXT;
  task_title TEXT;
  task_starts_at TIMESTAMP(3);
  task_ends_at TIMESTAMP(3);
  actor_is_active BOOLEAN;
  existing_revision_count INTEGER;
  predecessor_version INTEGER;
  successor_exists BOOLEAN;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'task-material-requirement:' || NEW."projectId" || ':' || NEW."taskId",
      0
    )
  );

  EXECUTE format(
    'SELECT task."revision", task."code", task."title", task."startsAt", task."endsAt"
       FROM %I."Task" AS task
       JOIN %I."Project" AS project ON project."id" = task."projectId"
      WHERE project."organizationId" = $1
        AND task."projectId" = $2
        AND task."id" = $3
        AND task."type" = ''TASK''
        AND task."status" <> ''DONE''
        AND task."metadata"->>''source'' = ''canonical-task-v1''',
    TG_TABLE_SCHEMA, TG_TABLE_SCHEMA
  ) INTO task_revision, task_code, task_title, task_starts_at, task_ends_at
  USING NEW."organizationId", NEW."projectId", NEW."taskId";

  IF task_revision IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Task material requirements require an active canonical task';
  END IF;
  IF NEW."taskRevisionSnapshot" IS DISTINCT FROM task_revision
     OR NEW."taskCodeSnapshot" IS DISTINCT FROM task_code
     OR NEW."taskTitleSnapshot" IS DISTINCT FROM task_title
     OR NEW."taskStartsAtSnapshot" IS DISTINCT FROM task_starts_at
     OR NEW."taskEndsAtSnapshot" IS DISTINCT FROM task_ends_at THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Task material requirement task snapshot is not authoritative';
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."TenantMembership"
        WHERE "organizationId" = $1
          AND "userId" = $2
          AND "status" = ''ACTIVE''
     )',
    TG_TABLE_SCHEMA
  ) INTO actor_is_active USING NEW."organizationId", NEW."authoredById";
  IF NOT actor_is_active THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Task material requirement author is not an active tenant member';
  END IF;

  IF NEW."predecessorId" IS NULL THEN
    EXECUTE format(
      'SELECT count(*)::integer
         FROM %I."TaskMaterialRequirementRevision"
        WHERE "organizationId" = $1
          AND "projectId" = $2
          AND "taskId" = $3',
      TG_TABLE_SCHEMA
    ) INTO existing_revision_count
    USING NEW."organizationId", NEW."projectId", NEW."taskId";
    IF NEW."version" <> 1 OR existing_revision_count <> 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Task material requirement root must be the only version 1';
    END IF;
  ELSE
    EXECUTE format(
      'SELECT "version"
         FROM %I."TaskMaterialRequirementRevision"
        WHERE "organizationId" = $1
          AND "projectId" = $2
          AND "taskId" = $3
          AND "id" = $4
        FOR UPDATE',
      TG_TABLE_SCHEMA
    ) INTO predecessor_version
    USING NEW."organizationId", NEW."projectId", NEW."taskId", NEW."predecessorId";
    IF predecessor_version IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'Task material requirement predecessor is outside the task scope';
    END IF;
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1 FROM %I."TaskMaterialRequirementRevision"
          WHERE "organizationId" = $1
            AND "projectId" = $2
            AND "taskId" = $3
            AND "predecessorId" = $4
       )',
      TG_TABLE_SCHEMA
    ) INTO successor_exists
    USING NEW."organizationId", NEW."projectId", NEW."taskId", NEW."predecessorId";
    IF successor_exists OR NEW."version" <> predecessor_version + 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'Task material requirement must extend the current head by one version';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_task_material_requirement_line_insert_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  revision_kind TEXT;
  expected_line_count INTEGER;
  current_line_count INTEGER;
  item_code TEXT;
  item_name TEXT;
  item_unit TEXT;
  item_active BOOLEAN;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'task-material-requirement:' || NEW."projectId" || ':' || NEW."taskId",
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
    'SELECT "kind"::text, "lineCount"
       FROM %I."TaskMaterialRequirementRevision"
      WHERE "organizationId" = $1
        AND "projectId" = $2
        AND "taskId" = $3
        AND "id" = $4',
    TG_TABLE_SCHEMA
  ) INTO revision_kind, expected_line_count
  USING NEW."organizationId", NEW."projectId", NEW."taskId", NEW."revisionId";
  IF revision_kind IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Task material requirement line revision scope is invalid';
  END IF;
  IF revision_kind <> 'MATERIALS_REQUIRED' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'NO_MATERIALS_REQUIRED revisions cannot contain lines';
  END IF;

  EXECUTE format(
    'SELECT "code", "name", "baseUnit", "active"
       FROM %I."InventoryItem"
      WHERE "organizationId" = $1
        AND "projectId" = $2
        AND "id" = $3',
    TG_TABLE_SCHEMA
  ) INTO item_code, item_name, item_unit, item_active
  USING NEW."organizationId", NEW."projectId", NEW."inventoryItemId";
  IF item_code IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Task material requirement item scope is invalid';
  END IF;
  IF NOT item_active THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Task material requirements require active inventory items';
  END IF;
  IF NEW."itemCodeSnapshot" IS DISTINCT FROM item_code
     OR NEW."itemNameSnapshot" IS DISTINCT FROM item_name
     OR NEW."unitSnapshot" IS DISTINCT FROM item_unit THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Task material requirement item snapshot is not authoritative';
  END IF;

  EXECUTE format(
    'SELECT count(*)::integer
       FROM %I."TaskMaterialRequirementLine"
      WHERE "organizationId" = $1
        AND "projectId" = $2
        AND "taskId" = $3
        AND "revisionId" = $4',
    TG_TABLE_SCHEMA
  ) INTO current_line_count
  USING NEW."organizationId", NEW."projectId", NEW."taskId", NEW."revisionId";
  IF current_line_count >= expected_line_count THEN
    RAISE EXCEPTION USING
      ERRCODE = '54000',
      MESSAGE = 'Task material requirement line count exceeds the published bundle';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_task_material_requirement_snapshot_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  target_organization_id TEXT;
  target_project_id TEXT;
  target_task_id TEXT;
  target_revision_id TEXT;
  revision_kind TEXT;
  expected_line_count INTEGER;
  actual_line_count INTEGER;
BEGIN
  target_organization_id := NEW."organizationId";
  target_project_id := NEW."projectId";
  target_task_id := NEW."taskId";
  IF TG_TABLE_NAME = 'TaskMaterialRequirementRevision' THEN
    target_revision_id := NEW."id";
  ELSE
    target_revision_id := NEW."revisionId";
  END IF;

  EXECUTE format(
    'SELECT "kind"::text, "lineCount"
       FROM %I."TaskMaterialRequirementRevision"
      WHERE "organizationId" = $1
        AND "projectId" = $2
        AND "taskId" = $3
        AND "id" = $4',
    TG_TABLE_SCHEMA
  ) INTO revision_kind, expected_line_count
  USING target_organization_id, target_project_id, target_task_id, target_revision_id;
  IF revision_kind IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Task material requirement bundle lost its revision';
  END IF;

  EXECUTE format(
    'SELECT count(*)::integer
       FROM %I."TaskMaterialRequirementLine"
      WHERE "organizationId" = $1
        AND "projectId" = $2
        AND "taskId" = $3
        AND "revisionId" = $4',
    TG_TABLE_SCHEMA
  ) INTO actual_line_count
  USING target_organization_id, target_project_id, target_task_id, target_revision_id;

  IF actual_line_count <> expected_line_count
     OR (revision_kind = 'MATERIALS_REQUIRED' AND actual_line_count < 1)
     OR (revision_kind = 'NO_MATERIALS_REQUIRED' AND actual_line_count <> 0) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Task material requirement bundle must match its declared mode and line count exactly';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "obrasaas_task_material_requirement_task_guard"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  requirement_exists BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."id" IS NOT DISTINCT FROM NEW."id"
     AND OLD."projectId" IS NOT DISTINCT FROM NEW."projectId"
     AND OLD."type" IS NOT DISTINCT FROM NEW."type"
     AND OLD."metadata"->>'source' IS NOT DISTINCT FROM NEW."metadata"->>'source' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'task-material-requirement:' || OLD."projectId" || ':' || OLD."id",
      0
    )
  );

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1 FROM %I."TaskMaterialRequirementRevision"
        WHERE "projectId" = $1 AND "taskId" = $2
     )',
    TG_TABLE_SCHEMA
  ) INTO requirement_exists USING OLD."projectId", OLD."id";
  IF requirement_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Task with material requirement history cannot be deleted or lose canonical identity';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "TaskMaterialRequirementRevision_insert_guard"
BEFORE INSERT ON "TaskMaterialRequirementRevision"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_requirement_revision_insert_guard"();
CREATE TRIGGER "TaskMaterialRequirementRevision_append_only"
BEFORE UPDATE OR DELETE ON "TaskMaterialRequirementRevision"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_requirement_append_only"();
CREATE TRIGGER "TaskMaterialRequirementRevision_no_truncate"
BEFORE TRUNCATE ON "TaskMaterialRequirementRevision"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_task_material_requirement_no_truncate"();
CREATE CONSTRAINT TRIGGER "TaskMaterialRequirementRevision_snapshot_guard"
AFTER INSERT ON "TaskMaterialRequirementRevision"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_requirement_snapshot_guard"();

CREATE TRIGGER "TaskMaterialRequirementLine_insert_guard"
BEFORE INSERT ON "TaskMaterialRequirementLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_requirement_line_insert_guard"();
CREATE TRIGGER "TaskMaterialRequirementLine_append_only"
BEFORE UPDATE OR DELETE ON "TaskMaterialRequirementLine"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_requirement_append_only"();
CREATE TRIGGER "TaskMaterialRequirementLine_no_truncate"
BEFORE TRUNCATE ON "TaskMaterialRequirementLine"
FOR EACH STATEMENT EXECUTE FUNCTION "obrasaas_task_material_requirement_no_truncate"();
CREATE CONSTRAINT TRIGGER "TaskMaterialRequirementLine_snapshot_guard"
AFTER INSERT ON "TaskMaterialRequirementLine"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_requirement_snapshot_guard"();

CREATE TRIGGER "Task_material_requirement_update_guard"
BEFORE UPDATE OF "id", "projectId", "type", "metadata" ON "Task"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_requirement_task_guard"();
CREATE TRIGGER "Task_material_requirement_delete_guard"
BEFORE DELETE ON "Task"
FOR EACH ROW EXECUTE FUNCTION "obrasaas_task_material_requirement_task_guard"();

ALTER TABLE "TaskMaterialRequirementRevision" ENABLE ALWAYS TRIGGER "TaskMaterialRequirementRevision_insert_guard";
ALTER TABLE "TaskMaterialRequirementRevision" ENABLE ALWAYS TRIGGER "TaskMaterialRequirementRevision_append_only";
ALTER TABLE "TaskMaterialRequirementRevision" ENABLE ALWAYS TRIGGER "TaskMaterialRequirementRevision_no_truncate";
ALTER TABLE "TaskMaterialRequirementRevision" ENABLE ALWAYS TRIGGER "TaskMaterialRequirementRevision_snapshot_guard";
ALTER TABLE "TaskMaterialRequirementLine" ENABLE ALWAYS TRIGGER "TaskMaterialRequirementLine_insert_guard";
ALTER TABLE "TaskMaterialRequirementLine" ENABLE ALWAYS TRIGGER "TaskMaterialRequirementLine_append_only";
ALTER TABLE "TaskMaterialRequirementLine" ENABLE ALWAYS TRIGGER "TaskMaterialRequirementLine_no_truncate";
ALTER TABLE "TaskMaterialRequirementLine" ENABLE ALWAYS TRIGGER "TaskMaterialRequirementLine_snapshot_guard";
ALTER TABLE "Task" ENABLE ALWAYS TRIGGER "Task_material_requirement_update_guard";
ALTER TABLE "Task" ENABLE ALWAYS TRIGGER "Task_material_requirement_delete_guard";
