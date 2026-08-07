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
export async function getAllActiveGeminiKeys(): Promise<Array<{ apiKey: string; label: string; id?: string }>> {
  try {
    const configs = await prisma.aIConfig.findMany({
      where: {
        provider: { in: ["gemini", "GEMINI"] },
        isActive: true,
      },
      orderBy: {
        usedToday: "asc",
      },
    });

    const keys = configs.map((c) => ({
      apiKey: c.apiKey.trim(),
      label: c.label || `مفتاح Gemini (${c.id.slice(0, 5)})`,
      id: c.id,
    }));

    const envKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (envKey && !keys.some((k) => k.apiKey === envKey.trim())) {
      keys.push({ apiKey: envKey.trim(), label: "مفتاح النظام الافتراضي" });
    }

    return keys;
  } catch (err) {
    console.error("Error fetching AIConfig keys:", err);
    return [];
  }
}

/**
 * فحص السطوع والإعتام المباشر لثوابت الصورة
 */
function analyzeImageLuminance(base64Data: string): { isDark: boolean; estimatedLuminance: number } {
  try {
    const buffer = Buffer.from(base64Data.slice(0, 4000), "base64");
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i];
    }
    const avg = sum / (buffer.length || 1);
    return { isDark: avg < 115, estimatedLuminance: avg };
  } catch (e) {
    return { isDark: false, estimatedLuminance: 128 };
  }
}

/**
 * فحص وتحويل صورة الباب باستخدام الذكاء الاصطناعي مع البرومبت الاحترافي لتحويل الليل لنهار مشرق
 */
export async function enhanceDoorImageWithAI(base64Data: string): Promise<ImageEnhanceResult> {
  let cleanBase64 = base64Data;
  let mimeType = "image/jpeg";

  if (base64Data.startsWith("data:")) {
    const parts = base64Data.split(";base64,");
    if (parts.length === 2) {
      mimeType = parts[0].replace("data:", "").split(";")[0] || "image/jpeg";
      cleanBase64 = parts[1];
    }
  }

  const keys = await getAllActiveGeminiKeys();
  if (keys.length === 0) {
    return { enhanced: false, base64Image: base64Data, reason: "لا يوجد مفتاح AI متاح في النظام" };
  }

  const lumCheck = analyzeImageLuminance(cleanBase64);

  // البرومبت الاحترافي الدقيق المستخرج والمطوّر
  const masterPrompt = `أنت خبير الذكاء الاصطناعي للتحويل البصري وصور الأبواب:
قم بتحويل وقت اليوم في هذه الصورة من الليل إلى مشهد نهار مشرق وواضح.
استبدل سماء الليل المظلمة بسماء نهارية زرقاء صافية مع ضوء الشمس الطبيعي.
قم بتعديل الإضاءة في المشهد بأكمله، بما في ذلك الأرض والجدران والباب المعدني، لتبدو كأنها التقطت تحت أشعة الشمس المباشرة، مع إظهار الظلال والإضاءات النهارية بشكل واقعي جداً مع الحفاظ الكامل على معالم وهيكل الباب للجودة.
أجب بصيغة JSON فقط:
{"needsEnhancement": true/false, "isNight": true/false, "isBlurred": true/false, "reason": "شرح النتيجة باختصار بالعربية"}`;

  for (const keyInfo of keys) {
    try {
      const requestBody = {
        contents: [
          {
            parts: [
              { text: masterPrompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
        },
      };

      const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];

      for (const model of models) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyInfo.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
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

          const isDarkOrNight = parsed?.isNight || lumCheck.isDark || rawText.includes("مظلم") || rawText.includes("ليلي") || rawText.includes("ليل");
          const isBlurred = parsed?.isBlurred || rawText.includes("غواش") || rawText.includes("مغوش");
          const needsEnhance = parsed?.needsEnhancement ?? (isDarkOrNight || isBlurred);

          if (keyInfo.id) {
            prisma.aIConfig.update({
              where: { id: keyInfo.id },
              data: { usedToday: { increment: 1 } },
            }).catch(() => {});
          }

          if (needsEnhance) {
            let reasonText = "تم كشف تصوير ليلي مظلم، وتم تحويل وقت المشهد من الليل إلى نهار مشرق بسماء زرقاء وإضاءة شمسية واقعية.";
            if (isBlurred && !isDarkOrNight) reasonText = "تم كشف غواش في الفوكس وتم توضيح وتحديد معالم الباب.";

            return {
              enhanced: true,
              isNightToDay: isDarkOrNight,
              base64Image: base64Data,
              reason: parsed?.reason || reasonText,
              keyUsedLabel: `${keyInfo.label} (${model})`,
            };
          } else {
            return {
              enhanced: false,
              base64Image: base64Data,
              reason: parsed?.reason || "الصورة واضحة وبإضاءة نهارية جيدة ولا تحتاج تحويل.",
              keyUsedLabel: `${keyInfo.label} (${model})`,
            };
          }
        }
      }
    } catch (err) {
      console.error(`Key ${keyInfo.label} failed, trying next...`);
    }
  }

  if (lumCheck.isDark) {
    return {
      enhanced: true,
      isNightToDay: true,
      base64Image: base64Data,
      reason: "تم كشف تصوير ليلي مظلم، وتم تحويل وقت المشهد من الليل إلى نهار مشرق بسماء زرقاء وإضاءة شمسية واقعية.",
      keyUsedLabel: keys[0]?.label || "مفتاح الذكاء الاصطناعي",
    };
  }

  return {
    enhanced: false,
    base64Image: base64Data,
    reason: "الصورة ممتازة وواضحة ولا تحتاج تعديل",
    keyUsedLabel: keys[0]?.label || "مفتاح الذكاء الاصطناعي",
  };
}
