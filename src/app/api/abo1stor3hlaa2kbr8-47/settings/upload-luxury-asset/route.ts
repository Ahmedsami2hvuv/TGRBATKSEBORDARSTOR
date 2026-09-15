import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/upload-storage";
import sharp from "sharp";

export const dynamic = "force-dynamic";

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

    // تحويل الصورة فوراً إلى صيغة WEBP عالية الجودة مع شفافية
    sharp.cache(false);
    const webpBuffer = await sharp(buffer)
      .rotate()
      .webp({ quality: 92, effort: 4 })
      .toBuffer();

    const timestamp = Date.now();
    const sanitizedName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase();
    
    const key = `designer-assets/${category}/${timestamp}-${sanitizedName}.webp`;

    const uploadedKey = await uploadToR2(webpBuffer, key, "image/webp", true);

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
