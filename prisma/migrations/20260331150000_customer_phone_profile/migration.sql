-- CreateTable
CREATE TABLE "CustomerPhoneProfile" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "locationUrl" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPhoneProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPhoneProfile_phone_key" ON "CustomerPhoneProfile"("phone");

-- CreateIndex
CREATE INDEX "CustomerPhoneProfile_regionId_idx" ON "CustomerPhoneProfile"("regionId");

-- AddForeignKey
ALTER TABLE "CustomerPhoneProfile" ADD CONSTRAINT "CustomerPhoneProfile_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
