import { NextResponse } from "next/server";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

/**
 * مرجع (رقم + منطقة) لصفحة رفع الطلب — يُحمّل عند اختيار المنطقة لعرض/إفراغ
 * لوكيشن وأقرب نقطة ورقم ثانٍ حسب المنطقة فقط (لا تسريب من منطقة أخرى).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const e = searchParams.get("e")?.trim() ?? "";
  const se = searchParams.get("se")?.trim() ?? "";
  const exp = searchParams.get("exp")?.trim() ?? "";
  const sig = searchParams.get("s")?.trim() ?? "";

  let isAuthorized = false;

  // التحقق من صلاحية الموظف (المحل) أو موظف النظام (Staff)
  if (e) {
    const v = verifyEmployeeOrderPortalQuery(e, exp, sig);
    if (v.ok) {
      const employee = await prisma.employee.findUnique({
        where: { id: v.employeeId },
        select: { orderPortalToken: true },
      });
      if (employee && employee.orderPortalToken === v.token) isAuthorized = true;
    }
  } else if (se) {
    const v = verifyStaffEmployeePortalQuery(se, exp, sig);
    if (v.ok) {
      const staff = await prisma.staffEmployee.findUnique({
        where: { id: v.staffEmployeeId },
        select: { portalToken: true, active: true },
      });
      if (staff && staff.active && staff.portalToken === v.token) isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const regionId = searchParams.get("regionId")?.trim() ?? "";
  const phoneRaw = searchParams.get("phone")?.trim() ?? "";

  const globalBlock = await prisma.globalBlockedPhone.findUnique({
    where: { phone },
  });

  if (!profile && !globalBlock) {
    return NextResponse.json({ profile: null });
  }

  const BLOCKED_PREFIX = "🔴 الزبون ممنوع من التوصيل";
  let landmark = profile?.landmark?.trim() ?? "";
  const isBlocked = !!profile?.isBlocked || !!globalBlock;

  if (isBlocked && !landmark.includes(BLOCKED_PREFIX)) {
    landmark = `${BLOCKED_PREFIX} ${landmark}`.trim();
  }

  return NextResponse.json({
    profile: {
      locationUrl: profile?.locationUrl?.trim() ?? "",
      landmark: landmark,
      alternatePhone: profile?.alternatePhone?.trim() ?? null,
      photoUrl: profile?.photoUrl?.trim() ?? "",
      isBlocked: isBlocked,
    },
  });
}
