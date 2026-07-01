import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== بدء فحص الطلبات المسلمة وفروقات الأرباح ===");

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["delivered", "archived"] },
    },
    include: {
      moneyEvents: {
        where: { deletedAt: null },
      },
    },
  });

  let countNullCourierEarningId = 0;

  for (const o of orders) {
    const deliveryEv = o.moneyEvents.find(e => e.kind === "delivery");
    const earningOwner = o.courierEarningForCourierId ?? deliveryEv?.courierId ?? o.assignedCourierId ?? null;
    
    // إذا كان الحقل في قاعدة البيانات null ولكن يمكن حسابه ديناميكياً
    if (!o.courierEarningForCourierId && earningOwner) {
      countNullCourierEarningId++;
      console.log(`طلب رقم ${o.orderNumber} (ID: ${o.id}):`);
      console.log(`  - الحالة: ${o.status}`);
      console.log(`  - المندوب المسند: ${o.assignedCourierId}`);
      console.log(`  - مندوب حركة الوارد: ${deliveryEv?.courierId}`);
      console.log(`  - courierEarningForCourierId في القاعدة: null`);
      console.log(`  - المالك المحتسب ديناميكياً: ${earningOwner}`);
      console.log(`  - courierEarningDinar في القاعدة: ${o.courierEarningDinar}`);
      console.log(`  -----------------------------`);
    }
  }

  console.log(`\nإجمالي الطلبات المسلمة/المؤرشفة التي تحتوي على courierEarningForCourierId فارغ: ${countNullCourierEarningId}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
