import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { buildEmployeeChatGreeting, whatsappAppUrl } from "@/lib/whatsapp";
import { getPublicAppUrl } from "@/lib/app-url";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params;
    const baseUrl = getPublicAppUrl();

    // جلب بيانات المحل مع موظفيه
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        locationUrl: true,
        employees: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            phone: true,
            orderPortalToken: true,
          },
        },
      },
    });

    if (!shop) {
      return NextResponse.json(
        { error: "المحل غير موجود" },
        { status: 404 }
      );
    }

    // توليد الروابط على السيرفر لضمان صحة التوقيع الرقمي
    const employeesWithLinks = shop.employees.map((emp) => {
      const orderPortalUrl = buildEmployeeOrderPortalUrl(emp.id, emp.orderPortalToken, baseUrl);
      const greeting = buildEmployeeChatGreeting({ employeeName: emp.name });
      const whatsappLink = whatsappAppUrl(emp.phone, greeting);

      return {
        ...emp,
        orderPortalUrl,
        whatsappLink
      };
    });

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
        locationUrl: shop.locationUrl,
      },
      employees: employeesWithLinks,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ داخلي في الخادم" },
      { status: 500 }
    );
  }
}
