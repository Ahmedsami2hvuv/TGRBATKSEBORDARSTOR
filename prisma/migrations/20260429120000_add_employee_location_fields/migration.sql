-- AddColumn Employee location fields
ALTER TABLE "Employee" ADD COLUMN "lastEmployeeLat" DOUBLE PRECISION;
ALTER TABLE "Employee" ADD COLUMN "lastEmployeeLng" DOUBLE PRECISION;
ALTER TABLE "Employee" ADD COLUMN "lastEmployeeLocationAt" TIMESTAMP(3);
