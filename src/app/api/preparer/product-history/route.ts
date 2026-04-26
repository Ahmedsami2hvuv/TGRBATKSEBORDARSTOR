import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productName = searchParams.get("name");
  const p = searchParams.get("p");
  const exp = searchParams.get("exp");
  const s = searchParams.get("s");

  if (!productName || !p || !exp || !s) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // نبحث عن آخر 5 طلبيات تحتوي على هذا المنتج
    // ملاحظة: البحث في JSON قد يكون مكلفاً، لذا سنستخدم استعلام SQL بسيط للمسودات المرسلة
    const history = await prisma.companyPreparerShoppingDraft.findMany({
      where: {
        status: "sent",
        data: {
          path: ["products"],
          array_contains: [{ line: productName }]
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { data: true }
    });

    const prices: { buyAlf: number; line: string }[] = [];
    const seen = new Set<string>();

    for (const h of history) {
      const data = h.data as any;
      if (data && Array.isArray(data.products)) {
        const prod = data.products.find((pp: any) => pp.line === productName && pp.buyAlf != null);
        if (prod) {
          const key = `${prod.line}-${prod.buyAlf}`;
          if (!seen.has(key)) {
            prices.push({ buyAlf: prod.buyAlf, line: prod.line });
            seen.add(key);
          }
        }
      }
      if (prices.length >= 5) break;
    }

    return NextResponse.json(prices);
  } catch (e) {
    console.error("History fetch error:", e);
    return NextResponse.json([]);
  }
}
