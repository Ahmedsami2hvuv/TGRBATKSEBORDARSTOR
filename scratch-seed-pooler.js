process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();
const { Client } = require('pg');

const connStr = "postgresql://postgres.trfjlxxeldnegjgdqefm:%40Ahmedfget43ft43fr3v43r3r32rv4@db.trfjlxxeldnegjgdqefm.supabase.co:6543/postgres?sslmode=require";

async function main() {
  console.log("Connecting via PG pooler with user postgres.trfjlxxeldnegjgdqefm...");
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
  });

  await client.connect();
  console.log("✅ Connected successfully to Database via Supabase Pooler!");

  // Clean
  console.log("Deleting old products, branches, categories...");
  await client.query(`DELETE FROM "StoreProductVariant"`);
  await client.query(`DELETE FROM "StoreProduct"`);
  await client.query(`DELETE FROM "StoreBranch"`);
  await client.query(`DELETE FROM "StoreCategory"`);
  console.log("Cleared old data!");

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

  for (const c of categoriesData) {
    const cId = "cat_" + Math.random().toString(36).substring(2, 10);
    console.log(`Inserting category: ${c.name}`);
    await client.query(
      `INSERT INTO "StoreCategory" (id, name, sequence, "photoUrl", active, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
      [cId, c.name, c.sequence, c.photoUrl]
    );

    for (const b of c.branches) {
      const bId = "br_" + Math.random().toString(36).substring(2, 10);
      console.log(`  Inserting branch: ${b.name}`);
      await client.query(
        `INSERT INTO "StoreBranch" (id, name, sequence, "photoUrl", "categoryId", active, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
        [bId, b.name, b.sequence, b.photoUrl, cId]
      );

      for (const p of b.products) {
        const pId = "prod_" + Math.random().toString(36).substring(2, 10);
        console.log(`    Inserting product: ${p.name}`);
        await client.query(
          `INSERT INTO "StoreProduct" (id, name, "salePrice", "purchasePrice", "photoUrls", sequence, "branchId", active, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())`,
          [pId, p.name, p.salePrice, p.purchasePrice, p.photoUrls, p.sequence, bId]
        );
      }
    }
  }

  console.log("🎉 SUCCESS! Store rebuilt perfectly via Pooler.");
  await client.end();
}

main().catch(err => {
  console.error("PG Pooler Error:", err);
});
