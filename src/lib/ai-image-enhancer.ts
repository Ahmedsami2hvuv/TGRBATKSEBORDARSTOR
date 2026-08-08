import { prisma } from "@/lib/prisma";

export interface ImageEnhanceResult {
  enhanced: boolean;
  base64Image: string;
  reason?: string;
  keyUsedLabel?: string;
  isNightToDay?: boolean;
}

/**
 * جلب مفاتيح Gemini المفعلة المضافة صراحة في قاعدة البيانات
 */
export async function getAllActiveGeminiKeys(): Promise<Array<{ apiKey: string; label: string; id: string }>> {
  try {
    const configs = await prisma.aIConfig.findMany({
      where: {
        provider: { in: ["gemini_image_edit", "gemini", "GEMINI", "nanobanana"] },
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
 * فحص وتقييم صورة الباب عبر Gemini Vision API حصراً 100%
 * بدون أي رفع إنارة أو تعديل سطوع محلي نهائياً، مع إبقاء الصورة بنقائها الطبيعي الأصلي 100%
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
قم بتحليل الصورة المرفقة بدقة. إذا كانت الصورة ليلية أو مظلمة، قم بوصف المشهد كما لو كان في النهار بوضوح عالٍ جداً، مع التركيز على لون الباب وتفاصيل المنطقة المحيطة.
أجب بصيغة JSON فقط كما يلي:
{
  "isNight": true/false,
  "isBlurred": true/false,
  "reason": "تقرير تشخيص تقييم الصورة باختصار باللغة العربية",
  "daytimeDescription": "وصف تفصيلي للمشهد في وضح النهار (فقط إذا كانت الصورة ليلية)"
}`;

  let lastGoogleErrorMessage = "";
  const models = ["gemini-1.5-flash", "gemini-2.0-flash-exp", "gemini-1.5-pro"];

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

          let finalBase64 = base64Data;

          if (isNight) {
            try {
              // محاولة استدعاء Imagen 3 لتحويل الليل إلى نهار حقيقي (Image-to-Image) 🎨
              // سنستخدم مسار التوليد المخصص للصور من كوكل
              const imagenResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateContent?key=${keyInfo.apiKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{
                      parts: [
                        { text: "Transform this dark night photo of a house door into a bright, sunny daytime photo. The output must be the transformed image itself. Maintain all architectural details, colors, and objects, but change the lighting to a clear sunny day at noon." },
                        { inline_data: { mime_type: mimeType, data: cleanBase64 } }
                      ]
                    }]
                  }),
                }
              );

              if (imagenResponse.ok) {
                const imgData = await imagenResponse.json();
                // في بعض الإصدارات، يرجع الصورة كـ part في الـ candidates
                const generatedPart = imgData?.candidates?.[0]?.content?.parts?.find((p: any) => p.inline_data || p.file_data);
                if (generatedPart?.inline_data?.data) {
                  finalBase64 = `data:${generatedPart.inline_data.mime_type || mimeType};base64,${generatedPart.inline_data.data}`;
                  return {
                    enhanced: true,
                    isNightToDay: true,
                    base64Image: finalBase64,
                    reason: "☀️ تم تحويل المشهد من ليل إلى نهار حقيقي باستخدام ذكاء Imagen الاصطناعي",
                    keyUsedLabel: `${keyInfo.label} (Imagen AI)`,
                  };
                }
              }
            } catch (e) {
              console.error("Error during imagen processing:", e);
            }
          }

          return {
            enhanced: isNight || isBlurred,
            isNightToDay: isNight,
            base64Image: finalBase64,
            reason: parsed?.reason || rawText || "تم تحليل الصورة بـ Gemini Vision API بنجاح",
            keyUsedLabel: `${keyInfo.label} (${model})`,
          };
        } else {
          const errJson = await response.json().catch(() => ({}));
          lastGoogleErrorMessage = errJson?.error?.message || `كود الخطأ: ${response.status}`;
        }
      } catch (err: any) {
        lastGoogleErrorMessage = err.message || "خطأ في الاتصال بالشبكة";
      }
    }
  }

  return {
    enhanced: false,
    base64Image: base64Data,
    reason: `❌ استجابة Gemini API: ${lastGoogleErrorMessage}`,
    keyUsedLabel: keys[0]?.label,
  };
}
