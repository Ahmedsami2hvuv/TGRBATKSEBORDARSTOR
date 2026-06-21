"use server";

import { deleteFromR2, getR2ObjectBuffer, uploadToR2 } from "@/lib/upload-storage";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

/**
 * يقوم بتحميل الصورة من R2 وضغطها بنسبة 96% ثم إعادة رفعها بنفس المفتاح لتحديث الحجم دون تخريب الروابط.
 */
export async function compressR2ImageAction(key: string) {
  try {
    const buffer = await getR2ObjectBuffer(key);
    if (!buffer) {
      return { ok: false, error: "تعذر قراءة الصورة من R2" };
    }

    // تقليص أبعاد الصورة لـ 1200 بكسل كحد أقصى للضلع وضغط الجودة
    const pipeline = sharp(buffer)
      .rotate() // الحفاظ على اتجاه الصورة الصحيح
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      });

    let contentType = "image/jpeg";
    let compressedBuffer: Buffer;
    
    if (key.toLowerCase().endsWith(".png")) {
      compressedBuffer = await pipeline.png({ palette: true, compressionLevel: 6 }).toBuffer();
      contentType = "image/png";
    } else if (key.toLowerCase().endsWith(".webp")) {
      compressedBuffer = await pipeline.webp({ quality: 75 }).toBuffer();
      contentType = "image/webp";
    } else {
      compressedBuffer = await pipeline.jpeg({ quality: 75 }).toBuffer();
      contentType = "image/jpeg";
    }

    const uploadedKey = await uploadToR2(compressedBuffer, key, contentType, true);
    if (!uploadedKey) {
      return { ok: false, error: "تعذر إعادة رفع الصورة المصغرة" };
    }

    return { ok: true };
  } catch (e: any) {
    console.error("Image compression failed:", e);
    return { ok: false, error: `فشل تقليص الصورة: ${e.message || e}` };
  }
}

/**
 * حذف الصورة بالكامل من R2
 */
export async function deleteR2ImageAction(key: string) {
  try {
    await deleteFromR2(key);
    revalidatePath(`${SECRET_ADMIN_PATH}/large-images`);
    return { ok: true };
  } catch (e: any) {
    console.error("Failed to delete object from R2:", e);
    return { ok: false, error: "فشل حذف الصورة من R2" };
  }
}
