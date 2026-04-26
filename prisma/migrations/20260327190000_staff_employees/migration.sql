-- CreateTable
CREATE TABLE "StaffEmployee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffEmployee_active_createdAt_idx" ON "StaffEmployee"("active", "createdAt");

