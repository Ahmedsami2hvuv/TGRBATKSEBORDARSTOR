import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 1. تنظيف جدول زبائن المحلات (Customer)
    const customersWithLongUrls = await prisma.customer.findMany({
      where: {
        customerDoorPhotoUrl: { startsWith: "data:image" }
      },
      select: { id: true, phone: true, customerRegionId: true }
    });

    let customerUpdates = 0;
    for (const c of customersWithLongUrls) {
      if (!c.customerRegionId) continue;
      
      // جلب الرابط النظيف من الملف المرجعي
      const profile = await prisma.customerPhoneProfile.findUnique({
        where: { phone_regionId: { phone: c.phone, regionId: c.customerRegionId } }
      });

      if (profile?.photoUrl && profile.photoUrl.includes("r2.dev")) {
        await prisma.customer.update({
          where: { id: c.id },
          data: { customerDoorPhotoUrl: profile.photoUrl }
        });
        customerUpdates++;
      } else {
        // إذا لم يتم رفعه لـ R2 بعد، يمكننا مسحه مؤقتاً لمنع التعليق أو تركه
        // للسهولة، سنتركه ليتم سحبه في المرة القادمة
      }
    }

    // 2. تنظيف جدول الطلبيات (Order)
    const ordersWithLongUrls = await prisma.order.findMany({
      where: {
        customerDoorPhotoUrl: { startsWith: "data:image" }
      },
      select: { id: true, customerPhone: true, customerRegionId: true }
    });

    let orderUpdates = 0;
    for (const o of ordersWithLongUrls) {
      if (!o.customerPhone || !o.customerRegionId) continue;
      
      // جلب الرابط النظيف من الملف المرجعي
      const profile = await prisma.customerPhoneProfile.findUnique({
        where: { phone_regionId: { phone: o.customerPhone, regionId: o.customerRegionId } }
      });

      if (profile?.photoUrl && profile.photoUrl.includes("r2.dev")) {
        await prisma.order.update({
          where: { id: o.id },
          data: { customerDoorPhotoUrl: profile.photoUrl }
        });
        orderUpdates++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `تم تنظيف ${customerUpdates} زبون محل، و ${orderUpdates} طلبية.`,
      customerUpdates,
      orderUpdates
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
