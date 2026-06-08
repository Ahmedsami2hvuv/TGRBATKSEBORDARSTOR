import { Client } from 'pg';

const regions = [
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'sa-east-1',
  'ca-central-1'
];

async function probe() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    // We use port 5432 or 6543
    const connectionString = `postgresql://postgres.trfjlxxeldnegjgdqefm:%40Ahmedfget43ft43fr3v43r3r32rv4@${host}:5432/postgres`;
    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`✅ SUCCESS connection to region: ${region}`);
      await client.end();
      return;
    } catch (err: any) {
      console.log(`❌ Failed for region ${region}:`, err.message);
    }
  }
}

probe();
