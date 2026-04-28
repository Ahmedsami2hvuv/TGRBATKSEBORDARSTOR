const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway',
  connectionTimeoutMillis: 30000
});

async function test() {
  try {
    await client.connect();
    const res = await client.query('SELECT phone, "regionId", "photoUrl" FROM "CustomerPhoneProfile" WHERE "photoUrl" IS NOT NULL AND "photoUrl" != \'\' AND "photoUrl" != \'not_found\' ORDER BY "createdAt" ASC LIMIT 5 OFFSET 0');
    console.log('Rows fetched:', res.rows.length);
    console.log('Sample lengths:', res.rows.map(r => r.photoUrl.length));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

test();
