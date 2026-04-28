import { Client } from "pg";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

async function main() {
  const client = new Client({ connectionString: OLD_DB_URL });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'Customer';
    `);
    console.log("COLUMNS:", JSON.stringify(res.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch(console.error);
