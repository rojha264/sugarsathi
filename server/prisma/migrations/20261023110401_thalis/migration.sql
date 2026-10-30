-- CreateTable
CREATE TABLE "Thali" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT NOT NULL,
    "diet" TEXT NOT NULL,
    "slots" TEXT[],
    "items" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thali_pkey" PRIMARY KEY ("id")
);
