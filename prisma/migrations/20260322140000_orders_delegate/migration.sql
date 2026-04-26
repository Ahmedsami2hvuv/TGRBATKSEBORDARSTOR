-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "assignedEmployeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_assignedEmployeeId_idx" ON "Order"("assignedEmployeeId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
