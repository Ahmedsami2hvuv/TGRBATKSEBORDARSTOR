-- Superseded: the original ALTER referenced OrderCourierMoneyEvent before the table existed
-- (see 20260330120000_courier_money_events) and used invalid "ON DELETE SET".
-- The real column + FK are in 20260330120001_order_money_event_recorded_by_preparer.
-- This no-op remains so existing failed migration rows can be marked rolled back.
SELECT 1;
