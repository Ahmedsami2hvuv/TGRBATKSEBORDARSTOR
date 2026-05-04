-- CreateTable
CREATE TABLE "LegacyKseOrderImportLog" (
    "orderId" INTEGER NOT NULL,
    "outcome" VARCHAR(32) NOT NULL,
    "phone" VARCHAR(20),
    "regionId" TEXT,
    "profileId" TEXT,
    "message" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegacyKseOrderImportLog_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex
CREATE INDEX "LegacyKseOrderImportLog_outcome_idx" ON "LegacyKseOrderImportLog"("outcome");
