const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

let dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.includes(':5432')) {
  // إذا كان 5432، قد يتطلب الاتصال عبر Pooler 6543 أو بالعكس حسب الإعداد
}

const prisma = new PrismaClient();

async function main() {
  const key = 'AIzaSyAX9j894_6VRZK5FT7QSVaBRHkOrNQ4FNg';
  await prisma.geminiApiKey.upsert({
    where: { key },
    create: { key, label: 'مفتاح جمناي الرئيسي', active: true },
    update: { active: true, errorCount: 0 }
  });
  console.log('ADDED_KEY_SUCCESSFULLY');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
