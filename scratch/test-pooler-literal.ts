import { Client } from 'pg';

async function run() {
  const host = "db.trfjlxxeldnegjgdqefm.supabase.co";
  const password = "%40Ahmedfget43ft43fr3v43r3r32rv4";
  const port = 6543;
  console.log(`Testing literal password: "${password}" on port ${port}...`);
  
  const client = new Client({
    user: 'postgres',
    password: password,
    host: host,
    port: port,
    database: 'postgres',
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`✅ SUCCESS connecting with password: "${password}" on port ${port}!`);
    const res = await client.query('SELECT tablename FROM pg_tables WHERE schemaname = \'public\' LIMIT 1');
    console.log('Test query success! Table:', res.rows[0]?.tablename);
  } catch (err: any) {
    console.error(`❌ Failed with password "${password}" on port ${port}:`, err.message || err);
  } finally {
    await client.end();
  }
}

run();
