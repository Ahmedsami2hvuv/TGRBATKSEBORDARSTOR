import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const globalSettings = await prisma.globalSettings.findUnique({
    where: { id: "system" }
  });
  console.log("=== GLOBAL SETTINGS ===");
  console.log(JSON.stringify(globalSettings, null, 2));

  const categories = await prisma.storeCategory.findMany({
    take: 5,
    select: { id: true, name: true, profitMargin: true }
  });
  console.log("=== CATEGORIES ===");
  console.log(JSON.stringify(categories, null, 2));

  const branches = await prisma.storeBranch.findMany({
    take: 5,
    select: { id: true, name: true, profitMargin: true, categoryId: true }
  });
  console.log("=== BRANCHES ===");
  console.log(JSON.stringify(branches, null, 2));

  const products = await prisma.storeProduct.findMany({
    take: 5,
    select: { id: true, name: true, purchasePrice: true, salePrice: true, branchId: true }
  });
  console.log("=== PRODUCTS ===");
  console.log(JSON.stringify(products, null, 2));
}

main().catch(console.error);
