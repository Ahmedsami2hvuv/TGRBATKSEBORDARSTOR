require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// تجربة استخدام الاتصال المباشر عبر البولر أو المباشر
const dbUrl = "postgresql://postgres:%40Ahmedfget43ft43fr3v43r3r32rv4@db.trfjlxxeldnegjgdqefm.supabase.co:5432/postgres";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});

async function main() {
  console.log("Cleaning old store items via Prisma...");

  await prisma.storeProductVariant.deleteMany();
  await prisma.storeProduct.deleteMany();
  await prisma.storeBranch.deleteMany();
  await prisma.storeCategory.deleteMany();

  console.log("Old data deleted successfully.");

  const categoriesData = [
    {
      name: "قسم لحم بعجين",
      sequence: 10,
      photoUrl: "/products/lahm_large_normal.jpg",
      branches: [
        {
          name: "لحم بعجين صغير",
          sequence: 10,
          photoUrl: "/products/lahm_small_normal.jpg",
          products: [
            { name: "لحم بعجين صغير عادي", salePrice: 2000, purchasePrice: 2000, photoUrls: ["/products/lahm_small_normal.jpg"], sequence: 10 },
            { name: "لحم بعجين صغير بالجبنه", salePrice: 2500, purchasePrice: 2500, photoUrls: ["/products/lahm_small_cheese.jpg"], sequence: 9 },
            { name: "لحم بعجين صغير بالبيض", salePrice: 2500, purchasePrice: 2500, photoUrls: ["/products/lahm_small_egg.jpg"], sequence: 8 },
            { name: "لحم بعجين صغير بالزعتر", salePrice: 2500, purchasePrice: 2500, photoUrls: ["/products/lahm_small_zaatar.jpg"], sequence: 7 }
          ]
        },
        {
          name: "لحم بعجين كبير",
          sequence: 9,
          photoUrl: "/products/lahm_large_normal.jpg",
          products: [
            { name: "لحم بعجين كبير عادي", salePrice: 4000, purchasePrice: 4000, photoUrls: ["/products/lahm_large_normal.jpg"], sequence: 10 },
            { name: "لحم بعجين كبير بالجبنه", salePrice: 4500, purchasePrice: 4500, photoUrls: ["/products/lahm_small_cheese.jpg"], sequence: 9 },
            { name: "لحم بعجين كبير بالبيض", salePrice: 4500, purchasePrice: 4500, photoUrls: ["/products/lahm_small_egg.jpg"], sequence: 8 },
            { name: "لحم بعجين كبير بالزعتر", salePrice: 4500, purchasePrice: 4500, photoUrls: ["/products/lahm_small_zaatar.jpg"], sequence: 7 }
          ]
        }
      ]
    },
    {
      name: "قسم الكرسبي والمقبلات",
      sequence: 9,
      photoUrl: "/products/crispy_5pcs.jpg",
      branches: [
        {
          name: "الكرسبي والفنكر",
          sequence: 10,
          photoUrl: "/products/crispy_3pcs.jpg",
          products: [
            { name: "فنكر", salePrice: 1000, purchasePrice: 1000, photoUrls: ["/products/french_fries.jpg"], sequence: 10 },
            { name: "كرسبي ثلاث قطع", salePrice: 3000, purchasePrice: 3000, photoUrls: ["/products/crispy_3pcs.jpg"], sequence: 9 },
            { name: "كرسبي خمس قطع", salePrice: 5000, purchasePrice: 5000, photoUrls: ["/products/crispy_5pcs.jpg"], sequence: 8 }
          ]
        }
      ]
    },
    {
      name: "قسم البيتزا",
      sequence: 8,
      photoUrl: "/products/pizza_mixed.jpg",
      branches: [
        {
          name: "بيتزا كبير",
          sequence: 10,
          photoUrl: "/products/pizza_beef.jpg",
          products: [
            { name: "بيتزا لحم كبير", salePrice: 7000, purchasePrice: 7000, photoUrls: ["/products/pizza_beef.jpg"], sequence: 10 },
            { name: "بيتزا دجاج كبير", salePrice: 7000, purchasePrice: 7000, photoUrls: ["/products/pizza_chicken.jpg"], sequence: 9 },
            { name: "بيتزا خضار كبير", salePrice: 7000, purchasePrice: 7000, photoUrls: ["/products/pizza_veggie.jpg"], sequence: 8 },
            { name: "بيتزا مشكل كبير", salePrice: 7000, purchasePrice: 7000, photoUrls: ["/products/pizza_mixed.jpg"], sequence: 7 }
          ]
        },
        {
          name: "بيتزا صغير",
          sequence: 9,
          photoUrl: "/products/pizza_chicken.jpg",
          products: [
            { name: "بيتزا لحم صغير", salePrice: 4000, purchasePrice: 4000, photoUrls: ["/products/pizza_beef.jpg"], sequence: 10 },
            { name: "بيتزا دجاج صغير", salePrice: 4000, purchasePrice: 4000, photoUrls: ["/products/pizza_chicken.jpg"], sequence: 9 },
            { name: "بيتزا خضار صغير", salePrice: 4000, purchasePrice: 4000, photoUrls: ["/products/pizza_veggie.jpg"], sequence: 8 },
            { name: "بيتزا مشكل صغير", salePrice: 4000, purchasePrice: 4000, photoUrls: ["/products/pizza_mixed.jpg"], sequence: 7 }
          ]
        }
      ]
    },
    {
      name: "قسم الريزو",
      sequence: 7,
      photoUrl: "/products/rizo_spicy.jpg",
      branches: [
        {
          name: "الوجبات",
          sequence: 10,
          photoUrl: "/products/rizo_normal.jpg",
          products: [
            { name: "ريزو سبايسي كبير", salePrice: 6000, purchasePrice: 6000, photoUrls: ["/products/rizo_spicy.jpg"], sequence: 10 },
            { name: "ريزو سبايسي صغير", salePrice: 4000, purchasePrice: 4000, photoUrls: ["/products/rizo_spicy.jpg"], sequence: 9 },
            { name: "ريزو عادي كبير", salePrice: 5000, purchasePrice: 5000, photoUrls: ["/products/rizo_normal.jpg"], sequence: 8 },
            { name: "ريزو عادي صغير", salePrice: 3000, purchasePrice: 3000, photoUrls: ["/products/rizo_normal.jpg"], sequence: 7 }
          ]
        }
      ]
    },
    {
      name: "قسم المشروبات الغازية",
      sequence: 6,
      photoUrl: "/products/pepsi_can.jpg",
      branches: [
        {
          name: "المشروبات الغازية (قوطية)",
          sequence: 10,
          photoUrl: "/products/shani_can.jpg",
          products: [
            { name: "بيبسي (قوطية)", salePrice: 500, purchasePrice: 500, photoUrls: ["/products/pepsi_can.jpg"], sequence: 10 },
            { name: "شاني (قوطية)", salePrice: 500, purchasePrice: 500, photoUrls: ["/products/shani_can.jpg"], sequence: 9 },
            { name: "سفن (قوطية)", salePrice: 500, purchasePrice: 500, photoUrls: ["/products/seven_up_can.jpg"], sequence: 8 }
          ]
        }
      ]
    }
  ];

  for (const catData of categoriesData) {
    console.log(`Creating Category: ${catData.name}`);
    const category = await prisma.storeCategory.create({
      data: {
        name: catData.name,
        sequence: catData.sequence,
        photoUrl: catData.photoUrl,
        active: true,
      }
    });

    for (const branchData of catData.branches) {
      console.log(`  Creating Branch: ${branchData.name}`);
      const branch = await prisma.storeBranch.create({
        data: {
          name: branchData.name,
          sequence: branchData.sequence,
          photoUrl: branchData.photoUrl,
          categoryId: category.id,
          active: true,
        }
      });

      for (const prodData of branchData.products) {
        console.log(`    Creating Product: ${prodData.name}`);
        await prisma.storeProduct.create({
          data: {
            name: prodData.name,
            salePrice: prodData.salePrice,
            purchasePrice: prodData.purchasePrice,
            photoUrls: prodData.photoUrls,
            sequence: prodData.sequence,
            branchId: branch.id,
            active: true,
          }
        });
      }
    }
  }

  console.log("SUCCESS! All products inserted successfully.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
