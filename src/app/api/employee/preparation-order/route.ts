import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { PreparerShoppingDraftStatus } from "@prisma/client";
import { pushNotifyPreparerNewNotice } from "@/lib/web-push-server";

async function verifyRequest(request: Request) {
  const urlObj = new URL(request.url);
  let se = request.headers.get("x-employee-se") || urlObj.searchParams.get("se") || undefined;
  let exp = request.headers.get("x-employee-exp") || urlObj.searchParams.get("exp") || undefined;
  let sig = request.headers.get("x-employee-sig") || urlObj.searchParams.get("s") || undefined;

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const rawAuth = authHeader.substring(7).trim();
    if (rawAuth.includes("se=") && rawAuth.includes("exp=") && rawAuth.includes("s=")) {
      try {
        const tokenUrl = new URL(rawAuth.startsWith("http") ? rawAuth : `https://aboakbr.com${rawAuth}`);
        se = tokenUrl.searchParams.get("se") || se;
        exp = tokenUrl.searchParams.get("exp") || exp;
        sig = tokenUrl.searchParams.get("s") || sig;
      } catch (e) {}
    } else {
      const emp = await prisma.staffEmployee.findFirst({
        where: { OR: [{ id: rawAuth }, { portalToken: rawAuth }] }
      });
      if (emp) {
        return { ok: true, staffEmployeeId: emp.id, token: emp.portalToken };
      }
    }
  }

  if (!se || !exp || !sig) {
    const tokenMatch = urlObj.searchParams.get("token");
    if (tokenMatch) {
      const emp = await prisma.staffEmployee.findFirst({
        where: { OR: [{ id: tokenMatch }, { portalToken: tokenMatch }] }
      });
      if (emp) {
        return { ok: true, staffEmployeeId: emp.id, token: emp.portalToken };
      }
    }
    return { ok: false };
  }
  return verifyStaffEmployeePortalQuery(se, exp, sig);
}

export async function POST(request: Request) {
  try {
    const verification = await verifyRequest(request);
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
    const { 
      text, 
      phone, 
      regionId, 
      orderTime, 
      targets, // قائمة المجهزين والموردين المحددين [{ id, type, name }]
      targetType,
      targetId,
      targetName
    } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: "نص الطلب أو المواد مفقود" }, { status: 400 });
    }

    const phoneLocal = normalizeIraqMobileLocal11(phone || "") || "";

    if (phoneLocal) {
      const isBlocked = await prisma.globalBlockedPhone.findUnique({
        where: { phone: phoneLocal },
      });
      if (isBlocked) {
        return NextResponse.json({ error: "عذراً، هذا الرقم محظور عالمياً من التوصيل" }, { status: 400 });
      }
    }

    const finalRegionId = regionId || null;
    const finalOrderTime = orderTime || "عاجل اليوم";

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const title = lines.length > 0 ? lines[0] : "طلب تجهيز جديد";
    const products = lines.map((line) => ({
      line,
      buyAlf: null as number | null,
      sellAlf: null as number | null,
    }));

    const groupId = `GRP-PREP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // تجميع المجهزين والموردين المحددين
    const resolvedTargets: Array<{ id: string; type: string; name: string }> = [];
    if (Array.isArray(targets) && targets.length > 0) {
      resolvedTargets.push(...targets);
    } else if (targetId) {
      resolvedTargets.push({
        id: targetId,
        type: targetType || "preparer",
        name: targetName || ""
      });
    }

    const targetNames = resolvedTargets.map(t => (t.type === "supplier" ? `🏬 ${t.name}` : `📦 ${t.name}`)).join(" + ");
    const primaryPreparer = resolvedTargets.find(t => t.type === "preparer");

    const draft = await prisma.companyPreparerShoppingDraft.create({
      data: {
        preparerId: primaryPreparer ? primaryPreparer.id : null,
        status: PreparerShoppingDraftStatus.draft,
        titleLine: title.substring(0, 100),
        rawListText: text,
        customerRegionId: finalRegionId,
        customerPhone: phoneLocal,
        orderTime: finalOrderTime,
        data: {
          version: 1,
          products,
          groupId,
          targets: resolvedTargets,
          fromStaffEmployeeId: staff.id,
          fromStaffEmployeeName: staff.name,
          notes: targetNames.length > 0 ? `المعينون: ${targetNames}` : "غير مسند"
        }
      },
      select: { id: true, draftNumber: true }
    });

    // إرسال الإشعارات لجميع المجهزين المحددين
    for (const t of resolvedTargets) {
      if (t.type === "preparer" && t.id) {
        await prisma.companyPreparerPrepNotice.create({
          data: {
            preparerId: t.id,
            title: `طلب تجهيز جديد #${draft.draftNumber}`,
            body: `طلب تجهيز من الموظف ${staff.name}: ${title.substring(0, 50)}`,
          },
        }).catch(() => {});

        await pushNotifyPreparerNewNotice({
          preparerId: t.id,
          title: `طلب تجهيز جديد #${draft.draftNumber}`,
          body: text,
          draftId: draft.id,
        }).catch(e => console.error("Web Push failed for prep order:", e));
      }
    }

    return NextResponse.json({
      success: true,
      draftId: draft.id,
      draftNumber: draft.draftNumber,
      message: `تم إرسال طلب التجهيز بنجاح! رقم المسودة: #${draft.draftNumber}`
    });

  } catch (error: any) {
    console.error("Employee preparation order API error:", error);
    return NextResponse.json({ error: error.message || "فشل إنشاء طلب التجهيز" }, { status: 500 });
  }
}
