import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/upload-storage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = (formData.get("file") || formData.get("image")) as File | null;
    const folder = (formData.get("folder") as string) || "shop-store";

    if (!file) {
      return NextResponse.json({ success: false, error: "لم يتم اختيار أي صورة" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const originalBuffer = Buffer.from(bytes);

    // تطبيق كود التحويل لصيغة WebP والضغط فائق الخفة بنسبة 90% للحفاظ على مساحة كلاود فلير آر تو
    let finalBuffer = originalBuffer;
    let contentType = "image/webp";
    const filename = `shop_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
    const r2Key = `${folder}/${filename}`;

    try {
      const sharp = (await import("sharp")).default;
      sharp.cache(false);

      // ضغط الصورة بنسبة 90% وتحويلها لصيغة WebP الحديثة مع الحفاظ على وضوح التفاصيل
      finalBuffer = await sharp(originalBuffer)
        .rotate()
        .resize({
          width: 900,
          height: 900,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: 65, // ضغط عالي جداً وخفيف ويوفر أكثر من 90% من مساحة التخزين
          effort: 5,
        })
        .toBuffer();

      contentType = "image/webp";

      console.log(
        `[Shop Store R2 Compress 90%] Original: ${(originalBuffer.length / 1024).toFixed(1)}KB -> WebP: ${(finalBuffer.length / 1024).toFixed(1)}KB (Saved ${((1 - finalBuffer.length / originalBuffer.length) * 100).toFixed(1)}%)`
      );
    } catch (sharpErr) {
      console.error("[Shop Store R2 Compress] Sharp failed, using fallback:", sharpErr);
    }

    // الرفع إلى كلاود فلير آر تو Cloudflare R2
    const keyResult = await uploadToR2(finalBuffer, r2Key, contentType, true);

    if (!keyResult) {
      return NextResponse.json({ success: false, error: "فشل الحفظ في خادم الصور Cloudflare R2" }, { status: 500 });
    }

    const publicUrl = `/uploads/${r2Key}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      key: r2Key,
      savedPercent: ((1 - finalBuffer.length / originalBuffer.length) * 100).toFixed(1),
      sizeKb: (finalBuffer.length / 1024).toFixed(1),
    });
  } catch (error: any) {
    console.error("[Shop Store Upload API] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "حدث خطأ أثناء رفع الصورة" }, { status: 500 });
  }
}
