import { prisma } from "@/lib/prisma";
import sharp from "sharp";

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
        provider: { in: ["nanobanana", "gemini_image_edit", "gemini", "GEMINI"] },
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
 * دالة تحويل السماء الليلية السوداء إلى سماء نهارية زرقاء مشرفة وتوضيح إضاءة الباب الأصلي (Sky Replacement & Daylight Relighting)
 * تُحافظ 100% على نفس صورة الباب والجدار والأرضية وتستبدل الظلام بالسماء النهارية والضوء الطبيعي
 */
async function processOriginalDoorImageRelighting(base64Data: string): Promise<string> {
  try {
    let cleanBase64 = base64Data;
    if (base64Data.startsWith("data:")) {
      cleanBase64 = base64Data.split(";base64,")[1] || base64Data;
    }

    const inputBuffer = Buffer.from(cleanBase64, "base64");
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    const width = metadata.width || 800;
    const height = metadata.height || 1000;

    // 1. إنشاء طبقة سماء نهارية زرقاء صافية طبيعية (Daylight Sky SVG)
    const skyHeight = Math.floor(height * 0.35); // الجزء العلوي الذي يحتوي عادة على السماء
    const skySvg = `
      <svg width="${width}" height="${skyHeight}">
        <defs>
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.92"/>
            <stop offset="60%" stop-color="#60a5fa" stop-opacity="0.85"/>
            <stop offset="100%" stop-color="#bfdbfe" stop-opacity="0.30"/>
          </linearGradient>
        </defs>
        <rect width="${width}" height="${skyHeight}" fill="url(#skyGrad)"/>
      </svg>
    `;

    // 2. تفتيح وتحسين وتعديل الإضاءة والوضوح لجميع أجزاء المشهد (الباب والجدار والأرضية)
    const relitBuffer = await image
      .modulate({
        brightness: 1.55, // رفع السطوع لتحويل إضاءة الليل إلى إضاءة نهارية مشمسة
        saturation: 1.25, // تعزيز ألوان باب الزبون والجدار
      })
      .gamma(1.3) // رفع مستوى تباين الألوان في الظلال
      .toBuffer();

    // 3. دمج طبقة السماء النهارية مع الصورة المعدلة
    const finalBuffer = await sharp(relitBuffer)
      .composite([
        {
          input: Buffer.from(skySvg),
          top: 0,
          left: 0,
          blend: "over",
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    return `data:image/jpeg;base64,${finalBuffer.toString("base64")}`;
  } catch (e) {
    console.error("Sharp Sky Replacement Relighting Error:", e);
    return base64Data;
  }
}

/**
 * فحص وتعديل صورة الباب بالذكاء الاصطناعي مع التعديل الصارم المباشر على نفس الصورة الأصلية
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
قم بتحليل الصورة المرفقة بدقة لمعرفة هل هي تصوير ليلي مظلم أم نهار، وهل بها غواش؟
أجب بصيغة JSON فقط:
{
  "isNight": true/false,
  "isBlurred": true/false,
  "reason": "تقرير التقييم باختصار باللغة العربية"
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
            // تحويل المشهد من الليل إلى النهار الناصع واستبدال السماء المظلمة بسماء نهارية زرقاء على نفس الصورة الأصلية لباب الزبون
            const relitDaylightImage = await processOriginalDoorImageRelighting(base64Data);

            return {
              enhanced: true,
              isNightToDay: isNight,
              base64Image: relitDaylightImage,
              reason: parsed?.reason || "تم استبدال السماء الليلية السوداء بسماء نهارية زرقاء وتعديل الإضاءة والوضوح على نفس صورة الباب ☀️",
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
