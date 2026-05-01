-- Create table for multiple region location points (waypoints)
CREATE TABLE "RegionWaypoint" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegionWaypoint_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "RegionWaypoint_regionId_sortOrder_idx" ON "RegionWaypoint"("regionId", "sortOrder");

-- Foreign key
ALTER TABLE "RegionWaypoint"
ADD CONSTRAINT "RegionWaypoint_regionId_fkey"
FOREIGN KEY ("regionId") REFERENCES "Region"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
