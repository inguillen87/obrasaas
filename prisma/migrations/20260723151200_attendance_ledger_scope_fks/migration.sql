-- Attach the concurrently-built index with a short metadata lock, then add
-- tenant-scoped foreign keys without scanning populated tables.
ALTER TABLE "Worker"
ADD CONSTRAINT "Worker_projectId_id_key"
UNIQUE USING INDEX "Worker_projectId_id_key";

ALTER TABLE "AttendanceShift"
ADD CONSTRAINT "AttendanceShift_projectId_fkey"
  FOREIGN KEY ("projectId")
  REFERENCES "Project" ("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE
  NOT VALID,
ADD CONSTRAINT "AttendanceShift_worker_scope_fkey"
  FOREIGN KEY ("projectId", "workerId")
  REFERENCES "Worker" ("projectId", "id")
  ON DELETE CASCADE
  ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "AttendanceEntry"
ADD CONSTRAINT "AttendanceEntry_worker_scope_fkey"
  FOREIGN KEY ("projectId", "workerId")
  REFERENCES "Worker" ("projectId", "id")
  ON DELETE CASCADE
  ON UPDATE CASCADE
  NOT VALID,
ADD CONSTRAINT "AttendanceEntry_shift_scope_fkey"
  FOREIGN KEY ("shiftId", "projectId", "workerId")
  REFERENCES "AttendanceShift" ("id", "projectId", "workerId")
  ON DELETE NO ACTION
  ON UPDATE CASCADE
  NOT VALID;
