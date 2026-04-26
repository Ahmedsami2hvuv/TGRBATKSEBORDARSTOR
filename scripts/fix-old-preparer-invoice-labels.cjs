const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const labelRegex = /فاتورة تجهيز طلب #(\d+)\s*\(مساهمتك\)/;

async function main() {
  const entries = await prisma.employeeWalletMiscEntry.findMany({
    where: {
      label: {
        contains: "(مساهمتك)",
      },
    },
  });

  console.log(`Found ${entries.length} entries with obsolete label text.`);

  let updatedCount = 0;
  for (const entry of entries) {
    const match = entry.label.match(labelRegex);
    if (!match) {
      console.warn(`Skipping entry ${entry.id}: unexpected label format: ${entry.label}`);
      continue;
    }

    const orderNumber = Number(match[1]);
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { customerRegion: true, shop: { include: { region: true } } },
    });

    if (!order) {
      console.warn(`Skipping entry ${entry.id}: order #${orderNumber} not found.`);
      continue;
    }

    const regionName = order.customerRegion?.name || order.shop?.region?.name || "المنطقة";
    const updatedLabel = `فاتورة تجهيز طلب #${orderNumber} (${regionName})`;

    if (entry.label === updatedLabel) {
      continue;
    }

    await prisma.employeeWalletMiscEntry.update({
      where: { id: entry.id },
      data: { label: updatedLabel },
    });

    updatedCount += 1;
    console.log(`Updated ${entry.id}: ${entry.label} -> ${updatedLabel}`);
  }

  console.log(`Finished. ${updatedCount} labels updated.`);
}

main()
  .catch((error) => {
    console.error("Error updating old preparer invoice labels:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
