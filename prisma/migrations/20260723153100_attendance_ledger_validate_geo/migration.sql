-- Keep geolocation validation in its own low-lock contract transaction.
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_coordinate_pair_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_latitude_range_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_longitude_range_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_accuracy_range_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_distance_nonnegative_check";
ALTER TABLE "AttendanceEntry"
VALIDATE CONSTRAINT "AttendanceEntry_geofence_radius_positive_check";
