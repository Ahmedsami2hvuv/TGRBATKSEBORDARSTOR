import { NextResponse } from "next/server";
import { getAllActiveGeminiKeys } from "@/lib/ai-image-enhancer";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // السماح للمسار بالعمل لمدة أطول بسبب تأخر توليد الصور

// نعود للنموذج الرسمي SDXL img2img لأنه الأكثر استقراراً ومجاني
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
      (k) => k.provider === "replicate"
    );

    if (!replicateKeyInfo || !replicateKeyInfo.apiKey) {
      return NextResponse.json(
        { error: "لم يتم العثور على مفتاح Replicate مفعل في الإعدادات." },
        { status: 500 }
      );
    }

    const replicateToken = replicateKeyInfo.apiKey;

    // 1. بدء عملية الرسم التوليدي (Prediction)
    // البرومبت العام المأخوذ من النصيحة
    const prompt = "Hyper-realistic daylight exterior architecture photography, the same exact scene as the reference image, transformed into bright, clear, natural noon daylight. The dark sky is replaced by a clear, pale blue daytime sky with soft, scattered clouds. The walls and facade textures are illuminated by even, diffuse sunlight, rendering accurate colors and textures. The entire scene has sharp details, deep depth of field, and realistic shadows consistent with high-noon sun. Shot on a Canon EOS R5, 35mm lens.";
    
    // تجهيز الصورة Base64
    const formattedImage = imageBase64.startsWith('data:image') 
      ? imageBase64 
      : `data:image/jpeg;base64,${imageBase64}`;

    console.log("Starting Replicate Prediction...");
    
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
          prompt_strength: 0.60,
          num_outputs: 1,
          scheduler: "K_EULER",
          num_inference_steps: 30,
          guidance_scale: 7.5
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