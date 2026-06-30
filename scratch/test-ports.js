const { Client } = require('pg');

async function testConnection(host, port) {
  const password = encodeURIComponent("@Ahmedfget43ft43fr3v43r3r32rv4");
  const connectionString = `postgresql://postgres.trfjlxxeldnegjgdqefm:${password}@${host}:${port}/postgres`;
  
  console.log(`Testing: ${host}:${port}...`);
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`✅ SUCCESS connecting to ${host}:${port}`);
    await client.end();
    return true;
  } catch (err) {
    console.error(`❌ FAILED connecting to ${host}:${port}:`, err.message);
    return false;
  }
}

async function run() {
  const hosts = [
    'aws-0-eu-west-1.pooler.supabase.com',
    'db.trfjlxxeldnegjgdqefm.supabase.co'
  ];
  const ports = [5432, 6543];

  for (const host of hosts) {
    for (const port of ports) {
      await testConnection(host, port);
    }
  }
}

run();
