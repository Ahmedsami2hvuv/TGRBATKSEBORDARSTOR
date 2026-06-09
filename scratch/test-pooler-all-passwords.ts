import { Client } from 'pg';

async function test(password: string, label: string) {
  const host = "aws-0-eu-west-1.pooler.supabase.com";
  // Format username as postgres.[project-ref]
  const user = "postgres.trfjlxxeldnegjgdqefm";
  console.log(`Testing password option: "${password}" (${label})...`);
  
  const client = new Client({
    user,
    password,
    host,
    port: 5432,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`✅ SUCCESS with password option: "${password}" (${label})`);
    const res = await client.query('SELECT 1');
    console.log('Result:', res.rows);
    await client.end();
    return true;
  } catch (err: any) {
    console.log(`❌ FAILED for "${password}":`, err.message);
    await client.end().catch(() => {});
    return false;
  }
}

async function run() {
  const options = [
    { pw: "@Ahmedfget43ft43fr3v43r3r32rv4", label: "starts with @" },
    { pw: "%40Ahmedfget43ft43fr3v43r3r32rv4", label: "starts with literal %40" },
    { pw: "Ahmedfget43ft43fr3v43r3r32rv4", label: "no prefix" },
    { pw: "postgres", label: "default postgres" }
  ];

  for (const opt of options) {
    const ok = await test(opt.pw, opt.label);
    if (ok) {
      console.log(`Found working password: ${opt.pw}`);
      break;
    }
  }
}

run();
