const { Client } = require('pg');

async function test(connectionString, label) {
  console.log(`Testing: ${label}`);
  const client = new Client({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    console.log(`✅ Success for ${label}`);
    const res = await client.query('SELECT now()');
    console.log('Time:', res.rows[0]);
  } catch (err) {
    console.error(`❌ Failed for ${label}:`, err.message);
  } finally {
    await client.end();
  }
}

async function run() {
  const railwayUrl = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";
  await test(railwayUrl, "Railway URL");
}

run();
