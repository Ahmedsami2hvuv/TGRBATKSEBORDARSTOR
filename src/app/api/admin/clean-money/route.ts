import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MONEY_KIND_DELIVERY } from "@/lib/mandoub-money-events";

export const dynamic = "force-dynamic";

export async function GET() {
  const allowedOrderNumbers = [439, 438, 436, 435, 434, 433, 432, 431, 430, 429, 426, 425, 424, 423, 422, 421, 420, 419];
  
  const couriers = await prisma.courier.findMany();
  let restored = 0;
  let removed = 0;
  
  for (const c of couriers) {
    if (!c.mandoubTotalsResetAt) continue;
    
    // نجيب كل الحركات
    const events = await prisma.orderCourierMoneyEvent.findMany({
       where: {
         courierId: c.id,
         kind: MONEY_KIND_DELIVERY,
         deletedAt: null
       },
       include: { order: true }
    });
    
    for (const ev of events) {
       const isTodayOrder = allowedOrderNumbers.includes(ev.order.orderNumber);
       
       if (isTodayOrder) {
          // هذا طلب من طلبات اليوم، يجب أن يكون تاريخ حركته حديث (مثلا نفس الـ updatedAt) لكي يدخل في الحساب
          if (ev.createdAt <= c.mandoubTotalsResetAt) {
             // إذا كان مرجع للماضي بالغلط، نرجعه لليوم
             await prisma.orderCourierMoneyEvent.update({
               where: { id: ev.id },
               data: { createdAt: ev.order.updatedAt }
             });
             restored++;
          }
       } else {
          // هذا طلب قديم، يجب أن يكون تاريخ حركته في الماضي لكي لا يدخل في حساب اليوم
          if (ev.createdAt > c.mandoubTotalsResetAt) {
             // إذا كان طافر لليوم، نرجعه للماضي
             await prisma.orderCourierMoneyEvent.update({
               where: { id: ev.id },
               data: { createdAt: ev.order.createdAt }
             });
             removed++;
          }
       }
    }
  }
  
  return NextResponse.json({ message: `Done. Restored ${restored} orders. Removed ${removed} wrong events.` });
}
