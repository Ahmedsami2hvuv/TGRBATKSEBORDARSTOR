import { prisma } from "../src/lib/prisma";
import { getOrderCardsDesignerConfig } from "../src/lib/order-card-customizer";
import {
  getCachedCompanyPreparers,
  getCachedMandoubWaButtonSettings,
  getCachedActiveCouriers,
  getCachedStoreProducts,
} from "../src/lib/server-reference-cache";

async function main() {
  console.log("Testing order fetch...");
  const firstOrder = await prisma.order.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, orderNumber: true },
  });

  if (!firstOrder) {
    console.log("No orders found in DB");
    return;
  }

  console.log("Testing with order id:", firstOrder.id, "number:", firstOrder.orderNumber);

  const order = await prisma.order.findUnique({
    where: { id: firstOrder.id },
    include: {
      submittedBy: { select: { name: true, phone: true } },
      submittedByCompanyPreparer: { select: { name: true, phone: true } },
      shop: { select: { id: true, name: true, phone: true, ownerName: true, photoUrl: true, locationUrl: true, region: { select: { name: true } } } },
      customerRegion: { select: { name: true } },
      secondCustomerRegion: { select: { name: true } },
      courier: { select: { name: true, phone: true } },
      customer: { select: { name: true, customerDoorPhotoUrl: true } },
    },
  });

  console.log("Order found:", !!order);

  const [
    preparers,
    waButtonSettings,
    storeProducts,
    couriersRaw,
    designerConfig,
  ] = await Promise.all([
    getCachedCompanyPreparers(),
    getCachedMandoubWaButtonSettings(),
    getCachedStoreProducts(),
    getCachedActiveCouriers(),
    getOrderCardsDesignerConfig().catch(() => null),
  ]);

  console.log("All data loaded successfully!");
  console.log("designerConfig exists:", !!designerConfig);
}

main()
  .catch((e) => {
    console.error("Diagnostic error caught:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
