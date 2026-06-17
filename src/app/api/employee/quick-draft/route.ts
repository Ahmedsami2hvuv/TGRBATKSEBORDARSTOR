import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { parseFlexibleOrderLines } from "@/lib/flexible-order-parse";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { PreparerShoppingDraftStatus } from "@prisma/client";
import { pushNotifyPreparerNewNotice } from "@/lib/web-push-server";

function verifyRequest(request: Request) {
  const urlObj = new URL(request.url);
  const se = request.headers.get("x-employee-se") || urlObj.searchParams.get("se") || undefined;
  const exp = request.headers.get("x-employee-exp") || urlObj.searchParams.get("exp") || undefined;
  const sig = request.headers.get("x-employee-sig") || urlObj.searchParams.get("s") || undefined;
  
  if (!se || !exp || !sig) return { ok: false };
  return verifyStaffEmployeePortalQuery(se, exp, sig);
}

export async function POST(request: Request) {
  try {
    const verification = verifyRequest(request);
    if (!verification.ok) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const staff = await prisma.staffEmployee.findUnique({
      where: { id: verification.staffEmployeeId },
      select: { id: true, name: true, active: true, portalToken: true }
    });

    if (!staff || !staff.active || staff.portalToken !== verification.token) {
      return NextResponse.json({ error: "الحساب غير مفعّل أو الرابط غير صالح" }, { status: 403 });
    }

    const body = await request.json();
    const { text, preparerIds, regionId, orderTime } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: "النص مفقود أو غير صالح" }, { status: 400 });
    }

    const parsed = parseFlexibleOrderLines(text);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const title = parsed ? parsed.title : (lines.length > 0 ? lines[0] : "تجهيز تسوق جديد");
    const phone = parsed ? parsed.phone : "";
    const productsList = parsed ? parsed.products : lines.slice(1);

    const phoneLocal = normalizeIraqMobileLocal11(phone) || "";

    let finalRegionId = regionId;

    // محاولة التعرف على المنطقة تلقائياً إذا لم يتم إرسالها
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

    // التحقق من المنطقة
    const region = await prisma.region.findUnique({
      where: { id: finalRegionId },
      select: { id: true }
    });
    if (!region) {
      return NextResponse.json({ error: "منطقة الزبون غير صالحة" }, { status: 400 });
    }

    // التحقق من الرقم المحظور
    if (phoneLocal) {
      const isBlocked = await prisma.globalBlockedPhone.findUnique({
        where: { phone: phoneLocal },
      });
      if (isBlocked) {
        return NextResponse.json({ error: "عذراً، هذا الرقم محظور عالمياً من التوصيل" }, { status: 400 });
      }
    }

    const products = productsList.map((line) => ({
      line,
      buyAlf: null as number | null,
      sellAlf: null as number | null,
    }));

    const groupId = `GRP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdDraftIds: string[] = [];
    const preparerNames: string[] = [];
    const resolvedPreparerIds = Array.isArray(preparerIds) ? preparerIds.filter(Boolean) : [];

    const finalOrderTime = orderTime || "عاجل اليوم";

    if (resolvedPreparerIds.length === 0) {
      // إرسال كمسودة عامة بدون مجهز
      const draft = await prisma.companyPreparerShoppingDraft.create({
        data: {
          status: PreparerShoppingDraftStatus.draft,
          titleLine: title.substring(0, 100),
          rawListText: text,
          customerRegion: { connect: { id: finalRegionId } },
          customerPhone: phoneLocal,
          orderTime: finalOrderTime,
          data: {
            version: 1,
            products,
            groupId,
            fromStaffEmployeeId: staff.id,
            fromStaffEmployeeName: staff.name,
          }
        },
        select: { id: true }
      });
      createdDraftIds.push(draft.id);
      preparerNames.push("غير مسند (عام)");
    } else {
      for (const preparerId of resolvedPreparerIds) {
        const preparer = await prisma.companyPreparer.findFirst({
          where: { id: preparerId, active: true },
          select: { id: true, name: true },
        });
        if (!preparer) continue;

        const draft = await prisma.companyPreparerShoppingDraft.create({
          data: {
            preparer: { connect: { id: preparer.id } },
            status: PreparerShoppingDraftStatus.draft,
            titleLine: title.substring(0, 100),
            rawListText: text,
            customerRegion: { connect: { id: finalRegionId } },
            customerPhone: phoneLocal,
            orderTime: finalOrderTime,
            data: {
              version: 1,
              products,
              groupId,
              fromStaffEmployeeId: staff.id,
              fromStaffEmployeeName: staff.name,
            }
          },
          select: { id: true }
        });

        createdDraftIds.push(draft.id);
        preparerNames.push(preparer.name);

        // إشعار المجهز
        await prisma.companyPreparerPrepNotice.create({
          data: {
            preparerId: preparer.id,
            title: title.substring(0, 100),
            body: `طلب تجهيز موظف جديد: ${phoneLocal}`,
          },
        });

        await pushNotifyPreparerNewNotice({
          preparerId: preparer.id,
          title: title.substring(0, 100),
          body: text,
          draftId: draft.id,
        }).catch(e => console.error("Web Push failed for staff app submission:", e));
      }
    }

    return NextResponse.json({
      success: true,
      draftIds: createdDraftIds,
      preparers: preparerNames.join(" + ")
    });

  } catch (error: any) {
    console.error("Employee quick-draft API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
