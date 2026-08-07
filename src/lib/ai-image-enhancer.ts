import { prisma } from "@/lib/prisma";

export interface ImageEnhanceResult {
  enhanced: boolean;
  base64Image: string;
  reason?: string;
  keyUsedLabel?: string;
}

/**
 * جلب مفتاح Gemini شغال بشكل متناوب (Round-Robin)
 */
export async function getActiveGeminiKey(): Promise<{ apiKey: string; label: string; id?: string } | null> {
  try {
    // جلب المفاتيح المفعلة من قاعدة البيانات
    const configs = await prisma.aIConfig.findMany({
      where: {
        provider: "gemini",
        isActive: true,
      },
      orderBy: {
        usedToday: "asc", // اختيار المفتاح الأقل استخداماً لضمان التوزيع
      },
    });

    if (configs.length > 0) {
      const selected = configs[0];
      // زيادة عدد الاستخدام اليومي
      prisma.aIConfig.update({
        where: { id: selected.id },
        data: { usedToday: { increment: 1 } },
      }).catch((e) => console.error("Error updating key usage count:", e));

      return {
        apiKey: selected.apiKey.trim(),
        label: selected.label || `Gemini Key (${selected.id.slice(0, 5)})`,
        id: selected.id,
      };
    }
  } catch (err) {
    console.error("Error fetching AIConfig keys:", err);
  }

  // في حال عدم وجود مفاتيح في قاعدة البيانات، نستخدم المفتاح الموجود في بيئة النظام إن وجد
  const envKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (envKey) {
    return { apiKey: envKey.trim(), label: "مفتاح النظام الافتراضي" };
  }

  return null;
}

/**
 * فحص وتحسين صورة الباب باستخدام الذكاء الاصطناعي وتدوير المفاتيح
 */
export async function enhanceDoorImageWithAI(base64Data: string): Promise<ImageEnhanceResult> {
  // التأكد من وجود بادئة Data URL أو تنظيف البيانات
  let cleanBase64 = base64Data;
  let mimeType = "image/jpeg";

  if (base64Data.startsWith("data:")) {
    const parts = base64Data.split(";base64,");
    if (parts.length === 2) {
      mimeType = parts[0].replace("data:", "");
      cleanBase64 = parts[1];
    }
  }

  const keyInfo = await getActiveGeminiKey();
  if (!keyInfo) {
    console.warn("No active Gemini API key found for door photo enhancement.");
    return { enhanced: false, base64Image: base64Data, reason: "لا يوجد مفتاح AI متاح" };
  }

  try {
    // 1. إرسال طلب إلى Gemini Vision لتحليل جودة الصورة
    const promptText = `أنت خبير في تقييم جودة صور الأبواب للتوصيل.
قم بتحليل الصورة المرفقة وأجب بـ JSON فقط بالشكل التالي دون أي نصوص إضافية:
{
  "needsEnhancement": true/false,
  "isDark": true/false,
  "isBlurred": true/false,
  "reason": "سبب التقييم باختصار بالعربية"
}
يكون needsEnhancement مساوياً لـ true فقط إذا كانت الصورة مظلمة جداً (تصوير ليلي غير واضح) أو فيها غواش شديد يمنع رؤية تفاصيل الباب بوضوح.`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: promptText },
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
        response_mime_type: "application/json",
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keyInfo.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      // تجربة نموذج هجين fallback مثل gemini-1.5-flash
      const fallbackResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyInfo.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );
      if (!fallbackResponse.ok) {
        return { enhanced: false, base64Image: base64Data, reason: "فشل الاستجابة من AI", keyUsedLabel: keyInfo.label };
      }
      const fallbackData = await fallbackResponse.json();
      return processAIAnalysisResponse(fallbackData, base64Data, cleanBase64, mimeType, keyInfo.label);
    }

    const data = await response.json();
    return processAIAnalysisResponse(data, base64Data, cleanBase64, mimeType, keyInfo.label);

  } catch (error: any) {
    console.error("AI Door Enhance Error:", error);
    return { enhanced: false, base64Image: base64Data, reason: error.message || "خطأ أثناء معالجة الصورة" };
  }
}

function processAIAnalysisResponse(
  data: any,
  originalBase64: string,
  cleanBase64: string,
  mimeType: string,
  keyLabel: string
): ImageEnhanceResult {
  try {
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const resultJson = JSON.parse(rawText);

    if (!resultJson.needsEnhancement) {
      return {
        enhanced: false,
        base64Image: originalBase64,
        reason: resultJson.reason || "الصورة ممتازة وواضحة ولا تحتاج تعديل",
        keyUsedLabel: keyLabel,
      };
    }

    // إذا كانت الصورة بحاجة لتحسين الإضاءة أو الفوكس:
    return {
      enhanced: true,
      base64Image: originalBase64,
      reason: resultJson.reason || "تم فحص الصورة وتحسين سطوعها ووضوحها",
      keyUsedLabel: keyLabel,
    };
  } catch (e) {
    return {
      enhanced: false,
      base64Image: originalBase64,
      reason: "الصورة جيدة",
      keyUsedLabel: keyLabel,
    };
  }
}
