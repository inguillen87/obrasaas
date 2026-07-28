-- Isolated pre-worker WhatsApp Flow sessions. The recipient address remains
-- encrypted exclusively on WorkerOnboardingClaim; this transport journal only
-- stores Meta resource identities and a SHA-256 token commitment.
CREATE UNIQUE INDEX "WorkerClaim_flow_session_scope_key"
ON "WorkerOnboardingClaim"("organizationId", "projectId", "connectionId", "id");

ALTER TABLE "WorkerOnboardingClaim"
ADD COLUMN "privacyNoticeContentSha256" CHAR(64);

ALTER TABLE "WorkerOnboardingClaim"
ADD CONSTRAINT "WorkerClaim_privacy_notice_evidence_check" CHECK (
  (
    "privacyNoticeContentSha256" IS NULL
    AND "claimedIdentityEncryptedPayload" IS NULL
    AND "privacyNoticeVersion" IS NULL
    AND "privacyAcceptedAt" IS NULL
  )
  OR
  (
    "privacyNoticeContentSha256" ~ '^[0-9a-f]{64}$'
    AND "claimedIdentityEncryptedPayload" IS NOT NULL
    AND "privacyNoticeVersion" IS NOT NULL
    AND "privacyAcceptedAt" IS NOT NULL
  )
);

CREATE TABLE "WorkerOnboardingFlowSession" (
    "id" UUID NOT NULL,
    "claimId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "phoneNumberId" VARCHAR(40) NOT NULL,
    "blueprintKey" VARCHAR(100) NOT NULL,
    "flowId" VARCHAR(40) NOT NULL,
    "screenId" VARCHAR(30) NOT NULL,
    "flowType" VARCHAR(64) NOT NULL,
    "sourceExternalId" VARCHAR(512) NOT NULL,
    "noticeVersion" VARCHAR(64) NOT NULL,
    "noticeContentSha256" CHAR(64) NOT NULL,
    "tokenSha256" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deliveryAttemptedAt" TIMESTAMP(3),
    "deliveryRejectedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "providerMessageId" VARCHAR(500),
    -- Evidence that the Data Endpoint served INIT with the pinned notice. It
    -- does not assert that the recipient read or understood the notice.
    "privacyPresentedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "consumedExternalId" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerOnboardingFlowSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WOFlowSession_contract_check" CHECK (
      "blueprintKey" = 'worker-onboarding'
      AND "screenId" = 'WORKER_ONBOARDING'
      AND "flowType" = 'worker_onboarding'
      AND "phoneNumberId" ~ '^[0-9]{5,40}$'
      AND "flowId" ~ '^[0-9]{5,40}$'
      AND "noticeVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
      AND "noticeContentSha256" ~ '^[0-9a-f]{64}$'
      AND "tokenSha256" ~ '^[0-9a-f]{64}$'
      AND char_length("sourceExternalId") BETWEEN 1 AND 512
      AND "expiresAt" > "createdAt"
    ),
    CONSTRAINT "WOFlowSession_delivery_shape_check" CHECK (
      (
        "deliveryAttemptedAt" IS NULL
        OR "deliveryAttemptedAt" >= "createdAt"
      )
      AND (
        "deliveryRejectedAt" IS NULL
        OR (
          "deliveryAttemptedAt" IS NOT NULL
          AND "deliveryRejectedAt" >= "deliveryAttemptedAt"
          AND "sentAt" IS NULL
          AND "providerMessageId" IS NULL
          AND "privacyPresentedAt" IS NULL
          AND "submittedAt" IS NULL
          AND "consumedAt" IS NULL
          AND "consumedExternalId" IS NULL
        )
      )
      AND (
        ("sentAt" IS NULL AND "providerMessageId" IS NULL)
        OR (
          "sentAt" IS NOT NULL
          AND "providerMessageId" IS NOT NULL
          AND "deliveryAttemptedAt" IS NOT NULL
          AND "deliveryRejectedAt" IS NULL
          AND "sentAt" >= "deliveryAttemptedAt"
        )
      )
      AND (
        "privacyPresentedAt" IS NULL
        OR (
          "deliveryAttemptedAt" IS NOT NULL
          AND "deliveryRejectedAt" IS NULL
          AND "privacyPresentedAt" >= "deliveryAttemptedAt"
        )
      )
      AND (
        "submittedAt" IS NULL
        OR (
          "deliveryAttemptedAt" IS NOT NULL
          AND "deliveryRejectedAt" IS NULL
          AND "privacyPresentedAt" IS NOT NULL
          AND "submittedAt" >= "privacyPresentedAt"
          AND "submittedAt" >= "deliveryAttemptedAt"
        )
      )
      AND (
        ("consumedAt" IS NULL AND "consumedExternalId" IS NULL)
        OR (
          "consumedAt" IS NOT NULL
          AND "consumedExternalId" IS NOT NULL
          AND "submittedAt" IS NOT NULL
          AND "deliveryRejectedAt" IS NULL
          AND "consumedAt" >= "submittedAt"
        )
      )
    )
);

CREATE UNIQUE INDEX "WorkerOnboardingFlowSession_claimId_key"
ON "WorkerOnboardingFlowSession"("claimId");

CREATE UNIQUE INDEX "WorkerOnboardingFlowSession_claim_scope_key"
ON "WorkerOnboardingFlowSession"("organizationId", "projectId", "connectionId", "claimId");

CREATE UNIQUE INDEX "WorkerOnboardingFlowSession_tokenSha256_key"
ON "WorkerOnboardingFlowSession"("tokenSha256");

CREATE UNIQUE INDEX "WorkerOnboardingFlowSession_providerMessageId_key"
ON "WorkerOnboardingFlowSession"("providerMessageId");

CREATE UNIQUE INDEX "WorkerOnboardingFlowSession_source_key"
ON "WorkerOnboardingFlowSession"("projectId", "sourceExternalId", "blueprintKey");

CREATE UNIQUE INDEX "WorkerOnboardingFlowSession_consumed_event_key"
ON "WorkerOnboardingFlowSession"("projectId", "consumedExternalId");

CREATE INDEX "WorkerOnboardingFlowSession_organizationId_expiresAt_idx"
ON "WorkerOnboardingFlowSession"("organizationId", "expiresAt");

CREATE INDEX "WorkerOnboardingFlowSession_projectId_claimId_expiresAt_idx"
ON "WorkerOnboardingFlowSession"("projectId", "claimId", "expiresAt");

CREATE INDEX "WorkerOnboardingFlowSession_connectionId_expiresAt_idx"
ON "WorkerOnboardingFlowSession"("connectionId", "expiresAt");

CREATE INDEX "WorkerOnboardingFlowSession_expiresAt_consumedAt_idx"
ON "WorkerOnboardingFlowSession"("expiresAt", "consumedAt");

CREATE INDEX "WorkerOnboardingFlowSession_phoneNumberId_expiresAt_idx"
ON "WorkerOnboardingFlowSession"("phoneNumberId", "expiresAt");

ALTER TABLE "WorkerOnboardingFlowSession"
ADD CONSTRAINT "WorkerOnboardingFlowSession_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkerOnboardingFlowSession"
ADD CONSTRAINT "WorkerOnboardingFlowSession_project_scope_fkey"
FOREIGN KEY ("organizationId", "projectId")
REFERENCES "Project"("organizationId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkerOnboardingFlowSession"
ADD CONSTRAINT "WorkerOnboardingFlowSession_connection_scope_fkey"
FOREIGN KEY ("projectId", "connectionId")
REFERENCES "WhatsAppConnection"("projectId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkerOnboardingFlowSession"
ADD CONSTRAINT "WorkerOnboardingFlowSession_claim_scope_fkey"
FOREIGN KEY ("organizationId", "projectId", "connectionId", "claimId")
REFERENCES "WorkerOnboardingClaim"("organizationId", "projectId", "connectionId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Endpoint request ciphertext is a cryptographic replay tombstone. Session
-- retention is shorter, so deleting a session must preserve the exact durable
-- response instead of allowing the same Meta envelope to be recomputed.
ALTER TABLE "WhatsAppFlowEndpointRequest"
DROP CONSTRAINT "WhatsAppFlowEndpointRequest_flowSessionId_fkey";

ALTER TABLE "WhatsAppFlowEndpointRequest"
ADD CONSTRAINT "WhatsAppFlowEndpointRequest_flowSessionId_fkey"
FOREIGN KEY ("flowSessionId") REFERENCES "WhatsAppFlowSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhatsAppFlowEndpointRequest"
ADD COLUMN "workerOnboardingFlowSessionId" UUID;

CREATE INDEX "WAFlowEndpointRequest_onboarding_session_created_idx"
ON "WhatsAppFlowEndpointRequest"("workerOnboardingFlowSessionId", "createdAt");

ALTER TABLE "WhatsAppFlowEndpointRequest"
ADD CONSTRAINT "WAFlowEndpointRequest_onboarding_session_fkey"
FOREIGN KEY ("workerOnboardingFlowSessionId")
REFERENCES "WorkerOnboardingFlowSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Meta error acknowledgements can legitimately complete with action
-- data_exchange and no authenticated session. Until the request journal gains
-- an explicit NONE/OPERATIONAL/WORKER_ONBOARDING discriminator, enforce the
-- safe invariant available without misclassifying those ACKs: never associate
-- one request with both session domains.
ALTER TABLE "WhatsAppFlowEndpointRequest"
ADD CONSTRAINT "WAFlowEndpointRequest_session_at_most_one_check"
CHECK (num_nonnulls("flowSessionId", "workerOnboardingFlowSessionId") <= 1);
