import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

// دالة لجلب المناطق مع التخزين المؤقت لمدة ساعة لتقليل الضغط على قاعدة البيانات
const getCachedRegions = unstable_cache(
  async () => {
    return prisma.region.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, deliveryPrice: true },
    });
  },
  ["all-regions-list"],
  { revalidate: 3600, tags: ["regions"] }
);

/** بحث مناطق فائق السرعة من الذاكرة */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

    if (q.length < 2) {
      return NextResponse.json({ regions: [] });
    }

    // جلب القائمة من الـ Cache (تستغرق صفر ثانية غالباً)
    const allRegions = await getCachedRegions();

    // الفلترة تتم في السيرفر بدون طلب جديد لقاعدة البيانات
    const filtered = allRegions
      .filter(r => r.name.toLowerCase().includes(q))
      .slice(0, 15); // تحديد أفضل 15 نتيجة للسرعة

    return NextResponse.json({
      regions: filtered.map((r) => ({
        id: r.id,
        name: r.name,
        deliveryPrice: r.deliveryPrice.toString(),
      })),
    });
  } catch (error) {
    console.error("Regions search error:", error);
    return NextResponse.json({ regions: [] }, { status: 500 });
  }
}
