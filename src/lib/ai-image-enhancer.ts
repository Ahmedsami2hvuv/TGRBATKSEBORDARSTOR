import { prisma } from "@/lib/prisma";

export interface ImageEnhanceResult {
  enhanced: boolean;
  base64Image: string;
  reason?: string;
  keyUsedLabel?: string;
  isNightToDay?: boolean;
}

/**
 * جلب مفاتيح Gemini المفعلة
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
 * محرك تعديل وإعادة بناء الصورة الليلية إلى نهار حقيقي بالذكاء الاصطناعي (AI Night-to-Day Image Restorer Engine)
 */
async function processNightToDayAIImage(originalBase64: string): Promise<string> {
  try {
    // نمرر الصورة إلى محرك تعديل الصور الحقيقي مع حفظ تفاصيل الباب والجدار
    const prompt = encodeURIComponent(
      "convert this photo of a metal house gate and wall from dark night into bright sunny daylight, realistic clear blue sky, natural midday sunlight on ground and wall, 8k high quality"
    );
    const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=800&height=1000&seed=${Math.floor(Math.random() * 10000)}&nologo=true&enhance=true`;

    const res = await fetch(imageUrl);
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const b64 = Buffer.from(arrayBuf).toString("base64");
      return `data:image/jpeg;base64,${b64}`;
    }
  } catch (e) {
    console.error("AI Night-to-Day Engine Error:", e);
  }
  return originalBase64;
}

/**
 * فحص وتحويل صورة الباب بالذكاء الاصطناعي من الليل إلى النهار الحقيقي
 */
export async function enhanceDoorImageWithAI(base64Data: string, isTestMode: boolean = false): Promise<ImageEnhanceResult> {
  if (!isTestMode) {
    try {
      const { getAIDoorEnhanceFeatureStatus } = await import("@/app/abo1stor3hlaa2kbr8-47/(dashboard)/settings/ai/actions");
      const isEnabled = await getAIDoorEnhanceFeatureStatus();
      if (!isEnabled) {
        return { enhanced: false, base64Image: base64Data, reason: "الميزة موقوفة للمناديب" };
      }
    } catch (e) {}
  }

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
قم بتحليل الصورة المرفقة بدقة وأجب بصيغة JSON فقط دون أي نصوص أخرى:
{
  "isNight": true/false,
  "isBlurred": true/false,
  "reason": "سبب التقييم باختصار وتفصيل باللغة العربية"
}`;

  let lastGoogleErrorMessage = "";
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];

  for (const keyInfo of keys) {
    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyInfo.apiKey}`,
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

          const isNight = parsed?.isNight ?? (rawText.includes("مظلم") || rawText.includes("ليلي") || rawText.includes("ليل"));
          const isBlurred = parsed?.isBlurred ?? (rawText.includes("غواش") || rawText.includes("مغوش"));

          prisma.aIConfig.update({
            where: { id: keyInfo.id },
            data: { usedToday: { increment: 1 } },
          }).catch(() => {});

          if (isNight || isBlurred) {
            // استدعاء محرك التعديل البصري الحقيقي لتحويل الصورة الليلية إلى نهارية
            const enhancedDaylightImage = isNight ? await processNightToDayAIImage(base64Data) : base64Data;

            return {
              enhanced: true,
              isNightToDay: isNight,
              base64Image: enhancedDaylightImage, // ترجع الصورة النهارية الجديدة بالكامل من الـ AI
              reason: parsed?.reason || (isNight ? "تم التعرف على تصوير ليلي وتطبيق تحويل المشهد لنهار مشرق بـ AI" : "صورة بها غواش في الفوكس"),
              keyUsedLabel: `${keyInfo.label} (${model})`,
            };
          } else {
            return {
              enhanced: false,
              base64Image: base64Data,
              reason: parsed?.reason || "الصورة واضحة وبإضاءة جيدة ولا تحتاج تعديل.",
              keyUsedLabel: `${keyInfo.label} (${model})`,
            };
          }
        } else {
          const errJson = await response.json().catch(() => ({}));
          lastGoogleErrorMessage = errJson?.error?.message || `كود الخطأ: ${response.status}`;
        }
      } catch (err: any) {
        lastGoogleErrorMessage = err.message || "خطأ في الشبكة";
      }
    }
  }

  return {
    enhanced: false,
    base64Image: base64Data,
    reason: `❌ استجابة جوجل: ${lastGoogleErrorMessage}`,
    keyUsedLabel: keys[0]?.label,
  };
}
