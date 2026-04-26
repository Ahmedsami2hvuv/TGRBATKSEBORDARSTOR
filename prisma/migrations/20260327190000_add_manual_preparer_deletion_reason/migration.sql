-- Add deletion reason for preparer manual deletions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderCourierMoneyDeletionReason'
      AND e.enumlabel = 'manual_preparer'
  ) THEN
    ALTER TYPE "OrderCourierMoneyDeletionReason" ADD VALUE 'manual_preparer';
  END IF;
END $$;

