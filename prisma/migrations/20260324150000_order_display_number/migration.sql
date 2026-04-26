-- رقم طلب تسلسلي للعرض (يبدأ من 1)
ALTER TABLE "Order" ADD COLUMN "orderNumber" INTEGER;

UPDATE "Order" o
SET "orderNumber" = n.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY "createdAt" ASC))::integer AS rn
  FROM "Order"
) n
WHERE o.id = n.id;

ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;

CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

CREATE SEQUENCE "Order_orderNumber_seq";
SELECT setval(
  '"Order_orderNumber_seq"',
  (SELECT COALESCE(MAX("orderNumber"), 0) FROM "Order")
);
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET DEFAULT nextval('"Order_orderNumber_seq"');
ALTER SEQUENCE "Order_orderNumber_seq" OWNED BY "Order"."orderNumber";
