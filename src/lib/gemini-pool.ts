import { prisma } from "./prisma";

export type GeminiKeyRecord = {
  id: string;
  key: string;
  label?: string | null;
};

/**
 * جلب مفتاح Gemini شغال ومتاح مع تدوير المفاتيح
 */
export async function getNextActiveGeminiKey(): Promise<GeminiKeyRecord | null> {
  try {
    // 1. البحث أولاً في جدول GeminiApiKey الجديد
    const dbKey = await prisma.geminiApiKey.findFirst({
      where: {
        active: true,
        errorCount: { lt: 10 },
      },
      orderBy: [
        { lastUsedAt: "asc" },
        { createdAt: "asc" },
      ],
    });

    if (dbKey?.key?.trim()) {
      await prisma.geminiApiKey.update({
        where: { id: dbKey.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});

      return { id: dbKey.id, key: dbKey.key.trim(), label: dbKey.label };
    }
  } catch (err) {
    console.error("[gemini-pool] Error fetching GeminiApiKey:", err);
  }

  try {
    // 2. البحث ثانياً في جدول AIConfig المربوط بصفحة إعدادات الذكاء الاصطناعي الحالي بالموقع
    const aiConfig = await prisma.aIConfig.findFirst({
      where: {
        isActive: true,
        OR: [
          { provider: { contains: "gemini", mode: "insensitive" } },
          { provider: { contains: "google", mode: "insensitive" } },
          { apiKey: { startsWith: "AIzaSy" } },
        ]
      },
      orderBy: { updatedAt: "desc" }
    });

    if (aiConfig?.apiKey?.trim()) {
      return { id: `aiconfig_${aiConfig.id}`, key: aiConfig.apiKey.trim(), label: aiConfig.label || "Gemini (AIConfig)" };
    }
  } catch (err) {
    console.error("[gemini-pool] Error fetching AIConfig:", err);
  }

  // 3. التراجع للمفتاح الموجود في البيئة .env
  const envKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (envKey) {
    return { id: "env", key: envKey, label: "مفتاح النظام (.env)" };
  }

  return null;
}

/**
 * الابلاغ عن نجاح استخدام المفتاح
 */
export async function markGeminiKeySuccess(keyId: string): Promise<void> {
  if (keyId.startsWith("env") || keyId.startsWith("aiconfig_")) return;
  try {
    await prisma.geminiApiKey.update({
      where: { id: keyId },
      data: { errorCount: 0, lastUsedAt: new Date() },
    });
  } catch (e) {}
}

/**
 * الإبلاغ عن خطأ نفاد الحد المسموح
 */
export async function markGeminiKeyError(keyId: string, isQuotaError: boolean = false): Promise<void> {
  if (keyId.startsWith("env") || keyId.startsWith("aiconfig_")) return;
  try {
    await prisma.geminiApiKey.update({
      where: { id: keyId },
      data: { errorCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  } catch (e) {}
}
