import { prisma } from "../lib/prisma";

async function main() {
  console.log("Starting Mithaq clean up...");

  // 1. البحث عن المورد/المجهز ميثاق في CompanyPreparer
  const preparers = await prisma.companyPreparer.findMany();
  const mithaqPrep = preparers.find(p => p.name.includes("ميثاق"));

  // 2. البحث عن المندوب ميثاق في Courier
  const couriers = await prisma.courier.findMany();
  const mithaqCourier = couriers.find(c => c.name.includes("ميثاق"));

  console.log("Mithaq Preparer:", mithaqPrep);
  console.log("Mithaq Courier:", mithaqCourier);

  // 3. فحص وحذف أي سجل مكرر بـ CreditBookPartner يحتوي على اسم ميثاق
  const partners = await prisma.creditBookPartner.findMany({
    where: { name: { contains: "ميثاق" } }
  });

  console.log("Found partners with Mithaq name:", partners.length);

  for (const p of partners) {
    // حذف جميع المعاملات المرتبطة بالسجلات المكررة
    await prisma.creditBookTransaction.deleteMany({
      where: { partnerId: p.id }
    });
    // حذف الشريك المكرر
    await prisma.creditBookPartner.delete({
      where: { id: p.id }
    });
    console.log(`Deleted duplicated partner ID: ${p.id} - ${p.name}`);
  }

  // 4. إنشاء وتأكيد السجل الرئيسي الوحيد الموحد لـ المورد ميثاق بـ CreditBookPartner
  if (mithaqPrep) {
    const cleanPartner = await prisma.creditBookPartner.create({
      data: {
        name: mithaqPrep.name,
        type: "preparer",
        externalId: mithaqPrep.id,
        phone: mithaqPrep.phone
      }
    });
    console.log("Created Unified Clean Partner for Mithaq Supplier:", cleanPartner);
  }

  console.log("Cleanup completed successfully!");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
