import { NextResponse } from "next/server";
import { getAllActiveGeminiKeys } from "@/lib/ai-image-enhancer";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // السماح للمسار بالعمل لمدة أطول بسبب تأخر توليد الصور

// نستخدم نموذج SDXL ControlNet Canny كما نصح Gemini للحفاظ على هندسة الأجسام بدقة متناهية
const REPLICATE_SDXL_VERSION = "db2ffdbdc7f6cb4d6dab512434679ee3366ae7ab84f89750f8947d5594b79a47";

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "لا توجد صورة مرسلة." }, { status: 400 });
    }

    // جلب مفتاح Replicate من الداتا بيس
    const configs = await getAllActiveGeminiKeys();
    const replicateKeyInfo = configs.find(
      (k) => k.provider === "replicate"
    );

    if (!replicateKeyInfo || !replicateKeyInfo.apiKey) {
      return NextResponse.json(
        { error: "لم يتم العثور على مفتاح Replicate مفعل في الإعدادات." },
        { status: 500 }
      );
    }

    const replicateToken = replicateKeyInfo.apiKey;

    // البرومبت الهندسي من توجيهات Gemini
    const prompt = "Hyper-realistic architectural photography. Transform scene illumination from night to bright, even, natural high-noon daylight. Maintain exact structural geometry of the building facade, concrete block textures, and the specific ornate copper/white gate design as defined by ControlNet input. Replace dark sky with clear pale blue daytime sky. Illuminate all elements (wheelie bins, truck portion, water tanks, gate) with realistic, hard-shadowless daylight. Preserve pixel-perfect position of all objects. Shot on a Canon EOS R5, 35mm lens.";
    
    // تجهيز الصورة Base64
    const formattedImage = imageBase64.startsWith('data:image') 
      ? imageBase64 
      : `data:image/jpeg;base64,${imageBase64}`;

    console.log("Starting Replicate Prediction (ControlNet Canny)...");
    
    const replicateResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${replicateToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: REPLICATE_SDXL_VERSION,
        input: {
          image: formattedImage,
          prompt: prompt,
          negative_prompt: "low quality, dark, night, artificial light, cartoon, painting, sketch, distorted perspective, blurry, overexposed, underexposed, wrong colors, extra objects, missing details",
          condition_scale: 0.85, // بناءً على توجيهات Gemini للحفاظ على الهيكل
          num_outputs: 1,
          scheduler: "K_EULER",
          num_inference_steps: 30,
        }
      }),
    });

    if (!replicateResponse.ok) {
      const err = await replicateResponse.json();
      throw new Error(`خطأ في تشغيل Replicate: ${err.detail || JSON.stringify(err)}`);
    }

    const prediction = await replicateResponse.json();
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
          "Authorization": `Token ${replicateToken}`,
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