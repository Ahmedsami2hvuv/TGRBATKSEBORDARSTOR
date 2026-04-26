import { NextResponse } from "next/server";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

/**
 * مرجع (رقم + منطقة) لصفحة رفع الطلب — يُحمّل عند اختيار المنطقة لعرض/إفراغ
 * لوكيشن وأقرب نقطة ورقم ثانٍ حسب المنطقة فقط (لا تسريب من منطقة أخرى).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const e = searchParams.get("e")?.trim() ?? "";
  const exp = searchParams.get("exp")?.trim() ?? "";
  const sig = searchParams.get("s")?.trim() ?? "";
  const v = verifyEmployeeOrderPortalQuery(e, exp, sig);
  if (!v.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const regionId = searchParams.get("regionId")?.trim() ?? "";
  const phoneRaw = searchParams.get("phone")?.trim() ?? "";
  const phone = normalizeIraqMobileLocal11(phoneRaw);
  if (!regionId || !phone) {
    return NextResponse.json({
      profile: null as {
        locationUrl: string;
        landmark: string;
        alternatePhone: string | null;
        photoUrl: string;
      } | null,
    });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: v.employeeId },
    select: { orderPortalToken: true },
  });
  if (!employee || employee.orderPortalToken !== v.token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const profile = await prisma.customerPhoneProfile.findUnique({
    where: { phone_regionId: { phone, regionId } },
    select: {
      locationUrl: true,
      landmark: true,
      alternatePhone: true,
      photoUrl: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({
    profile: {
      locationUrl: profile.locationUrl?.trim() ?? "",
      landmark: profile.landmark?.trim() ?? "",
      alternatePhone: profile.alternatePhone?.trim() ?? null,
      photoUrl: profile.photoUrl?.trim() ?? "",
    },
  });
}
