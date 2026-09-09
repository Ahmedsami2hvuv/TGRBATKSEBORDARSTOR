import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";

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

async function handleMarkSent(orderId: string) {
  if (!orderId) {
    return NextResponse.json({ error: "معرف الطلب مفقود" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: String(orderId) },
    select: { id: true, customerPhone: true, adminOrderCode: true }
  });

  if (!order) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  const rawPhone = order.customerPhone?.trim();
  const currentCode = order.adminOrderCode || "";
  const newCode = currentCode.length > 0 
    ? (currentCode.includes("RATING_REQUESTED") ? currentCode : `${currentCode}__RATING_REQUESTED`)
    : "RATING_REQUESTED";

  await prisma.order.update({
    where: { id: order.id },
    data: { adminOrderCode: newCode }
  });

  // تأشير كافة طلبات هذا الزبون في قاعدة البيانات ليتلون بالأخضر في كل الأيام
  if (rawPhone && rawPhone.length >= 7) {
    const otherOrders = await prisma.order.findMany({
      where: {
        customerPhone: rawPhone,
        id: { not: order.id },
        NOT: { adminOrderCode: { contains: "RATING_REQUESTED" } }
      },
      select: { id: true, adminOrderCode: true }
    });

    for (const o of otherOrders) {
      const cCode = o.adminOrderCode || "";
      const nCode = cCode.length > 0 ? `${cCode}__RATING_REQUESTED` : "RATING_REQUESTED";
      await prisma.order.update({
        where: { id: o.id },
        data: { adminOrderCode: nCode }
      });
    }

    // إضافة الزبون لقائمة مهمة المراسلة والتخزين ليظهر بعد 24 ساعة بأولوية قصوى
    try {
      const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { shop: { select: { name: true } } }
      });
      await addRatedCustomerToOutreachQueue(rawPhone, fullOrder?.shop?.name);
    } catch (e) {
      console.error("Auto add to outreach queue failed:", e);
    }
  }

  return NextResponse.json({ success: true, message: "تم تأشير الطلب كمُرسل تقييمه بنجاح", adminOrderCode: newCode });
}

async function addRatedCustomerToOutreachQueue(phone: string, shopName?: string) {
  const defaultStaff = await prisma.staffEmployee.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" }
  });
  if (!defaultStaff) return;

  let mainList = await prisma.staffOutreachList.findFirst({
    where: { staffEmployeeId: defaultStaff.id },
    orderBy: { createdAt: "asc" }
  });

  if (!mainList) {
    mainList = await prisma.staffOutreachList.create({
      data: {
        id: crypto.randomUUID(),
        staffEmployeeId: defaultStaff.id,
        title: "قائمة مهام التواصل الرئيسية",
      }
    });
  }

  const availableAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // بعد 24 ساعة
  const originalInput = shopName ? `${shopName} (تقييم ⭐)` : "تقييم زبون ⭐";

  const existing = await prisma.staffOutreachItem.findFirst({
    where: {
      listId: mainList.id,
      phone: phone,
    }
  });

  if (!existing) {
    await prisma.staffOutreachItem.create({
      data: {
        id: crypto.randomUUID(),
        listId: mainList.id,
        phone: phone,
        originalInput,
        status: "pending",
        source: "evaluation",
        availableAt,
        priority: 10,
      }
    });
  } else if (existing.status !== "completed") {
    await prisma.staffOutreachItem.update({
      where: { id: existing.id },
      data: {
        priority: 10,
        source: "evaluation",
        availableAt,
        originalInput: existing.originalInput || originalInput,
      }
    });
  }
}

export async function POST(request: Request) {
  try {
    const verification = await verifyRequest(request);
    if (!verification.ok) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    let orderId: string | undefined;
    try {
      const body = await request.json();
      orderId = body.orderId;
    } catch (e) {
      const urlObj = new URL(request.url);
      orderId = urlObj.searchParams.get("orderId") || undefined;
    }

    if (!orderId) {
      const urlObj = new URL(request.url);
      orderId = urlObj.searchParams.get("orderId") || undefined;
    }

    return await handleMarkSent(orderId || "");
  } catch (error: any) {
    console.error("Mark rating requested API error:", error);
    return NextResponse.json({ error: error.message || "فشل تأشير الطلب" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const verification = await verifyRequest(request);
    if (!verification.ok) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const urlObj = new URL(request.url);
    const orderId = urlObj.searchParams.get("orderId") || "";

    return await handleMarkSent(orderId);
  } catch (error: any) {
    console.error("Mark rating requested API error (GET):", error);
    return NextResponse.json({ error: error.message || "فشل تأشير الطلب" }, { status: 500 });
  }
}
