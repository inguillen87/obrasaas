CREATE TYPE "ProgressEvidenceCaptureStatus" AS ENUM (
  'AWAITING_LOCATION',
  'LOCATION_CAPTURED',
  'CONSUMED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TYPE "ProgressEvidenceLocationSource" AS ENUM (
  'WEBVIEW_GEOLOCATION',
  'WHATSAPP_DECLARED'
);

CREATE TYPE "ProgressEvidenceLocationVerification" AS ENUM (
  'IN_GEOFENCE',
  'REVIEW_REQUIRED',
  'DECLARED_ONLY'
);

CREATE TABLE "ProgressEvidenceCaptureSession" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "status" "ProgressEvidenceCaptureStatus" NOT NULL DEFAULT 'AWAITING_LOCATION',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "tokenHash" CHAR(64) NOT NULL,
  "privacyNoticeVersion" VARCHAR(64) NOT NULL,
  "privacyNoticeContentSha256" CHAR(64) NOT NULL,
  "privacyAcceptedAt" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "locationCapturedAt" TIMESTAMP(3),
  "locationReceivedAt" TIMESTAMP(3),
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "accuracyMeters" DECIMAL(9,2),
  "locationSource" "ProgressEvidenceLocationSource",
  "locationVerification" "ProgressEvidenceLocationVerification",
  "distanceMeters" DECIMAL(10,2),
  "geofenceRadiusMeters" DECIMAL(10,2),
  "operationKeyHash" CHAR(64),
  "requestFingerprint" CHAR(64),
  "consumedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProgressEvidenceCaptureSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgressEvidenceCaptureSession_hashes_check" CHECK (
    "tokenHash" ~ '^[0-9a-f]{64}$'
    AND "privacyNoticeContentSha256" ~ '^[0-9a-f]{64}$'
    AND ("operationKeyHash" IS NULL OR "operationKeyHash" ~ '^[0-9a-f]{64}$')
    AND ("requestFingerprint" IS NULL OR "requestFingerprint" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "ProgressEvidenceCaptureSession_metadata_check" CHECK (
    "revision" >= 0
    AND char_length(btrim("privacyNoticeVersion")) BETWEEN 1 AND 64
    AND "privacyNoticeVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND (("operationKeyHash" IS NULL) = ("requestFingerprint" IS NULL))
    AND (("locationCapturedAt" IS NULL) = ("operationKeyHash" IS NULL))
  ),
  CONSTRAINT "ProgressEvidenceCaptureSession_location_bundle_check" CHECK (
    (
      "locationCapturedAt" IS NULL
      AND "locationReceivedAt" IS NULL
      AND "privacyAcceptedAt" IS NULL
      AND "latitude" IS NULL
      AND "longitude" IS NULL
      AND "accuracyMeters" IS NULL
      AND "locationSource" IS NULL
      AND "locationVerification" IS NULL
      AND "distanceMeters" IS NULL
      AND "geofenceRadiusMeters" IS NULL
    )
    OR (
      "locationCapturedAt" IS NOT NULL
      AND "locationReceivedAt" IS NOT NULL
      AND "privacyAcceptedAt" IS NOT NULL
      AND "latitude" BETWEEN -90 AND 90
      AND "longitude" BETWEEN -180 AND 180
      AND "locationSource" IS NOT NULL
      AND "locationVerification" IS NOT NULL
      AND "locationCapturedAt" >= "issuedAt" - INTERVAL '2 minutes'
      AND "locationCapturedAt" <= "locationReceivedAt" + INTERVAL '2 minutes'
      AND "locationReceivedAt" >= "issuedAt"
      AND "locationReceivedAt" <= "expiresAt"
      AND "privacyAcceptedAt" >= "issuedAt"
      AND "privacyAcceptedAt" <= "locationReceivedAt"
      AND (
        (
          "locationSource" = 'WEBVIEW_GEOLOCATION'
          AND "accuracyMeters" BETWEEN 0.01 AND 10000
          AND "locationVerification" IN ('IN_GEOFENCE', 'REVIEW_REQUIRED')
          AND (
            (
              "locationVerification" = 'IN_GEOFENCE'
              AND "distanceMeters" BETWEEN 0 AND 20050000
              AND "geofenceRadiusMeters" BETWEEN 1 AND 100000
              AND "distanceMeters" + "accuracyMeters" <= "geofenceRadiusMeters"
            )
            OR (
              "locationVerification" = 'REVIEW_REQUIRED'
              AND (
                ("distanceMeters" IS NULL AND "geofenceRadiusMeters" IS NULL)
                OR (
                  "distanceMeters" BETWEEN 0 AND 20050000
                  AND "geofenceRadiusMeters" BETWEEN 1 AND 100000
                )
              )
            )
          )
        )
        OR (
          "locationSource" = 'WHATSAPP_DECLARED'
          AND "accuracyMeters" IS NULL
          AND "distanceMeters" IS NULL
          AND "geofenceRadiusMeters" IS NULL
          AND "locationVerification" = 'DECLARED_ONLY'
        )
      )
    )
  ),
  CONSTRAINT "ProgressEvidenceCaptureSession_state_check" CHECK (
    (
      "status" = 'AWAITING_LOCATION'
      AND "locationCapturedAt" IS NULL
      AND "mediaAssetId" IS NOT NULL
      AND "consumedAt" IS NULL
      AND "expiredAt" IS NULL
      AND "cancelledAt" IS NULL
    )
    OR (
      "status" = 'LOCATION_CAPTURED'
      AND "locationCapturedAt" IS NOT NULL
      AND "mediaAssetId" IS NOT NULL
      AND "consumedAt" IS NULL
      AND "expiredAt" IS NULL
      AND "cancelledAt" IS NULL
    )
    OR (
      "status" = 'CONSUMED'
      AND "locationCapturedAt" IS NOT NULL
      AND "mediaAssetId" IS NOT NULL
      AND "consumedAt" IS NOT NULL
      AND "expiredAt" IS NULL
      AND "cancelledAt" IS NULL
    )
    OR (
      "status" = 'EXPIRED'
      AND "locationCapturedAt" IS NULL
      AND "mediaAssetId" IS NOT NULL
      AND "consumedAt" IS NULL
      AND "expiredAt" IS NOT NULL
      AND "cancelledAt" IS NULL
    )
    OR (
      "status" = 'CANCELLED'
      AND "locationCapturedAt" IS NULL
      AND "mediaAssetId" IS NOT NULL
      AND "consumedAt" IS NULL
      AND "expiredAt" IS NULL
      AND "cancelledAt" IS NOT NULL
    )
  ),
  CONSTRAINT "ProgressEvidenceCaptureSession_timestamps_check" CHECK (
    "expiresAt" > "issuedAt"
    AND "expiresAt" <= "issuedAt" + INTERVAL '30 minutes'
    AND "updatedAt" >= "createdAt"
    AND ("consumedAt" IS NULL OR (
      "locationReceivedAt" IS NOT NULL
      AND "consumedAt" >= "locationReceivedAt"
    ))
    AND ("expiredAt" IS NULL OR "expiredAt" >= "expiresAt")
    AND ("cancelledAt" IS NULL OR (
      "cancelledAt" >= "issuedAt"
      AND "cancelledAt" <= "expiresAt"
    ))
  )
);

CREATE UNIQUE INDEX "ProgressEvidenceCaptureSession_project_id_key"
  ON "ProgressEvidenceCaptureSession"("projectId", "id");

CREATE UNIQUE INDEX "ProgressEvidenceCaptureSession_token_hash_key"
  ON "ProgressEvidenceCaptureSession"("tokenHash");

CREATE UNIQUE INDEX "ProgressEvidenceCaptureSession_project_media_asset_key"
  ON "ProgressEvidenceCaptureSession"("projectId", "mediaAssetId");

CREATE UNIQUE INDEX "ProgressEvidenceCaptureSession_project_operation_key"
  ON "ProgressEvidenceCaptureSession"("projectId", "operationKeyHash");

CREATE INDEX "ProgressEvidenceCaptureSession_org_created_idx"
  ON "ProgressEvidenceCaptureSession"("organizationId", "createdAt", "id");

CREATE INDEX "ProgressEvidenceCaptureSession_worker_active_idx"
  ON "ProgressEvidenceCaptureSession"("projectId", "workerId", "status", "expiresAt", "id");

CREATE INDEX "ProgressEvidenceCaptureSession_connection_active_idx"
  ON "ProgressEvidenceCaptureSession"("projectId", "connectionId", "status", "expiresAt", "id");

CREATE INDEX "ProgressEvidenceCaptureSession_expiry_idx"
  ON "ProgressEvidenceCaptureSession"("status", "expiresAt", "id");

ALTER TABLE "ProgressEvidence"
  ADD COLUMN "locationCaptureSessionId" TEXT,
  ADD COLUMN "locationCapturedAt" TIMESTAMP(3),
  ADD COLUMN "locationSource" "ProgressEvidenceLocationSource",
  ADD COLUMN "locationVerification" "ProgressEvidenceLocationVerification";

-- This scoped unique index is the sole lookup and one-to-one authority for the
-- capture relation; a redundant unscoped index would add write and lock cost.
-- Concurrent index syntax is intentionally kept out of this Prisma migration
-- because it has a separate failure and retry contract. Preview rollout must
-- measure lock/scan duration before production promotion, which requires an
-- approved write window.
CREATE UNIQUE INDEX "ProgressEvidence_project_location_capture_session_key"
  ON "ProgressEvidence"("projectId", "locationCaptureSessionId");

-- Existing evidence coordinates are intentionally not reclassified. NOT VALID
-- preserves those rows while enforcing the governed bundle for every future
-- insert or update; no historical source or consent is invented.
ALTER TABLE "ProgressEvidence"
  ADD CONSTRAINT "ProgressEvidence_location_capture_bundle_check" CHECK (
    (
      "locationCaptureSessionId" IS NULL
      AND "locationCapturedAt" IS NULL
      AND "locationSource" IS NULL
      AND "locationVerification" IS NULL
    )
    OR (
      "locationCaptureSessionId" IS NOT NULL
      AND "locationCapturedAt" IS NOT NULL
      AND "latitude" BETWEEN -90 AND 90
      AND "longitude" BETWEEN -180 AND 180
      AND (
        (
          "locationSource" = 'WEBVIEW_GEOLOCATION'
          AND "accuracyMeters" BETWEEN 0.01 AND 10000
          AND "locationVerification" IN ('IN_GEOFENCE', 'REVIEW_REQUIRED')
        )
        OR (
          "locationSource" = 'WHATSAPP_DECLARED'
          AND "accuracyMeters" IS NULL
          AND "locationVerification" = 'DECLARED_ONLY'
        )
      )
    )
  ) NOT VALID;

ALTER TABLE "ProgressEvidenceCaptureSession"
  ADD CONSTRAINT "ProgressEvidenceCaptureSession_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProgressEvidenceCaptureSession"
  ADD CONSTRAINT "ProgressEvidenceCaptureSession_project_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProgressEvidenceCaptureSession"
  ADD CONSTRAINT "ProgressEvidenceCaptureSession_worker_scope_fkey"
  FOREIGN KEY ("projectId", "workerId")
  REFERENCES "Worker"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProgressEvidenceCaptureSession"
  ADD CONSTRAINT "ProgressEvidenceCaptureSession_connection_scope_fkey"
  FOREIGN KEY ("projectId", "connectionId")
  REFERENCES "WhatsAppConnection"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProgressEvidenceCaptureSession"
  ADD CONSTRAINT "ProgressEvidenceCaptureSession_media_asset_scope_fkey"
  FOREIGN KEY ("projectId", "mediaAssetId")
  REFERENCES "WhatsAppMediaAsset"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProgressEvidence"
  ADD CONSTRAINT "ProgressEvidence_location_capture_scope_fkey"
  FOREIGN KEY ("projectId", "locationCaptureSessionId")
  REFERENCES "ProgressEvidenceCaptureSession"("projectId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "enforce_progress_evidence_capture_session_transition"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'CONSUMED' THEN
      RAISE EXCEPTION 'consumed capture sessions cannot be deleted'
        USING ERRCODE = '55000', CONSTRAINT = 'ProgressEvidenceCaptureSession_consumed_delete_guard';
    END IF;

    RETURN OLD;
  END IF;

  IF ROW(
    OLD."organizationId",
    OLD."projectId",
    OLD."workerId",
    OLD."connectionId",
    OLD."mediaAssetId",
    OLD."tokenHash",
    OLD."privacyNoticeVersion",
    OLD."privacyNoticeContentSha256",
    OLD."issuedAt",
    OLD."expiresAt",
    OLD."createdAt"
  ) IS DISTINCT FROM ROW(
    NEW."organizationId",
    NEW."projectId",
    NEW."workerId",
    NEW."connectionId",
    NEW."mediaAssetId",
    NEW."tokenHash",
    NEW."privacyNoticeVersion",
    NEW."privacyNoticeContentSha256",
    NEW."issuedAt",
    NEW."expiresAt",
    NEW."createdAt"
  ) THEN
    RAISE EXCEPTION 'capture identity, token, notice and issuance provenance are immutable'
      USING ERRCODE = '55000', CONSTRAINT = 'ProgressEvidenceCaptureSession_identity_immutability_guard';
  END IF;

  IF OLD."operationKeyHash" IS NOT NULL AND ROW(
    OLD."operationKeyHash",
    OLD."requestFingerprint"
  ) IS DISTINCT FROM ROW(
    NEW."operationKeyHash",
    NEW."requestFingerprint"
  ) THEN
    RAISE EXCEPTION 'capture operation provenance is immutable once recorded'
      USING ERRCODE = '55000', CONSTRAINT = 'ProgressEvidenceCaptureSession_operation_immutability_guard';
  END IF;

  IF NEW."revision" <> OLD."revision" + 1 THEN
    RAISE EXCEPTION 'capture session revision must advance exactly once'
      USING ERRCODE = '23514', CONSTRAINT = 'ProgressEvidenceCaptureSession_revision_transition_guard';
  END IF;

  IF OLD."locationCapturedAt" IS NOT NULL AND ROW(
    OLD."privacyAcceptedAt",
    OLD."locationCapturedAt",
    OLD."locationReceivedAt",
    OLD."latitude",
    OLD."longitude",
    OLD."accuracyMeters",
    OLD."locationSource",
    OLD."locationVerification",
    OLD."distanceMeters",
    OLD."geofenceRadiusMeters"
  ) IS DISTINCT FROM ROW(
    NEW."privacyAcceptedAt",
    NEW."locationCapturedAt",
    NEW."locationReceivedAt",
    NEW."latitude",
    NEW."longitude",
    NEW."accuracyMeters",
    NEW."locationSource",
    NEW."locationVerification",
    NEW."distanceMeters",
    NEW."geofenceRadiusMeters"
  ) THEN
    RAISE EXCEPTION 'captured location and consent provenance are immutable'
      USING ERRCODE = '55000', CONSTRAINT = 'ProgressEvidenceCaptureSession_location_immutability_guard';
  END IF;

  IF OLD."status" IN ('CONSUMED', 'EXPIRED', 'CANCELLED') THEN
    RAISE EXCEPTION 'terminal capture sessions are immutable'
      USING ERRCODE = '55000', CONSTRAINT = 'ProgressEvidenceCaptureSession_terminal_immutability_guard';
  END IF;

  IF (
    OLD."status" = 'AWAITING_LOCATION'
    AND NEW."status" IN ('LOCATION_CAPTURED', 'EXPIRED', 'CANCELLED')
  ) OR (
    OLD."status" = 'LOCATION_CAPTURED'
    AND NEW."status" = 'CONSUMED'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid progress evidence capture lifecycle transition'
    USING ERRCODE = '23514', CONSTRAINT = 'ProgressEvidenceCaptureSession_transition_guard';
END;
$$;

CREATE TRIGGER "ProgressEvidenceCaptureSession_transition_guard"
BEFORE UPDATE OR DELETE ON "ProgressEvidenceCaptureSession"
FOR EACH ROW
EXECUTE FUNCTION "enforce_progress_evidence_capture_session_transition"();

CREATE FUNCTION "enforce_progress_evidence_location_provenance_immutability"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."locationCaptureSessionId" IS NOT NULL THEN
      RAISE EXCEPTION 'canonical evidence linked to a capture session cannot be deleted'
        USING ERRCODE = '55000', CONSTRAINT = 'ProgressEvidence_location_delete_guard';
    END IF;

    RETURN OLD;
  END IF;

  IF OLD."locationCaptureSessionId" IS NOT NULL AND ROW(
    OLD."authorWorkerId",
    OLD."locationCaptureSessionId",
    OLD."locationCapturedAt",
    OLD."latitude",
    OLD."longitude",
    OLD."accuracyMeters",
    OLD."locationSource",
    OLD."locationVerification"
  ) IS DISTINCT FROM ROW(
    NEW."authorWorkerId",
    NEW."locationCaptureSessionId",
    NEW."locationCapturedAt",
    NEW."latitude",
    NEW."longitude",
    NEW."accuracyMeters",
    NEW."locationSource",
    NEW."locationVerification"
  ) THEN
    RAISE EXCEPTION 'linked evidence location provenance is immutable'
      USING ERRCODE = '55000', CONSTRAINT = 'ProgressEvidence_location_immutability_guard';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ProgressEvidence_location_immutability_guard"
BEFORE UPDATE OR DELETE ON "ProgressEvidence"
FOR EACH ROW
EXECUTE FUNCTION "enforce_progress_evidence_location_provenance_immutability"();

-- Both directions are deferred so a transaction can atomically consume the
-- session and create its canonical evidence in either statement order.
CREATE FUNCTION "validate_progress_evidence_location_capture_link"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  capture RECORD;
  current_session RECORD;
  linked_evidence RECORD;
  capture_count INTEGER;
  current_session_count INTEGER;
  linked_evidence_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'ProgressEvidenceCaptureSession' THEN
    EXECUTE pg_catalog.format(
      'SELECT "workerId", "status", "locationCapturedAt", "latitude", "longitude", "accuracyMeters", "locationSource", "locationVerification" FROM %I."ProgressEvidenceCaptureSession" WHERE "projectId" = $1 AND "id" = $2',
      TG_TABLE_SCHEMA
    )
    INTO current_session
    USING NEW."projectId", NEW."id";
    GET DIAGNOSTICS current_session_count = ROW_COUNT;

    IF current_session_count = 0 THEN
      RETURN NULL;
    END IF;

    EXECUTE pg_catalog.format(
      'SELECT "authorWorkerId", "locationCapturedAt", "latitude", "longitude", "accuracyMeters", "locationSource", "locationVerification" FROM %I."ProgressEvidence" WHERE "projectId" = $1 AND "locationCaptureSessionId" = $2',
      TG_TABLE_SCHEMA
    )
    INTO linked_evidence
    USING NEW."projectId", NEW."id";
    GET DIAGNOSTICS linked_evidence_count = ROW_COUNT;

    IF current_session."status" = 'CONSUMED' THEN
      IF linked_evidence_count <> 1 THEN
        RAISE EXCEPTION 'consumed capture session requires one canonical evidence row'
          USING ERRCODE = '23514', CONSTRAINT = 'ProgressEvidenceCaptureSession_consumed_evidence_guard';
      END IF;

      IF linked_evidence."authorWorkerId" IS DISTINCT FROM current_session."workerId"
        OR linked_evidence."locationCapturedAt" IS DISTINCT FROM current_session."locationCapturedAt"
        OR linked_evidence."latitude" IS DISTINCT FROM current_session."latitude"
        OR linked_evidence."longitude" IS DISTINCT FROM current_session."longitude"
        OR linked_evidence."accuracyMeters" IS DISTINCT FROM current_session."accuracyMeters"
        OR linked_evidence."locationSource" IS DISTINCT FROM current_session."locationSource"
        OR linked_evidence."locationVerification" IS DISTINCT FROM current_session."locationVerification" THEN
        RAISE EXCEPTION 'canonical evidence does not exactly copy capture provenance'
          USING ERRCODE = '23514', CONSTRAINT = 'ProgressEvidenceCaptureSession_evidence_copy_guard';
      END IF;
    ELSIF linked_evidence_count <> 0 THEN
      RAISE EXCEPTION 'only consumed capture sessions may be linked to evidence'
        USING ERRCODE = '23514', CONSTRAINT = 'ProgressEvidenceCaptureSession_unconsumed_link_guard';
    END IF;

    RETURN NULL;
  END IF;

  IF NEW."locationCaptureSessionId" IS NULL THEN
    RETURN NULL;
  END IF;

  EXECUTE pg_catalog.format(
    'SELECT "workerId", "status", "locationCapturedAt", "latitude", "longitude", "accuracyMeters", "locationSource", "locationVerification" FROM %I."ProgressEvidenceCaptureSession" WHERE "projectId" = $1 AND "id" = $2',
    TG_TABLE_SCHEMA
  )
  INTO capture
  USING NEW."projectId", NEW."locationCaptureSessionId";
  GET DIAGNOSTICS capture_count = ROW_COUNT;

  IF capture_count <> 1 THEN
    RAISE EXCEPTION 'evidence location link requires a consumed capture session'
      USING ERRCODE = '23514', CONSTRAINT = 'ProgressEvidence_consumed_capture_guard';
  END IF;

  IF capture."status" <> 'CONSUMED' THEN
    RAISE EXCEPTION 'evidence location link requires a consumed capture session'
      USING ERRCODE = '23514', CONSTRAINT = 'ProgressEvidence_consumed_capture_guard';
  END IF;

  IF NEW."authorWorkerId" IS DISTINCT FROM capture."workerId"
    OR NEW."locationCapturedAt" IS DISTINCT FROM capture."locationCapturedAt"
    OR NEW."latitude" IS DISTINCT FROM capture."latitude"
    OR NEW."longitude" IS DISTINCT FROM capture."longitude"
    OR NEW."accuracyMeters" IS DISTINCT FROM capture."accuracyMeters"
    OR NEW."locationSource" IS DISTINCT FROM capture."locationSource"
    OR NEW."locationVerification" IS DISTINCT FROM capture."locationVerification" THEN
    RAISE EXCEPTION 'evidence location provenance must exactly match its capture session'
      USING ERRCODE = '23514', CONSTRAINT = 'ProgressEvidence_capture_copy_guard';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "ProgressEvidenceCaptureSession_evidence_link_guard"
AFTER INSERT OR UPDATE ON "ProgressEvidenceCaptureSession"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "validate_progress_evidence_location_capture_link"();

CREATE CONSTRAINT TRIGGER "ProgressEvidence_capture_session_link_guard"
AFTER INSERT OR UPDATE ON "ProgressEvidence"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "validate_progress_evidence_location_capture_link"();
