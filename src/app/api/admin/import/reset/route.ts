import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // حذف البيانات بترتيب يحترم العلاقات (من الأبناء للأباء)
    await prisma.orderCourierMoneyEvent.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.preparerShop.deleteMany({});
    await prisma.shop.deleteMany({});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
