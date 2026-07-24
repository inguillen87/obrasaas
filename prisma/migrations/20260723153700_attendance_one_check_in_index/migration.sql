CREATE UNIQUE INDEX CONCURRENTLY "AttendanceEntry_one_check_in_per_shift_idx"
ON "AttendanceEntry" ("shiftId")
WHERE
  "shiftId" IS NOT NULL
  AND "eventType" = 'CHECK_IN'
  AND "verificationStatus" <> 'VOIDED';
