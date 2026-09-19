BEGIN;
-- CreateTable
CREATE TABLE "InspectionRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "technicalReference" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentHash" VARCHAR(64) NOT NULL,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionRevision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "previousHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InspectionRecord_list_idx" ON "InspectionRecord"("projectId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionRecord_scope_key" ON "InspectionRecord"("organizationId", "projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionRecord_request_key" ON "InspectionRecord"("projectId", "clientRequestId");

-- CreateIndex
CREATE INDEX "InspectionRevision_scope_idx" ON "InspectionRevision"("organizationId", "projectId", "inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionRevision_version_key" ON "InspectionRevision"("inspectionId", "version");

-- AddForeignKey
ALTER TABLE "InspectionRecord" ADD CONSTRAINT "InspectionRecord_organizationId_projectId_fkey" FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRecord" ADD CONSTRAINT "InspectionRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRecord" ADD CONSTRAINT "InspectionRecord_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRevision" ADD CONSTRAINT "InspectionRevision_organizationId_projectId_inspectionId_fkey" FOREIGN KEY ("organizationId", "projectId", "inspectionId") REFERENCES "InspectionRecord"("organizationId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRevision" ADD CONSTRAINT "InspectionRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defensive constraints supplement server-side validation.
ALTER TABLE "InspectionRecord" ADD CONSTRAINT "InspectionRecord_status_check"
  CHECK ("status" IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'OBSERVED', 'REJECTED'));
ALTER TABLE "InspectionRecord" ADD CONSTRAINT "InspectionRecord_version_check"
  CHECK ("version" > 0 AND "templateVersion" > 0);
ALTER TABLE "InspectionRecord" ADD CONSTRAINT "InspectionRecord_checklist_check"
  CHECK (jsonb_typeof("checklist") = 'array' AND jsonb_array_length("checklist") BETWEEN 1 AND 40);
ALTER TABLE "InspectionRecord" ADD CONSTRAINT "InspectionRecord_review_check" CHECK (
  CASE WHEN "status" IN ('APPROVED', 'OBSERVED', 'REJECTED') THEN
    "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND length(trim(coalesce("reviewNotes", ''))) > 0
  ELSE "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "reviewNotes" IS NULL END
);
ALTER TABLE "InspectionRevision" ADD CONSTRAINT "InspectionRevision_version_check" CHECK ("version" > 0);
CREATE FUNCTION "inspection_revision_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Inspection revisions are append-only' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER "InspectionRevision_append_only"
  BEFORE UPDATE OR DELETE ON "InspectionRevision"
  FOR EACH ROW EXECUTE FUNCTION "inspection_revision_append_only"();
CREATE FUNCTION "inspection_record_transition_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Inspection records cannot be deleted' USING ERRCODE = '55000'; END IF;
  IF OLD."status" IN ('APPROVED', 'REJECTED') THEN RAISE EXCEPTION 'Final inspection is read-only' USING ERRCODE = '55000'; END IF;
  IF ROW(NEW."id", NEW."organizationId", NEW."projectId", NEW."createdById", NEW."clientRequestId", NEW."requestHash", NEW."templateKey", NEW."templateVersion", NEW."createdAt") IS DISTINCT FROM
     ROW(OLD."id", OLD."organizationId", OLD."projectId", OLD."createdById", OLD."clientRequestId", OLD."requestHash", OLD."templateKey", OLD."templateVersion", OLD."createdAt")
  THEN RAISE EXCEPTION 'Inspection identity is immutable' USING ERRCODE = '55000'; END IF;
  IF NEW."version" <> OLD."version" + 1 THEN RAISE EXCEPTION 'Inspection version must increase once' USING ERRCODE = '55000'; END IF;
  IF NOT ((OLD."status" = 'DRAFT' AND NEW."status" IN ('DRAFT', 'SUBMITTED')) OR
          (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('APPROVED', 'OBSERVED', 'REJECTED')) OR
          (OLD."status" = 'OBSERVED' AND NEW."status" = 'DRAFT'))
  THEN RAISE EXCEPTION 'Invalid inspection transition' USING ERRCODE = '55000'; END IF;
  IF NOT (OLD."status" = 'DRAFT' AND NEW."status" = 'DRAFT') AND
    ROW(NEW."title", NEW."location", NEW."technicalReference", NEW."notes", NEW."checklist") IS DISTINCT FROM
    ROW(OLD."title", OLD."location", OLD."technicalReference", OLD."notes", OLD."checklist")
  THEN RAISE EXCEPTION 'Inspection content can change only in draft' USING ERRCODE = '55000'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InspectionRecord_transition_guard" BEFORE UPDATE OR DELETE ON "InspectionRecord"
  FOR EACH ROW EXECUTE FUNCTION "inspection_record_transition_guard"();

COMMIT;
