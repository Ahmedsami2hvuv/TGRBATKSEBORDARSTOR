import { prisma } from "@/lib/prisma";

export interface ImageEnhanceResult {
  enhanced: boolean;
  base64Image: string;
  reason?: string;
  keyUsedLabel?: string;
  isNightToDay?: boolean;
}

/**
 * جلب مفاتيح الذكاء الاصطناعي المفعلة المضافة صراحة في قاعدة البيانات
 */
export async function getAllActiveGeminiKeys(): Promise<Array<{ apiKey: string; label: string; id: string; provider: string }>> {
  try {
    const configs = await prisma.aIConfig.findMany({
      where: {
        provider: { in: ["gemini_image_edit", "gemini", "GEMINI", "nanobanana", "openrouter"] },
        isActive: true,
      },
      orderBy: {
        usedToday: "asc",
      },
    });

    return configs.map((c) => ({
      apiKey: c.apiKey.trim(),
      label: c.label || `مفتاح (${c.id.slice(0, 5)})`,
      id: c.id,
      provider: c.provider,
    }));
  } catch (err) {
    console.error("Error fetching AIConfig keys:", err);
    return [];
  }
}

/**
 * فحص وتقييم صورة الباب عبر الذكاء الاصطناعي المباشر (دعم Google API + OpenRouter)
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
      reason: "❌ لا يوجد أي مفتاح API مضاف في النظام! يرجى إضافة مفتاح في الإعدادات لاستخدام الذكاء الاصطناعي.",
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
قم بتحليل الصورة المرفقة وأجب بصيغة JSON فقط:
{
  "isNight": true/false,
  "isBlurred": true/false,
  "reason": "تقرير تشخيص تقييم الصورة باختصار باللغة العربية"
}`;

  let lastErrorMessage = "";
  let isQuotaError = false;
  let isNotFoundError = false;
  
  const openRouterEndpoint = "https://openrouter.ai/api/v1/chat/completions";

  // الموديلات المجانية الخارقة للرؤية في OpenRouter بالترتيب (تم تحديثها للأسماء الرسمية الفعالة)
  const openRouterModels = [
    "google/gemini-2.0-flash-exp:free",
    "meta-llama/llama-3.2-11b-vision-instruct:free", 
    "qwen/qwen-2-vl-7b-instruct:free",
    "google/gemini-1.5-flash"
  ];

  // موديلات جوجل الرسمية لضمان الاستقرار والعمل على كافة أنواع المفاتيح القديمة والجديدة
  const googleModels = [
    "gemini-1.5-flash-latest",
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro",
    "gemini-1.5-flash"
  ];

  for (const keyInfo of keys) {
    let isProviderOpenRouter = keyInfo.provider === "openrouter";
    let modelsToTry = isProviderOpenRouter ? openRouterModels : googleModels;

    for (const currentModel of modelsToTry) {
      try {
        let response: Response;

        if (isProviderOpenRouter) {
          // الاتصال عبر OpenRouter (يدعم Gemini وغيرها بصيغة موحدة)
          response = await fetch(openRouterEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${keyInfo.apiKey}`,
              "HTTP-Referer": "https://aboakbr.com", // موقعك
              "X-Title": "Abo Akbr System",
            },
            body: JSON.stringify({
              model: currentModel,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: masterPrompt },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${cleanBase64}` } }
                  ]
                }
              ],
              response_format: { type: "json_object" }
            }),
          });
        } else {
          // الاتصال الافتراضي عبر Google AI Studio المباشر
          const googleEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`;
          response = await fetch(
            `${googleEndpoint}?key=${keyInfo.apiKey}`,
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
        }

        if (response.ok) {
          const data = await response.json();
          
          let rawText = "";
          if (isProviderOpenRouter) {
            rawText = data?.choices?.[0]?.message?.content || "";
          } else {
            rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }

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

          return {
            enhanced: false,
            isNightToDay: isNight,
            base64Image: base64Data,
            reason: parsed?.reason || rawText || "تم تحليل الصورة بالذكاء الاصطناعي بنجاح ☀️",
            keyUsedLabel: `${keyInfo.label} (${isProviderOpenRouter ? currentModel.split(':')[0] : 'Google API'})`,
          };
        } else {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson?.error?.message || response.statusText || "";
          
          if (errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("exceeded") || errMsg.toLowerCase().includes("credit") || response.status === 429 || response.status === 402) {
            isQuotaError = true;
            lastErrorMessage = errMsg || "Insufficient Quota / Credits";
            break; // خروج لإنهاء المحاولة لأن هذا المفتاح استنفد الرصيد بالكامل
          } else {
            // أي خطأ آخر (مثل الموديل غير موجود، السيرفر مشغول، إلخ) نسجله ونستمر فوراً للموديل التالي
            lastErrorMessage = errMsg || `كود الخطأ: ${response.status}`;
            continue; // استمر للموديل اللي بعده
          }
        }
      } catch (err: any) {
        lastErrorMessage = err.message || "خطأ في الاتصال بالشبكة";
        continue; // استمر للموديل اللي بعده
      }
    }
    
    // إذا كان الخطأ متعلقاً بانتهاء الرصيد نكسر حلقة المفاتيح فوراً ونبلغ المستخدم
    if (isQuotaError) {
        break;
    }
  }

  // ترجمة ذكية وواضحة جداً للمستخدم بناءً على نوع الخطأ الصادر
  let finalReason = `❌ استجابة السيرفر: ${lastErrorMessage}`;
  
  if (isQuotaError) {
    finalReason = "❌ تنبيه: حسابك استنفد الرصيد أو الحصة المجانية بالكامل! (Quota Exceeded). الحل: يرجى شحن الرصيد أو استخدام مفتاح جديد.";
  } else if (isNotFoundError) {
    finalReason = "❌ تنبيه: هذا المفتاح مقيد ولا يملك صلاحية للوصول للموديلات أو الموديل غير موجود (Not Found). الحل: تأكد من تفعيل الصلاحيات أو استخدام موديل آخر.";
  }

  return {
    enhanced: false,
    base64Image: base64Data,
    reason: finalReason,
    keyUsedLabel: keys[0]?.label,
  };
}
