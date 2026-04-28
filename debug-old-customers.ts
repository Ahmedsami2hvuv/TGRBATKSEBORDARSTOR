import { Client } from "pg";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

async function main() {
  const client = new Client({ connectionString: OLD_DB_URL });
  await client.connect();
  try {
    const res = await client.query(`SELECT count(*) FROM "CustomerPhoneProfile"`);
    console.log("OLD_DB_CUSTOMER_COUNT:", res.rows[0].count);

    const sample = await client.query(`SELECT * FROM "CustomerPhoneProfile" LIMIT 5`);
    console.log("SAMPLE_DATA:", JSON.stringify(sample.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch(console.error);
