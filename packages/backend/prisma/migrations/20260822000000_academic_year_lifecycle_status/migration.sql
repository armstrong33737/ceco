-- AlterTable
ALTER TABLE "AcademicYear" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'UPCOMING';

-- Synchronisation des états existants
UPDATE "AcademicYear" SET "status" = 'CURRENT' WHERE "isCurrent" = true;
UPDATE "AcademicYear" SET "status" = 'CLOSED' WHERE "isCurrent" = false;