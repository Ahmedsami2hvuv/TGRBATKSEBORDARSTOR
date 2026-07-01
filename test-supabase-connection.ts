import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function test(connectionString: string | undefined, name: string) {
  if (!connectionString) {
    console.error(`❌ ${name} is not defined in .env`);
    return;
  }
  
  // Mask password for safety
  const maskedString = connectionString.replace(/:([^@]+)@/, ':****@');
  console.log(`Testing connection for ${name}: ${maskedString}...`);
  
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`✅ Success connecting using ${name}!`);
    const res = await client.query('SELECT tablename FROM pg_tables WHERE schemaname = \'public\' LIMIT 5');
    console.log('Tables found:', res.rows.map(r => r.tablename));
  } catch (err: any) {
    console.error(`❌ Failed connecting using ${name}:`, err.message || err);
  } finally {
    await client.end();
  }
}

async function run() {
  console.log("Starting DB connection tests...");
  
  // 1. Test local .env Supabase DATABASE_URL
  await test(process.env.DATABASE_URL, "DATABASE_URL (Local Env Supabase)");
  
  // 2. Test Vercel Production Supabase URL
  const vercelProdUrl = "postgresql://postgres:Ahmedsami2002316@db.trfjlxxeldnegjgdqefm.supabase.co:5432/postgres";
  await test(vercelProdUrl, "VERCEL_PRODUCTION_URL (Supabase)");
  
  // 3. Test Railway OLD_DB_URL
  await test(process.env.OLD_DB_URL, "OLD_DB_URL (Railway)");
}

run();

