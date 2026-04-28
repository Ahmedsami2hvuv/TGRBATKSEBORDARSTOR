import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // حذف كل شيء بالترتيب الصحيح لكسر القيود
    await prisma.customer.deleteMany({});
    await prisma.customerPhoneProfile.deleteMany({});
    await prisma.orderCourierMoneyEvent.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.preparerShop.deleteMany({});
    await prisma.companyPreparerShoppingDraft.deleteMany({});
    await prisma.shop.deleteMany({});
    await prisma.region.deleteMany({});

    return NextResponse.json({ success: true, message: "تم تصفير كل شيء: المناطق، المحلات، والزبائن صارت 0" });
  } catch (error: any) {
    console.error("RESET ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
