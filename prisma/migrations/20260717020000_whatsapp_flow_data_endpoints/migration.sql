-- Per-connection WhatsApp Flows data endpoints. Private RSA material is
-- envelope-encrypted by an independent application KEK before persistence.
CREATE TYPE "WhatsAppFlowEndpointKeyStatus" AS ENUM (
    'STAGED',
    'ACTIVE',
    'RETIRING',
    'REVOKED'
);

CREATE TYPE "WhatsAppFlowEndpointRequestStatus" AS ENUM (
    'PROCESSING',
    'SUCCEEDED',
    'REJECTED',
    'FAILED'
);

CREATE TABLE "WhatsAppFlowEndpoint" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connectionId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppFlowEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppFlowEndpointKey" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "endpointId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "WhatsAppFlowEndpointKeyStatus" NOT NULL DEFAULT 'STAGED',
    "encryptedPrivateKey" TEXT NOT NULL,
    "publicKeyPem" TEXT NOT NULL,
    "publicKeySha256" CHAR(64) NOT NULL,
    "wrappingKeyId" VARCHAR(100) NOT NULL,
    "uploadedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "retiringAt" TIMESTAMP(3),
    "retireAfter" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppFlowEndpointKey_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WhatsAppFlowEndpointKey_version_check"
      CHECK ("version" > 0),
    CONSTRAINT "WhatsAppFlowEndpointKey_publicKeySha256_format_check"
      CHECK ("publicKeySha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "WhatsAppFlowEndpointKey_wrappingKeyId_format_check"
      CHECK ("wrappingKeyId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'),
    CONSTRAINT "WhatsAppFlowEndpointKey_material_size_check"
      CHECK (
        octet_length("publicKeyPem") BETWEEN 256 AND 8192
        AND octet_length("encryptedPrivateKey") BETWEEN 256 AND 32768
      ),
    CONSTRAINT "WhatsAppFlowEndpointKey_verification_order_check"
      CHECK (
        ("verifiedAt" IS NULL OR "uploadedAt" IS NOT NULL)
        AND ("verifiedAt" IS NULL OR "verifiedAt" >= "uploadedAt")
        AND ("activatedAt" IS NULL OR "verifiedAt" IS NOT NULL)
        AND ("activatedAt" IS NULL OR "activatedAt" >= "verifiedAt")
        AND ("retiringAt" IS NULL OR "activatedAt" IS NOT NULL)
        AND ("retiringAt" IS NULL OR "retiringAt" >= "activatedAt")
        AND ("retireAfter" IS NULL OR "retiringAt" IS NOT NULL)
        AND (
          "retireAfter" IS NULL
          OR "retireAfter" = "retiringAt" + INTERVAL '48 hours'
        )
        AND ("lastUsedAt" IS NULL OR "activatedAt" IS NOT NULL)
        AND ("lastUsedAt" IS NULL OR "lastUsedAt" >= "activatedAt")
      ),
    CONSTRAINT "WhatsAppFlowEndpointKey_state_shape_check"
      CHECK (
        (
          "status" = 'STAGED'
          AND "activatedAt" IS NULL
          AND "retiringAt" IS NULL
          AND "retireAfter" IS NULL
        )
        OR
        (
          "status" = 'ACTIVE'
          AND "uploadedAt" IS NOT NULL
          AND "verifiedAt" IS NOT NULL
          AND "activatedAt" IS NOT NULL
          AND "retiringAt" IS NULL
          AND "retireAfter" IS NULL
        )
        OR
        (
          "status" = 'RETIRING'
          AND "uploadedAt" IS NOT NULL
          AND "verifiedAt" IS NOT NULL
          AND "activatedAt" IS NOT NULL
          AND "retiringAt" IS NOT NULL
          AND "retireAfter" IS NOT NULL
        )
        OR "status" = 'REVOKED'
      )
);

CREATE TABLE "WhatsAppFlowEndpointRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "endpointId" UUID NOT NULL,
    "flowSessionId" UUID,
    "requestSha256" CHAR(64) NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "screen" VARCHAR(30),
    "keyVersion" INTEGER,
    "status" "WhatsAppFlowEndpointRequestStatus" NOT NULL DEFAULT 'PROCESSING',
    "responseStatus" INTEGER,
    "responseCiphertext" TEXT,
    "failureCode" VARCHAR(64),
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "leaseToken" UUID,
    "leaseExpiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppFlowEndpointRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WhatsAppFlowEndpointRequest_requestSha256_format_check"
      CHECK ("requestSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "WhatsAppFlowEndpointRequest_action_format_check"
      CHECK ("action" ~ '^[A-Za-z][A-Za-z0-9_]{0,31}$'),
    CONSTRAINT "WhatsAppFlowEndpointRequest_screen_format_check"
      CHECK ("screen" IS NULL OR "screen" ~ '^[A-Z][A-Z0-9_]{0,29}$'),
    CONSTRAINT "WhatsAppFlowEndpointRequest_key_version_check"
      CHECK ("keyVersion" IS NULL OR "keyVersion" > 0),
    CONSTRAINT "WhatsAppFlowEndpointRequest_response_status_check"
      CHECK ("responseStatus" IS NULL OR "responseStatus" BETWEEN 100 AND 599),
    CONSTRAINT "WhatsAppFlowEndpointRequest_attempts_check"
      CHECK ("attempts" > 0),
    CONSTRAINT "WhatsAppFlowEndpointRequest_expiry_check"
      CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "WhatsAppFlowEndpointRequest_lease_shape_check"
      CHECK (
        ("leaseToken" IS NULL AND "leaseExpiresAt" IS NULL)
        OR
        (
          "leaseToken" IS NOT NULL
          AND "leaseExpiresAt" IS NOT NULL
          AND "leaseExpiresAt" <= "expiresAt"
        )
      ),
    CONSTRAINT "WhatsAppFlowEndpointRequest_failure_code_format_check"
      CHECK (
        "failureCode" IS NULL
        OR "failureCode" ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$'
      ),
    CONSTRAINT "WhatsAppFlowEndpointRequest_response_size_check"
      CHECK (
        "responseCiphertext" IS NULL
        OR octet_length("responseCiphertext") <= 262144
      ),
    CONSTRAINT "WhatsAppFlowEndpointRequest_state_shape_check"
      CHECK (
        (
          "status" = 'PROCESSING'
          AND "completedAt" IS NULL
          AND "failureCode" IS NULL
        )
        OR
        (
          "status" = 'SUCCEEDED'
          AND "completedAt" IS NOT NULL
          AND "responseStatus" BETWEEN 200 AND 299
          AND "responseCiphertext" IS NOT NULL
          AND "failureCode" IS NULL
          AND "leaseToken" IS NULL
          AND "leaseExpiresAt" IS NULL
        )
        OR
        (
          "status" IN ('REJECTED', 'FAILED')
          AND "completedAt" IS NOT NULL
          AND "responseStatus" IS NOT NULL
          AND "failureCode" IS NOT NULL
          AND "leaseToken" IS NULL
          AND "leaseExpiresAt" IS NULL
        )
      )
);

CREATE UNIQUE INDEX "WhatsAppFlowEndpoint_connectionId_key"
ON "WhatsAppFlowEndpoint"("connectionId");

CREATE UNIQUE INDEX "WhatsAppFlowEndpointKey_endpointId_version_key"
ON "WhatsAppFlowEndpointKey"("endpointId", "version");

CREATE UNIQUE INDEX "WhatsAppFlowEndpointKey_publicKeySha256_key"
ON "WhatsAppFlowEndpointKey"("publicKeySha256");

-- Database-enforced rotation invariant. Application advisory locks provide a
-- useful conflict response; this index remains the final concurrency fence.
CREATE UNIQUE INDEX "WhatsAppFlowEndpointKey_one_active_per_endpoint_key"
ON "WhatsAppFlowEndpointKey"("endpointId")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "WhatsAppFlowEndpointKey_one_staged_per_endpoint_key"
ON "WhatsAppFlowEndpointKey"("endpointId")
WHERE "status" = 'STAGED';

CREATE UNIQUE INDEX "WhatsAppFlowEndpointKey_one_retiring_per_endpoint_key"
ON "WhatsAppFlowEndpointKey"("endpointId")
WHERE "status" = 'RETIRING';

CREATE INDEX "WhatsAppFlowEndpointKey_endpointId_status_version_idx"
ON "WhatsAppFlowEndpointKey"("endpointId", "status", "version");

CREATE INDEX "WhatsAppFlowEndpointKey_status_retireAfter_idx"
ON "WhatsAppFlowEndpointKey"("status", "retireAfter");

CREATE INDEX "WhatsAppFlowEndpointKey_wrappingKeyId_status_idx"
ON "WhatsAppFlowEndpointKey"("wrappingKeyId", "status");

CREATE UNIQUE INDEX "WhatsAppFlowEndpointRequest_endpointId_requestSha256_key"
ON "WhatsAppFlowEndpointRequest"("endpointId", "requestSha256");

CREATE INDEX "WhatsAppFlowEndpointRequest_endpointId_status_createdAt_idx"
ON "WhatsAppFlowEndpointRequest"("endpointId", "status", "createdAt");

CREATE INDEX "WhatsAppFlowEndpointRequest_status_leaseExpiresAt_createdAt_idx"
ON "WhatsAppFlowEndpointRequest"("status", "leaseExpiresAt", "createdAt");

CREATE INDEX "WhatsAppFlowEndpointRequest_flowSessionId_createdAt_idx"
ON "WhatsAppFlowEndpointRequest"("flowSessionId", "createdAt");

CREATE INDEX "WhatsAppFlowEndpointRequest_expiresAt_status_idx"
ON "WhatsAppFlowEndpointRequest"("expiresAt", "status");

ALTER TABLE "WhatsAppFlowEndpoint"
ADD CONSTRAINT "WhatsAppFlowEndpoint_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "WhatsAppConnection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppFlowEndpointKey"
ADD CONSTRAINT "WhatsAppFlowEndpointKey_endpointId_fkey"
FOREIGN KEY ("endpointId") REFERENCES "WhatsAppFlowEndpoint"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppFlowEndpointRequest"
ADD CONSTRAINT "WhatsAppFlowEndpointRequest_endpointId_fkey"
FOREIGN KEY ("endpointId") REFERENCES "WhatsAppFlowEndpoint"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppFlowEndpointRequest"
ADD CONSTRAINT "WhatsAppFlowEndpointRequest_flowSessionId_fkey"
FOREIGN KEY ("flowSessionId") REFERENCES "WhatsAppFlowSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
