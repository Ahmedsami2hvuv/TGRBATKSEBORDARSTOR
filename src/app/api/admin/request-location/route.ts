import { NextResponse } from "next/server";
import { adminCookieName, verifyAdminToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { sendOneSignalNotification } from "@/lib/onesignal-server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const token = jar.get(adminCookieName)?.value ?? "";
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { userId?: string; userType?: "courier" | "preparer" | "employee" };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { userId, userType } = body;
    if (!userId || !userType) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    let targetApp: "mandob" | "preparer" | "employee" = "mandob";
    let userName = "";

    if (userType === "courier") {
      targetApp = "mandob";
      const user = await prisma.courier.findUnique({ where: { id: userId }, select: { name: true } });
      if (!user) return NextResponse.json({ error: "Courier not found" }, { status: 404 });
      userName = user.name;
    } else if (userType === "preparer") {
      targetApp = "preparer";
      const user = await prisma.companyPreparer.findUnique({ where: { id: userId }, select: { name: true } });
      if (!user) return NextResponse.json({ error: "Preparer not found" }, { status: 404 });
      userName = user.name;
    } else if (userType === "employee") {
      targetApp = "employee";
      const user = await prisma.staffEmployee.findUnique({ where: { id: userId }, select: { name: true } });
      if (!user) return NextResponse.json({ error: "Staff Employee not found" }, { status: 404 });
      userName = user.name;
    } else {
      return NextResponse.json({ error: "Invalid userType" }, { status: 400 });
    }

    console.log(`[Admin Request Location] Requesting location for ${userType} (${userName}) with ID: ${userId}`);

    // إرسال إشعار صامت عبر OneSignal
    const result = await sendOneSignalNotification({
      title: "تحديث الموقع",
      body: "جلب الموقع الجغرافي الحالي",
      url: "",
      externalIds: [userId],
      targetApp: targetApp,
      isSilent: true,
      data: {
        type: "request_location"
      }
    });

    if (result.success) {
      return NextResponse.json({ ok: true, message: `تم إرسال طلب الموقع بنجاح إلى ${userName}` });
    } else {
      return NextResponse.json({ error: result.error || "Failed to send notification via OneSignal" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error in request-location API:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
