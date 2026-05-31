import { Client } from 'pg';

async function testCredentials(password: string, label: string) {
  const host = "db.trfjlxxeldnegjgdqefm.supabase.co";
  console.log(`Testing password: "${password}" (${label})...`);
  
  const client = new Client({
    user: 'postgres',
    password: password,
    host: host,
    port: 5432,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`✅ SUCCESS connecting with password: "${password}" (${label})`);
    const res = await client.query('SELECT tablename FROM pg_tables WHERE schemaname = \'public\' LIMIT 1');
    console.log('Test query success! Table:', res.rows[0]?.tablename);
    return true;
  } catch (err: any) {
    console.error(`❌ Failed with password "${password}":`, err.message || err);
    return false;
  } finally {
    await client.end();
  }
}

async function run() {
  const passwordsToTest = [
    // If "%40" in .env was a URL-encoded "@"
    "@Ahmedfget43ft43fr3v43r3r32rv4",
    // If the password literally is "%40Ahmedfget43ft43fr3v43r3r32rv4"
    "%40Ahmedfget43ft43fr3v43r3r32rv4",
    // If the password is just "Ahmedfget43ft43fr3v43r3r32rv4" without "@" or "%40"
    "Ahmedfget43ft43fr3v43r3r32rv4",
    // In case there is any leading/trailing spaces or other minor things
    " Ahmedfget43ft43fr3v43r3r32rv4",
    "@Ahmedfget43ft43fr3v43r3r32rv4 "
  ];

  for (const pw of passwordsToTest) {
    const success = await testCredentials(pw, "literal");
    if (success) {
      console.log(`Found working password! ${pw}`);
      break;
    }
  }
}

run();
