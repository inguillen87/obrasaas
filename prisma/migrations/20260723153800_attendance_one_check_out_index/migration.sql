CREATE UNIQUE INDEX CONCURRENTLY "AttendanceEntry_one_check_out_per_shift_idx"
ON "AttendanceEntry" ("shiftId")
WHERE
  "shiftId" IS NOT NULL
  AND "eventType" = 'CHECK_OUT'
  AND "verificationStatus" <> 'VOIDED';
