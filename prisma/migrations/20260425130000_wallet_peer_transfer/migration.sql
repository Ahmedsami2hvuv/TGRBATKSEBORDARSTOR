-- CreateEnum
CREATE TYPE "WalletPeerTransferStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "WalletPeerPartyKind" AS ENUM ('courier', 'employee', 'admin');

-- CreateTable
CREATE TABLE "WalletPeerTransfer" (
    "id" TEXT NOT NULL,
    "status" "WalletPeerTransferStatus" NOT NULL DEFAULT 'pending',
    "amountDinar" DECIMAL(14,4) NOT NULL,
    "handoverLocation" TEXT NOT NULL,
    "fromKind" "WalletPeerPartyKind" NOT NULL,
    "fromCourierId" TEXT,
    "fromEmployeeId" TEXT,
    "toKind" "WalletPeerPartyKind" NOT NULL,
    "toCourierId" TEXT,
    "toEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "WalletPeerTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeWalletMiscEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "direction" "CourierWalletMiscDirection" NOT NULL,
    "amountDinar" DECIMAL(14,4) NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedReason" "OrderCourierMoneyDeletionReason",
    "deletedByDisplayName" TEXT,

    CONSTRAINT "EmployeeWalletMiscEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletPeerTransfer_status_idx" ON "WalletPeerTransfer"("status");

-- CreateIndex
CREATE INDEX "WalletPeerTransfer_fromCourierId_idx" ON "WalletPeerTransfer"("fromCourierId");

-- CreateIndex
CREATE INDEX "WalletPeerTransfer_toCourierId_idx" ON "WalletPeerTransfer"("toCourierId");

-- CreateIndex
CREATE INDEX "WalletPeerTransfer_fromEmployeeId_idx" ON "WalletPeerTransfer"("fromEmployeeId");

-- CreateIndex
CREATE INDEX "WalletPeerTransfer_toEmployeeId_idx" ON "WalletPeerTransfer"("toEmployeeId");

-- CreateIndex
CREATE INDEX "WalletPeerTransfer_createdAt_idx" ON "WalletPeerTransfer"("createdAt");

-- CreateIndex
CREATE INDEX "EmployeeWalletMiscEntry_employeeId_idx" ON "EmployeeWalletMiscEntry"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeWalletMiscEntry_employeeId_deletedAt_idx" ON "EmployeeWalletMiscEntry"("employeeId", "deletedAt");

-- AddForeignKey
ALTER TABLE "WalletPeerTransfer" ADD CONSTRAINT "WalletPeerTransfer_fromCourierId_fkey" FOREIGN KEY ("fromCourierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletPeerTransfer" ADD CONSTRAINT "WalletPeerTransfer_fromEmployeeId_fkey" FOREIGN KEY ("fromEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletPeerTransfer" ADD CONSTRAINT "WalletPeerTransfer_toCourierId_fkey" FOREIGN KEY ("toCourierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletPeerTransfer" ADD CONSTRAINT "WalletPeerTransfer_toEmployeeId_fkey" FOREIGN KEY ("toEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWalletMiscEntry" ADD CONSTRAINT "EmployeeWalletMiscEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
