-- CreateTable
CREATE TABLE "FoodPick" (
    "patientId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "slots" TEXT[],
    "note" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "addedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodPick_pkey" PRIMARY KEY ("patientId","foodId")
);

-- AddForeignKey
ALTER TABLE "FoodPick" ADD CONSTRAINT "FoodPick_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodPick" ADD CONSTRAINT "FoodPick_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodPick" ADD CONSTRAINT "FoodPick_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
