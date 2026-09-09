import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { ensureOutreachTablesExist } from "@/lib/db-self-heal-outreach";

export const dynamic = "force-dynamic";

async function verifyRequest(request: Request) {
  const urlObj = new URL(request.url);
  let se = request.headers.get("x-employee-se") || urlObj.searchParams.get("se") || undefined;
  let exp = request.headers.get("x-employee-exp") || urlObj.searchParams.get("exp") || undefined;
  let sig = request.headers.get("x-employee-sig") || urlObj.searchParams.get("s") || undefined;
  const staffIdHeader = request.headers.get("x-employee-staff-id") || urlObj.searchParams.get("staff_id");

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

  if (staffIdHeader) {
    const emp = await prisma.staffEmployee.findFirst({
      where: { OR: [{ id: staffIdHeader }, { portalToken: staffIdHeader }] }
    });
    if (emp) {
      return { ok: true, staffEmployeeId: emp.id, token: emp.portalToken };
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

function normalizeIraqiPhone(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  while (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("964") && d.length >= 12) return d;
  if (d.startsWith("07") && d.length === 11) return "964" + d.slice(1);
  if (d.startsWith("7") && d.length === 10) return "964" + d;
  return d;
}

export async function GET(request: Request) {
  try {
    await ensureOutreachTablesExist();

    const verification = await verifyRequest(request);
    if (!verification.ok || !verification.staffEmployeeId) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const staffId = verification.staffEmployeeId;

    // 1. جلب نماذج الرسائل الفعالة الخاصة بالموظف
    const templates = await prisma.staffOutreachTemplate.findMany({
      where: {
        staffEmployeeId: staffId,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const templateTexts = templates
      .map((t) => t.content.trim())
      .filter(Boolean);

    if (templateTexts.length === 0) {
      templateTexts.push(
        "السلام عليكم ورحمة الله وبركاته 🌸\nمعك خدمات التوصيل السريع — أبو الأكبر للتوصيل ✨\nيسعدنا ويشرفنا حفظ رقمنا لديك لطلب خدمة التوصيل في أي وقت 📦🌹",
        "مرحباً بك عزيزنا الزبون 🌹\nنرجو حفظ هذا الرقم للتواصل السريع وطلب خدمات التوصيل في بغداد والمحافظات 🚗📦\nنتشرف بخدمتكم دائماً ✨"
      );
    }

    // 2. البحث عن القائمة الرئيسية للموظف
    const mainList = await prisma.staffOutreachList.findFirst({
      where: { staffEmployeeId: staffId },
      orderBy: { createdAt: "asc" },
    });

    if (!mainList) {
      return NextResponse.json({
        success: true,
        totalPendingCount: 0,
        queue: [],
        nextItem: null,
      });
    }

    const now = new Date();

    // 3. جلب الأرقام غير المكتملة التي حان موعد ظهورها (أو ليس لها موعد محدد) مع تقديم أصحاب الأولوية القصوى
    const pendingItems = await prisma.staffOutreachItem.findMany({
      where: {
        listId: mainList.id,
        status: { in: ["pending", "whatsapp_opened"] },
        OR: [
          { availableAt: null },
          { availableAt: { lte: now } }
        ]
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      take: 100,
    });

    const totalPendingCount = await prisma.staffOutreachItem.count({
      where: {
        listId: mainList.id,
        status: { in: ["pending", "whatsapp_opened"] },
        OR: [
          { availableAt: null },
          { availableAt: { lte: now } }
        ]
      },
    });

    const queueItems = pendingItems.map((item) => {
      const randomTemplate = templateTexts[Math.floor(Math.random() * templateTexts.length)];
      const waPhone = normalizeIraqiPhone(item.phone);

      let renderedMessage = randomTemplate
        .replace(/\{phone\}|\{\{\{customer_phone\}\}\}/g, item.phone)
        .replace(/\{name\}|\{\{\{customer_name\}\}\}/g, item.originalInput || "");

      return {
        id: item.id,
        phone: item.phone,
        waPhone: waPhone,
        originalInput: item.originalInput,
        status: item.status,
        generatedMessage: renderedMessage,
        createdAt: item.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      totalPendingCount,
      queue: queueItems,
      nextItem: queueItems.length > 0 ? queueItems[0] : null,
    });
  } catch (error: any) {
    console.error("Outreach queue API error:", error);
    return NextResponse.json({ error: error.message || "حدث خطأ في الخادم" }, { status: 500 });
  }
}
