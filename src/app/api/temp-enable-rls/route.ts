import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  // حماية المسار برمز سري لمنع تشغيله من أي طرف خارجي
  if (secret !== "safe_rls_activation_2026") {
    return NextResponse.json({ error: "غير مصرح به" }, { status: 401 });
  }

  const prisma = new PrismaClient();
  const results: string[] = [];

  try {
    // 1. جلب قائمة بجميع الجداول في المخطط العام public
    const tables = (await prisma.$queryRawUnsafe(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public';
    `)) as { tablename: string }[];

    results.push(`تم العثور على ${tables.length} جدول.`);

    // 2. تفعيل RLS على كل جدول
    for (const row of tables) {
      const tableName = row.tablename;
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;
      `);
      results.push(`تم تفعيل RLS للجدول: ${tableName}`);
    }

    // 3. إعداد سياسة أمان لجدول SchemaPlaceholder لضمان عمل التنبيهات الحية
    await prisma.$executeRawUnsafe(`
      DROP POLICY IF EXISTS "Allow public read access to SchemaPlaceholder" ON "SchemaPlaceholder";
    `);

    await prisma.$executeRawUnsafe(`
      CREATE POLICY "Allow public read access to SchemaPlaceholder" ON "SchemaPlaceholder" FOR SELECT USING (true);
    `);
    
    results.push("تم بنجاح إعداد سياسة القراءة العامة لجدول SchemaPlaceholder");

    return NextResponse.json({ success: true, steps: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, steps: results }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
