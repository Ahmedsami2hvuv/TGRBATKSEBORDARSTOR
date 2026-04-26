-- Fix production error for /admin/store/categories and /admin/store/products
-- Some environments applied store_core before adding StoreCategory.imageUrl.
-- Ensure the column exists safely.

ALTER TABLE "StoreCategory"
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT NOT NULL DEFAULT '';

