require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  console.log("Cleaning old store data...");
  
  // 1. Delete old items
  await supabase.from('StoreProductVariant').delete().neq('id', '0');
  await supabase.from('StoreProduct').delete().neq('id', '0');
  await supabase.from('StoreBranch').delete().neq('id', '0');
  await supabase.from('StoreCategory').delete().neq('id', '0');

  console.log("Old data cleaned.");

  // Structure definition
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
    const id = "cat_" + Math.random().toString(36).substring(2, 9);
    console.log(`Creating Category: ${catData.name}`);
    const { data: catRes, error: catErr } = await supabase.from('StoreCategory').insert({
      id: id,
      name: catData.name,
      sequence: catData.sequence,
      photoUrl: catData.photoUrl,
      active: true,
      updatedAt: new Date().toISOString()
    }).select().single();

    if (catErr) {
      console.error(`Error inserting category ${catData.name}:`, catErr);
      continue;
    }

    for (const bData of catData.branches) {
      const bId = "br_" + Math.random().toString(36).substring(2, 9);
      console.log(`  Creating Branch: ${bData.name}`);
      const { data: bRes, error: bErr } = await supabase.from('StoreBranch').insert({
        id: bId,
        name: bData.name,
        sequence: bData.sequence,
        photoUrl: bData.photoUrl,
        categoryId: catRes.id,
        active: true,
        updatedAt: new Date().toISOString()
      }).select().single();

      if (bErr) {
        console.error(`Error inserting branch ${bData.name}:`, bErr);
        continue;
      }

      for (const pData of bData.products) {
        const pId = "prod_" + Math.random().toString(36).substring(2, 9);
        console.log(`    Creating Product: ${pData.name} - Price: ${pData.salePrice}`);
        const { error: pErr } = await supabase.from('StoreProduct').insert({
          id: pId,
          name: pData.name,
          salePrice: pData.salePrice,
          purchasePrice: pData.purchasePrice,
          photoUrls: pData.photoUrls,
          sequence: pData.sequence,
          branchId: bRes.id,
          active: true,
          updatedAt: new Date().toISOString()
        });

        if (pErr) {
          console.error(`Error inserting product ${pData.name}:`, pErr);
        }
      }
    }
  }

  console.log("✅ Store database successfully populated with new products!");
}

main().catch(console.error);
