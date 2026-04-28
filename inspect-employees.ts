import { Client } from "pg";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

async function main() {
  const client = new Client({ connectionString: OLD_DB_URL });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'Employee';
    `);
    console.log("EMPLOYEE_COLUMNS:", JSON.stringify(res.rows, null, 2));

    const sample = await client.query(`SELECT * FROM "Employee" LIMIT 1`);
    console.log("SAMPLE_EMPLOYEE:", JSON.stringify(sample.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch(console.error);
