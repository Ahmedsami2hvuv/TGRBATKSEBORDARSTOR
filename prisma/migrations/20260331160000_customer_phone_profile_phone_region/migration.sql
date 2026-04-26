-- DropIndex: unique on phone only (replaced by composite)
DROP INDEX IF EXISTS "CustomerPhoneProfile_phone_key";

-- AlterTable
ALTER TABLE "CustomerPhoneProfile" ADD COLUMN IF NOT EXISTS "landmark" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CustomerPhoneProfile" ADD COLUMN IF NOT EXISTS "alternatePhone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPhoneProfile_phone_regionId_key" ON "CustomerPhoneProfile"("phone", "regionId");
