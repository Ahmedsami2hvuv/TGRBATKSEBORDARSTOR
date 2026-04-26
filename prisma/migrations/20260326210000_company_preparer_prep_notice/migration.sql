-- CreateTable
CREATE TABLE "CompanyPreparerPrepNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "preparerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "CompanyPreparerPrepNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyPreparerPrepNotice_preparerId_dismissedAt_idx" ON "CompanyPreparerPrepNotice"("preparerId", "dismissedAt");

-- AddForeignKey
ALTER TABLE "CompanyPreparerPrepNotice" ADD CONSTRAINT "CompanyPreparerPrepNotice_preparerId_fkey" FOREIGN KEY ("preparerId") REFERENCES "CompanyPreparer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
