import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // حذف قسري: نقوم بفك ارتباط الزبائن من الطلبات أولاً (نجعلها null) لكي يسمح بالحذف
    await prisma.order.updateMany({
        where: { NOT: { customerId: null } },
        data: { customerId: null }
    });

    // حذف البروفايلات والزبائن
    await prisma.customerProfile.deleteMany({}); // إذا كان موجوداً
    await prisma.customerPhoneProfile.deleteMany({});
    await prisma.customer.deleteMany({});

    return NextResponse.json({ success: true, message: "تم تصفير كافة بيانات الزبائن بنجاح" });
  } catch (error: any) {
    console.error("RESET ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
