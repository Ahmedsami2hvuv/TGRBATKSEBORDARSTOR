const fs = require('fs');
const path = require('path');

const filesToRemove = [
  'public/products',
  'src/data/fallback-store-data.ts',
  'src/app/api/admin/seed-store',
  'scratch-call-seed-api.js',
  'scratch-copy-images.js',
  'scratch-inspect-store.ts',
  'scratch-inspect.js',
  'scratch-seed-direct-fix.js',
  'scratch-seed-direct.js',
  'scratch-seed-pooler.js',
  'scratch-seed-prisma.js',
  'scratch-seed-store.js',
  'scratch-test-pooler-hosts.js',
  'scratch-test-supabase.js'
];

for (const f of filesToRemove) {
  const fullPath = path.join(__dirname, f);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`Removed ${f}`);
  }
}
