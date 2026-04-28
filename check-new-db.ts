import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.customerPhoneProfile.count();
  console.log("CURRENT_CUSTOMER_COUNT:", count);

  const regions = await prisma.region.findMany();
  console.log("REGIONS_COUNT:", regions.length);

  const samples = await prisma.customerPhoneProfile.findMany({ take: 5 });
  console.log("SAMPLES:", JSON.stringify(samples, null, 2));
}

main().catch(console.error);
