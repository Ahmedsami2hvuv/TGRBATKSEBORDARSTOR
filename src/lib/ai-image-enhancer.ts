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
 * تعديل وتوضيح إضاءة الصورة الأصلية نفسها لباب الزبون بواسطة محرك Sharp للسيرفر
 * يضمن التعديل الحقيقي المباشر على نفس صورة الباب المرفوعة دون إنشاء أو توليد أي صورة غريبة
 */
async function processOriginalDoorImageRelighting(base64Data: string): Promise<string> {
  try {
    let cleanBase64 = base64Data;
    if (base64Data.startsWith("data:")) {
      cleanBase64 = base64Data.split(";base64,")[1] || base64Data;
    }

    const inputBuffer = Buffer.from(cleanBase64, "base64");

    // تطبيق معالجة نهارية احترافية على نفس الصورة الأصلية (رفع الظلال وتصحيح التباين والسطوع الطبيعي)
    const processedBuffer = await sharp(inputBuffer)
      .modulate({
        brightness: 1.45, // رفع سطوع المشهد الليلي المظلم إلى نهار ناصع
        saturation: 1.15, // تعزيز الألوان الطبيعية للمعدن والجدار
      })
      .linear(1.2, -10) // تصحيح التباين لتوضيح ملامح باب الزبون
      .toBuffer();

    return `data:image/jpeg;base64,${processedBuffer.toString("base64")}`;
  } catch (e) {
    console.error("Sharp Image Processing Error:", e);
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
            // التعديل المباشر الصارم على نفس الصورة الأصلية المرفوعة لباب الزبون بـ Sharp
            const relitImage = await processOriginalDoorImageRelighting(base64Data);

            return {
              enhanced: true,
              isNightToDay: isNight,
              base64Image: relitImage,
              reason: parsed?.reason || "تم كشف تصوير ليلي وتعديل إضاءة ووضوح صورة الباب الأصلية المرفوعة بنجاح ☀️",
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
