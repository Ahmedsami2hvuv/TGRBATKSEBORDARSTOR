import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { normalizeRegionNameForMatch } from "@/lib/region-name-normalize";

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

function sortRegionHits<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      a.name.length - b.name.length ||
      a.name.localeCompare(b.name, "ar")
  );
}

/** بحث مناطق: مطابقة كل الكلمات إن أمكن؛ وإلا ترتيب حسب عدد الكلمات المطابقة (مثل العنوان الطويل مع إضافات وصفية). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get("q")?.trim() ?? "";

    if (raw.length < 2) {
      return NextResponse.json({ regions: [] });
    }

    const normQ = normalizeRegionNameForMatch(raw);
    const tokens = normQ.split(/\s+/).filter((t) => t.length > 0);

    const allRegions = await getCachedRegions();

    const strict = allRegions.filter((r) => {
      const normName = normalizeRegionNameForMatch(r.name);
      return tokens.every((t) => normName.includes(t));
    });

    const picked =
      strict.length > 0
        ? sortRegionHits(strict).slice(0, 15)
        : sortRegionHits(
            allRegions
              .map((r) => {
                const normName = normalizeRegionNameForMatch(r.name);
                let score = 0;
                for (const t of tokens) {
                  if (t.length < 2) continue;
                  if (normName.includes(t)) score++;
                }
                if (tokens.length === 1 && tokens[0]!.length >= 1 && normName.includes(tokens[0]!)) {
                  score = Math.max(score, 1);
                }
                return { r, score };
              })
              .filter((x) => x.score > 0)
              .sort(
                (a, b) =>
                  b.score - a.score ||
                  a.r.name.length - b.r.name.length ||
                  a.r.name.localeCompare(b.r.name, "ar")
              )
              .slice(0, 15)
              .map((x) => x.r)
          );

    return NextResponse.json({
      regions: picked.map((r) => ({
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
