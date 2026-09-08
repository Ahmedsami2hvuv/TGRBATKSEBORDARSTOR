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
    select: { id: true, adminOrderCode: true }
  });

  if (!order) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  const currentCode = order.adminOrderCode || "";
  if (currentCode.includes("RATING_REQUESTED")) {
    return NextResponse.json({ success: true, message: "تم تأشير الطلب مسبقاً" });
  }

  const newCode = currentCode.length > 0 
    ? `${currentCode}__RATING_REQUESTED`
    : "RATING_REQUESTED";

  await prisma.order.update({
    where: { id: order.id },
    data: { adminOrderCode: newCode }
  });

  return NextResponse.json({ success: true, message: "تم تأشير الطلب كمُرسل تقييمه بنجاح", adminOrderCode: newCode });
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
