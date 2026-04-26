-- CreateEnum
CREATE TYPE "CourierWalletMiscDirection" AS ENUM ('take', 'give');

-- CreateTable
CREATE TABLE "CourierWalletMiscEntry" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "direction" "CourierWalletMiscDirection" NOT NULL,
    "amountDinar" DECIMAL(14,4) NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedReason" "OrderCourierMoneyDeletionReason",
    "deletedByDisplayName" TEXT,

    CONSTRAINT "CourierWalletMiscEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourierWalletMiscEntry_courierId_idx" ON "CourierWalletMiscEntry"("courierId");

-- CreateIndex
CREATE INDEX "CourierWalletMiscEntry_courierId_deletedAt_idx" ON "CourierWalletMiscEntry"("courierId", "deletedAt");

-- AddForeignKey
ALTER TABLE "CourierWalletMiscEntry" ADD CONSTRAINT "CourierWalletMiscEntry_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
