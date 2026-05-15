import { prisma } from "./prisma";

/**
 * جلب توكن بوت معين بناءً على الغرض منه.
 * إذا لم يوجد بوت مخصص في قاعدة البيانات، يمكن العودة للتوكن الافتراضي من .env
 */
export async function getBotTokenByPurpose(purpose: string): Promise<string | undefined> {
  const bot = await prisma.telegramBot.findFirst({
    where: { purpose, active: true },
    select: { token: true }
  });
  return bot?.token;
}

/**
 * جلب جميع بيانات البوت النشط لغرض معين
 */
export async function getActiveBotByPurpose(purpose: string) {
  return await prisma.telegramBot.findFirst({
    where: { purpose, active: true }
  });
}

/**
 * التأكد من ضبط الـ Webhook لجميع البوتات النشطة في قاعدة البيانات.
 * مفيد للاستدعاء عند بدء التطبيق أو عند إضافة بوت جديد.
 */
export async function ensureAllBotsWebhooksConfigured(force: boolean = false, baseUrl?: string) {
  const { ensureTelegramWebhookConfigured } = await import("./telegram");
  const bots = await prisma.telegramBot.findMany({
    where: { active: true }
  });

  for (const bot of bots) {
    await ensureTelegramWebhookConfigured(bot.token, bot.id, force, baseUrl).catch(err => {
      console.error(`Failed to ensure webhook for bot ${bot.name}:`, err);
    });
  }
}
