process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const pass = "%40Ahmedfget43ft43fr3v43r3r32rv4";
const proj = "trfjlxxeldnegjgdqefm";

const hostsToTest = [
  { host: `aws-0-eu-central-1.pooler.supabase.com`, port: 6543, user: `postgres.${proj}` },
  { host: `aws-0-me-central-1.pooler.supabase.com`, port: 6543, user: `postgres.${proj}` },
  { host: `aws-0-us-east-1.pooler.supabase.com`, port: 6543, user: `postgres.${proj}` },
  { host: `db.${proj}.supabase.co`, port: 6543, user: `postgres.${proj}` },
  { host: `db.${proj}.supabase.co`, port: 5432, user: `postgres` },
];

async function testOne(target) {
  const connectionString = `postgresql://${target.user}:${pass}@${target.host}:${target.port}/postgres?sslmode=require`;
  console.log(`Testing ${target.host}:${target.port} with user ${target.user}...`);
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log(`✅ SUCCESS connecting to ${target.host}:${target.port}!`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`❌ Failed ${target.host}:${target.port}: ${err.message}`);
    return false;
  }
}

async function run() {
  for (const h of hostsToTest) {
    const ok = await testOne(h);
    if (ok) break;
  }
}

run();
