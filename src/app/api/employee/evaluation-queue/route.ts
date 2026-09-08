import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

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
    const verification = await verifyRequest(request);
    if (!verification.ok) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const waButtons = await prisma.mandoubWaButtonSetting.findMany({
      where: { isActive: true }
    });

    const evaluationTemplates: string[] = [];
    for (const btn of waButtons) {
      if (btn.label.includes("تقييم") || btn.templateText.includes("تقييم") || btn.name.includes("تقييم")) {
        const parts = btn.templateText.split(/\n\s*---\s*\n/g).map(s => s.trim()).filter(Boolean);
        evaluationTemplates.push(...parts);
      }
    }

    if (evaluationTemplates.length === 0) {
      evaluationTemplates.push(
        "مرحباً بك عزيزنا الزبون، نرجو تقييم خدمة التوصيل لطلبكم من {shopName}. رأيكم يهمنا جداً لتطوير الخدمة ⭐",
        "أهلاً وسهلاً، نود الاطمئنان على وصول طلبكم من {shopName}، ونسعد بتقييمكم لخدمتنا لتوفير أفضل تجربة لكم دائماً 🌹",
        "السلام عليكم، نأمل أن تكون راضياً عن خدمة التوصيل لطلبك رقم #{orderNumber} من {shopName}. تقييمك لخدمتنا يسعدنا 🌟",
        "مرحباً، شكراً لتعاملك معنا في {shopName}. نرجو إعطاء تقييمك لمندوب وخدمة التوصيل لمساعدتنا على تقديم الأفضل دائماً ✨"
      );
    }

    // جلب الطلبات المؤرشفة الأحدث التي لم يتم إرسال طلب تقييم لها
    const pendingOrders = await prisma.order.findMany({
      where: {
        status: "archived",
        NOT: {
          adminOrderCode: { contains: "RATING_REQUESTED" }
        },
        customerPhone: { not: "" }
      },
      orderBy: { orderNumber: "desc" },
      take: 50,
      include: {
        shop: { select: { name: true } },
        customerRegion: { select: { name: true } },
        courier: { select: { name: true } }
      }
    });

    const totalPendingCount = await prisma.order.count({
      where: {
        status: "archived",
        NOT: {
          adminOrderCode: { contains: "RATING_REQUESTED" }
        },
        customerPhone: { not: "" }
      }
    });

    const queueItems = pendingOrders.map((o) => {
      const randomTemplate = evaluationTemplates[Math.floor(Math.random() * evaluationTemplates.length)];
      const priceStr = o.totalAmount != null ? formatDinarAsAlfWithUnit(o.totalAmount) : "—";
      const shopName = o.shop?.name || "";
      const regionName = o.customerRegion?.name || "";
      const courierName = o.courier?.name || "";
      const waPhone = normalizeIraqiPhone(o.customerPhone);

      let renderedMessage = randomTemplate
        .replace(/\{shopName\}|\{\{\{clientshop\}\}\}/g, shopName)
        .replace(/\{regionName\}|\{\{\{city\}\}\}/g, regionName)
        .replace(/\{orderNumber\}|\{\{\{order_number\}\}\}/g, String(o.orderNumber))
        .replace(/\{total\}|\{\{\{total_price\}\}\}/g, priceStr)
        .replace(/\{delivery\}|\{\{\{delivery\}\}\}/g, courierName)
        .replace(/\{customerPhone\}|\{\{\{customer_phone\}\}\}/g, o.customerPhone);

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        shopName: shopName,
        regionName: regionName,
        customerPhone: o.customerPhone,
        waPhone: waPhone,
        alternatePhone: o.secondCustomerPhone || o.alternatePhone || null,
        courierName: courierName,
        totalAmount: priceStr,
        generatedMessage: renderedMessage,
        createdAt: o.createdAt
      };
    });

    return NextResponse.json({
      success: true,
      totalPendingCount,
      queue: queueItems,
      nextItem: queueItems.length > 0 ? queueItems[0] : null
    });

  } catch (error: any) {
    console.error("Evaluation queue API error:", error);
    return NextResponse.json({ error: error.message || "حدث خطأ في الخادم" }, { status: 500 });
  }
}
