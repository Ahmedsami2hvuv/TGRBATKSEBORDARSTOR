import { prisma } from "./prisma";

export type GeminiKeyRecord = {
  id: string;
  key: string;
  label?: string | null;
};

/**
 * جلب جميع مفاتيح Gemini المتاحة في لوحة تحكم الموقع وقاعدة البيانات ومتغيرات البيئة
 */
export async function getAllActiveGeminiKeys(): Promise<GeminiKeyRecord[]> {
  const keysList: GeminiKeyRecord[] = [];

  // 1. جلب المفاتيح من جدول Prisma GeminiApiKey
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

  // 2. جلب المفاتيح من جدول AIConfig
  try {
    const aiConfigs = await prisma.aIConfig.findMany();
    for (const c of aiConfigs) {
      if (c.apiKey?.trim()) {
        const cleanK = c.apiKey.trim();
        if (!keysList.some(k => k.key === cleanK)) {
          keysList.push({ id: `aiconfig_${c.id}`, key: cleanK, label: c.label || c.provider || "AIConfig Key" });
        }
      }
    }
  } catch (e) {}

  // 3. جلب المفاتيح من Supabase Direct REST API
  try {
    const supabaseUrl = process.env.SUPABASE_URL || "https://trfjlxxeldnegjgdqefm.supabase.co";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_OzGTq6fwKa3dh5qeIfyZkw__LLSzJNR";

    const res = await fetch(`${supabaseUrl}/rest/v1/GeminiApiKey?select=*`, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      },
      cache: "no-store"
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const k of data) {
          if (k.key?.trim() && !keysList.some(item => item.key === k.key.trim())) {
            keysList.push({ id: k.id, key: k.key.trim(), label: k.label || "Supabase - GeminiKey" });
          }
        }
      }
    }
  } catch (e) {}

  // 4. مفاتيح مجمعة من البيئة GEMINI_KEYS (مفصولة بفواصل)
  const envKeysGroup = process.env.GEMINI_KEYS || process.env.GEMINI_API_KEYS;
  if (envKeysGroup?.trim()) {
    const splitted = envKeysGroup.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    splitted.forEach((k, idx) => {
      if (!keysList.some(item => item.key === k)) {
        keysList.push({ id: `env_group_${idx}`, key: k, label: `Env Key ${idx + 1}` });
      }
    });
  }

  // 5. مفاتيح بيئة فردية GEMINI_API_KEY و GOOGLE_API_KEY
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
