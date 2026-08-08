import { prisma } from "@/lib/prisma";
import * as jose from "jose";
import vertexKey from "./vertex-key.json";

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
 * جلب Access Token لـ Google Cloud باستخدام Service Account ومكتبة jose
 */
async function getGoogleAccessToken() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const privateKey = await jose.importPKCS8(vertexKey.private_key, "RS256");

    const jwt = await new jose.SignJWT({
      scope: "https://www.googleapis.com/auth/cloud-platform",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt(now)
      .setIssuer(vertexKey.client_email)
      .setAudience("https://oauth2.googleapis.com/token")
      .setExpirationTime(now + 3600)
      .sign(privateKey);

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    const data = await res.json();
    return data.access_token;
  } catch (err) {
    console.error("Error generating Access Token:", err);
    return null;
  }
}

/**
 * فحص وتقييم صورة الباب عبر Gemini Vision API أو Vertex AI Imagen 3
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
  const models = ["gemini-1.5-flash", "gemini-2.0-flash"];

  // أولاً: استخدام Gemini للتحليل ومعرفة هل هي ليل أم لا
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
          let imagenStatus = "";

          if (isNight) {
            try {
              const accessToken = await getGoogleAccessToken();
              if (!accessToken) {
                imagenStatus = " (فشل التوثيق مع Vertex AI)";
              } else {
                const projectId = vertexKey.project_id;
                const location = "us-central1";
                const imagenResponse = await fetch(
                  `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                      instances: [
                        {
                          prompt: "A high-quality, clear, daytime photo of this house entrance. Transform the current night lighting into bright natural sunlight at noon. Maintain exactly the same door, walls, plants, and architectural details. No changes except lighting.",
                          image: {
                            bytesBase64Encoded: cleanBase64
                          }
                        }
                      ],
                      parameters: {
                        sampleCount: 1,
                        aspectRatio: "1:1"
                      }
                    }),
                  }
                );

                if (imagenResponse.ok) {
                  const imgData = await imagenResponse.json();
                  const generatedBase64 = imgData?.predictions?.[0]?.bytesBase64Encoded;
                  if (generatedBase64) {
                    finalBase64 = `data:${mimeType};base64,${generatedBase64}`;
                    return {
                      enhanced: true,
                      isNightToDay: true,
                      base64Image: finalBase64,
                      reason: "☀️ تم تحويل المشهد من ليل إلى نهار حقيقي باستخدام Vertex AI Imagen 3",
                      keyUsedLabel: "Vertex AI (Imagen 3)",
                    };
                  }
                } else {
                  const errJson = await imagenResponse.json().catch(() => ({}));
                  imagenStatus = ` (خطأ Imagen: ${errJson?.error?.message || imagenResponse.status})`;
                }
              }
            } catch (e: any) {
              imagenStatus = ` (خطأ برمجي في Vertex: ${e.message})`;
            }
          }

          return {
            enhanced: isNight || isBlurred,
            isNightToDay: isNight,
            base64Image: finalBase64,
            reason: (parsed?.reason || rawText || "تم تحليل الصورة بنجاح") + imagenStatus,
            keyUsedLabel: `${keyInfo.label} (${model})`,
          };
        } else {
          const errJson = await response.json().catch(() => ({}));
          lastGoogleErrorMessage = `Gemini (${model}): ${errJson?.error?.message || response.statusText || response.status}`;
        }
      } catch (err: any) {
        lastGoogleErrorMessage = err.message || "خطأ في الاتصال بالشبكة";
      }
    }
  }

  return {
    enhanced: false,
    base64Image: base64Data,
    reason: `عذراً، تعذر معالجة الصورة. آخر خطأ من جوجل: ${lastGoogleErrorMessage || "غير معروف"}. تم الإبقاء على الصورة الأصلية.`,
    keyUsedLabel: keys[0]?.label || "بدون مفتاح",
  };
}
