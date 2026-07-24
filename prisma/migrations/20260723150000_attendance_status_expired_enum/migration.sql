-- PostgreSQL enum values become safely usable only after the transaction that
-- adds them commits. Keep this migration deliberately limited to that change;
-- later attendance migrations may then use EXPIRED without an unsafe same-
-- transaction enum reference.
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
