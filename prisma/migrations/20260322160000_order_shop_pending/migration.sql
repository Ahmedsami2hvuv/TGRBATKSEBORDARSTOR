-- Order: ربط بالمحل، طابور pending، وإسناد اختياري للمندوب
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_assignedEmployeeId_fkey";

ALTER TABLE "Order" ADD COLUMN "shopId" TEXT;
ALTER TABLE "Order" ADD COLUMN "submittedByEmployeeId" TEXT;

UPDATE "Order" o
SET "shopId" = e."shopId"
FROM "Employee" e
WHERE e.id = o."assignedEmployeeId"
  AND o."shopId" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "assignedEmployeeId" DROP NOT NULL;

DELETE FROM "Order" WHERE "shopId" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "shopId" SET NOT NULL;

ALTER TABLE "Order" ADD CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_submittedByEmployeeId_fkey" FOREIGN KEY ("submittedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Order_shopId_idx" ON "Order"("shopId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
