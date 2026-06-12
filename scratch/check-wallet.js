const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const preparers = await prisma.companyPreparer.findMany({
    include: {
      walletEmployee: true
    }
  });

  console.log("=== PREPARERS ===");
  for (const p of preparers) {
    console.log(`Preparer: ${p.name} (ID: ${p.id})`);
    console.log(`  walletEmployeeId: ${p.walletEmployeeId}`);
    if (p.walletEmployee) {
      console.log(`  Employee Name: ${p.walletEmployee.name}`);
      
      const miscEntries = await prisma.employeeWalletMiscEntry.findMany({
        where: { employeeId: p.walletEmployeeId },
        orderBy: { createdAt: "desc" }
      });
      console.log(`  Misc Entries Count: ${miscEntries.length}`);
      miscEntries.slice(0, 5).forEach(e => {
        console.log(`    - [${e.createdAt.toISOString()}] Direction: ${e.direction}, Amount: ${e.amountDinar}, Label: ${e.label}`);
      });
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
