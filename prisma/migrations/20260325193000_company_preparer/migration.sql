-- CreateTable
CREATE TABLE "CompanyPreparer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPreparer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreparerShop" (
    "preparerId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreparerShop_pkey" PRIMARY KEY ("preparerId","shopId")
);

-- CreateIndex
CREATE INDEX "PreparerShop_shopId_idx" ON "PreparerShop"("shopId");

-- AddForeignKey
ALTER TABLE "PreparerShop" ADD CONSTRAINT "PreparerShop_preparerId_fkey" FOREIGN KEY ("preparerId") REFERENCES "CompanyPreparer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparerShop" ADD CONSTRAINT "PreparerShop_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
