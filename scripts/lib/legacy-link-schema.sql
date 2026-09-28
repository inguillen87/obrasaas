-- Isolated reference ledger only. Never run as an application migration.
CREATE SCHEMA obrasaas_link_rehearsal_v1;
REVOKE ALL ON SCHEMA obrasaas_link_rehearsal_v1 FROM PUBLIC;
CREATE TABLE obrasaas_link_rehearsal_v1.header (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  version text NOT NULL CHECK (version = 'reference-link-rehearsal-v1')
);
INSERT INTO obrasaas_link_rehearsal_v1.header VALUES (true, 'reference-link-rehearsal-v1');
CREATE TABLE obrasaas_link_rehearsal_v1.runs (
  run_id text PRIMARY KEY CHECK (run_id ~ '^run_[a-f0-9]{64}$'),
  target_ref text NOT NULL,
  source_sha text NOT NULL CHECK (source_sha ~ '^[a-f0-9]{40}$'),
  plan_fingerprint text UNIQUE NOT NULL CHECK (plan_fingerprint ~ '^[a-f0-9]{64}$'),
  links_digest text NOT NULL CHECK (links_digest ~ '^[a-f0-9]{64}$'),
  record_digest text NOT NULL CHECK (record_digest ~ '^[a-f0-9]{64}$'),
  link_count integer NOT NULL CHECK (link_count BETWEEN 1 AND 5000),
  state text NOT NULL CHECK (state IN ('RECORDED', 'REVERTED')),
  revision integer NOT NULL CHECK (revision IN (1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  reverted_at timestamptz,
  CHECK ((state = 'RECORDED' AND revision = 1 AND reverted_at IS NULL) OR
         (state = 'REVERTED' AND revision = 2 AND reverted_at IS NOT NULL))
);
CREATE TABLE obrasaas_link_rehearsal_v1.links (
  run_id text NOT NULL REFERENCES obrasaas_link_rehearsal_v1.runs(run_id),
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 1 AND 5000),
  source_ref text NOT NULL CHECK (source_ref ~ '^source_[a-f0-9]{64}$'),
  target_ref text NOT NULL CHECK (target_ref ~ '^target_[a-f0-9]{64}$'),
  parent_source_ref text,
  kind text NOT NULL CHECK (kind IN ('organization', 'project', 'worker', 'task')),
  operation_key text UNIQUE NOT NULL CHECK (operation_key ~ '^op_[a-f0-9]{64}$'),
  PRIMARY KEY (run_id, source_ref),
  UNIQUE (run_id, ordinal), UNIQUE (run_id, target_ref),
  FOREIGN KEY (run_id, parent_source_ref) REFERENCES obrasaas_link_rehearsal_v1.links(run_id, source_ref),
  CHECK ((kind = 'organization' AND parent_source_ref IS NULL) OR
         (kind <> 'organization' AND parent_source_ref IS NOT NULL))
);
CREATE TABLE obrasaas_link_rehearsal_v1.events (
  operation_key text PRIMARY KEY,
  run_id text NOT NULL REFERENCES obrasaas_link_rehearsal_v1.runs(run_id),
  operation text NOT NULL CHECK (operation IN ('RECORD','REVERT')),
  request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  receipt jsonb NOT NULL,
  receipt_digest text NOT NULL CHECK (receipt_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, operation)
);
REVOKE ALL ON ALL TABLES IN SCHEMA obrasaas_link_rehearsal_v1 FROM PUBLIC;
