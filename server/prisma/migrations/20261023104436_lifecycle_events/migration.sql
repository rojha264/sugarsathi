-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "kind" TEXT;

-- CreateTable
CREATE TABLE "AppEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "props" JSONB NOT NULL DEFAULT '{}',
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppEvent_name_at_idx" ON "AppEvent"("name", "at");

-- CreateIndex
CREATE INDEX "AppEvent_userId_at_idx" ON "AppEvent"("userId", "at");

-- AddForeignKey
ALTER TABLE "AppEvent" ADD CONSTRAINT "AppEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
