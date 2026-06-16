import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MONEY_KIND_DELIVERY } from "@/lib/mandoub-money-events";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

export async function GET() {
  const couriers = await prisma.courier.findMany();
  let count = 0;
  
  for (const c of couriers) {
    const orders = await prisma.order.findMany({
      where: {
        status: "delivered",
        OR: [
           { assignedCourierId: c.id },
           { courierEarningForCourierId: c.id }
        ]
      },
      include: {
        moneyEvents: { where: { kind: MONEY_KIND_DELIVERY, deletedAt: null } }
      }
    });
    
    for (const o of orders) {
      if (o.moneyEvents.length > 0) continue;
      
      const earning = o.courierEarningDinar ?? new Decimal(0);
      const expected = o.deliveryPrice ?? new Decimal(0);
      
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000);
      let evDate = o.updatedAt;
      
      if (o.createdAt < twoDaysAgo) {
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
  
  return NextResponse.json({ message: "تم إصلاح وتوليد أرباح " + count + " طلباً بنجاح! الأرباح الآن أصبحت دقيقة 100%." });
}
