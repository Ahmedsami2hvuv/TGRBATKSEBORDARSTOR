require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.storeCategory.findMany({
    include: {
      branches: {
        include: {
          products: true,
        },
      },
    },
  });

  console.log('Categories count:', categories.length);
  for (const cat of categories) {
    console.log(`Category: ${cat.name} (id: ${cat.id})`);
    for (const b of cat.branches) {
      console.log(`  Branch: ${b.name} (id: ${b.id}) - Products: ${b.products.length}`);
      for (const p of b.products) {
        console.log(`    Product: ${p.name} - Price: ${p.salePrice}`);
      }
    }
  }

  const count = await prisma.storeProduct.count();
  console.log('Total products count:', count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
