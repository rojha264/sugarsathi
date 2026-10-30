-- CreateTable
CREATE TABLE "AppInstall" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "lang" TEXT,
    "steps" JSONB NOT NULL DEFAULT '{}',
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppInstall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "seconds" INTEGER NOT NULL,
    "screens" JSONB NOT NULL DEFAULT '{}',
    "platform" TEXT,
    "appVersion" TEXT,

    CONSTRAINT "AppSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppInstall_firstSeen_idx" ON "AppInstall"("firstSeen");

-- CreateIndex
CREATE INDEX "AppSession_startedAt_idx" ON "AppSession"("startedAt");

-- CreateIndex
CREATE INDEX "AppSession_userId_startedAt_idx" ON "AppSession"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "AppInstall" ADD CONSTRAINT "AppInstall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSession" ADD CONSTRAINT "AppSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
