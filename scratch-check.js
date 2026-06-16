const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const couriers = await prisma.courier.findMany();
  for (const c of couriers) {
    if (!c.mandoubTotalsResetAt) continue;
    
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { assignedCourierId: c.id },
          { courierEarningForCourierId: c.id }
        ]
      },
      include: {
        moneyEvents: true
      }
    });

    let sum = 0;
    let countedOrders = [];
    
    for (const o of orders) {
      if (o.status !== 'delivered') continue;
      
      const dev = o.moneyEvents.find(e => e.kind === 'delivery_in' && !e.deletedAt);
      let skip = false;
      
      if (dev) {
        skip = dev.createdAt <= c.mandoubTotalsResetAt;
      } else {
        const oldTh = new Date(c.mandoubTotalsResetAt.getTime() - 2 * 24 * 3600 * 1000);
        if (o.createdAt <= oldTh) skip = true;
        else skip = o.updatedAt <= c.mandoubTotalsResetAt;
      }
      
      if (!skip) {
        countedOrders.push({
          id: o.orderNumber,
          earn: Number(o.courierEarningDinar || 0),
          created: o.createdAt,
          updated: o.updatedAt,
          hasDev: !!dev
        });
        sum += Number(o.courierEarningDinar || 0);
      }
    }
    
    if (sum > 0) {
      console.log('Courier:', c.name, '| Baseline:', c.mandoubTotalsResetAt);
      for (const co of countedOrders) {
         console.log(`  -> Order: #${co.id} | Earn: ${co.earn} | Created: ${co.created.toISOString()} | Updated: ${co.updated.toISOString()} | HasDev: ${co.hasDev}`);
      }
      console.log('  Total Earn:', sum);
      console.log('-----------------------------------');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
