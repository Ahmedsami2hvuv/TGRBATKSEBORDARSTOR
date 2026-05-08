-- رقم تسلسلي دائم لطلبات التجهيز (يبدأ من 1 ولا يتكرر)
ALTER TABLE "CompanyPreparerShoppingDraft" ADD COLUMN "draftNumber" INTEGER;

UPDATE "CompanyPreparerShoppingDraft" d
SET "draftNumber" = n.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY "createdAt" ASC))::integer AS rn
  FROM "CompanyPreparerShoppingDraft"
) n
WHERE d.id = n.id;

ALTER TABLE "CompanyPreparerShoppingDraft" ALTER COLUMN "draftNumber" SET NOT NULL;

CREATE UNIQUE INDEX "CompanyPreparerShoppingDraft_draftNumber_key"
ON "CompanyPreparerShoppingDraft"("draftNumber");

CREATE SEQUENCE "CompanyPreparerShoppingDraft_draftNumber_seq";
SELECT setval(
  '"CompanyPreparerShoppingDraft_draftNumber_seq"',
  (SELECT COALESCE(MAX("draftNumber"), 0) FROM "CompanyPreparerShoppingDraft")
);
ALTER TABLE "CompanyPreparerShoppingDraft"
ALTER COLUMN "draftNumber" SET DEFAULT nextval('"CompanyPreparerShoppingDraft_draftNumber_seq"');
ALTER SEQUENCE "CompanyPreparerShoppingDraft_draftNumber_seq"
OWNED BY "CompanyPreparerShoppingDraft"."draftNumber";
