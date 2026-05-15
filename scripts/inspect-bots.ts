import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Telegram Bots ---');
  const bots = await prisma.telegramBot.findMany();
  bots.forEach(bot => {
    const tokenPreview = bot.token ? `${bot.token.substring(0, 5)}...${bot.token.substring(bot.token.length - 5)}` : 'null';
    console.log(`ID: ${bot.id}, Name: ${bot.name}, Purpose: ${bot.purpose}, Active: ${bot.active}, Token: ${tokenPreview}`);
    if (bot.token && !/^\d+:[\w-]+$/.test(bot.token)) {
      console.warn(`  ⚠️ INVALID TOKEN FORMAT: ${bot.token}`);
    }
  });

  console.log('\n--- Telegram Admins ---');
  const admins = await prisma.telegramAdmin.findMany();
  admins.forEach(admin => {
    console.log(`ID: ${admin.id}, Name: ${admin.name}, TelegramUserID: ${admin.telegramUserId}, Active: ${admin.active}`);
  });

  console.log('\n--- Environment Variables ---');
  console.log(`TELEGRAM_WEBHOOK_SECRET: ${process.env.TELEGRAM_WEBHOOK_SECRET ? 'SET' : 'NOT SET'}`);
  console.log(`TELEGRAM_ADMIN_USER_IDS: ${process.env.TELEGRAM_ADMIN_USER_IDS || 'NOT SET'}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
