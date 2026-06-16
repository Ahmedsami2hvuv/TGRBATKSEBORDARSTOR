const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { orderNumber: "desc" },
      take: 10,
      select: { orderNumber: true }
    });
    console.log("Latest order numbers:", orders);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
