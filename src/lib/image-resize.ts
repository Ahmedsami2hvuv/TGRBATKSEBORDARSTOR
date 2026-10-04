/**
 * تصغير صور الرفع على الخادم (محلات، إلخ) — JPEG بجودة معقولة.
 */
import sharp from "sharp";

const MAX_EDGE = 1024; // تقليل الأبعاد لتسريع التحميل وتقليل حجم قاعدة البيانات
const WEBP_QUALITY = 80; // جودة متوازنة جداً وفائقة النقاء للويب

/** يعيد Buffer للصورة المصغرة - يدعم WebP و PNG و JPEG */
export async function resizeImageBufferForShop(
  input: Buffer,
  format: 'jpeg' | 'png' | 'webp' = 'webp'
): Promise<Buffer> {
  const pipeline = sharp(input)
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });

  if (format === 'png') {
    return pipeline.webp({ quality: WEBP_QUALITY, effort: 4, alphaQuality: 85 }).toBuffer();
  }

  if (format === 'jpeg') {
    return pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
  }

  return pipeline.webp({ quality: WEBP_QUALITY, effort: 4, alphaQuality: 85 }).toBuffer();
}
