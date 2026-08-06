import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/auth";
import { parseFlexibleOrderLines } from "@/lib/flexible-order-parse";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    let token = authHeader?.split(" ")[1];
    
    if (!token) {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(/admin_token=([^;]+)/);
        if (match) token = match[1];
      }
    }
    
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const body = await request.json();
    const { text, preparerIds, regionId } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: "النص مفقود أو غير صالح" }, { status: 400 });
    }

    if (!preparerIds || !Array.isArray(preparerIds) || preparerIds.length === 0) {
      return NextResponse.json({ error: "يجب اختيار مجهز واحد على الأقل" }, { status: 400 });
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
        const allRegions = await prisma.region.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
        const fallbackRegions = matchedRegions.length > 0 ? matchedRegions : allRegions;
          
        return NextResponse.json({
          requireRegion: true,
          suggestedRegions: fallbackRegions,
          allRegions: allRegions
        });
      }
    }

    const draftIds = [];
    for (const pId of preparerIds) {
      const draft = await prisma.companyPreparerShoppingDraft.create({
        data: {
          rawListText: text,
          preparerId: pId,
          titleLine: title.substring(0, 100),
          customerPhone: phone,
          customerRegionId: finalRegionId,
          status: "draft",
          data: {
            products: productsList.map(p => ({ line: p, buyAlf: "", sellAlf: "" }))
          }
        }
      });
      draftIds.push(draft.id);
    }

    return NextResponse.json({ success: true, draftIds });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

