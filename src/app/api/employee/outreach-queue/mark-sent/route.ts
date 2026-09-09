import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { ensureOutreachTablesExist } from "@/lib/db-self-heal-outreach";

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

async function handleMarkSent(itemId: string) {
  if (!itemId) {
    return NextResponse.json({ error: "معرف العنصر مفقود" }, { status: 400 });
  }

  await ensureOutreachTablesExist();

  const item = await prisma.staffOutreachItem.findUnique({
    where: { id: String(itemId) },
  });

  if (!item) {
    return NextResponse.json({ error: "العنصر غير موجود" }, { status: 404 });
  }

  await prisma.staffOutreachItem.update({
    where: { id: item.id },
    data: {
      status: "completed",
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, message: "تم تأشير الرقم كمكتمل الإرسال بنجاح" });
}

export async function POST(request: Request) {
  try {
    const verification = await verifyRequest(request);
    if (!verification.ok) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    let itemId: string | undefined;
    try {
      const body = await request.json();
      itemId = body.itemId || body.id;
    } catch (e) {
      const urlObj = new URL(request.url);
      itemId = urlObj.searchParams.get("itemId") || urlObj.searchParams.get("id") || undefined;
    }

    if (!itemId) {
      const urlObj = new URL(request.url);
      itemId = urlObj.searchParams.get("itemId") || urlObj.searchParams.get("id") || undefined;
    }

    return await handleMarkSent(itemId || "");
  } catch (error: any) {
    console.error("Mark outreach sent API error:", error);
    return NextResponse.json({ error: error.message || "فشل تأشير العنصر" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const verification = await verifyRequest(request);
    if (!verification.ok) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const urlObj = new URL(request.url);
    const itemId = urlObj.searchParams.get("itemId") || urlObj.searchParams.get("id") || "";

    return await handleMarkSent(itemId);
  } catch (error: any) {
    console.error("Mark outreach sent API error (GET):", error);
    return NextResponse.json({ error: error.message || "فشل تأشير العنصر" }, { status: 500 });
  }
}
