import { NextResponse } from "next/server";
import { getAllActiveGeminiKeys } from "@/lib/ai-image-enhancer";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // السماح للمسار بالعمل لمدة أطول بسبب تأخر توليد الصور

const REPLICATE_SDXL_VERSION = "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "لا توجد صورة مرسلة." }, { status: 400 });
    }

    // جلب مفتاح Replicate من الداتا بيس
    const configs = await getAllActiveGeminiKeys();
    const replicateKeyInfo = configs.find(
      (k) => k.provider === "replicate" && k.isActive
    );

    if (!replicateKeyInfo || !replicateKeyInfo.apiKey) {
      return NextResponse.json(
        { error: "لم يتم العثور على مفتاح Replicate مفعل في الإعدادات." },
        { status: 500 }
      );
    }

    const replicateToken = replicateKeyInfo.apiKey;

    // 1. بدء عملية الرسم التوليدي (Prediction)
    const prompt = "make it bright daytime, clear blue sky, highly detailed, realistic, perfect lighting, sunny, vivid colors, keeping the original door structure exactly the same";
    
    // تجهيز الصورة Base64 (قد تحتوي على data:image/jpeg;base64, تأكد من وجودها)
    const formattedImage = imageBase64.startsWith('data:image') 
      ? imageBase64 
      : `data:image/jpeg;base64,${imageBase64}`;

    console.log("Starting Replicate Prediction...");
    
    const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: REPLICATE_SDXL_VERSION,
        input: {
          image: formattedImage,
          prompt: prompt,
          negative_prompt: "night, dark, blurry, distorted, changing structure",
          prompt_strength: 0.65, // قوة التغيير: يحافظ على الهيكل ويغير الإضاءة بقوة
          num_outputs: 1,
          scheduler: "K_EULER",
          num_inference_steps: 25,
          guidance_scale: 7.5
        }
      })
    });

    if (!startResponse.ok) {
      const err = await startResponse.json();
      throw new Error(`خطأ في تشغيل Replicate: ${err.detail || JSON.stringify(err)}`);
    }

    const prediction = await startResponse.json();
    let predictionUrl = prediction.urls.get;
    let status = prediction.status;
    let finalOutputUrl = null;

    // 2. الانتظار (Polling) حتى تنتهي الصورة من الرسم
    const maxAttempts = 20; // الحد الأقصى للمحاولات (تقريباً 40 ثانية)
    let attempts = 0;

    while (status !== "succeeded" && status !== "failed" && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // انتظر ثانيتين
      
      const pollResponse = await fetch(predictionUrl, {
        headers: {
          Authorization: `Bearer ${replicateToken}`,
        }
      });
      
      const pollData = await pollResponse.json();
      status = pollData.status;
      
      if (status === "succeeded") {
        finalOutputUrl = pollData.output[0]; // الرابط الخاص بالصورة المولدة
      } else if (status === "failed") {
        throw new Error(`فشل Replicate في توليد الصورة: ${pollData.error}`);
      }
      
      attempts++;
    }

    if (!finalOutputUrl) {
      throw new Error("تأخر Replicate في الرد. انتهى وقت الانتظار.");
    }

    // 3. جلب الصورة من الرابط وتحويلها إلى Base64 لكي يستطيع التطبيق عرضها وحفظها
    console.log("Image generated, fetching output URL...", finalOutputUrl);
    const imageResponse = await fetch(finalOutputUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const generatedBase64 = Buffer.from(imageBuffer).toString('base64');
    const finalBase64Url = `data:image/jpeg;base64,${generatedBase64}`;

    return NextResponse.json({
      enhanced: true,
      reason: "تم رسم الصورة بالذكاء الاصطناعي التوليدي لتصبح نهارية ومشرقة.",
      base64Image: finalBase64Url,
      keyUsedLabel: replicateKeyInfo.label || "Replicate Img2Img",
    });

  } catch (error: any) {
    console.error("Generative AI Enhance Error:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ غير متوقع أثناء توليد الصورة." },
      { status: 500 }
    );
  }
}
