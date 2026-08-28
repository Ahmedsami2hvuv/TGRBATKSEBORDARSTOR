import { prisma } from "./prisma";

export type GeminiKeyRecord = {
  id: string;
  key: string;
  label?: string | null;
};

/**
 * جلب جميع مفاتيح Gemini المتاحة من قاعدة البيانات ومن متغيّرات البيئة
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
      if (k.key?.trim() && !keysList.some(item => item.key === k.key.trim())) {
        keysList.push({ id: k.id, key: k.key.trim(), label: k.label || "GeminiApiKey" });
      }
    }
  } catch (e) {}

  // 2. مفاتيح من جدول AIConfig
  try {
    const aiConfigs = await prisma.aIConfig.findMany({
      where: { isActive: true }
    });
    for (const c of aiConfigs) {
      if (c.apiKey?.trim() && (c.apiKey.startsWith("AIzaSy") || c.provider?.toLowerCase().includes("gemini") || c.provider?.toLowerCase().includes("google"))) {
        if (!keysList.some(k => k.key === c.apiKey.trim())) {
          keysList.push({ id: `aiconfig_${c.id}`, key: c.apiKey.trim(), label: c.label || "AIConfig Key" });
        }
      }
    }
  } catch (e) {}

  // 3. مفاتيح مجمعة من البيئة GEMINI_KEYS (مفصولة بفواصل)
  const envKeysGroup = process.env.GEMINI_KEYS || process.env.GEMINI_API_KEYS;
  if (envKeysGroup?.trim()) {
    const splitted = envKeysGroup.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    splitted.forEach((k, idx) => {
      if (!keysList.some(item => item.key === k)) {
        keysList.push({ id: `env_group_${idx}`, key: k, label: `Env Key ${idx + 1}` });
      }
    });
  }

  // 4. مفاتيح بيئة فردية GEMINI_API_KEY و GOOGLE_API_KEY
  const envKeySingle = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (envKeySingle && !keysList.some(k => k.key === envKeySingle)) {
    keysList.push({ id: "env_single", key: envKeySingle, label: "Env Single Key" });
  }

  return keysList;
}

export async function getNextActiveGeminiKey(): Promise<GeminiKeyRecord | null> {
  const list = await getAllActiveGeminiKeys();
  return list.length > 0 ? list[0] : null;
}

export async function markGeminiKeySuccess(keyId: string): Promise<void> {
  if (keyId.startsWith("env_") || keyId.startsWith("aiconfig_")) return;
  try {
    await prisma.geminiApiKey.update({
      where: { id: keyId },
      data: { errorCount: 0, lastUsedAt: new Date() },
    });
  } catch (e) {}
}

export async function markGeminiKeyError(keyId: string, isQuotaError: boolean = false): Promise<void> {
  if (keyId.startsWith("env_") || keyId.startsWith("aiconfig_")) return;
  try {
    await prisma.geminiApiKey.update({
      where: { id: keyId },
      data: { errorCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  } catch (e) {}
}
