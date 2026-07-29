-- Deployment contract: AI Dispatch Plan v1 is schema-qualified to `public` so
-- SECURITY INVOKER helpers can pin search_path to pg_catalog without exposing
-- relation-hijacking paths. The migration verifier rejects any other schema.
CREATE TYPE "AiDispatchBudgetReservationStatus" AS ENUM (
  'RESERVED',
  'SETTLED',
  'RELEASED'
);

CREATE TYPE "AiDispatchSettlementBasis" AS ENUM (
  'PRE_DISPATCH_RELEASE',
  'RESPONSE_USAGE',
  'RECONCILED_USAGE',
  'PROVIDER_BILLING',
  'CONFIRMED_NO_CHARGE'
);

-- AI Dispatch Plan v1 keeps immutable route, budget and normalized provider
-- evidence on the assessment that caused the spend. All columns are nullable
-- as a group so assessments written before this migration remain valid.
ALTER TABLE "VisualProgressAssessment"
  ADD COLUMN "registryModelId" VARCHAR(190),
  ADD COLUMN "providerRoute" VARCHAR(120),
  ADD COLUMN "routePolicyVersion" VARCHAR(64),
  ADD COLUMN "routeReasonCode" VARCHAR(64),
  ADD COLUMN "pricingVersion" VARCHAR(64),
  ADD COLUMN "budgetCivilDayUtc" DATE,
  ADD COLUMN "budgetWorkload" VARCHAR(64),
  ADD COLUMN "quotaPolicyVersion" VARCHAR(64),
  ADD COLUMN "budgetLimitMicros" BIGINT,
  ADD COLUMN "budgetReservationMicros" BIGINT,
  ADD COLUMN "estimateBasis" VARCHAR(64),
  ADD COLUMN "providerDispatchStartedAt" TIMESTAMP(3),
  ADD COLUMN "providerRequestId" VARCHAR(190),
  ADD COLUMN "inputTokens" INTEGER,
  ADD COLUMN "outputTokens" INTEGER,
  ADD COLUMN "totalTokens" INTEGER,
  ADD COLUMN "cachedInputTokens" INTEGER,
  ADD COLUMN "estimatedCostMicros" BIGINT,
  ADD COLUMN "actualCostMicros" BIGINT;

ALTER TABLE "VisualProgressAssessment"
  ADD CONSTRAINT "VisualProgressAssessment_dispatch_audit_check" CHECK (
    (
      num_nonnulls(
        "registryModelId",
        "providerRoute",
        "routePolicyVersion",
        "routeReasonCode",
        "pricingVersion",
        "budgetCivilDayUtc",
        "budgetWorkload",
        "quotaPolicyVersion",
        "budgetLimitMicros",
        "budgetReservationMicros",
        "estimateBasis",
        "providerDispatchStartedAt",
        "providerRequestId",
        "inputTokens",
        "outputTokens",
        "totalTokens",
        "cachedInputTokens",
        "estimatedCostMicros",
        "actualCostMicros"
      ) = 0
    )
    OR (
      "registryModelId" IS NOT NULL
      AND "registryModelId" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,189}$'
      AND "providerRoute" IS NOT NULL
      AND "providerRoute" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$'
      AND "routePolicyVersion" IS NOT NULL
      AND "routePolicyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      AND "routeReasonCode" IS NOT NULL
      AND "routeReasonCode" ~ '^[a-z][a-z0-9_]{0,63}$'
      AND "pricingVersion" IS NOT NULL
      AND "pricingVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      AND "budgetCivilDayUtc" IS NOT NULL
      AND "budgetWorkload" IS NOT NULL
      AND "budgetWorkload" ~ '^[a-z][a-z0-9_-]{0,63}$'
      AND "quotaPolicyVersion" IS NOT NULL
      AND "quotaPolicyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      AND "budgetLimitMicros" IS NOT NULL
      AND "budgetLimitMicros" > 0
      AND "budgetReservationMicros" IS NOT NULL
      AND "budgetReservationMicros" >= 0
      AND "budgetReservationMicros" <= "budgetLimitMicros"
      AND "estimateBasis" IS NOT NULL
      AND "estimateBasis" ~ '^[a-z][a-z0-9-]{0,63}$'
      AND (
        "providerDispatchStartedAt" IS NULL
        OR "providerDispatchStartedAt" >= "createdAt"
      )
      AND (
        "providerRequestId" IS NULL
        OR (
          char_length(btrim("providerRequestId")) > 0
          AND "providerDispatchStartedAt" IS NOT NULL
        )
      )
      AND (
        num_nonnulls(
          "inputTokens",
          "outputTokens",
          "totalTokens",
          "cachedInputTokens"
        ) = 0
        OR (
          "providerDispatchStartedAt" IS NOT NULL
          AND "inputTokens" IS NOT NULL
          AND "inputTokens" >= 0
          AND "outputTokens" IS NOT NULL
          AND "outputTokens" >= 0
          AND "totalTokens" IS NOT NULL
          AND "totalTokens" >= 0
          AND (
            "cachedInputTokens" IS NULL
            OR (
              "cachedInputTokens" >= 0
              AND "cachedInputTokens" <= "inputTokens"
            )
          )
          AND "totalTokens"::BIGINT
            = "inputTokens"::BIGINT + "outputTokens"::BIGINT
        )
      )
      AND "estimatedCostMicros" IS NOT NULL
      AND "estimatedCostMicros" >= 0
      AND ("actualCostMicros" IS NULL OR "actualCostMicros" >= 0)
      AND (
        "actualCostMicros" IS NULL
        OR "actualCostMicros" = 0
        OR "providerDispatchStartedAt" IS NOT NULL
      )
    )
  );

CREATE INDEX "VPA_project_registry_created_idx"
  ON "VisualProgressAssessment"("projectId", "registryModelId", "createdAt");

-- Any governed dispatch with unknown actual cost fences the evidence across
-- FAILED/time-out/recovered attempts. A new operation becomes eligible only
-- after exact settlement or an explicit zero-cost pre-dispatch release.
CREATE UNIQUE INDEX "VPA_project_evidence_unsettled_dispatch_key"
  ON "VisualProgressAssessment"("projectId", "evidenceId")
  WHERE "registryModelId" IS NOT NULL AND "actualCostMicros" IS NULL;

-- A provider result is staged exactly once before any projection or billing
-- mutation. The immutable receipt is the source for deterministic recovery if
-- the process stops between provider response, assessment apply and settlement.
CREATE TABLE "VisualProgressProviderResultReceipt" (
  "assessmentId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "receiptSha256" CHAR(64) NOT NULL,
  "providerRequestId" VARCHAR(190),
  "providerResponseId" VARCHAR(190),
  "inputSha256" CHAR(64) NOT NULL,
  "submittedSha256" CHAR(64) NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "abstained" BOOLEAN NOT NULL,
  "abstentionReason" VARCHAR(64),
  "summary" TEXT NOT NULL,
  "elementType" VARCHAR(120),
  "progressMin" INTEGER,
  "progressMax" INTEGER,
  "confidence" DECIMAL(5, 4) NOT NULL,
  "quality" JSONB NOT NULL,
  "observations" JSONB NOT NULL,
  "limitations" JSONB NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "totalTokens" INTEGER,
  "cachedInputTokens" INTEGER,
  "cacheWriteTokens" INTEGER,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "VisualProgressProviderResultReceipt_pkey"
    PRIMARY KEY ("assessmentId"),
  CONSTRAINT "VPRR_identity_check" CHECK (
    "schemaVersion" = 1
    AND "receiptSha256" ~ '^[0-9a-f]{64}$'
    AND "inputSha256" ~ '^[0-9a-f]{64}$'
    AND "submittedSha256" ~ '^[0-9a-f]{64}$'
    AND (
      "providerRequestId" IS NULL
      OR char_length(btrim("providerRequestId")) BETWEEN 1 AND 190
    )
    AND (
      "providerResponseId" IS NULL
      OR char_length(btrim("providerResponseId")) BETWEEN 1 AND 190
    )
  ),
  CONSTRAINT "VPRR_dimensions_check" CHECK (
    "width" BETWEEN 32 AND 12000
    AND "height" BETWEEN 32 AND 12000
    AND "width"::BIGINT * "height"::BIGINT <= 50000000
  ),
  CONSTRAINT "VPRR_result_check" CHECK (
    char_length(btrim("summary")) BETWEEN 1 AND 700
    AND (
      "elementType" IS NULL
      OR char_length(btrim("elementType")) BETWEEN 1 AND 120
    )
    AND "confidence" >= 0
    AND "confidence" <= 1
    AND (
      (
        "abstained"
        AND "abstentionReason" IN (
          'image_quality',
          'insufficient_context',
          'not_construction_progress',
          'unsafe_or_unsupported'
        )
        AND "progressMin" IS NULL
        AND "progressMax" IS NULL
        AND jsonb_array_length("limitations") > 0
      )
      OR (
        NOT "abstained"
        AND "abstentionReason" IS NULL
        AND "progressMin" BETWEEN 0 AND 100
        AND "progressMax" BETWEEN 0 AND 100
        AND "progressMin" <= "progressMax"
        AND jsonb_array_length("observations") > 0
        AND "quality"->>'overall' <> 'insufficient'
      )
    )
  ),
  CONSTRAINT "VPRR_json_shape_check" CHECK (
    jsonb_typeof("quality") = 'object'
    AND "quality" ?& ARRAY['overall', 'angle', 'lighting', 'occlusion']
    AND ("quality" - 'overall' - 'angle' - 'lighting' - 'occlusion') = '{}'::JSONB
    AND "quality"->>'overall' IN ('good', 'limited', 'insufficient')
    AND "quality"->>'angle' IN ('good', 'limited', 'insufficient')
    AND "quality"->>'lighting' IN ('good', 'limited', 'insufficient')
    AND "quality"->>'occlusion' IN ('none', 'partial', 'severe')
    AND jsonb_typeof("observations") = 'array'
    AND jsonb_array_length("observations") <= 12
    AND jsonb_typeof("limitations") = 'array'
    AND jsonb_array_length("limitations") <= 10
  ),
  CONSTRAINT "VPRR_usage_check" CHECK (
    num_nonnulls(
      "inputTokens",
      "outputTokens",
      "totalTokens",
      "cachedInputTokens",
      "cacheWriteTokens"
    ) = 0
    OR (
      num_nonnulls(
        "inputTokens",
        "outputTokens",
        "totalTokens",
        "cachedInputTokens",
        "cacheWriteTokens"
      ) = 5
      AND "inputTokens" >= 0
      AND "outputTokens" >= 0
      AND "totalTokens" >= 0
      AND "cachedInputTokens" >= 0
      AND "cachedInputTokens" <= "inputTokens"
      AND "cacheWriteTokens" = 0
      AND "cachedInputTokens"::BIGINT + "cacheWriteTokens"::BIGINT
        <= "inputTokens"::BIGINT
      AND "totalTokens"::BIGINT
        = "inputTokens"::BIGINT + "outputTokens"::BIGINT
    )
  ),
  CONSTRAINT "VPRR_lifecycle_check" CHECK (
    (
      "appliedAt" IS NULL
      AND "revision" = 0
    )
    OR (
      "appliedAt" IS NOT NULL
      AND "appliedAt" >= "receivedAt"
      AND "revision" = 1
    )
  )
);

CREATE UNIQUE INDEX "VPRR_project_assessment_key"
  ON "VisualProgressProviderResultReceipt"("projectId", "assessmentId");

CREATE UNIQUE INDEX "VPRR_org_receipt_sha_key"
  ON "VisualProgressProviderResultReceipt"("organizationId", "receiptSha256");

CREATE INDEX "VPRR_org_received_idx"
  ON "VisualProgressProviderResultReceipt"("organizationId", "receivedAt");

CREATE INDEX "VPRR_project_received_idx"
  ON "VisualProgressProviderResultReceipt"("projectId", "receivedAt");

CREATE INDEX "VPRR_project_pending_received_idx"
  ON "VisualProgressProviderResultReceipt"("projectId", "receivedAt")
  WHERE "appliedAt" IS NULL;

ALTER TABLE "VisualProgressProviderResultReceipt"
  ADD CONSTRAINT "VPRR_project_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "VPRR_assessment_scope_fkey"
  FOREIGN KEY ("projectId", "assessmentId")
  REFERENCES "VisualProgressAssessment"("projectId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- This aggregate is the contention boundary for quota admission. Settlement
-- may exceed the configured limit because already-incurred spend must never be
-- hidden; only new reservations are blocked at or beyond the limit.
CREATE TABLE "AiDailyBudgetLedger" (
  "organizationId" TEXT NOT NULL,
  "civilDayUtc" DATE NOT NULL,
  "workload" VARCHAR(64) NOT NULL,
  "quotaPolicyVersion" VARCHAR(64) NOT NULL,
  "budgetLimitMicros" BIGINT NOT NULL,
  "reservedMicros" BIGINT NOT NULL DEFAULT 0,
  "settledMicros" BIGINT NOT NULL DEFAULT 0,
  "requestCount" BIGINT NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiDailyBudgetLedger_pkey"
    PRIMARY KEY ("organizationId", "civilDayUtc", "workload"),
  CONSTRAINT "AiDailyBudgetLedger_identity_check" CHECK (
    "workload" ~ '^[a-z][a-z0-9_-]{0,63}$'
    AND "quotaPolicyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
  ),
  CONSTRAINT "AiDailyBudgetLedger_counters_check" CHECK (
    "budgetLimitMicros" > 0
    AND "reservedMicros" >= 0
    AND "settledMicros" >= 0
    AND "requestCount" >= 0
    AND "revision" >= 0
  ),
  CONSTRAINT "AiDailyBudgetLedger_timestamps_check" CHECK (
    "updatedAt" >= "createdAt"
  )
);

CREATE INDEX "AiDailyBudgetLedger_day_workload_idx"
  ON "AiDailyBudgetLedger"("civilDayUtc", "workload");

CREATE INDEX "AiDailyBudgetLedger_org_updated_idx"
  ON "AiDailyBudgetLedger"("organizationId", "updatedAt");

ALTER TABLE "AiDailyBudgetLedger"
  ADD CONSTRAINT "AiDailyBudgetLedger_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- A durable row binds every aggregate reservation and terminal settlement to
-- exactly one assessment. Callers never supply a decrement during settlement.
CREATE TABLE "AiDispatchBudgetReservation" (
  "assessmentId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "civilDayUtc" DATE NOT NULL,
  "workload" VARCHAR(64) NOT NULL,
  "quotaPolicyVersion" VARCHAR(64) NOT NULL,
  "budgetLimitMicros" BIGINT NOT NULL,
  "reservedMicros" BIGINT NOT NULL,
  "actualMicros" BIGINT,
  "status" "AiDispatchBudgetReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "settlementBasis" "AiDispatchSettlementBasis",
  "settlementOperationKeyHash" CHAR(64),
  "settlementEvidenceSha256" CHAR(64),
  "settledById" TEXT,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settledAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiDispatchBudgetReservation_pkey" PRIMARY KEY ("assessmentId"),
  CONSTRAINT "AiDispatchBudgetReservation_identity_check" CHECK (
    "workload" ~ '^[a-z][a-z0-9_-]{0,63}$'
    AND "quotaPolicyVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    AND "budgetLimitMicros" > 0
    AND "reservedMicros" >= 0
    AND "reservedMicros" <= "budgetLimitMicros"
    AND ("actualMicros" IS NULL OR "actualMicros" >= 0)
    AND (
      "settlementOperationKeyHash" IS NULL
      OR "settlementOperationKeyHash" ~ '^[0-9a-f]{64}$'
    )
    AND (
      "settlementEvidenceSha256" IS NULL
      OR "settlementEvidenceSha256" ~ '^[0-9a-f]{64}$'
    )
    AND (
      "settledById" IS NULL
      OR char_length(btrim("settledById")) BETWEEN 1 AND 190
    )
    AND "revision" >= 0
  ),
  CONSTRAINT "AiDispatchBudgetReservation_state_check" CHECK (
    (
      "status" = 'RESERVED'
      AND "actualMicros" IS NULL
      AND "settlementBasis" IS NULL
      AND "settlementOperationKeyHash" IS NULL
      AND "settlementEvidenceSha256" IS NULL
      AND "settledById" IS NULL
      AND "settledAt" IS NULL
      AND "revision" = 0
    )
    OR (
      "status" = 'SETTLED'
      AND "actualMicros" IS NOT NULL
      AND "settlementBasis" IN (
        'RESPONSE_USAGE',
        'PROVIDER_BILLING',
        'CONFIRMED_NO_CHARGE'
      )
      AND "settlementOperationKeyHash" IS NOT NULL
      AND "settlementEvidenceSha256" IS NOT NULL
      AND (
        (
          "settlementBasis" = 'RESPONSE_USAGE'
          AND "settledById" IS NULL
        )
        OR (
          "settlementBasis" IN (
            'PROVIDER_BILLING',
            'CONFIRMED_NO_CHARGE'
          )
          AND "settledById" IS NOT NULL
        )
      )
      AND (
        "settlementBasis" <> 'CONFIRMED_NO_CHARGE'
        OR "actualMicros" = 0
      )
      AND "settledAt" IS NOT NULL
      AND "revision" = 1
    )
    OR (
      "status" = 'RELEASED'
      AND "actualMicros" = 0
      AND "settlementBasis" = 'PRE_DISPATCH_RELEASE'
      AND "settlementOperationKeyHash" IS NOT NULL
      AND "settlementEvidenceSha256" IS NOT NULL
      AND "settledById" IS NULL
      AND "settledAt" IS NOT NULL
      AND "revision" = 1
    )
  ),
  CONSTRAINT "AiDispatchBudgetReservation_timestamps_check" CHECK (
    "reservedAt" >= "createdAt"
    AND "updatedAt" >= "createdAt"
    AND ("settledAt" IS NULL OR "settledAt" >= "reservedAt")
  )
);

CREATE UNIQUE INDEX "AiDispatchBudgetReservation_project_assessment_key"
  ON "AiDispatchBudgetReservation"("projectId", "assessmentId");

CREATE UNIQUE INDEX "AiDispatchBudgetReservation_org_settlement_operation_key"
  ON "AiDispatchBudgetReservation"(
    "organizationId", "settlementOperationKeyHash"
  );

CREATE INDEX "AiDispatchBudgetReservation_ledger_status_idx"
  ON "AiDispatchBudgetReservation"(
    "organizationId", "civilDayUtc", "workload", "status"
  );

CREATE INDEX "AiDispatchBudgetReservation_org_status_updated_idx"
  ON "AiDispatchBudgetReservation"("organizationId", "status", "updatedAt");

CREATE INDEX "AiDispatchBudgetReservation_settled_by_idx"
  ON "AiDispatchBudgetReservation"("settledById", "settledAt");

ALTER TABLE "AiDispatchBudgetReservation"
  ADD CONSTRAINT "AiDispatchBudgetReservation_project_scope_fkey"
  FOREIGN KEY ("organizationId", "projectId")
  REFERENCES "Project"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AiDispatchBudgetReservation_assessment_scope_fkey"
  FOREIGN KEY ("projectId", "assessmentId")
  REFERENCES "VisualProgressAssessment"("projectId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AiDispatchBudgetReservation_daily_ledger_fkey"
  FOREIGN KEY ("organizationId", "civilDayUtc", "workload")
  REFERENCES "AiDailyBudgetLedger"("organizationId", "civilDayUtc", "workload")
  ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT "AiDispatchBudgetReservation_settledById_fkey"
  FOREIGN KEY ("settledById")
  REFERENCES "PlatformUser"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reserve is exactly-once by assessmentId. An exact retry returns the durable
-- row without incrementing either reservedMicros or requestCount; any changed
-- identity is rejected before another aggregate mutation can occur.
CREATE FUNCTION "obrasaas_ai_daily_budget_reserve"(
  p_assessment_id TEXT,
  p_civil_day_utc DATE,
  p_workload TEXT,
  p_quota_policy_version TEXT,
  p_budget_limit_micros BIGINT,
  p_reserve_micros BIGINT
)
RETURNS "public"."AiDispatchBudgetReservation"
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  assessment_project_id TEXT;
  assessment_organization_id TEXT;
  assessment_budget_day DATE;
  assessment_budget_workload TEXT;
  assessment_quota_policy TEXT;
  assessment_budget_limit_micros BIGINT;
  assessment_reserved_micros BIGINT;
  assessment_dispatch_started_at TIMESTAMP(3);
  assessment_actual_micros BIGINT;
  existing_reservation "public"."AiDispatchBudgetReservation"%ROWTYPE;
  affected_rows INTEGER;
  operation_now TIMESTAMP(3);
BEGIN
  IF p_assessment_id IS NULL OR char_length(btrim(p_assessment_id)) = 0
    OR p_civil_day_utc IS NULL
    OR p_workload IS NULL
    OR p_workload !~ '^[a-z][a-z0-9_-]{0,63}$'
    OR p_quota_policy_version IS NULL
    OR p_quota_policy_version !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
    OR p_budget_limit_micros IS NULL
    OR p_budget_limit_micros <= 0
    OR p_reserve_micros IS NULL
    OR p_reserve_micros < 0
    OR p_reserve_micros > p_budget_limit_micros
  THEN
    RAISE EXCEPTION 'invalid AI assessment budget reservation'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_reserve_input_guard';
  END IF;

  SELECT assessment."projectId",
         project."organizationId",
         assessment."budgetCivilDayUtc",
         assessment."budgetWorkload",
         assessment."quotaPolicyVersion",
         assessment."budgetLimitMicros",
         assessment."budgetReservationMicros",
         assessment."providerDispatchStartedAt",
         assessment."actualCostMicros"
    INTO assessment_project_id,
         assessment_organization_id,
         assessment_budget_day,
         assessment_budget_workload,
         assessment_quota_policy,
         assessment_budget_limit_micros,
         assessment_reserved_micros,
         assessment_dispatch_started_at,
         assessment_actual_micros
    FROM "public"."VisualProgressAssessment" AS assessment
    JOIN "public"."Project" AS project
      ON project."id" = assessment."projectId"
   WHERE assessment."id" = p_assessment_id
     FOR UPDATE OF assessment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI assessment does not exist in a governed tenant project'
      USING ERRCODE = '23503',
            CONSTRAINT = 'AiDispatchBudgetReservation_assessment_scope_fkey';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'ai-daily-budget:' || assessment_organization_id || ':' || p_civil_day_utc::TEXT,
    0
  ));

  SELECT *
    INTO existing_reservation
    FROM "public"."AiDispatchBudgetReservation"
   WHERE "assessmentId" = p_assessment_id
     FOR UPDATE;

  IF FOUND THEN
    IF existing_reservation."organizationId" <> assessment_organization_id
      OR existing_reservation."projectId" <> assessment_project_id
      OR existing_reservation."civilDayUtc" IS DISTINCT FROM assessment_budget_day
      OR existing_reservation."workload" IS DISTINCT FROM assessment_budget_workload
      OR existing_reservation."quotaPolicyVersion" IS DISTINCT FROM assessment_quota_policy
      OR existing_reservation."budgetLimitMicros" IS DISTINCT FROM assessment_budget_limit_micros
      OR existing_reservation."reservedMicros" IS DISTINCT FROM assessment_reserved_micros
    THEN
      RAISE EXCEPTION 'AI assessment reservation no longer matches its budget snapshot'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDispatchBudgetReservation_assessment_budget_guard';
    END IF;

    IF existing_reservation."organizationId" = assessment_organization_id
      AND existing_reservation."projectId" = assessment_project_id
      AND existing_reservation."civilDayUtc" = p_civil_day_utc
      AND existing_reservation."workload" = p_workload
      AND existing_reservation."quotaPolicyVersion" = p_quota_policy_version
      AND existing_reservation."budgetLimitMicros" = p_budget_limit_micros
      AND existing_reservation."reservedMicros" = p_reserve_micros
    THEN
      RETURN existing_reservation;
    END IF;

    RAISE EXCEPTION 'AI assessment reservation replay changed its identity'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_replay_mismatch';
  END IF;

  IF assessment_budget_day IS DISTINCT FROM p_civil_day_utc
    OR assessment_budget_workload IS DISTINCT FROM p_workload
    OR assessment_quota_policy IS DISTINCT FROM p_quota_policy_version
    OR assessment_budget_limit_micros IS DISTINCT FROM p_budget_limit_micros
    OR assessment_reserved_micros IS DISTINCT FROM p_reserve_micros
  THEN
    RAISE EXCEPTION 'AI assessment budget snapshot does not match reservation input'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_assessment_budget_guard';
  END IF;

  IF assessment_dispatch_started_at IS NOT NULL OR assessment_actual_micros IS NOT NULL THEN
    RAISE EXCEPTION 'AI provider dispatch started before its durable reservation'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_started_without_reservation';
  END IF;

  -- Wall-clock time is captured after serialization. CURRENT_TIMESTAMP is the
  -- transaction start and can move audit timestamps backwards after lock waits.
  operation_now := clock_timestamp();

  -- Transaction-local, exact aggregate transition capability. The ledger
  -- trigger consumes these values to reject accidental generic DML and to
  -- verify the precise reserve delta written by this function.
  PERFORM set_config(
    'obrasaas.ai_budget_ledger_key',
    jsonb_build_array(
      assessment_organization_id,
      p_civil_day_utc::TEXT,
      p_workload
    )::TEXT,
    true
  );
  PERFORM set_config('obrasaas.ai_budget_ledger_action', 'reserve', true);
  PERFORM set_config(
    'obrasaas.ai_budget_ledger_reserved_delta',
    p_reserve_micros::TEXT,
    true
  );
  PERFORM set_config('obrasaas.ai_budget_ledger_settled_delta', '0', true);

  INSERT INTO "public"."AiDailyBudgetLedger" AS ledger (
    "organizationId",
    "civilDayUtc",
    "workload",
    "quotaPolicyVersion",
    "budgetLimitMicros",
    "reservedMicros",
    "settledMicros",
    "requestCount",
    "revision",
    "createdAt",
    "updatedAt"
  ) VALUES (
    assessment_organization_id,
    p_civil_day_utc,
    p_workload,
    p_quota_policy_version,
    p_budget_limit_micros,
    p_reserve_micros,
    0,
    1,
    0,
    operation_now,
    operation_now
  )
  ON CONFLICT ON CONSTRAINT "AiDailyBudgetLedger_pkey" DO UPDATE
    SET "reservedMicros" = ledger."reservedMicros" + EXCLUDED."reservedMicros",
        "requestCount" = ledger."requestCount" + 1,
        "revision" = ledger."revision" + 1,
        "updatedAt" = operation_now
  WHERE ledger."quotaPolicyVersion" = EXCLUDED."quotaPolicyVersion"
    AND ledger."budgetLimitMicros" = EXCLUDED."budgetLimitMicros"
    AND ledger."settledMicros" < ledger."budgetLimitMicros"
    AND ledger."settledMicros"
      <= ledger."budgetLimitMicros" - p_reserve_micros
    AND ledger."reservedMicros"
      <= ledger."budgetLimitMicros" - p_reserve_micros - ledger."settledMicros";

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'AI daily budget is exhausted or its policy changed'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDailyBudgetLedger_budget_exceeded';
  END IF;

  PERFORM set_config('obrasaas.ai_budget_ledger_key', '', true);
  PERFORM set_config('obrasaas.ai_budget_ledger_action', '', true);
  PERFORM set_config('obrasaas.ai_budget_ledger_reserved_delta', '', true);
  PERFORM set_config('obrasaas.ai_budget_ledger_settled_delta', '', true);

  PERFORM set_config(
    'obrasaas.ai_reservation_insert_assessment',
    p_assessment_id,
    true
  );

  INSERT INTO "public"."AiDispatchBudgetReservation" (
    "assessmentId",
    "organizationId",
    "projectId",
    "civilDayUtc",
    "workload",
    "quotaPolicyVersion",
    "budgetLimitMicros",
    "reservedMicros",
    "actualMicros",
    "status",
    "reservedAt",
    "settledAt",
    "revision",
    "createdAt",
    "updatedAt"
  ) VALUES (
    p_assessment_id,
    assessment_organization_id,
    assessment_project_id,
    p_civil_day_utc,
    p_workload,
    p_quota_policy_version,
    p_budget_limit_micros,
    p_reserve_micros,
    NULL,
    'RESERVED',
    operation_now,
    NULL,
    0,
    operation_now,
    operation_now
  )
  RETURNING * INTO existing_reservation;

  PERFORM set_config('obrasaas.ai_reservation_insert_assessment', '', true);

  RETURN existing_reservation;
END;
$$;

-- Settle locks and consumes only the reservation identified by assessmentId.
-- Exact terminal replay is a read; changed actual cost is rejected. Actual
-- spend is always recorded even when it overruns the reservation or day limit.
CREATE FUNCTION "obrasaas_ai_daily_budget_settle"(
  p_assessment_id TEXT,
  p_actual_micros BIGINT,
  p_settlement_basis "public"."AiDispatchSettlementBasis",
  p_settlement_operation_key_hash TEXT,
  p_settlement_evidence_sha256 TEXT,
  p_settled_by_id TEXT
)
RETURNS "public"."AiDispatchBudgetReservation"
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  assessment_project_id TEXT;
  assessment_organization_id TEXT;
  assessment_budget_day DATE;
  assessment_budget_workload TEXT;
  assessment_quota_policy TEXT;
  assessment_budget_limit_micros BIGINT;
  assessment_reserved_micros BIGINT;
  assessment_dispatch_started_at TIMESTAMP(3);
  assessment_actual_micros BIGINT;
  assessment_request_fingerprint TEXT;
  assessment_input_sha256 TEXT;
  assessment_provider_request_id TEXT;
  assessment_provider_response_id TEXT;
  assessment_input_tokens INTEGER;
  assessment_output_tokens INTEGER;
  assessment_total_tokens INTEGER;
  assessment_cached_input_tokens INTEGER;
  existing_reservation "public"."AiDispatchBudgetReservation"%ROWTYPE;
  response_receipt "public"."VisualProgressProviderResultReceipt"%ROWTYPE;
  target_status "public"."AiDispatchBudgetReservationStatus";
  affected_rows INTEGER;
  operation_now TIMESTAMP(3);
BEGIN
  IF p_assessment_id IS NULL OR char_length(btrim(p_assessment_id)) = 0
    OR p_actual_micros IS NULL
    OR p_actual_micros < 0
    OR p_settlement_basis IS NULL
    OR p_settlement_operation_key_hash IS NULL
    OR p_settlement_operation_key_hash !~ '^[0-9a-f]{64}$'
    OR p_settlement_evidence_sha256 IS NULL
    OR p_settlement_evidence_sha256 !~ '^[0-9a-f]{64}$'
    OR (
      p_settled_by_id IS NOT NULL
      AND char_length(btrim(p_settled_by_id)) NOT BETWEEN 1 AND 190
    )
    OR (
      p_settlement_basis IN ('PRE_DISPATCH_RELEASE', 'RESPONSE_USAGE')
      AND p_settled_by_id IS NOT NULL
    )
    OR (
      p_settlement_basis IN (
        'PROVIDER_BILLING',
        'CONFIRMED_NO_CHARGE'
      )
      AND p_settled_by_id IS NULL
    )
  THEN
    RAISE EXCEPTION 'invalid AI assessment budget settlement'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_settle_input_guard';
  END IF;

  -- Reserved enum value for a future reconciler with durable normalized
  -- evidence. A caller-provided hash alone is not sufficient proof today.
  IF p_settlement_basis = 'RECONCILED_USAGE' THEN
    RAISE EXCEPTION 'reconciled usage settlement is not enabled without durable evidence'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_unsupported_settlement_basis';
  END IF;

  SELECT assessment."projectId",
         project."organizationId",
         assessment."budgetCivilDayUtc",
         assessment."budgetWorkload",
         assessment."quotaPolicyVersion",
         assessment."budgetLimitMicros",
         assessment."budgetReservationMicros",
         assessment."providerDispatchStartedAt",
         assessment."actualCostMicros",
         assessment."requestFingerprint",
         assessment."inputSha256",
         assessment."providerRequestId",
         assessment."providerResponseId",
         assessment."inputTokens",
         assessment."outputTokens",
         assessment."totalTokens",
         assessment."cachedInputTokens"
    INTO assessment_project_id,
         assessment_organization_id,
         assessment_budget_day,
         assessment_budget_workload,
         assessment_quota_policy,
         assessment_budget_limit_micros,
         assessment_reserved_micros,
         assessment_dispatch_started_at,
         assessment_actual_micros,
         assessment_request_fingerprint,
         assessment_input_sha256,
         assessment_provider_request_id,
         assessment_provider_response_id,
         assessment_input_tokens,
         assessment_output_tokens,
         assessment_total_tokens,
         assessment_cached_input_tokens
    FROM "public"."VisualProgressAssessment" AS assessment
    JOIN "public"."Project" AS project
      ON project."id" = assessment."projectId"
   WHERE assessment."id" = p_assessment_id
     FOR UPDATE OF assessment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI assessment does not exist in a governed tenant project'
      USING ERRCODE = '23503',
            CONSTRAINT = 'AiDispatchBudgetReservation_assessment_scope_fkey';
  END IF;

  IF assessment_budget_day IS NULL THEN
    RAISE EXCEPTION 'AI assessment has no durable budget reservation'
      USING ERRCODE = '23503',
            CONSTRAINT = 'AiDispatchBudgetReservation_missing_reservation';
  END IF;

  IF p_settlement_basis IN (
      'PROVIDER_BILLING',
      'CONFIRMED_NO_CHARGE'
    )
    AND assessment_actual_micros IS NULL
  THEN
    PERFORM 1
     FROM "public"."PlatformUser" AS actor
     WHERE actor."id" = p_settled_by_id
       AND actor."systemRole" = 'SUPERADMIN'
     FOR SHARE OF actor;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'manual settlement actor must be an active global superadmin identity'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDispatchBudgetReservation_settlement_actor_guard';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'ai-daily-budget:' || assessment_organization_id || ':'
      || assessment_budget_day::TEXT,
    0
  ));

  SELECT *
    INTO existing_reservation
    FROM "public"."AiDispatchBudgetReservation"
   WHERE "assessmentId" = p_assessment_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI assessment has no durable budget reservation'
      USING ERRCODE = '23503',
            CONSTRAINT = 'AiDispatchBudgetReservation_missing_reservation';
  END IF;

  IF existing_reservation."organizationId" <> assessment_organization_id
    OR existing_reservation."projectId" <> assessment_project_id
    OR existing_reservation."civilDayUtc" IS DISTINCT FROM assessment_budget_day
    OR existing_reservation."workload" IS DISTINCT FROM assessment_budget_workload
    OR existing_reservation."quotaPolicyVersion" IS DISTINCT FROM assessment_quota_policy
    OR existing_reservation."budgetLimitMicros" IS DISTINCT FROM assessment_budget_limit_micros
    OR existing_reservation."reservedMicros" IS DISTINCT FROM assessment_reserved_micros
  THEN
    RAISE EXCEPTION 'AI assessment reservation no longer matches its budget snapshot'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_assessment_budget_guard';
  END IF;

  target_status := CASE
    WHEN p_settlement_basis = 'PRE_DISPATCH_RELEASE' THEN 'RELEASED'
    ELSE 'SETTLED'
  END;

  IF p_settlement_basis = 'PRE_DISPATCH_RELEASE' THEN
    IF p_actual_micros <> 0
      OR assessment_dispatch_started_at IS NOT NULL
      OR p_settlement_evidence_sha256 <> assessment_request_fingerprint
      OR EXISTS (
        SELECT 1
          FROM "public"."VisualProgressProviderResultReceipt" AS receipt
         WHERE receipt."assessmentId" = p_assessment_id
      )
    THEN
      RAISE EXCEPTION 'pre-dispatch release provenance does not match assessment state'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDispatchBudgetReservation_pre_dispatch_release_guard';
    END IF;
  ELSIF assessment_dispatch_started_at IS NULL THEN
    RAISE EXCEPTION 'provider settlement requires a persisted dispatch start'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_dispatch_start_guard';
  END IF;

  IF p_settlement_basis = 'CONFIRMED_NO_CHARGE' AND p_actual_micros <> 0 THEN
    RAISE EXCEPTION 'confirmed no-charge settlement must have zero actual cost'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_no_charge_guard';
  END IF;

  IF p_settlement_basis = 'RESPONSE_USAGE' THEN
    SELECT receipt.*
      INTO response_receipt
      FROM "public"."VisualProgressProviderResultReceipt" AS receipt
     WHERE receipt."assessmentId" = p_assessment_id
       AND receipt."organizationId" = assessment_organization_id
       AND receipt."projectId" = assessment_project_id
     FOR KEY SHARE;

    IF NOT FOUND
      OR response_receipt."receiptSha256" <> p_settlement_evidence_sha256
      OR response_receipt."inputSha256" <> assessment_input_sha256
      OR response_receipt."providerRequestId" IS DISTINCT FROM assessment_provider_request_id
      OR response_receipt."providerResponseId" IS DISTINCT FROM assessment_provider_response_id
      OR response_receipt."inputTokens" IS NULL
      OR response_receipt."outputTokens" IS NULL
      OR response_receipt."totalTokens" IS NULL
      OR response_receipt."cachedInputTokens" IS NULL
      OR response_receipt."cacheWriteTokens" IS NULL
      OR response_receipt."cacheWriteTokens" <> 0
      OR response_receipt."inputTokens" IS DISTINCT FROM assessment_input_tokens
      OR response_receipt."outputTokens" IS DISTINCT FROM assessment_output_tokens
      OR response_receipt."totalTokens" IS DISTINCT FROM assessment_total_tokens
      OR response_receipt."cachedInputTokens" IS DISTINCT FROM assessment_cached_input_tokens
    THEN
      RAISE EXCEPTION 'response usage settlement lacks an exact normalized receipt'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDispatchBudgetReservation_response_receipt_guard';
    END IF;
  ELSIF p_settlement_basis IN (
      'PROVIDER_BILLING',
      'CONFIRMED_NO_CHARGE'
    )
  THEN
    SELECT receipt.*
      INTO response_receipt
      FROM "public"."VisualProgressProviderResultReceipt" AS receipt
     WHERE receipt."assessmentId" = p_assessment_id
       AND receipt."organizationId" = assessment_organization_id
       AND receipt."projectId" = assessment_project_id
     FOR KEY SHARE;

    IF FOUND
      AND (
        response_receipt."inputTokens" IS NOT NULL
        OR response_receipt."appliedAt" IS NULL
      )
    THEN
      RAISE EXCEPTION 'manual settlement cannot strand or supersede a normalized provider receipt'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDispatchBudgetReservation_manual_receipt_guard';
    END IF;
  END IF;

  IF existing_reservation."status" IN ('SETTLED', 'RELEASED') THEN
    IF existing_reservation."status" = target_status
      AND existing_reservation."actualMicros" = p_actual_micros
      AND existing_reservation."settlementBasis" = p_settlement_basis
      AND existing_reservation."settlementOperationKeyHash"
        = p_settlement_operation_key_hash
      AND existing_reservation."settlementEvidenceSha256"
        = p_settlement_evidence_sha256
      AND existing_reservation."settledById" IS NOT DISTINCT FROM p_settled_by_id
      AND assessment_actual_micros = p_actual_micros
    THEN
      RETURN existing_reservation;
    END IF;

    RAISE EXCEPTION 'AI assessment settlement replay changed its terminal result'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_settlement_replay_mismatch';
  END IF;

  IF assessment_actual_micros IS NOT NULL THEN
    RAISE EXCEPTION 'AI assessment cost was written outside its durable settlement'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_assessment_cost_guard';
  END IF;

  -- Capture after row/advisory locks and provenance validation so a transaction
  -- that waited behind newer work cannot regress durable audit timestamps.
  operation_now := clock_timestamp();

  -- The trigger validates both decrements against the locked reservation and
  -- the actual-cost delta against this transaction-local capability.
  PERFORM set_config(
    'obrasaas.ai_budget_ledger_key',
    jsonb_build_array(
      existing_reservation."organizationId",
      existing_reservation."civilDayUtc"::TEXT,
      existing_reservation."workload"
    )::TEXT,
    true
  );
  PERFORM set_config('obrasaas.ai_budget_ledger_action', 'settle', true);
  PERFORM set_config(
    'obrasaas.ai_budget_ledger_reserved_delta',
    existing_reservation."reservedMicros"::TEXT,
    true
  );
  PERFORM set_config(
    'obrasaas.ai_budget_ledger_settled_delta',
    p_actual_micros::TEXT,
    true
  );

  UPDATE "public"."AiDailyBudgetLedger" AS ledger
     SET "reservedMicros" = ledger."reservedMicros"
           - existing_reservation."reservedMicros",
         "settledMicros" = ledger."settledMicros" + p_actual_micros,
         "revision" = ledger."revision" + 1,
         "updatedAt" = operation_now
   WHERE ledger."organizationId" = existing_reservation."organizationId"
     AND ledger."civilDayUtc" = existing_reservation."civilDayUtc"
     AND ledger."workload" = existing_reservation."workload"
     AND ledger."quotaPolicyVersion" = existing_reservation."quotaPolicyVersion"
     AND ledger."budgetLimitMicros" = existing_reservation."budgetLimitMicros"
     AND ledger."reservedMicros" >= existing_reservation."reservedMicros";

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'AI assessment reservation cannot be settled from a stale ledger'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_settlement_guard';
  END IF;

  PERFORM set_config('obrasaas.ai_budget_ledger_key', '', true);
  PERFORM set_config('obrasaas.ai_budget_ledger_action', '', true);
  PERFORM set_config('obrasaas.ai_budget_ledger_reserved_delta', '', true);
  PERFORM set_config('obrasaas.ai_budget_ledger_settled_delta', '', true);

  -- Transaction-local capability marker for the two guarded writes below.
  -- This prevents accidental generic/Prisma DML from creating a terminal
  -- reservation without moving the ledger. It is defense in depth, not a
  -- substitute for keeping arbitrary SQL privileges out of application roles.
  PERFORM set_config(
    'obrasaas.ai_settlement_assessment',
    p_assessment_id,
    true
  );

  UPDATE "public"."AiDispatchBudgetReservation"
     SET "actualMicros" = p_actual_micros,
         "status" = target_status,
         "settlementBasis" = p_settlement_basis,
         "settlementOperationKeyHash" = p_settlement_operation_key_hash,
         "settlementEvidenceSha256" = p_settlement_evidence_sha256,
         "settledById" = p_settled_by_id,
         "settledAt" = operation_now,
         "revision" = 1,
         "updatedAt" = operation_now
   WHERE "assessmentId" = p_assessment_id
     AND "status" = 'RESERVED'
     AND "revision" = 0
  RETURNING * INTO existing_reservation;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI assessment reservation lost its settlement lease'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_settlement_guard';
  END IF;

  UPDATE "public"."VisualProgressAssessment"
     SET "actualCostMicros" = p_actual_micros,
         "updatedAt" = operation_now
   WHERE "id" = p_assessment_id
     AND "actualCostMicros" IS NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'AI assessment cost compare-and-set failed'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_assessment_cost_guard';
  END IF;

  PERFORM set_config('obrasaas.ai_settlement_assessment', '', true);

  RETURN existing_reservation;
END;
$$;

-- Receipt content is immutable. The only update transition is PENDING ->
-- APPLIED after the assessment projection and any RESPONSE_USAGE settlement
-- already match the exact normalized receipt inside the same transaction.
CREATE FUNCTION "obrasaas_visual_progress_receipt_write_once"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF jsonb_typeof(NEW."observations") <> 'array'
    OR jsonb_typeof(NEW."limitations") <> 'array'
  THEN
    RAISE EXCEPTION 'visual provider receipt arrays have invalid shapes'
      USING ERRCODE = '23514',
            CONSTRAINT = 'VPRR_json_items_check';
  END IF;

  IF EXISTS (
      SELECT 1
        FROM jsonb_array_elements(NEW."observations") AS item(value)
       WHERE jsonb_typeof(item.value) <> 'string'
          OR char_length(btrim(item.value #>> '{}')) NOT BETWEEN 1 AND 300
    )
    OR EXISTS (
      SELECT 1
        FROM jsonb_array_elements(NEW."limitations") AS item(value)
       WHERE jsonb_typeof(item.value) <> 'string'
          OR char_length(btrim(item.value #>> '{}')) NOT BETWEEN 1 AND 300
    )
  THEN
    RAISE EXCEPTION 'visual provider receipt arrays contain invalid items'
      USING ERRCODE = '23514',
            CONSTRAINT = 'VPRR_json_items_check';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."appliedAt" IS NOT NULL OR NEW."revision" <> 0 THEN
      RAISE EXCEPTION 'visual provider receipt must begin pending'
        USING ERRCODE = '23514',
              CONSTRAINT = 'VPRR_lifecycle_guard';
    END IF;

    PERFORM 1
      FROM "public"."VisualProgressAssessment" AS assessment
      JOIN "public"."Project" AS project
        ON project."id" = assessment."projectId"
     WHERE assessment."id" = NEW."assessmentId"
       AND assessment."projectId" = NEW."projectId"
       AND project."organizationId" = NEW."organizationId"
       AND assessment."registryModelId" IS NOT NULL
       AND assessment."providerDispatchStartedAt" IS NOT NULL
       AND assessment."actualCostMicros" IS NULL
       AND assessment."inputSha256" = NEW."inputSha256"
       AND NEW."receivedAt" >= assessment."providerDispatchStartedAt"
       AND (
         assessment."providerRequestId" IS NULL
         OR assessment."providerRequestId" IS NOT DISTINCT FROM NEW."providerRequestId"
       )
       AND (
         assessment."providerResponseId" IS NULL
         OR assessment."providerResponseId" IS NOT DISTINCT FROM NEW."providerResponseId"
       )
     FOR KEY SHARE OF assessment;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'visual provider receipt does not match a dispatched assessment'
        USING ERRCODE = '23514',
              CONSTRAINT = 'VPRR_assessment_dispatch_guard';
    END IF;

    PERFORM 1
      FROM "public"."AiDispatchBudgetReservation" AS reservation
      JOIN "public"."VisualProgressAssessment" AS assessment
        ON assessment."id" = reservation."assessmentId"
     WHERE reservation."assessmentId" = NEW."assessmentId"
       AND reservation."organizationId" = NEW."organizationId"
       AND reservation."projectId" = NEW."projectId"
       AND reservation."status" = 'RESERVED'
       AND reservation."actualMicros" IS NULL
       AND reservation."civilDayUtc" IS NOT DISTINCT FROM assessment."budgetCivilDayUtc"
       AND reservation."workload" IS NOT DISTINCT FROM assessment."budgetWorkload"
       AND reservation."quotaPolicyVersion" IS NOT DISTINCT FROM assessment."quotaPolicyVersion"
       AND reservation."budgetLimitMicros" IS NOT DISTINCT FROM assessment."budgetLimitMicros"
       AND reservation."reservedMicros" IS NOT DISTINCT FROM assessment."budgetReservationMicros"
     FOR KEY SHARE OF reservation;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'visual provider receipt requires an exact active reservation'
        USING ERRCODE = '23514',
              CONSTRAINT = 'VPRR_reservation_guard';
    END IF;

    RETURN NEW;
  END IF;

  IF ROW(
      NEW."assessmentId",
      NEW."organizationId",
      NEW."projectId",
      NEW."schemaVersion",
      NEW."receiptSha256",
      NEW."providerRequestId",
      NEW."providerResponseId",
      NEW."inputSha256",
      NEW."submittedSha256",
      NEW."width",
      NEW."height",
      NEW."abstained",
      NEW."abstentionReason",
      NEW."summary",
      NEW."elementType",
      NEW."progressMin",
      NEW."progressMax",
      NEW."confidence",
      NEW."quality",
      NEW."observations",
      NEW."limitations",
      NEW."inputTokens",
      NEW."outputTokens",
      NEW."totalTokens",
      NEW."cachedInputTokens",
      NEW."cacheWriteTokens",
      NEW."receivedAt"
    ) IS DISTINCT FROM ROW(
      OLD."assessmentId",
      OLD."organizationId",
      OLD."projectId",
      OLD."schemaVersion",
      OLD."receiptSha256",
      OLD."providerRequestId",
      OLD."providerResponseId",
      OLD."inputSha256",
      OLD."submittedSha256",
      OLD."width",
      OLD."height",
      OLD."abstained",
      OLD."abstentionReason",
      OLD."summary",
      OLD."elementType",
      OLD."progressMin",
      OLD."progressMax",
      OLD."confidence",
      OLD."quality",
      OLD."observations",
      OLD."limitations",
      OLD."inputTokens",
      OLD."outputTokens",
      OLD."totalTokens",
      OLD."cachedInputTokens",
      OLD."cacheWriteTokens",
      OLD."receivedAt"
    )
  THEN
    RAISE EXCEPTION 'visual provider receipt content is immutable'
      USING ERRCODE = '23514',
            CONSTRAINT = 'VPRR_content_immutable';
  END IF;

  IF OLD."appliedAt" IS NOT NULL THEN
    IF NEW."appliedAt" IS DISTINCT FROM OLD."appliedAt"
      OR NEW."revision" IS DISTINCT FROM OLD."revision"
    THEN
      RAISE EXCEPTION 'applied visual provider receipt is immutable'
        USING ERRCODE = '23514',
              CONSTRAINT = 'VPRR_applied_immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."appliedAt" IS NULL AND NEW."revision" = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW."appliedAt" IS NULL OR NEW."revision" <> 1 THEN
    RAISE EXCEPTION 'visual provider receipt apply transition is invalid'
      USING ERRCODE = '23514',
            CONSTRAINT = 'VPRR_lifecycle_guard';
  END IF;

  PERFORM 1
    FROM "public"."VisualProgressAssessment" AS assessment
   WHERE assessment."id" = NEW."assessmentId"
     AND assessment."projectId" = NEW."projectId"
     AND assessment."inputSha256" = NEW."inputSha256"
     AND assessment."providerRequestId" IS NOT DISTINCT FROM NEW."providerRequestId"
     AND assessment."providerResponseId" IS NOT DISTINCT FROM NEW."providerResponseId"
     AND assessment."summary" IS NOT DISTINCT FROM NEW."summary"
     AND assessment."elementType" IS NOT DISTINCT FROM NEW."elementType"
     AND assessment."progressMin" IS NOT DISTINCT FROM NEW."progressMin"
     AND assessment."progressMax" IS NOT DISTINCT FROM NEW."progressMax"
     AND assessment."confidence" IS NOT DISTINCT FROM NEW."confidence"
     AND assessment."quality" IS NOT DISTINCT FROM NEW."quality"
     AND assessment."observations" IS NOT DISTINCT FROM NEW."observations"
     AND assessment."limitations" IS NOT DISTINCT FROM NEW."limitations"
     AND assessment."inputTokens" IS NOT DISTINCT FROM NEW."inputTokens"
     AND assessment."outputTokens" IS NOT DISTINCT FROM NEW."outputTokens"
     AND assessment."totalTokens" IS NOT DISTINCT FROM NEW."totalTokens"
     AND assessment."cachedInputTokens" IS NOT DISTINCT FROM NEW."cachedInputTokens"
     AND assessment."status" = CASE
       WHEN NEW."abstained" THEN 'ABSTAINED'::"public"."VisualProgressAssessmentStatus"
       ELSE 'COMPLETED'::"public"."VisualProgressAssessmentStatus"
     END
     AND assessment."reviewStatus" = 'PENDING'
     AND assessment."failureCode" IS NULL
     AND assessment."leaseExpiresAt" IS NULL
     AND assessment."completedAt" IS NOT NULL
     AND NEW."appliedAt" >= assessment."completedAt"
   FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'visual provider receipt does not match assessment projection'
      USING ERRCODE = '23514',
            CONSTRAINT = 'VPRR_projection_guard';
  END IF;

  IF NEW."inputTokens" IS NULL THEN
    PERFORM 1
      FROM "public"."AiDispatchBudgetReservation" AS reservation
      JOIN "public"."VisualProgressAssessment" AS assessment
        ON assessment."id" = reservation."assessmentId"
     WHERE reservation."assessmentId" = NEW."assessmentId"
       AND reservation."organizationId" = NEW."organizationId"
       AND reservation."projectId" = NEW."projectId"
       AND reservation."status" = 'RESERVED'
       AND reservation."actualMicros" IS NULL
       AND assessment."actualCostMicros" IS NULL
     FOR KEY SHARE OF reservation;
  ELSE
    PERFORM 1
      FROM "public"."AiDispatchBudgetReservation" AS reservation
      JOIN "public"."VisualProgressAssessment" AS assessment
        ON assessment."id" = reservation."assessmentId"
     WHERE reservation."assessmentId" = NEW."assessmentId"
       AND reservation."organizationId" = NEW."organizationId"
       AND reservation."projectId" = NEW."projectId"
       AND reservation."status" = 'SETTLED'
       AND reservation."settlementBasis" = 'RESPONSE_USAGE'
       AND reservation."settlementEvidenceSha256" = NEW."receiptSha256"
       AND reservation."actualMicros" IS NOT NULL
       AND assessment."actualCostMicros" = reservation."actualMicros"
     FOR KEY SHARE OF reservation;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'visual provider receipt billing state is not atomically aligned'
      USING ERRCODE = '23514',
            CONSTRAINT = 'VPRR_settlement_projection_guard';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "VPRR_write_once"
BEFORE INSERT OR UPDATE ON "VisualProgressProviderResultReceipt"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_visual_progress_receipt_write_once"();

-- A receipt is retained for the tenant lifetime. Deferred evaluation permits
-- only the explicit Organization cascade; direct receipt, assessment or
-- project deletion cannot erase provider evidence inside a live tenant.
CREATE FUNCTION "obrasaas_visual_progress_receipt_retention"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM 1
    FROM "public"."Organization" AS organization
   WHERE organization."id" = OLD."organizationId";
  IF FOUND THEN
    RAISE EXCEPTION 'visual provider receipt must be retained for the tenant lifetime'
      USING ERRCODE = '23503',
            CONSTRAINT = 'VPRR_assessment_retention_guard';
  END IF;
  RETURN OLD;
END;
$$;

CREATE CONSTRAINT TRIGGER "VPRR_assessment_retention"
AFTER DELETE ON "VisualProgressProviderResultReceipt"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_visual_progress_receipt_retention"();

-- Only reserve/settle may mutate the economic aggregate. The exact transition
-- is checked as defense in depth against accidental ORM writes. These custom
-- GUCs remain user-settable by roles with arbitrary SQL, so production roles
-- must still be least-privileged and unable to execute arbitrary statements.
CREATE FUNCTION "obrasaas_ai_budget_ledger_write_guard"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  expected_key TEXT;
  marker_action TEXT;
  marker_reserved_delta NUMERIC;
  marker_settled_delta NUMERIC;
  marker_reserved_delta_text TEXT;
  marker_settled_delta_text TEXT;
BEGIN
  expected_key := jsonb_build_array(
    NEW."organizationId",
    NEW."civilDayUtc"::TEXT,
    NEW."workload"
  )::TEXT;
  marker_action := current_setting('obrasaas.ai_budget_ledger_action', true);
  marker_reserved_delta_text := current_setting(
    'obrasaas.ai_budget_ledger_reserved_delta',
    true
  );
  marker_settled_delta_text := current_setting(
    'obrasaas.ai_budget_ledger_settled_delta',
    true
  );

  IF current_setting('obrasaas.ai_budget_ledger_key', true)
      IS DISTINCT FROM expected_key
    OR marker_action IS NULL
    OR marker_action NOT IN ('reserve', 'settle')
    OR marker_reserved_delta_text IS NULL
    OR marker_reserved_delta_text !~ '^[0-9]+$'
    OR marker_settled_delta_text IS NULL
    OR marker_settled_delta_text !~ '^[0-9]+$'
  THEN
    RAISE EXCEPTION 'AI budget ledger can only change through reserve or settle'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDailyBudgetLedger_transition_guard';
  END IF;

  marker_reserved_delta := marker_reserved_delta_text::NUMERIC;
  marker_settled_delta := marker_settled_delta_text::NUMERIC;

  IF TG_OP = 'INSERT' THEN
    IF marker_action <> 'reserve'
      OR NEW."reservedMicros"::NUMERIC <> marker_reserved_delta
      OR NEW."settledMicros" <> 0
      OR marker_settled_delta <> 0
      OR NEW."requestCount" <> 1
      OR NEW."revision" <> 0
    THEN
      RAISE EXCEPTION 'AI budget ledger insert does not match reserve admission'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDailyBudgetLedger_transition_guard';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(
      NEW."organizationId",
      NEW."civilDayUtc",
      NEW."workload",
      NEW."quotaPolicyVersion",
      NEW."budgetLimitMicros",
      NEW."createdAt"
    ) IS DISTINCT FROM ROW(
      OLD."organizationId",
      OLD."civilDayUtc",
      OLD."workload",
      OLD."quotaPolicyVersion",
      OLD."budgetLimitMicros",
      OLD."createdAt"
    )
    OR NEW."updatedAt" < OLD."updatedAt"
  THEN
    RAISE EXCEPTION 'AI budget ledger identity and policy are immutable'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDailyBudgetLedger_transition_guard';
  END IF;

  IF marker_action = 'reserve' THEN
    IF NEW."reservedMicros"::NUMERIC
        <> OLD."reservedMicros"::NUMERIC + marker_reserved_delta
      OR NEW."settledMicros" <> OLD."settledMicros"
      OR marker_settled_delta <> 0
      OR NEW."requestCount" <> OLD."requestCount" + 1
      OR NEW."revision" <> OLD."revision" + 1
    THEN
      RAISE EXCEPTION 'AI budget ledger update does not match reserve admission'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDailyBudgetLedger_transition_guard';
    END IF;
  ELSE
    IF NEW."reservedMicros"::NUMERIC
        <> OLD."reservedMicros"::NUMERIC - marker_reserved_delta
      OR NEW."settledMicros"::NUMERIC
        <> OLD."settledMicros"::NUMERIC + marker_settled_delta
      OR NEW."requestCount" <> OLD."requestCount"
      OR NEW."revision" <> OLD."revision" + 1
    THEN
      RAISE EXCEPTION 'AI budget ledger update does not match settlement'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDailyBudgetLedger_transition_guard';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "AiDailyBudgetLedger_write_guard"
BEFORE INSERT OR UPDATE ON "AiDailyBudgetLedger"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_ai_budget_ledger_write_guard"();

-- Economic aggregates are tenant-lifetime audit records. A deferred guard
-- permits the Organization cascade but rejects a standalone ledger purge even
-- after every child assessment/project has been removed.
CREATE FUNCTION "obrasaas_ai_budget_ledger_retention"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM 1
    FROM "public"."Organization" AS organization
   WHERE organization."id" = OLD."organizationId";
  IF FOUND THEN
    RAISE EXCEPTION 'AI budget ledger must be retained for the tenant lifetime'
      USING ERRCODE = '23503',
            CONSTRAINT = 'AiDailyBudgetLedger_organization_retention_guard';
  END IF;
  RETURN OLD;
END;
$$;

CREATE CONSTRAINT TRIGGER "AiDailyBudgetLedger_organization_retention"
AFTER DELETE ON "AiDailyBudgetLedger"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_ai_budget_ledger_retention"();

CREATE FUNCTION "obrasaas_ai_budget_reservation_write_once"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_setting('obrasaas.ai_reservation_insert_assessment', true)
      IS DISTINCT FROM NEW."assessmentId"
    THEN
      RAISE EXCEPTION 'AI reservation can only be inserted through admission'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDispatchBudgetReservation_insert_guard';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(
      NEW."assessmentId",
      NEW."organizationId",
      NEW."projectId",
      NEW."civilDayUtc",
      NEW."workload",
      NEW."quotaPolicyVersion",
      NEW."budgetLimitMicros",
      NEW."reservedMicros",
      NEW."reservedAt",
      NEW."createdAt"
    ) IS DISTINCT FROM ROW(
      OLD."assessmentId",
      OLD."organizationId",
      OLD."projectId",
      OLD."civilDayUtc",
      OLD."workload",
      OLD."quotaPolicyVersion",
      OLD."budgetLimitMicros",
      OLD."reservedMicros",
      OLD."reservedAt",
      OLD."createdAt"
    )
  THEN
    RAISE EXCEPTION 'AI reservation identity is immutable'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_identity_immutable';
  END IF;

  IF OLD."status" IN ('SETTLED', 'RELEASED') THEN
    IF ROW(
        NEW."actualMicros",
        NEW."status",
        NEW."settlementBasis",
        NEW."settlementOperationKeyHash",
        NEW."settlementEvidenceSha256",
        NEW."settledById",
        NEW."settledAt",
        NEW."revision",
        NEW."updatedAt"
      ) IS DISTINCT FROM ROW(
        OLD."actualMicros",
        OLD."status",
        OLD."settlementBasis",
        OLD."settlementOperationKeyHash",
        OLD."settlementEvidenceSha256",
        OLD."settledById",
        OLD."settledAt",
        OLD."revision",
        OLD."updatedAt"
      )
    THEN
      RAISE EXCEPTION 'terminal AI settlement provenance is immutable'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDispatchBudgetReservation_terminal_immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."status" IN ('SETTLED', 'RELEASED')
    AND current_setting('obrasaas.ai_settlement_assessment', true)
      IS DISTINCT FROM NEW."assessmentId"
  THEN
    RAISE EXCEPTION 'AI reservation can only become terminal through durable settlement'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_transition_guard';
  END IF;

  IF NEW."status" = 'RESERVED'
    AND ROW(
      NEW."actualMicros",
      NEW."settlementBasis",
      NEW."settlementOperationKeyHash",
      NEW."settlementEvidenceSha256",
      NEW."settledById",
      NEW."settledAt",
      NEW."revision",
      NEW."updatedAt"
    ) IS DISTINCT FROM ROW(
      OLD."actualMicros",
      OLD."settlementBasis",
      OLD."settlementOperationKeyHash",
      OLD."settlementEvidenceSha256",
      OLD."settledById",
      OLD."settledAt",
      OLD."revision",
      OLD."updatedAt"
    )
  THEN
    RAISE EXCEPTION 'active AI reservation can only transition through settlement'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchBudgetReservation_transition_guard';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "AiDispatchBudgetReservation_write_once"
BEFORE INSERT OR UPDATE ON "AiDispatchBudgetReservation"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_ai_budget_reservation_write_once"();

CREATE FUNCTION "obrasaas_ai_budget_reservation_retention"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM 1
    FROM "public"."Organization" AS organization
   WHERE organization."id" = OLD."organizationId";
  IF FOUND THEN
    RAISE EXCEPTION 'AI reservation must be retained for the tenant lifetime'
      USING ERRCODE = '23503',
            CONSTRAINT = 'AiDispatchBudgetReservation_assessment_retention_guard';
  END IF;
  RETURN OLD;
END;
$$;

CREATE CONSTRAINT TRIGGER "AiDispatchBudgetReservation_assessment_retention"
AFTER DELETE ON "AiDispatchBudgetReservation"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_ai_budget_reservation_retention"();

-- Route, pricing and provider evidence are write-once audit facts. The trigger
-- permits the expected staged transition (plan -> dispatch -> telemetry ->
-- settlement) while rejecting accidental rewrites through generic Prisma DML.
CREATE FUNCTION "obrasaas_ai_dispatch_audit_write_once"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."actualCostMicros" IS NOT NULL THEN
      RAISE EXCEPTION 'AI actual cost must be written by durable settlement'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDispatchAudit_settlement_required';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."registryModelId" IS NOT NULL
    AND ROW(
      OLD."provider",
      OLD."providerModel",
      OLD."registryModelId",
      OLD."providerRoute",
      OLD."routePolicyVersion",
      OLD."routeReasonCode",
      OLD."pricingVersion",
      OLD."budgetCivilDayUtc",
      OLD."budgetWorkload",
      OLD."quotaPolicyVersion",
      OLD."budgetLimitMicros",
      OLD."budgetReservationMicros",
      OLD."estimateBasis",
      OLD."estimatedCostMicros",
      OLD."analyzerVersion"
    ) IS DISTINCT FROM ROW(
      NEW."provider",
      NEW."providerModel",
      NEW."registryModelId",
      NEW."providerRoute",
      NEW."routePolicyVersion",
      NEW."routeReasonCode",
      NEW."pricingVersion",
      NEW."budgetCivilDayUtc",
      NEW."budgetWorkload",
      NEW."quotaPolicyVersion",
      NEW."budgetLimitMicros",
      NEW."budgetReservationMicros",
      NEW."estimateBasis",
      NEW."estimatedCostMicros",
      NEW."analyzerVersion"
    )
  THEN
    RAISE EXCEPTION 'AI route, pricing and budget snapshot is immutable'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchAudit_core_immutable';
  END IF;

  IF OLD."providerDispatchStartedAt" IS NOT NULL
    AND NEW."providerDispatchStartedAt" IS DISTINCT FROM OLD."providerDispatchStartedAt"
  THEN
    RAISE EXCEPTION 'AI provider dispatch boundary is immutable'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchAudit_dispatch_start_immutable';
  END IF;

  IF OLD."providerDispatchStartedAt" IS NULL
    AND NEW."providerDispatchStartedAt" IS NOT NULL
  THEN
    PERFORM 1
      FROM "public"."AiDispatchBudgetReservation" AS reservation
     WHERE reservation."assessmentId" = NEW."id"
       AND reservation."status" = 'RESERVED'
       AND reservation."actualMicros" IS NULL
       AND reservation."organizationId" = (
         SELECT project."organizationId"
           FROM "public"."Project" AS project
          WHERE project."id" = NEW."projectId"
       )
       AND reservation."projectId" = NEW."projectId"
       AND reservation."civilDayUtc" IS NOT DISTINCT FROM NEW."budgetCivilDayUtc"
       AND reservation."workload" IS NOT DISTINCT FROM NEW."budgetWorkload"
       AND reservation."quotaPolicyVersion" IS NOT DISTINCT FROM NEW."quotaPolicyVersion"
       AND reservation."budgetLimitMicros" IS NOT DISTINCT FROM NEW."budgetLimitMicros"
       AND reservation."reservedMicros" IS NOT DISTINCT FROM NEW."budgetReservationMicros"
     FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'AI provider dispatch requires a durable active reservation'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDispatchAudit_dispatch_reservation_required';
    END IF;
  END IF;

  IF OLD."providerRequestId" IS NOT NULL
    AND NEW."providerRequestId" IS DISTINCT FROM OLD."providerRequestId"
  THEN
    RAISE EXCEPTION 'AI provider request correlation is immutable'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchAudit_request_id_immutable';
  END IF;

  IF OLD."providerResponseId" IS NOT NULL
    AND NEW."providerResponseId" IS DISTINCT FROM OLD."providerResponseId"
  THEN
    RAISE EXCEPTION 'AI provider response correlation is immutable'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchAudit_response_id_immutable';
  END IF;

  IF num_nonnulls(
      OLD."inputTokens",
      OLD."outputTokens",
      OLD."totalTokens",
      OLD."cachedInputTokens"
    ) > 0
    AND ROW(
      NEW."inputTokens",
      NEW."outputTokens",
      NEW."totalTokens",
      NEW."cachedInputTokens"
    ) IS DISTINCT FROM ROW(
      OLD."inputTokens",
      OLD."outputTokens",
      OLD."totalTokens",
      OLD."cachedInputTokens"
    )
  THEN
    RAISE EXCEPTION 'AI provider usage telemetry is immutable'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchAudit_usage_immutable';
  END IF;

  IF OLD."actualCostMicros" IS NOT NULL
    AND NEW."actualCostMicros" IS DISTINCT FROM OLD."actualCostMicros"
  THEN
    RAISE EXCEPTION 'AI actual cost is immutable after settlement'
      USING ERRCODE = '23514',
            CONSTRAINT = 'AiDispatchAudit_actual_cost_immutable';
  END IF;

  IF NEW."actualCostMicros" IS DISTINCT FROM OLD."actualCostMicros" THEN
    IF current_setting('obrasaas.ai_settlement_assessment', true)
      IS DISTINCT FROM NEW."id"
    THEN
      RAISE EXCEPTION 'AI actual cost must be written by durable settlement'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDispatchAudit_settlement_required';
    END IF;

    PERFORM 1
      FROM "public"."AiDispatchBudgetReservation" AS reservation
     WHERE reservation."assessmentId" = NEW."id"
       AND reservation."actualMicros" IS NOT DISTINCT FROM NEW."actualCostMicros"
       AND reservation."status" IN ('SETTLED', 'RELEASED');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'AI actual cost must match durable terminal settlement'
        USING ERRCODE = '23514',
              CONSTRAINT = 'AiDispatchAudit_settlement_required';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "VisualProgressAssessment_ai_dispatch_write_once"
BEFORE INSERT OR UPDATE ON "VisualProgressAssessment"
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_ai_dispatch_audit_write_once"();

-- Application admission intentionally writes the governed assessment snapshot
-- before calling reserve in the same transaction. Deferred validation permits
-- that order while making an orphan governed assessment impossible at COMMIT.
CREATE FUNCTION "obrasaas_ai_assessment_budget_reservation_required"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM 1
    FROM "public"."VisualProgressAssessment" AS assessment
   WHERE assessment."id" = NEW."id"
     AND assessment."projectId" = NEW."projectId";
  IF NOT FOUND THEN
    -- The assessment disappeared as part of a project/tenant cascade.
    RETURN NEW;
  END IF;

  IF NEW."registryModelId" IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1
    FROM "public"."VisualProgressAssessment" AS assessment
    JOIN "public"."Project" AS project
      ON project."id" = assessment."projectId"
    JOIN "public"."AiDispatchBudgetReservation" AS reservation
      ON reservation."assessmentId" = assessment."id"
     AND reservation."organizationId" = project."organizationId"
     AND reservation."projectId" = assessment."projectId"
     AND reservation."civilDayUtc" IS NOT DISTINCT FROM assessment."budgetCivilDayUtc"
     AND reservation."workload" IS NOT DISTINCT FROM assessment."budgetWorkload"
     AND reservation."quotaPolicyVersion" IS NOT DISTINCT FROM assessment."quotaPolicyVersion"
     AND reservation."budgetLimitMicros" IS NOT DISTINCT FROM assessment."budgetLimitMicros"
     AND reservation."reservedMicros" IS NOT DISTINCT FROM assessment."budgetReservationMicros"
    JOIN "public"."AiDailyBudgetLedger" AS ledger
      ON ledger."organizationId" = reservation."organizationId"
     AND ledger."civilDayUtc" = reservation."civilDayUtc"
     AND ledger."workload" = reservation."workload"
     AND ledger."quotaPolicyVersion" = reservation."quotaPolicyVersion"
     AND ledger."budgetLimitMicros" = reservation."budgetLimitMicros"
   WHERE assessment."id" = NEW."id"
     AND assessment."projectId" = NEW."projectId"
     AND (
       (
         assessment."actualCostMicros" IS NULL
         AND reservation."status" = 'RESERVED'
         AND reservation."actualMicros" IS NULL
       )
       OR (
         assessment."actualCostMicros" IS NOT NULL
         AND reservation."status" IN ('SETTLED', 'RELEASED')
         AND reservation."actualMicros" = assessment."actualCostMicros"
       )
     )
   FOR KEY SHARE OF assessment, project, reservation, ledger;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'governed AI assessment requires an exact durable budget reservation'
      USING ERRCODE = '23503',
            CONSTRAINT = 'VisualProgressAssessment_budget_reservation_required';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "VisualProgressAssessment_budget_reservation_required"
AFTER INSERT OR UPDATE ON "VisualProgressAssessment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "obrasaas_ai_assessment_budget_reservation_required"();

COMMENT ON TABLE "AiDailyBudgetLedger" IS
  'Fail-closed admission aggregate and truthful micro-USD settlement ledger per tenant, UTC civil day and workload.';

COMMENT ON TABLE "AiDispatchBudgetReservation" IS
  'Exactly-once AI budget reservation and settlement identity bound to one VisualProgressAssessment.';

COMMENT ON COLUMN "VisualProgressAssessment"."budgetReservationMicros" IS
  'Durable conservative budget hold in integer micro-USD before provider dispatch; assessment creation and reserve admission must share one transaction.';

COMMENT ON COLUMN "VisualProgressAssessment"."actualCostMicros" IS
  'Truthful settled provider cost in integer micro-USD, including budget overruns.';
