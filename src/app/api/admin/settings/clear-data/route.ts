import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // حذف البيانات بالترتيب لتجنب مشاكل Foreign Key
    await prisma.customer.deleteMany();
    await prisma.customerPhoneProfile.deleteMany();
    await prisma.orderCourierMoneyEvent.deleteMany();
    await prisma.order.deleteMany();
    await prisma.preparerShop.deleteMany();
    await prisma.companyPreparerShoppingDraft.deleteMany();
    await prisma.shop.deleteMany();
    await prisma.region.deleteMany();

    return NextResponse.json({ success: true, message: "تم تصغير كافة البيانات بنجاح (Supabase صارت 0)" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
