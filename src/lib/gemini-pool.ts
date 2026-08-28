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
    // جلب أول مفتاح نشط ولم يمر عليه أكثر من 10 أخطاء متتالية
    const dbKey = await prisma.geminiApiKey.findFirst({
      where: {
        active: true,
        errorCount: { lt: 10 },
      },
      orderBy: [
        { lastUsedAt: "asc" }, // استخدام المفتاح الأقدم استخداماً للمساواة (Round-Robin)
        { createdAt: "asc" },
      ],
    });

    if (dbKey) {
      // تحديث وقت الاستخدام
      await prisma.geminiApiKey.update({
        where: { id: dbKey.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});

      return { id: dbKey.id, key: dbKey.key, label: dbKey.label };
    }
  } catch (err) {
    console.error("[gemini-pool] Error fetching key from DB:", err);
  }

  // التراجع للمفتاح الموجود في البيئة .env في حال عدم وجود مفاتيح في قاعدة البيانات
  const envKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (envKey) {
    return { id: "env", key: envKey, label: "مفتاح النظام (.env)" };
  }

  return null;
}

/**
 * الابلاغ عن نجاح استخدام المفتاح لإعادة صفر عدد الأخطاء
 */
export async function markGeminiKeySuccess(keyId: string): Promise<void> {
  if (keyId === "env") return;
  try {
    await prisma.geminiApiKey.update({
      where: { id: keyId },
      data: { errorCount: 0, lastUsedAt: new Date() },
    });
  } catch (e) {}
}

/**
 * الإبلاغ عن خطأ نفاد الحد المسموح (Rate limit / Quota) لتعطيله أو رفع عدد الأخطاء
 */
export async function markGeminiKeyError(keyId: string, isQuotaError: boolean = false): Promise<void> {
  if (keyId === "env") return;
  try {
    if (isQuotaError) {
      await prisma.geminiApiKey.update({
        where: { id: keyId },
        data: { errorCount: { increment: 1 }, lastUsedAt: new Date() },
      });
    } else {
      await prisma.geminiApiKey.update({
        where: { id: keyId },
        data: { errorCount: { increment: 1 } },
      });
    }
  } catch (e) {}
}
