import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/upload-storage";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = (formData.get("file") || formData.get("image")) as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "لم يتم اختيار أي صورة" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const originalBuffer = Buffer.from(bytes);

    // تطبيق كود تقليل الحجم والتحويل لصيغة WebP الفائقة الخفة
    let finalBuffer = originalBuffer;
    let contentType = "image/webp";
    const filename = `market_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
    const r2Key = `market/${filename}`;

    try {
      const sharp = (await import("sharp")).default;
      sharp.cache(false);

      // تقليل الأبعاد والجودة والتحويل إلى صيغة WebP للحصول على حجم كيلوبايتات ضئيل جداً وسرعة خيالية
      finalBuffer = await sharp(originalBuffer)
        .rotate()
        .resize({
          width: 900,
          height: 900,
          fit: "inside",
          withoutEnlargement: true
        })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();

      contentType = "image/webp";

      console.log(
        `[High Compression WebP R2] Original: ${(originalBuffer.length / 1024 / 1024).toFixed(2)}MB (${(originalBuffer.length / 1024).toFixed(1)}KB) -> Compressed WebP: ${(finalBuffer.length / 1024).toFixed(1)}KB (Saved ${((1 - finalBuffer.length / originalBuffer.length) * 100).toFixed(1)}%)`
      );
    } catch (sharpErr) {
      console.error("Sharp compression failed in upload route:", sharpErr);
    }

    // الرفع المباشر إلى Cloudflare R2
    const keyResult = await uploadToR2(finalBuffer, r2Key, contentType, true);

    if (!keyResult) {
      return NextResponse.json({ success: false, error: "فشل الحفظ في خادم الصور Cloudflare R2" }, { status: 500 });
    }

    // استخدام مسار /uploads الداخلي المضمون لتقديم صور R2
    const publicUrl = `/uploads/${r2Key}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      key: r2Key,
      compressedSizeKb: (finalBuffer.length / 1024).toFixed(1)
    });
  } catch (error: any) {
    console.error("Upload Route error:", error);
    return NextResponse.json({ success: false, error: error.message || "حدث خطأ أثناء رفع الصورة" }, { status: 500 });
  }
}
