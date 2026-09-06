import { prisma } from "@/lib/prisma";

let hasCheckedOutreach = false;

/**
 * التأكد التلقائي من وجود جداول مهمة مراسلة الزبائن في قاعدة بيانات PostgreSQL
 */
export async function ensureOutreachTablesExist(): Promise<void> {
  if (hasCheckedOutreach) return;

  try {
    // 1. جدول قوائم التواصل StaffOutreachList
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StaffOutreachList" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "staffEmployeeId" TEXT NOT NULL,
        "title" TEXT NOT NULL DEFAULT 'قائمة تواصل',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StaffOutreachList_pkey" PRIMARY KEY ("id")
      );
    `);

    // 2. جدول أرقام الزبائن StaffOutreachItem
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StaffOutreachItem" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "listId" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "originalInput" TEXT NOT NULL DEFAULT '',
        "status" TEXT NOT NULL DEFAULT 'pending',
        "templateUsed" TEXT,
        "openedAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StaffOutreachItem_pkey" PRIMARY KEY ("id")
      );
    `);

    // 3. جدول النماذج الإعلانية StaffOutreachTemplate
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StaffOutreachTemplate" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "staffEmployeeId" TEXT,
        "title" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StaffOutreachTemplate_pkey" PRIMARY KEY ("id")
      );
    `);

    // 4. تعيين DEFAULT gen_random_uuid() للأعمدة في حال تم إنشاؤها مسبقاً بدونه
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "StaffOutreachList" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE "StaffOutreachItem" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE "StaffOutreachTemplate" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
      `);
    } catch (e) {}

    // 5. إنشاء الفهارس (Indexes)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StaffOutreachList_staffEmployeeId_idx" ON "StaffOutreachList"("staffEmployeeId");
      CREATE INDEX IF NOT EXISTS "StaffOutreachItem_listId_status_idx" ON "StaffOutreachItem"("listId", "status");
      CREATE INDEX IF NOT EXISTS "StaffOutreachItem_phone_idx" ON "StaffOutreachItem"("phone");
      CREATE INDEX IF NOT EXISTS "StaffOutreachTemplate_staffEmployeeId_idx" ON "StaffOutreachTemplate"("staffEmployeeId");
    `);

    hasCheckedOutreach = true;
  } catch (error) {
    console.error("[DbSelfHeal] Error creating outreach tables:", error);
  }
}
