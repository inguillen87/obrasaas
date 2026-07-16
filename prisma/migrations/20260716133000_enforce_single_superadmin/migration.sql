-- The platform owner is an identity invariant, not a deploy-time toggle.
-- Reconcile historical rows before adding the database guard.
UPDATE "PlatformUser"
SET "systemRole" = CASE
  WHEN LOWER(TRIM("primaryEmail")) = 'guillen.marce@gmail.com' THEN 'SUPERADMIN'::"SystemRole"
  ELSE 'TENANT_USER'::"SystemRole"
END
WHERE "systemRole" IS DISTINCT FROM CASE
  WHEN LOWER(TRIM("primaryEmail")) = 'guillen.marce@gmail.com' THEN 'SUPERADMIN'::"SystemRole"
  ELSE 'TENANT_USER'::"SystemRole"
END;

ALTER TABLE "PlatformUser"
ADD CONSTRAINT "PlatformUser_single_superadmin_email_check"
CHECK (
  (LOWER(TRIM("primaryEmail")) = 'guillen.marce@gmail.com')
  = ("systemRole" = 'SUPERADMIN')
);
