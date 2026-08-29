import { prisma } from "../lib/prisma";

async function main() {
  const couriers = await prisma.courier.findMany();
  const mithaqCourier = couriers.find(c => c.name.includes("ميثاق"));

  if (mithaqCourier) {
    console.log("Found mithaq courier ID:", mithaqCourier.id);
    
    // التحديث الفوري لجميع سجلات ميثاق بدفتر الديون لربطها بالمندوب ميثاق الأصلي
    const updated = await prisma.creditBookPartner.updateMany({
      where: { name: { contains: "ميثاق" } },
      data: {
        type: "courier",
        externalId: mithaqCourier.id,
        phone: mithaqCourier.phone
      }
    });

    console.log("Updated credit book partners count:", updated.count);
  } else {
    console.log("No courier found with name mithaq");
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
