import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();
const MONEY_KIND_DELIVERY = "delivery_in";

async function main() {
  const couriers = await prisma.courier.findMany();
  let count = 0;
  
  for (const c of couriers) {
    if (!c.mandoubTotalsResetAt) continue;
    
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
      if (o.moneyEvents.length > 0) continue;
      
      const earning = o.courierEarningDinar ?? new Decimal(0);
      const expected = o.deliveryPrice ?? new Decimal(0);
      
      let evDate = o.createdAt;
      const oldTh = new Date(c.mandoubTotalsResetAt.getTime() - 2 * 24 * 3600 * 1000);
      
      // إصلاح الطلبات لليوم بناء على ربحها.
      if (Number(earning) === 2 && o.createdAt > oldTh) {
         evDate = o.updatedAt; 
      } else if (Number(earning) !== 2) {
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
  
  console.log(`Created delivery events for ${count} orders.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
