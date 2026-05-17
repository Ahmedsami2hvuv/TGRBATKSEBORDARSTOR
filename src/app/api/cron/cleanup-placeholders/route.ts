import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * تنظيف روابط التليجرام المختصرة القديمة من جدول SchemaPlaceholder.
 * يُفضل تشغيل هذا الـ Cron دورياً (مرة كل ساعة أو يومياً).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const url = new URL(req.url);
  const q = url.searchParams.get("secret")?.trim();
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  // التحقق من صلاحية الطلب
  if (secret && (q !== secret && bearer !== secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    // حذف المدخلات التي بدأت بـ pl_ ومضى على إنشائها أكثر من 24 ساعة
    // أو يمكن حذف جميع مدخلات pl_ القديمة
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.schemaPlaceholder.deleteMany({
      where: {
        id: { startsWith: "pl_" },
        createdAt: { lt: yesterday },
      },
    });

    return NextResponse.json({
      ok: true,
      deletedCount: result.count,
      message: `Deleted ${result.count} expired short links.`,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
