import { Client } from 'pg';

async function test(port: number, host: string) {
  const connectionString = `postgresql://postgres:%40Ahmedfget43ft43fr3v43r3r32rv4@${host}:${port}/postgres`;
  console.log(`Testing connection to ${host}:${port}...`);
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`✅ Success connecting to ${host}:${port}!`);
    const res = await client.query('SELECT tablename FROM pg_tables WHERE schemaname = \'public\' LIMIT 5');
    console.log('Tables found:', res.rows.map(r => r.tablename));
  } catch (err: any) {
    console.error(`❌ Failed connecting to ${host}:${port}:`, err.message || err);
  } finally {
    await client.end();
  }
}

async function run() {
  const host = "db.trfjlxxeldnegjgdqefm.supabase.co";
  // Test direct port 5432
  await test(5432, host);
  // Test pooler port 6543
  await test(6543, host);
  // Test Supabase IPv4 transaction pooler if available (aws-0-us-east-1.pooler.supabase.com or similar)
  // Let's resolve the host to see what IP we get
  const dns = require('dns').promises;
  try {
    const ips = await dns.resolve4(host);
    console.log(`Resolved IP addresses for ${host}:`, ips);
  } catch (e: any) {
    console.error("DNS Resolution failed:", e.message);
  }
}

run();
