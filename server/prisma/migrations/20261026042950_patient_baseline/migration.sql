-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "flags" TEXT[],
ADD COLUMN     "meds" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "region" TEXT;
