-- اشتراك المجهز (موظف المحل) والعميل في Web Push
ALTER TABLE "WebPushSubscription" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "WebPushSubscription" ADD COLUMN "customerId" TEXT;

CREATE INDEX "WebPushSubscription_employeeId_idx" ON "WebPushSubscription"("employeeId");
CREATE INDEX "WebPushSubscription_customerId_idx" ON "WebPushSubscription"("customerId");

ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
