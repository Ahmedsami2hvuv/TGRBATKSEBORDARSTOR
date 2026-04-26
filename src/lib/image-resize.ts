/**
 * تصغير صور الرفع على الخادم (محلات، إلخ) — JPEG بجودة معقولة.
 */
import sharp from "sharp";

const MAX_EDGE = 1024; // تقليل الأبعاد لتسريع التحميل وتقليل حجم قاعدة البيانات
const JPEG_QUALITY = 75; // جودة متوازنة جداً للويب

/** يعيد Buffer للصورة المصغرة - يدعم JPEG و PNG */
export async function resizeImageBufferForShop(input: Buffer, format: 'jpeg' | 'png' = 'jpeg'): Promise<Buffer> {
  const pipeline = sharp(input)
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });

  if (format === 'png') {
    return pipeline.png({ quality: 90, compressionLevel: 9 }).toBuffer();
  }

  return pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
}
