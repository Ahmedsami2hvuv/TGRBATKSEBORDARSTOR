import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // 1. فك ارتباط الزبائن من كافة الطلبات (للسماح بالحذف)
    await prisma.order.updateMany({
        data: { customerId: null }
    });

    // 2. حذف اشتراكات التنبيهات المرتبطة بالزبائن
    await prisma.webPushSubscription.deleteMany({
        where: { customerId: { not: null } }
    });

    // 3. حذف البروفايلات والزبائن نهائياً
    await prisma.customerPhoneProfile.deleteMany({});
    await prisma.customer.deleteMany({});

    return NextResponse.json({ success: true, message: "تم تصفير القاعدة بنجاح. يمكنك السحب الآن." });
  } catch (error: any) {
    console.error("RESET ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
