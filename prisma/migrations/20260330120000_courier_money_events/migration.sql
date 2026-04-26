-- CreateEnum
CREATE TYPE "CourierVehicleType" AS ENUM ('car', 'bike');

-- CreateEnum
CREATE TYPE "OrderCourierMoneyDeletionReason" AS ENUM ('manual_admin', 'manual_courier', 'status_revert');

-- AlterTable
ALTER TABLE "Courier" ADD COLUMN "vehicleType" "CourierVehicleType" NOT NULL DEFAULT 'car';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "courierEarningDinar" DECIMAL(14,4),
ADD COLUMN "courierEarningForCourierId" TEXT;

-- CreateTable
CREATE TABLE "OrderCourierMoneyEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountDinar" DECIMAL(14,4) NOT NULL,
    "expectedDinar" DECIMAL(14,4),
    "matchesExpected" BOOLEAN NOT NULL DEFAULT true,
    "mismatchReason" TEXT NOT NULL DEFAULT '',
    "mismatchNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedReason" "OrderCourierMoneyDeletionReason",

    CONSTRAINT "OrderCourierMoneyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderCourierMoneyEvent_orderId_idx" ON "OrderCourierMoneyEvent"("orderId");

-- CreateIndex
CREATE INDEX "OrderCourierMoneyEvent_courierId_idx" ON "OrderCourierMoneyEvent"("courierId");

-- CreateIndex
CREATE INDEX "OrderCourierMoneyEvent_courierId_kind_deletedAt_idx" ON "OrderCourierMoneyEvent"("courierId", "kind", "deletedAt");

-- AddForeignKey
ALTER TABLE "OrderCourierMoneyEvent" ADD CONSTRAINT "OrderCourierMoneyEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCourierMoneyEvent" ADD CONSTRAINT "OrderCourierMoneyEvent_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_courierEarningForCourierId_fkey" FOREIGN KEY ("courierEarningForCourierId") REFERENCES "Courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
