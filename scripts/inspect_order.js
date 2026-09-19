require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { orderNumber: 2585 },
        { id: "cmu8fqs3v0000kw04rd9s5hjt" },
        { id: "cmu81sdms0003jk04f2virq08" },
      ],
    },
    include: {
      submittedBy: { select: { name: true, phone: true } },
      submittedByCompanyPreparer: { select: { name: true, phone: true } },
      shop: { select: { id: true, name: true, phone: true, ownerName: true, photoUrl: true, locationUrl: true, region: { select: { name: true } } } },
      customerRegion: { select: { name: true } },
      secondCustomerRegion: { select: { name: true } },
      courier: { select: { name: true, phone: true } },
      customer: { select: { name: true, customerDoorPhotoUrl: true } },
      moneyEvents: true,
    },
  });

  if (!order) {
    console.log("Order not found");
    return;
  }

  console.log("Order details:", JSON.stringify({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerPhone: order.customerPhone,
    customerLocationUrl: order.customerLocationUrl,
    customerLandmark: order.customerLandmark,
    customerDoorPhotoUrl: order.customerDoorPhotoUrl,
    shopPhotoUrl: order.shop?.photoUrl,
    shopLocationUrl: order.shop?.locationUrl,
    moneyEventsCount: order.moneyEvents.length,
    orderSubtotal: order.orderSubtotal,
    deliveryPrice: order.deliveryPrice,
    totalAmount: order.totalAmount,
    orderType: order.orderType,
    summary: order.summary,
  }, null, 2));
}

main().catch(console.error).finally(() => {
  prisma.$disconnect();
  process.exit(0);
});
