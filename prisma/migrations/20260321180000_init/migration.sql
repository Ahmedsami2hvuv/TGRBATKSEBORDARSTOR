-- CreateTable
CREATE TABLE "SchemaPlaceholder" (
    "id" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT 'init',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemaPlaceholder_pkey" PRIMARY KEY ("id")
);
