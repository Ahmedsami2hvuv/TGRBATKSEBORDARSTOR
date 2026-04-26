-- Store core: categories, products, variants, stock, guest orders

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StoreStockMovementKind" AS ENUM ('in', 'out', 'adjust');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StoreOrderStatus" AS ENUM ('pending', 'confirmed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoreCategory" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoreBranch" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shopId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoreProduct" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "imageUrls" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "categoryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoreProductVariant" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku" TEXT NOT NULL DEFAULT '',
  "optionValues" JSONB NOT NULL,
  "salePriceDinar" DECIMAL(14,4) NOT NULL,
  "costPriceDinar" DECIMAL(14,4) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoreStockMovement" (
  "id" TEXT NOT NULL,
  "kind" "StoreStockMovementKind" NOT NULL,
  "branchId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoreOrder" (
  "id" TEXT NOT NULL,
  "orderNumber" SERIAL NOT NULL,
  "status" "StoreOrderStatus" NOT NULL DEFAULT 'pending',
  "customerName" TEXT NOT NULL DEFAULT '',
  "customerPhone" TEXT NOT NULL,
  "addressText" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "subtotalSaleDinar" DECIMAL(14,4) NOT NULL,
  "totalSaleDinar" DECIMAL(14,4) NOT NULL,
  "totalCostDinar" DECIMAL(14,4) NOT NULL,
  "profitDinar" DECIMAL(14,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoreOrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "variantId" TEXT,
  "productName" TEXT NOT NULL,
  "variantLabel" TEXT NOT NULL DEFAULT '',
  "quantity" INTEGER NOT NULL,
  "unitSaleDinar" DECIMAL(14,4) NOT NULL,
  "unitCostDinar" DECIMAL(14,4) NOT NULL,
  "lineSaleDinar" DECIMAL(14,4) NOT NULL,
  "lineCostDinar" DECIMAL(14,4) NOT NULL,
  "lineProfitDinar" DECIMAL(14,4) NOT NULL,
  CONSTRAINT "StoreOrderItem_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "StoreCategory_slug_key" ON "StoreCategory"("slug");
CREATE INDEX IF NOT EXISTS "StoreCategory_parentId_idx" ON "StoreCategory"("parentId");
CREATE INDEX IF NOT EXISTS "StoreCategory_sortOrder_idx" ON "StoreCategory"("sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "StoreBranch_shopId_key" ON "StoreBranch"("shopId");
CREATE INDEX IF NOT EXISTS "StoreBranch_active_idx" ON "StoreBranch"("active");

CREATE UNIQUE INDEX IF NOT EXISTS "StoreProduct_slug_key" ON "StoreProduct"("slug");
CREATE INDEX IF NOT EXISTS "StoreProduct_active_idx" ON "StoreProduct"("active");
CREATE INDEX IF NOT EXISTS "StoreProduct_categoryId_idx" ON "StoreProduct"("categoryId");

CREATE INDEX IF NOT EXISTS "StoreProductVariant_productId_idx" ON "StoreProductVariant"("productId");
CREATE INDEX IF NOT EXISTS "StoreProductVariant_active_idx" ON "StoreProductVariant"("active");

CREATE INDEX IF NOT EXISTS "StoreStockMovement_branchId_idx" ON "StoreStockMovement"("branchId");
CREATE INDEX IF NOT EXISTS "StoreStockMovement_variantId_idx" ON "StoreStockMovement"("variantId");
CREATE INDEX IF NOT EXISTS "StoreStockMovement_createdAt_idx" ON "StoreStockMovement"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "StoreOrder_orderNumber_key" ON "StoreOrder"("orderNumber");
CREATE INDEX IF NOT EXISTS "StoreOrder_status_idx" ON "StoreOrder"("status");
CREATE INDEX IF NOT EXISTS "StoreOrder_createdAt_idx" ON "StoreOrder"("createdAt");

CREATE INDEX IF NOT EXISTS "StoreOrderItem_orderId_idx" ON "StoreOrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "StoreOrderItem_variantId_idx" ON "StoreOrderItem"("variantId");

-- Foreign keys
ALTER TABLE "StoreCategory"
  ADD CONSTRAINT "StoreCategory_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "StoreCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoreBranch"
  ADD CONSTRAINT "StoreBranch_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoreProduct"
  ADD CONSTRAINT "StoreProduct_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "StoreCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoreProductVariant"
  ADD CONSTRAINT "StoreProductVariant_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoreStockMovement"
  ADD CONSTRAINT "StoreStockMovement_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoreStockMovement"
  ADD CONSTRAINT "StoreStockMovement_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "StoreProductVariant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoreOrderItem"
  ADD CONSTRAINT "StoreOrderItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "StoreOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoreOrderItem"
  ADD CONSTRAINT "StoreOrderItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "StoreProductVariant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

