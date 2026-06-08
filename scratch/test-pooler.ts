import { Client } from 'pg';

async function test(connectionString: string, desc: string) {
  console.log(`Testing: ${desc}`);
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`✅ SUCCESS: ${desc}`);
    const res = await client.query('SELECT 1');
    console.log('Result:', res.rows);
    await client.end();
  } catch (err: any) {
    console.log(`❌ FAILED: ${desc} ->`, err.message);
  }
}

async function run() {
  const host = "aws-0-eu-west-1.pooler.supabase.com";
  
  // Test 1: literal password starting with %40 (encoded as %2540)
  await test(`postgresql://postgres.trfjlxxeldnegjgdqefm:%2540Ahmedfget43ft43fr3v43r3r32rv4@${host}:5432/postgres`, "Session port 5432, user postgres.trfjlxxeldnegjgdqefm, password literal %40");
  
  // Test 2: on port 6543
  await test(`postgresql://postgres.trfjlxxeldnegjgdqefm:%2540Ahmedfget43ft43fr3v43r3r32rv4@${host}:6543/postgres`, "Pooler port 6543, user postgres.trfjlxxeldnegjgdqefm, password literal %40");

  // Test 3: user postgres without suffix (maybe not needed but test anyway)
  await test(`postgresql://postgres:%40Ahmedfget43ft43fr3v43r3r32rv4@${host}:5432/postgres`, "Session port 5432, user postgres, password decoded");
}

run();
