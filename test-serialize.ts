import { PrismaClient } from '@prisma/client';
import { serializePrisma } from './src/lib/serialize-prisma';

async function main() {
  const prisma = new PrismaClient();
  const orders = await prisma.order.findMany({
    take: 2,
    include: { moneyEvents: true }
  });
  console.log("Fetched orders:", orders.length);
  try {
    const serialized = serializePrisma(orders);
    console.log("Serialized successfully!");
  } catch (err) {
    console.error("Serialization failed:", err);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
