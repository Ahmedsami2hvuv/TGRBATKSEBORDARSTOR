import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const actualPrep = await prisma.companyPreparer.findFirst({
    where: { walletEmployeeId: { not: null } }
  });

  if (!actualPrep) {
    console.log("No preparer found");
    return;
  }

  console.log('Preparer:', actualPrep.name);
  console.log('walletEmployeeId:', actualPrep.walletEmployeeId);
  const lastW = actualPrep.lastSalaryWithdrawalAt || actualPrep.createdAt || new Date(0);
  console.log('lastWithdrawal:', lastW);
  
  const entries = await prisma.employeeWalletMiscEntry.findMany({
    where: {
      employeeId: actualPrep.walletEmployeeId!,
      createdAt: { gt: lastW },
      OR: [
        { label: { startsWith: "[راتب]" } },
        { label: { startsWith: "راتب" } },
        { label: { contains: "راتب" } }
      ],
      deletedAt: null
    }
  });
  
  console.log('Found partial withdrawal entries:', entries.length);
  for (const entry of entries) {
    console.log(`- amount: ${entry.amountDinar}, label: ${entry.label}, date: ${entry.createdAt}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
