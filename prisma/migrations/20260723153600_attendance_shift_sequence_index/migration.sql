CREATE UNIQUE INDEX CONCURRENTLY "AttendanceEntry_shift_sequence_key"
ON "AttendanceEntry" ("shiftId", "sequence");
