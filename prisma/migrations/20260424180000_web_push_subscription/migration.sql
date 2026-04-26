-- CreateTable
CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "courierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "WebPushSubscription_audience_idx" ON "WebPushSubscription"("audience");

-- CreateIndex
CREATE INDEX "WebPushSubscription_courierId_idx" ON "WebPushSubscription"("courierId");

-- AddForeignKey
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
