import { prisma } from "@/lib/prisma";

export interface ImageEnhanceResult {
  enhanced: boolean;
  base64Image: string;
  reason?: string;
  keyUsedLabel?: string;
  isNightToDay?: boolean;
}

/**
 * جلب مفاتيح Gemini المفعلة المضافة صراحة في قاعدة البيانات حصراً
 */
export async function getAllActiveGeminiKeys(): Promise<Array<{ apiKey: string; label: string; id: string }>> {
  try {
    const configs = await prisma.aIConfig.findMany({
      where: {
        provider: { in: ["gemini_image_edit", "gemini", "GEMINI"] },
        isActive: true,
      },
      orderBy: {
        usedToday: "asc",
      },
    });

    return configs.map((c) => ({
      apiKey: c.apiKey.trim(),
      label: c.label || `مفتاح Gemini (${c.id.slice(0, 5)})`,
      id: c.id,
    }));
  } catch (err) {
    console.error("Error fetching AIConfig keys:", err);
    return [];
  }
}

/**
 * فحص صورة الباب بالذكاء الاصطناعي حصراً عند وجود مفاتيح مضافة وبطريقة صارمة
 */
export async function enhanceDoorImageWithAI(base64Data: string, isTestMode: boolean = false): Promise<ImageEnhanceResult> {
  // 1. فحص تفعيل الميزة للمناديب
  if (!isTestMode) {
    try {
      const { getAIDoorEnhanceFeatureStatus } = await import("@/app/abo1stor3hlaa2kbr8-47/(dashboard)/settings/ai/actions");
      const isEnabled = await getAIDoorEnhanceFeatureStatus();
      if (!isEnabled) {
        return { enhanced: false, base64Image: base64Data, reason: "الميزة موقوفة للمناديب" };
      }
    } catch (e) {}
  }

  // 2. جلب مفاتيح قاعدة البيانات فقط
  const keys = await getAllActiveGeminiKeys();
  if (keys.length === 0) {
    return {
      enhanced: false,
      base64Image: base64Data,
      reason: "❌ لا يوجد أي مفتاح API مضاف في النظام! يرجى إضافة مفتاح Gemini في الإعدادات لاستخدام الذكاء الاصطناعي.",
      keyUsedLabel: "بدون مفتاح",
    };
  }

  let cleanBase64 = base64Data;
  let mimeType = "image/jpeg";

  if (base64Data.startsWith("data:")) {
    const parts = base64Data.split(";base64,");
    if (parts.length === 2) {
      mimeType = parts[0].replace("data:", "").split(";")[0] || "image/jpeg";
      cleanBase64 = parts[1];
    }
  }

  const masterPrompt = `أنت خبير فحص صور الأبواب للتوصيل:
قم بتحليل الصورة المرفقة وأجب بـ JSON فقط:
{
  "isNight": true/false,
  "isBlurred": true/false,
  "reason": "سبب التقييم باختصار باللغة العربية"
}`;

  // تجربة المفاتيح المضافة حصراً
  for (const keyInfo of keys) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyInfo.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: masterPrompt },
                  { inline_data: { mime_type: mimeType, data: cleanBase64 } },
                ],
              },
            ],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        let parsed: any = null;
        try {
          const match = rawText.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]);
        } catch (e) {}

        const isNight = parsed?.isNight ?? (rawText.includes("مظلم") || rawText.includes("ليلي"));
        const isBlurred = parsed?.isBlurred ?? (rawText.includes("غواش") || rawText.includes("مغوش"));

        // تحديث عدد الاستخدام اليومي للمفتاح الحقيقي
        prisma.aIConfig.update({
          where: { id: keyInfo.id },
          data: { usedToday: { increment: 1 } },
        }).catch(() => {});

        if (isNight || isBlurred) {
          return {
            enhanced: true,
            isNightToDay: isNight,
            base64Image: base64Data,
            reason: parsed?.reason || (isNight ? "صورة ليلية مظلمة بحاجة لتعديل المشهد" : "صورة بها غواش"),
            keyUsedLabel: keyInfo.label,
          };
        } else {
          return {
            enhanced: false,
            base64Image: base64Data,
            reason: parsed?.reason || "الصورة واضحة وبإضاءة جيدة ولا تحتاج تعديل.",
            keyUsedLabel: keyInfo.label,
          };
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        console.error(`Gemini API Error for key ${keyInfo.label}:`, errJson);
      }
    } catch (err) {
      console.error(`Fetch error for key ${keyInfo.label}:`, err);
    }
  }

  return {
    enhanced: false,
    base64Image: base64Data,
    reason: "❌ فشل الاتصال بمفاتيح Gemini المضافة. تأكد من صحة الـ API Key في الإعدادات.",
    keyUsedLabel: keys[0]?.label,
  };
}
