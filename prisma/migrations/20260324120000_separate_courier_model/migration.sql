-- CreateTable
CREATE TABLE "Courier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "assignedCourierId" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedCourierId_fkey" FOREIGN KEY ("assignedCourierId") REFERENCES "Courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- نقل المندوبين من Employee إلى Courier وربط الطلبات
DO $$
DECLARE
  r RECORD;
  cid TEXT;
BEGIN
  FOR r IN SELECT * FROM "Employee" WHERE "isCourier" = true LOOP
    cid := 'c' || substr(md5(random()::text || clock_timestamp()::text || r.id), 1, 24);
    INSERT INTO "Courier" ("id", "name", "phone", "createdAt", "updatedAt")
    VALUES (cid, r."name", r."phone", r."createdAt", r."updatedAt");
    UPDATE "Order" SET "assignedCourierId" = cid WHERE "assignedEmployeeId" = r.id;
    IF r."isShopStaff" = true THEN
      UPDATE "Employee" SET "isCourier" = false WHERE id = r.id;
    ELSE
      DELETE FROM "Employee" WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_assignedEmployeeId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN IF EXISTS "assignedEmployeeId";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "isCourier";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "isShopStaff";

-- CreateIndex
CREATE INDEX "Order_assignedCourierId_idx" ON "Order"("assignedCourierId");
