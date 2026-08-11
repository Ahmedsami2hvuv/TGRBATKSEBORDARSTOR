import { NextResponse } from "next/server";
import { getAllActiveGeminiKeys } from "@/lib/ai-image-enhancer";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // السماح للمسار بالعمل لمدة أطول بسبب تأخر توليد الصور

// نستخدم نموذج SDXL ControlNet Canny كما نصح Gemini للحفاظ على هندسة الأجسام بدقة متناهية
const REPLICATE_SDXL_VERSION = "db2ffdbdc7f6cb4d6dab512434679ee3366ae7ab84f89750f8947d5594b79a47";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageBase64, predictionUrl } = body;

    if (!imageBase64 && !predictionUrl) {
      return NextResponse.json({ error: "لا توجد بيانات مرسلة." }, { status: 400 });
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

    // حالة 1: إذا كان الطلب هو استعلام عن حالة صورة قيد المعالجة (Polling)
    if (predictionUrl) {
      const pollResponse = await fetch(predictionUrl, {
        headers: {
          "Authorization": `Token ${replicateToken}`,
        }
      });
      
      if (!pollResponse.ok) {
        const err = await pollResponse.json();
        return NextResponse.json({ error: `خطأ في الاستعلام: ${err.detail || JSON.stringify(err)}` }, { status: 500 });
      }
      
      const pollData = await pollResponse.json();
      
      if (pollData.status === "succeeded") {
        let finalOutputUrl = "";
        if (Array.isArray(pollData.output)) {
           finalOutputUrl = pollData.output[0];
        } else if (typeof pollData.output === "string") {
           finalOutputUrl = pollData.output;
        } else {
           throw new Error("لا يوجد رابط صورة في النتيجة.");
        }
        
        // تحويل الصورة الناتجة إلى Base64
        const imageResponse = await fetch(finalOutputUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const generatedBase64 = Buffer.from(imageBuffer).toString('base64');
        const finalBase64Url = `data:image/jpeg;base64,${generatedBase64}`;
        
        return NextResponse.json({
          status: pollData.status,
          enhanced: true,
          reason: "تم رسم الصورة بالذكاء الاصطناعي التوليدي لتصبح نهارية ومشرقة.",
          base64Image: finalBase64Url,
          keyUsedLabel: replicateKeyInfo.label || "Replicate ControlNet",
        });
      } else if (pollData.status === "failed") {
         return NextResponse.json({ error: `فشل Replicate في توليد الصورة: ${pollData.error}` }, { status: 500 });
      }

      return NextResponse.json({
        status: pollData.status,
        predictionUrl: predictionUrl
      });
    }

    // حالة 2: بدء طلب جديد لمعالجة صورة
    // حالة 2: بدء طلب جديد لمعالجة صورة
    // البرومبت الهندسي الجديد الصارم جداً لنموذج Flux كما اقترح Gemini
    const prompt = "Hyper-realistic exterior architecture photography. Transform lighting from night to bright, natural, even daylight. PRESERVE PIXEL-PERFECT GEOMETRY. CRITICAL: Do not alter wall material (keep rough concrete block texture). CRITICAL: Do not change ornate gate design or color. CRITICAL: Do not change wheelie bin colors or order (Blue-Left, Orange-Middle, Blue-Right). Maintain exact position of truck portion. Replace dark sky with clear daytime sky. No new objects or textures to be generated. Zero tolerance for artistic reinterpretation.";
    
    const formattedImage = imageBase64.startsWith('data:image') 
      ? imageBase64 
      : `data:image/jpeg;base64,${imageBase64}`;

    console.log("Starting Replicate Prediction (Flux-Dev Img2Img)...");
    
    // استخدام Endpoint المباشر لنموذج Flux Dev
    const replicateResponse = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${replicateToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          image: formattedImage,
          prompt: prompt,
          prompt_strength: 0.25, // القيمة الحرجة التي نصح بها جمناي (0.25) لمنع الهلوسة نهائياً
          num_outputs: 1,
          output_format: "jpg",
          go_fast: true, // لتسريع المعالجة إذا كان مدعوماً
          megapixels: "1"
        }
      }),
    });

    if (!replicateResponse.ok) {
      const err = await replicateResponse.json();
      throw new Error(`خطأ في تشغيل Replicate (Flux): ${err.detail || JSON.stringify(err)}`);
    }

    const prediction = await replicateResponse.json();
    
    // إعادة الرابط والحالة للواجهة لتقوم هي بعملية الاستعلام
    return NextResponse.json({
      status: prediction.status,
      predictionUrl: prediction.urls.get
    });

  } catch (error: any) {
    console.error("Generative AI Enhance Error:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ غير متوقع أثناء توليد الصورة." },
      { status: 500 }
    );
  }
}