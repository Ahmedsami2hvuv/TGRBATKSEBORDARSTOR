-- Allow publishing product in multiple store categories/branches

CREATE TABLE IF NOT EXISTS "StoreProductCategory" (
  "productId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreProductCategory_pkey" PRIMARY KEY ("productId","categoryId")
);

CREATE INDEX IF NOT EXISTS "StoreProductCategory_categoryId_idx"
  ON "StoreProductCategory"("categoryId");

ALTER TABLE "StoreProductCategory"
  ADD CONSTRAINT "StoreProductCategory_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoreProductCategory"
  ADD CONSTRAINT "StoreProductCategory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "StoreCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing primary category links
INSERT INTO "StoreProductCategory" ("productId", "categoryId")
SELECT "id", "categoryId"
FROM "StoreProduct"
WHERE "categoryId" IS NOT NULL
ON CONFLICT ("productId","categoryId") DO NOTHING;

