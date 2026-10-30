-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "amountInr" INTEGER,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "note" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Subscription_patientId_endsAt_idx" ON "Subscription"("patientId", "endsAt");
