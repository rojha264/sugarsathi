-- AlterTable
ALTER TABLE "DietPlanItem" ADD COLUMN     "day" INTEGER;

-- AlterTable
ALTER TABLE "ExercisePlanItem" ADD COLUMN     "day" INTEGER;

-- CreateTable
CREATE TABLE "ProgramTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "diet" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "risk" TEXT NOT NULL DEFAULT 'standard',
    "kcal" INTEGER NOT NULL DEFAULT 1500,
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramDay" (
    "templateId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "focusEn" TEXT NOT NULL DEFAULT '',
    "focusHi" TEXT NOT NULL DEFAULT '',
    "tipEn" TEXT NOT NULL DEFAULT '',
    "tipHi" TEXT NOT NULL DEFAULT '',
    "sugarCheck" TEXT NOT NULL DEFAULT 'none',
    "exercises" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ProgramDay_pkey" PRIMARY KEY ("templateId","day")
);

-- CreateTable
CREATE TABLE "ProgramMeal" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "slot" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "altGroup" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProgramMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "templateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startsOn" TEXT NOT NULL,
    "kcal" INTEGER NOT NULL DEFAULT 1500,
    "baseline" JSONB NOT NULL DEFAULT '{}',
    "riskReasons" TEXT[],
    "result" JSONB,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "offerShownAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramMeal_templateId_day_idx" ON "ProgramMeal"("templateId", "day");

-- CreateIndex
CREATE INDEX "Enrollment_status_idx" ON "Enrollment"("status");

-- CreateIndex
CREATE INDEX "Enrollment_patientId_idx" ON "Enrollment"("patientId");

-- AddForeignKey
ALTER TABLE "ProgramDay" ADD CONSTRAINT "ProgramDay_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProgramTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMeal" ADD CONSTRAINT "ProgramMeal_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProgramTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMeal" ADD CONSTRAINT "ProgramMeal_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProgramTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
