import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function test() {
  try {
    const courier = await prisma.courier.findFirst();
    if (!courier) return;
    console.log('Testing reset for:', courier.id);
    const resetAt = courier.mandoubTotalsResetAt;
    const periodStartAt = resetAt ?? courier.createdAt;
    const periodEndAt = new Date();
    await prisma.$transaction(async (tx: any) => {
      await tx.courierProfitHistory.create({
        data: {
          courierId: courier.id,
          periodStartAt,
          periodEndAt,
          totalOrders: 0,
          totalProfitDinar: 0,
        },
      });
    });
    console.log('Success!');
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
