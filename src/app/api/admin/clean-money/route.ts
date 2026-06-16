import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MONEY_KIND_DELIVERY } from "@/lib/mandoub-money-events";

export const dynamic = "force-dynamic";

export async function GET() {
  const allowedOrderNumbers = [439, 438, 436, 435, 434, 433, 432, 431, 430, 429, 426, 425, 424, 423, 422, 421, 420, 419].map(n => n.toString());
  
  const couriers = await prisma.courier.findMany();
  let count = 0;
  
  for (const c of couriers) {
    if (!c.mandoubTotalsResetAt) continue;
    
    // إيجاد الأحداث المالية التي تمت إضافتها للتو (خلال اليوم)
    // والتي تكون تابعة لطلبات قديمة لم يتم ذكرها في القائمة اليوم
    const events = await prisma.orderCourierMoneyEvent.findMany({
       where: {
         courierId: c.id,
         kind: MONEY_KIND_DELIVERY,
         deletedAt: null,
         createdAt: { gt: c.mandoubTotalsResetAt } // دخلت في الحساب بعد التصفية
       },
       include: { order: true }
    });
    
    for (const ev of events) {
       // إذا كان الطلب من أمس أو أقدم، ولم يُذكر في القائمة اليوم
       // معناه هذا طلب تم إحياؤه بالخطأ بسبب التعديل الإداري (updatedAt)
       // يجب حذفه (تغيير تاريخه إلى ما قبل التصفية حتى يخرج من الحساب)
       const isTodayOrder = allowedOrderNumbers.includes(ev.order.orderNumber);
       
       if (!isTodayOrder) {
          // الطلب ليس ضمن طلبات اليوم (ليس في الـ 18 طلب)
          // نقوم بإخراجه من الأرباح بإرجاع تاريخ حركته إلى وقت إنشاء الطلب نفسه (الذي كان قبل التصفية)
          await prisma.orderCourierMoneyEvent.update({
            where: { id: ev.id },
            data: { createdAt: ev.order.createdAt }
          });
          count++;
       }
    }
  }
  
  return NextResponse.json({ message: "Done. Fixed " + count + " wrong events." });
}
