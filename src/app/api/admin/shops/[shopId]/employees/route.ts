import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params;

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

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
        locationUrl: shop.locationUrl,
      },
      employees: shop.employees,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ داخلي في الخادم" },
      { status: 500 }
    );
  }
}
