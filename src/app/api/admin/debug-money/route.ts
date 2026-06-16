import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MONEY_KIND_DELIVERY } from "@/lib/mandoub-money-events";
import { computeMandoubTotalsForCourier } from "@/lib/mandoub-courier-totals";

export const dynamic = "force-dynamic";

export async function GET() {
  const couriers = await prisma.courier.findMany();
  let result = [];
  
  for (const c of couriers) {
    if (!c.mandoubTotalsResetAt) continue;
    const totals = await computeMandoubTotalsForCourier(c.id);
    if (Math.abs(Number(totals.deliveryEarningDinar) - 39.33) < 0.1 || Math.abs(Number(totals.deliveryEarningDinar) - 37.33) < 0.1) {
       // وجدنا المندوب!
       const orders = await prisma.order.findMany({
         where: {
            status: "delivered",
            OR: [ { assignedCourierId: c.id }, { courierEarningForCourierId: c.id } ]
         },
         include: { moneyEvents: { where: { kind: MONEY_KIND_DELIVERY, deletedAt: null } } }
       });
       
       const activeOrders = [];
       for (const o of orders) {
          let skipForBaseline = false;
          if (c.mandoubTotalsResetAt) {
            const deliveryEv = o.moneyEvents.length > 0 ? o.moneyEvents[0] : null;
            if (deliveryEv) {
              skipForBaseline = deliveryEv.createdAt <= c.mandoubTotalsResetAt;
            } else {
              skipForBaseline = o.createdAt <= c.mandoubTotalsResetAt;
            }
          }
          if (!skipForBaseline) {
            activeOrders.push({
               orderNumber: o.orderNumber,
               earning: o.courierEarningDinar,
               createdAt: o.createdAt,
               deliveryEvDate: o.moneyEvents[0]?.createdAt
            });
          }
       }
       result.push({ name: c.name, totals: totals.deliveryEarningDinar, orders: activeOrders });
    }
  }
  
  return NextResponse.json(result);
}
