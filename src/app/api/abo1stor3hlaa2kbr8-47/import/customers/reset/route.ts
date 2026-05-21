import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { target } = await req.json().catch(() => ({ target: "all" }));

    if (target === "orders") {
      await prisma.orderCourierMoneyEvent.deleteMany({});
      await prisma.order.deleteMany({});
      return NextResponse.json({ success: true, message: "تم حذف الطلبات فقط" });
    }

    if (target === "customers") {
      await prisma.customer.deleteMany({});
      await prisma.customerPhoneProfile.deleteMany({});
      return NextResponse.json({ success: true, message: "تم حذف الزبائن فقط" });
    }

    if (target === "shops") {
      await prisma.preparerShop.deleteMany({});
      await prisma.shop.deleteMany({});
      return NextResponse.json({ success: true, message: "تم حذف المحلات فقط" });
    }

    if (target === "regions") {
      // حذف المناطق يتطلب حذف الزبائن والمحلات أولاً بسبب القيود
      await prisma.customer.deleteMany({});
      await prisma.customerPhoneProfile.deleteMany({});
      await prisma.shop.deleteMany({});
      await prisma.region.deleteMany({});
      return NextResponse.json({ success: true, message: "تم حذف المناطق وما يرتبط بها" });
    }

    if (target === "all") {
      await prisma.customer.deleteMany({});
      await prisma.customerPhoneProfile.deleteMany({});
      await prisma.orderCourierMoneyEvent.deleteMany({});
      await prisma.order.deleteMany({});
      await prisma.preparerShop.deleteMany({});
      await prisma.companyPreparerShoppingDraft.deleteMany({});
      await prisma.shop.deleteMany({});
      await prisma.region.deleteMany({});
      return NextResponse.json({ success: true, message: "تم تصفير كل شيء بنجاح" });
    }

    return NextResponse.json({ success: false, message: "هدف غير معروف" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
