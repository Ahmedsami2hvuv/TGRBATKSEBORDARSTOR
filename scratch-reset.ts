import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  const courier = await prisma.courier.findFirst({ select: { id: true, mandoubWalletCarryOverDinar: true } });
  console.log(courier);
}
run();
