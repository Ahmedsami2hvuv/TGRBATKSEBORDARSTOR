const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const regions = await prisma.region.findMany({
    where: {
      name: { contains: "ساح" }
    }
  });
  console.log("Found regions with 'ساح':", regions.map(r => r.name));
}

main().catch(console.error).finally(() => prisma.$disconnect());
