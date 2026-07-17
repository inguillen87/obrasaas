-- Backfill the namespaced, managed Task projection from the existing Gantt
-- snapshot. ProjectSnapshot remains the write authority during this phase;
-- Flow and portfolio reads only consume rows marked with this source.
BEGIN;

-- Runtime writers use the same per-project advisory lock. Acquiring every
-- project lock first gives the backfill a fresh, stable snapshot and prevents
-- an in-flight old deployment from leaving the projection stale.
-- TASK_PROJECTION_LOCKS_BEGIN
SELECT
  projects."projectId",
  pg_advisory_xact_lock(hashtextextended(projects."projectId", 0)) IS NULL AS locked
FROM (
  SELECT snapshot."projectId"
  FROM "ProjectSnapshot" AS snapshot
  UNION
  SELECT task."projectId"
  FROM "Task" AS task
  WHERE task."metadata"->>'source' = 'project-snapshot-v1'
) AS projects
ORDER BY projects."projectId";
-- TASK_PROJECTION_LOCKS_END

-- TASK_PROJECTION_BACKFILL_BEGIN
WITH snapshot_tasks AS (
  SELECT
    snapshot."projectId",
    snapshot."version" AS state_version,
    snapshot."createdAt" AS snapshot_created_at,
    snapshot."updatedAt" AS snapshot_updated_at,
    project."startsAt" AS project_starts_at,
    task.key AS snapshot_task_id,
    task.value AS snapshot_task,
    CASE
      WHEN COALESCE(task.value->>'progress', '') ~ '^-?[0-9]+([.][0-9]+)?$'
        THEN LEAST(100, GREATEST(0, round((task.value->>'progress')::numeric)::integer))
      ELSE 0
    END AS progress,
    CASE
      WHEN COALESCE(task.value->>'duration', '') ~ '^[0-9]+([.][0-9]+)?$'
        THEN LEAST(3650, GREATEST(1, round((task.value->>'duration')::numeric)::integer))
      ELSE 1
    END AS duration,
    CASE
      WHEN COALESCE(task.value->>'startDay', '') ~ '^[0-9]+$'
        THEN LEAST(3650, GREATEST(1, (task.value->>'startDay')::integer))
      ELSE NULL
    END AS start_day,
    CASE
      WHEN jsonb_typeof(task.value->'isDelayed') = 'boolean'
        THEN (task.value->>'isDelayed')::boolean
      ELSE false
    END AS is_delayed
  FROM "ProjectSnapshot" AS snapshot
  JOIN "Project" AS project ON project."id" = snapshot."projectId"
  CROSS JOIN LATERAL jsonb_each(
    CASE
      WHEN jsonb_typeof(snapshot."state"->'tasks') = 'object'
        THEN snapshot."state"->'tasks'
      ELSE '{}'::jsonb
    END
  ) AS task(key, value)
  WHERE jsonb_typeof(task.value) = 'object'
)

INSERT INTO "Task" (
  "id",
  "projectId",
  "externalId",
  "title",
  "status",
  "progress",
  "startsAt",
  "endsAt",
  "assignee",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT
  'snapshot_' || md5(source."projectId" || ':' || source.snapshot_task_id),
  source."projectId",
  'snapshot:' || source.snapshot_task_id,
  left(COALESCE(NULLIF(btrim(source.snapshot_task->>'name'), ''), 'Tarea sin nombre'), 160),
  CASE
    WHEN source.progress >= 100 THEN 'DONE'::"TaskStatus"
    WHEN source.is_delayed THEN 'BLOCKED'::"TaskStatus"
    WHEN source.progress > 0 THEN 'IN_PROGRESS'::"TaskStatus"
    ELSE 'READY'::"TaskStatus"
  END,
  source.progress,
  CASE
    WHEN source.project_starts_at IS NOT NULL AND source.start_day IS NOT NULL
      THEN date_trunc('day', source.project_starts_at)
        + (source.start_day - 1) * interval '1 day'
    ELSE NULL
  END,
  CASE
    WHEN source.project_starts_at IS NOT NULL AND source.start_day IS NOT NULL
      THEN date_trunc('day', source.project_starts_at)
        + (source.start_day + source.duration - 2) * interval '1 day'
    ELSE NULL
  END,
  NULLIF(left(btrim(COALESCE(source.snapshot_task->>'assignee', '')), 160), ''),
  jsonb_build_object(
    'schemaVersion', 1,
    'source', 'project-snapshot-v1',
    'projectStateVersion', source.state_version,
    'snapshotTaskId', source.snapshot_task_id,
    'snapshot', source.snapshot_task
  ),
  source.snapshot_created_at,
  source.snapshot_updated_at
FROM snapshot_tasks AS source
ON CONFLICT ("projectId", "externalId") DO UPDATE SET
  "title" = EXCLUDED."title",
  "status" = EXCLUDED."status",
  "progress" = EXCLUDED."progress",
  "startsAt" = EXCLUDED."startsAt",
  "endsAt" = EXCLUDED."endsAt",
  "assignee" = EXCLUDED."assignee",
  "metadata" = EXCLUDED."metadata",
  "updatedAt" = EXCLUDED."updatedAt";
-- TASK_PROJECTION_BACKFILL_END

-- Remove only rows owned by this projection that are no longer represented
-- by a snapshot task. Legacy/manual Task rows remain untouched.
-- TASK_PROJECTION_PRUNE_BEGIN
DELETE FROM "Task" AS projected
WHERE projected."metadata"->>'source' = 'project-snapshot-v1'
  AND NOT EXISTS (
    SELECT 1
    FROM "ProjectSnapshot" AS snapshot
    CROSS JOIN LATERAL jsonb_object_keys(
      CASE
        WHEN jsonb_typeof(snapshot."state"->'tasks') = 'object'
          THEN snapshot."state"->'tasks'
        ELSE '{}'::jsonb
      END
    ) AS task(snapshot_task_id)
    WHERE snapshot."projectId" = projected."projectId"
      AND projected."externalId" = 'snapshot:' || task.snapshot_task_id
  );
-- TASK_PROJECTION_PRUNE_END

COMMIT;
