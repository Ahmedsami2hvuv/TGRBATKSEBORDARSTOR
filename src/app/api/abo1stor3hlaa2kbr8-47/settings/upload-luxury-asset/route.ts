import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/upload-storage";
import sharp from "sharp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "luxury-assets";

    if (!file || file.size <= 0) {
      return NextResponse.json({ error: "لم يتم استلام أي ملف صورة." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    sharp.cache(false);

    const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

    let webpBuffer: Buffer;
    let contentType = "image/webp";
    let fileExt = "webp";

    if (isSvg) {
      webpBuffer = buffer;
      contentType = "image/svg+xml";
      fileExt = "svg";
    } else {
      // هل الملف عبارة عن إطار أو خلفية؟
      const isFrameOrBg =
        category.toLowerCase().includes("frame") ||
        category.toLowerCase().includes("bg") ||
        file.name.toLowerCase().includes("frame") ||
        file.name.toLowerCase().includes("bg");

      let processedBuffer: Buffer | null = null;

      // محاولة أولى: معالجة الصورة وتحويلها لـ WEBP فائقة الجودة مع تصغير آمن إذا تجاوزت 2048px
      try {
        let pipeline = sharp(buffer)
          .rotate()
          .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true });

        // لا نقوم بقص الحواف تلقائياً للأطر والخلفيات حتى لا تشوه هوامش التصميم
        if (!isFrameOrBg) {
          try {
            pipeline = pipeline.trim();
          } catch (trimErr) {
            console.warn("Trim step skipped:", trimErr);
          }
        }

        processedBuffer = await pipeline.webp({ quality: 90, effort: 3 }).toBuffer();
      } catch (sharpErr) {
        console.warn("Sharp primary pipeline failed, attempting fallback without trim:", sharpErr);
        try {
          processedBuffer = await sharp(buffer)
            .rotate()
            .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 90, effort: 2 })
            .toBuffer();
        } catch (fallbackErr) {
          console.error("Sharp fallback also failed, using raw buffer:", fallbackErr);
          processedBuffer = buffer;
          contentType = file.type || "image/jpeg";
          fileExt = file.name.split(".").pop() || "jpg";
        }
      }

      webpBuffer = processedBuffer || buffer;
    }

    const timestamp = Date.now();
    const sanitizedName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase();

    const key = `designer-assets/${category}/${timestamp}-${sanitizedName}.${fileExt}`;

    const uploadedKey = await uploadToR2(webpBuffer, key, contentType, true);

    if (!uploadedKey) {
      return NextResponse.json(
        { error: "فشل في رفع الصورة إلى سيرفر التخزين السحابي." },
        { status: 500 }
      );
    }

    const publicUrl = `/uploads/${uploadedKey}`;

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      key: uploadedKey,
    });
  } catch (error: any) {
    console.error("Error processing luxury asset upload:", error);
    return NextResponse.json(
      { error: error?.message || "حدث خطأ غير متوقع أثناء معالجة الصورة." },
      { status: 500 }
    );
  }
}

