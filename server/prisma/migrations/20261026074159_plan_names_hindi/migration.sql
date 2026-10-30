-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "featuresHi" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nameHi" TEXT NOT NULL DEFAULT '';
