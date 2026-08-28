import { prisma } from "./prisma";

export type GeminiKeyRecord = {
  id: string;
  key: string;
  label?: string | null;
};

/**
 * جلب جميع مفاتيح Gemini المتاحة من قاعدة البيانات من الجداول المختلفة
 */
export async function getAllActiveGeminiKeys(): Promise<GeminiKeyRecord[]> {
  const keysList: GeminiKeyRecord[] = [];

  // 1. مفاتيح من جدول GeminiApiKey
  try {
    const dbKeys = await prisma.geminiApiKey.findMany({
      where: { active: true },
      orderBy: { lastUsedAt: "asc" }
    });
    for (const k of dbKeys) {
      if (k.key?.trim()) {
        keysList.push({ id: k.id, key: k.key.trim(), label: k.label || "GeminiApiKey" });
      }
    }
  } catch (e) {}

  // 2. مفاتيح من جدول AIConfig (أي مفتاح يبدأ بـ AIzaSy أو مزوده gemini/google)
  try {
    const aiConfigs = await prisma.aIConfig.findMany({
      where: { isActive: true }
    });
    for (const c of aiConfigs) {
      if (c.apiKey?.trim() && (c.apiKey.startsWith("AIzaSy") || c.provider.toLowerCase().includes("gemini") || c.provider.toLowerCase().includes("google"))) {
        // تجنب التكرار
        if (!keysList.some(k => k.key === c.apiKey.trim())) {
          keysList.push({ id: `aiconfig_${c.id}`, key: c.apiKey.trim(), label: c.label || "AIConfig Key" });
        }
      }
    }
  } catch (e) {}

  // 3. مفاتيح البيئة .env
  const envKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (envKey && !keysList.some(k => k.key === envKey)) {
    keysList.push({ id: "env", key: envKey, label: "Env Key" });
  }

  return keysList;
}

export async function getNextActiveGeminiKey(): Promise<GeminiKeyRecord | null> {
  const list = await getAllActiveGeminiKeys();
  return list.length > 0 ? list[0] : null;
}

export async function markGeminiKeySuccess(keyId: string): Promise<void> {
  if (keyId.startsWith("env") || keyId.startsWith("aiconfig_")) return;
  try {
    await prisma.geminiApiKey.update({
      where: { id: keyId },
      data: { errorCount: 0, lastUsedAt: new Date() },
    });
  } catch (e) {}
}

export async function markGeminiKeyError(keyId: string, isQuotaError: boolean = false): Promise<void> {
  if (keyId.startsWith("env") || keyId.startsWith("aiconfig_")) return;
  try {
    await prisma.geminiApiKey.update({
      where: { id: keyId },
      data: { errorCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  } catch (e) {}
}
