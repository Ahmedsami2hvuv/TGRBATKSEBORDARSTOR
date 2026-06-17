import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { se, exp, sig, portalUrl } = body;

    // إذا تم تمرير الرابط بالكامل، نقوم بتحليله لاستخراج البارامترات
    if (portalUrl && typeof portalUrl === "string") {
      try {
        const urlObj = new URL(portalUrl);
        se = urlObj.searchParams.get("se") || undefined;
        exp = urlObj.searchParams.get("exp") || undefined;
        sig = urlObj.searchParams.get("s") || undefined;
      } catch (urlErr) {
        return NextResponse.json({ error: "رابط البوابة غير صالح" }, { status: 400 });
      }
    }

    if (!se || !exp || !sig) {
      return NextResponse.json({ error: "الرجاء توفير معلمات بوابة الموظف كاملة" }, { status: 400 });
    }

    const verification = verifyStaffEmployeePortalQuery(se, exp, sig);
    if (!verification.ok) {
      return NextResponse.json({ error: "الرابط غير صالح أو منتهي الصلاحية" }, { status: 401 });
    }

    const staff = await prisma.staffEmployee.findUnique({
      where: { id: verification.staffEmployeeId },
      select: {
        id: true,
        name: true,
        phone: true,
        active: true,
        portalToken: true,
        canSubmitOrders: true,
        salaryBalance: true,
      },
    });

    if (!staff) {
      return NextResponse.json({ error: "حساب الموظف غير موجود" }, { status: 404 });
    }

    if (!staff.active) {
      return NextResponse.json({ error: "حساب الموظف معطل من قبل الإدارة" }, { status: 403 });
    }

    if (staff.portalToken !== verification.token) {
      return NextResponse.json({ error: "الرمز غير مطابق للرمز الحالي" }, { status: 401 });
    }

    // إرجاع تفاصيل الموظف بنجاح
    return NextResponse.json({
      success: true,
      staff: {
        id: staff.id,
        name: staff.name,
        phone: staff.phone,
        canSubmitOrders: staff.canSubmitOrders,
        salaryBalance: Number(staff.salaryBalance || 0),
        // نرجع نفس البيانات المدخلة ليقوم التطبيق بتخزينها واستخدامها للتوثيق اللاحق
        se,
        exp,
        sig
      }
    });

  } catch (error: any) {
    console.error("Employee login API error:", error);
    return NextResponse.json({ error: "حدث خطأ غير متوقع: " + error.message }, { status: 500 });
  }
}
