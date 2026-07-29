require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
  const { data: categories, error: catErr } = await supabase.from('StoreCategory').select('*, branches:StoreBranch(*, products:StoreProduct(*))');
  if (catErr) {
    console.error('Error fetching categories:', catErr);
    return;
  }
  console.log('Categories count:', categories ? categories.length : 0);
  if (categories) {
    for (const cat of categories) {
      console.log(`Category: ${cat.name} (${cat.id})`);
      if (cat.branches) {
        for (const b of cat.branches) {
          console.log(`  Branch: ${b.name} (${b.id}) - Products: ${b.products ? b.products.length : 0}`);
          if (b.products) {
            for (const p of b.products) {
              console.log(`    Product: ${p.name} - Price: ${p.salePrice}`);
            }
          }
        }
      }
    }
  }

  const { count, error: prodErr } = await supabase.from('StoreProduct').select('*', { count: 'exact', head: true });
  console.log('Total products count:', count, 'Error:', prodErr);
}

main().catch(console.error);
