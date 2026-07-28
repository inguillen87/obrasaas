-- Preserve the exact normalized request behind every idempotent schedule
-- operation. The previous migration already shipped to Preview, so this is an
-- additive migration instead of rewriting applied history.
--
-- Existing rows (none are expected because the API was not exposed yet) get a
-- deterministic legacy sentinel without issuing UPDATE statements that would
-- violate the append-only triggers. New application writes always provide the
-- real SHA-256 request fingerprint.
ALTER TABLE "ScheduleBaseline"
  ADD COLUMN "requestFingerprint" CHAR(64) NOT NULL
    DEFAULT repeat('0', 64);

ALTER TABLE "ScheduleBaseline"
  ALTER COLUMN "requestFingerprint" DROP DEFAULT,
  ADD CONSTRAINT "ScheduleBaseline_request_fingerprint_check"
    CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$');

ALTER TABLE "ScheduleForecastRun"
  ADD COLUMN "requestFingerprint" CHAR(64) NOT NULL
    DEFAULT repeat('0', 64);

ALTER TABLE "ScheduleForecastRun"
  ALTER COLUMN "requestFingerprint" DROP DEFAULT,
  ADD CONSTRAINT "ScheduleForecastRun_request_fingerprint_check"
    CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$');
