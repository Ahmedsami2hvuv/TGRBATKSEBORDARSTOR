-- Add image for store branch
ALTER TABLE "StoreBranch"
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT NOT NULL DEFAULT '';

