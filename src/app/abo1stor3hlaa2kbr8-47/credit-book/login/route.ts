import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAdminToken, adminCookieName } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return new NextResponse("رابط الوصول غير صالح (التوكن مفقود)", { status: 400 });
    }

    // البحث عن المحاسب المرتبط بهذا التوكن
    const setting = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "credit_book", section: "accountant_access_tokens" } }
    });

    if (!setting || !setting.config || typeof setting.config !== "object") {
      return new NextResponse("رابط الوصول غير صالح أو منتهي الصلاحية", { status: 403 });
    }

    const accountants = (setting.config as any).accountants || [];
    const acc = accountants.find((a: any) => a.token === token && a.active);

    if (!acc) {
      return new NextResponse("رابط الوصول غير صالح أو تم إلغاؤه من قبل الإدارة", { status: 403 });
    }

    // توليد توكن الإدارة بالاسم المحدد للمحاسب
    const jwtToken = await signAdminToken(acc.name);

    // توجيه المستخدم لصفحة دفتر الديون مع تعيين الكوكيز
    const res = NextResponse.redirect(new URL("/abo1stor3hlaa2kbr8-47/credit-book", req.url));
    res.cookies.set(adminCookieName, jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 أيام
    });

    return res;
  } catch (error) {
    console.error("Error in accountant login route:", error);
    return new NextResponse("حدث خطأ غير متوقع في الخادم", { status: 500 });
  }
}
