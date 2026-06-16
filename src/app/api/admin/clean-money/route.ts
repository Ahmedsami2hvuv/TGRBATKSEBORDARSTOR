import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MONEY_KIND_DELIVERY } from "@/lib/mandoub-money-events";

export const dynamic = "force-dynamic";

export async function GET() {
  const allowedOrderNumbers = [439, 438, 436, 435, 434, 433, 432, 431, 430, 429, 426, 425, 424, 423, 422, 421, 420, 419];
  
  const couriers = await prisma.courier.findMany();
  let count = 0;
  
  for (const c of couriers) {
    if (!c.mandoubTotalsResetAt) continue;
    
    const events = await prisma.orderCourierMoneyEvent.findMany({
       where: {
         courierId: c.id,
         kind: MONEY_KIND_DELIVERY,
         deletedAt: null,
         createdAt: { gt: c.mandoubTotalsResetAt }
       },
       include: { order: true }
    });
    
    for (const ev of events) {
       const isTodayOrder = allowedOrderNumbers.includes(ev.order.orderNumber);
       
       if (!isTodayOrder) {
          await prisma.orderCourierMoneyEvent.update({
            where: { id: ev.id },
            data: { createdAt: ev.order.createdAt } // إرجاعها للماضي
          });
          count++;
       }
    }
  }
  
  return NextResponse.json({ message: "Done. Fixed " + count + " wrong events." });
}
