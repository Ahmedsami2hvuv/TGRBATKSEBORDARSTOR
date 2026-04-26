-- Employee order portal: permanent token (revocable by rotation)
ALTER TABLE "Employee"
ADD COLUMN "orderPortalToken" TEXT NOT NULL
DEFAULT substring(md5(random()::text || clock_timestamp()::text), 1, 32);

UPDATE "Employee"
SET "orderPortalToken" = substring(md5(random()::text || clock_timestamp()::text), 1, 32)
WHERE "orderPortalToken" IS NULL OR "orderPortalToken" = '';

ALTER TABLE "Employee" ALTER COLUMN "orderPortalToken" DROP DEFAULT;

