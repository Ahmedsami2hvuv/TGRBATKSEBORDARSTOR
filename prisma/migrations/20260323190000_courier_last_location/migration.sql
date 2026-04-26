-- AlterTable
ALTER TABLE "Courier" ADD COLUMN "lastCourierLat" DOUBLE PRECISION,
ADD COLUMN "lastCourierLng" DOUBLE PRECISION,
ADD COLUMN "lastCourierLocationAt" TIMESTAMP(3);
