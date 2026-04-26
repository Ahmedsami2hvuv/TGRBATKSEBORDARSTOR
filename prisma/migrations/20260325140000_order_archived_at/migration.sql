-- AlterTable
ALTER TABLE "Order" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_archivedAt_idx" ON "Order"("archivedAt");

-- طلبات مؤرشفة قديمة: نعتمد وقت التحديث كتاريخ أرشفة تقريبي
UPDATE "Order" SET "archivedAt" = "updatedAt" WHERE status = 'archived' AND "archivedAt" IS NULL;
