import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/auth";
import { parseFlexibleOrderLines } from "@/lib/flexible-order-parse";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const body = await request.json();
    const { text, preparerId, regionId } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: "النص مفقود أو غير صالح" }, { status: 400 });
    }

    if (!preparerId) {
      return NextResponse.json({ error: "يجب اختيار مجهز" }, { status: 400 });
    }

    const parsed = parseFlexibleOrderLines(text);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const title = parsed ? parsed.title : (lines.length > 0 ? lines[0] : "تجهيز تسوق جديد");
    const phone = parsed ? parsed.phone : "";
    const productsList = parsed ? parsed.products : lines.slice(1);

    let finalRegionId = regionId;

    if (!finalRegionId) {
      const matchedRegions = await prisma.region.findMany({
        where: { name: { contains: title } },
        select: { id: true, name: true }
      });

      if (matchedRegions.length === 1) {
        finalRegionId = matchedRegions[0].id;
      } else {
        const fallbackRegions = matchedRegions.length > 0 
          ? matchedRegions 
          : await prisma.region.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
          
        return NextResponse.json({
          requireRegion: true,
          suggestedRegions: fallbackRegions
        });
      }
    }

    const draft = await prisma.companyPreparerShoppingDraft.create({
      data: {
        rawListText: text,
        preparerId: preparerId,
        titleLine: title.substring(0, 100),
        customerPhone: phone,
        customerRegionId: finalRegionId,
        status: "draft",
        data: {
          products: productsList.map(p => ({ line: p, buyAlf: "", sellAlf: "" }))
        }
      }
    });

    return NextResponse.json({ success: true, draftId: draft.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
