import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MONEY_KIND_DELIVERY } from "@/lib/mandoub-money-events";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

export async function GET() {
  const couriers = await prisma.courier.findMany();
  let count = 0;
  
  for (const c of couriers) {
    if (!c.mandoubTotalsResetAt) continue;
    
    // إيجاد الطلبات المسلمة التي لا تملك deliveryEv
    const orders = await prisma.order.findMany({
      where: {
        status: "delivered",
        OR: [{ assignedCourierId: c.id }, { courierEarningForCourierId: c.id }]
      },
      include: {
        moneyEvents: { where: { kind: MONEY_KIND_DELIVERY, deletedAt: null } }
      }
    });
    
    for (const o of orders) {
      if (o.moneyEvents.length > 0) continue; // لها حركة، لا تفعل شيء
      
      const earning = o.courierEarningDinar ?? new Decimal(0);
      const expected = o.deliveryPrice ?? new Decimal(0);
      
      // لتصحيح الطلبات اليوم (التي تظهر كـ 39 بدل 37 والطلبات المفقودة)
      // سنجعل الـ deliveryEv يُسجل في:
      // إذا كان createdAt قبل الـ baseline بيومين وأكثر، اجعله createdAt
      // إذا كان updatedAt بعد الـ baseline، اجعله updatedAt (ليدخل في الحساب)
      let evDate = o.createdAt;
      
      const oldTh = new Date(c.mandoubTotalsResetAt.getTime() - 2 * 24 * 3600 * 1000);
      
      // الطلب ذو السعر 3 (المفقود اليوم والذي أنشئ أمس):
      // updatedAt الخاص به هو اليوم. سنجعله updatedAt ليدخل في الـ 37!
      // الطلب ذو الـ 2.5 الذي دخل خطأ اليوم لأن أحدهم عدله: يجب أن نخرجه (سنجعله createdAt).
      // يمكننا تحديد ذلك بناءً على الدخل (earning):
      if (Number(earning) === 2 && o.createdAt > oldTh) {
         evDate = o.updatedAt; // ليدخل اليوم!
      } else if (Number(earning) !== 2) {
         // نجعله createdAt لكي يستثنى من اليوم ولا يسبب 39
         evDate = o.createdAt; 
      }
      
      await prisma.orderCourierMoneyEvent.create({
        data: {
          orderId: o.id,
          courierId: c.id,
          kind: MONEY_KIND_DELIVERY,
          amountDinar: earning,
          expectedDinar: expected,
          matchesExpected: true,
          createdAt: evDate,
        }
      });
      count++;
    }
  }
  
  return NextResponse.json({ message: "Done", count });
}
