import { prisma } from "./prisma";

/**
 * جلب توكن بوت معين بناءً على الغرض منه.
 * إذا لم يوجد بوت مخصص في قاعدة البيانات، يمكن العودة للتوكن الافتراضي من .env
 */
export async function getBotTokenByPurpose(purpose: string): Promise<string | undefined> {
  const normalizedPurpose = purpose.trim().toLowerCase();
  const bot = await prisma.telegramBot.findFirst({
    where: { purpose: normalizedPurpose, active: true },
    select: { token: true }
  });
  if (bot?.token?.trim()) {
    console.log(`[telegram-bots] Using DB token for bot purpose=${normalizedPurpose}`);
    return bot.token.trim();
  }

  const envKey = `TELEGRAM_${normalizedPurpose.toUpperCase()}_BOT_TOKEN`;
  const envToken = process.env[envKey]?.trim();
  if (envToken) {
    console.log(`[telegram-bots] Using ENV token ${envKey} for bot purpose=${normalizedPurpose}`);
    return envToken;
  }

  const baseToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (baseToken) {
    console.log(`[telegram-bots] Using fallback TELEGRAM_BOT_TOKEN for bot purpose=${normalizedPurpose}`);
  } else {
    console.warn(`[telegram-bots] No bot token found for purpose=${normalizedPurpose}`);
  }
  return baseToken || undefined;
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
    const result = await ensureTelegramWebhookConfigured(bot.token, bot.id, force, baseUrl).catch(err => {
      console.error(`Failed to ensure webhook for bot ${bot.name}:`, err);
      return { ok: false, url: "", description: err.message };
    });

    if (result.ok) {
      console.log(`Successfully configured webhook for ${bot.name}: ${result.url} (${result.description || "OK"})`);
    } else {
      console.error(`Failed to configure webhook for ${bot.name}: ${result.description}`);
    }
  }
}
