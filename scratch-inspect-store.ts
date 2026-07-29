import { PrismaClient } from '@prisma/client';

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
    console.log(`Category: ${cat.name} (${cat.id})`);
    for (const b of cat.branches) {
      console.log(`  Branch: ${b.name} (${b.id}) - Products count: ${b.products.length}`);
    }
  }

  const allProducts = await prisma.storeProduct.count();
  console.log('Total products count:', allProducts);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
