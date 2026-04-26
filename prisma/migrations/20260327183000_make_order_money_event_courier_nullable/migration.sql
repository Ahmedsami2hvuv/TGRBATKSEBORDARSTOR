-- Allow preparer-recorded money events without courier assignment
ALTER TABLE "OrderCourierMoneyEvent" ALTER COLUMN "courierId" DROP NOT NULL;

