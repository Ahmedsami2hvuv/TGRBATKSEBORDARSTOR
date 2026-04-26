import { resizeImageBufferForShop } from "@/lib/image-resize";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_ORDER_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_BASE64_STORAGE_BYTES = 5 * 1024 * 1024;

export function inferImageMime(file: File): string | null {
  const t = file.type?.trim().toLowerCase();
  if (t && IMAGE_TYPES.has(t)) return t;
  const n = file.name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

// دالة تفحص إذا كانت الخلفية بيضاء أو فاتحة جداً لتوفير رصيد الـ AI أو كحل بديل
async function isLikelyWhiteBackground(buffer: Buffer): Promise<boolean> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(100, 100, { fit: 'fill' }) // زيادة الدقة للفحص
      .raw()
      .toBuffer({ resolveWithObject: true });

    const checkPixel = (x: number, y: number) => {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // قبول الألوان حتى 230 (رمادي فاتح/أبيض باهت) بدلاً من 240
      return r > 230 && g > 230 && b > 230;
    };

    // فحص عينات من الحواف الأربعة (ليس فقط الزوايا)
    const samples = [
      checkPixel(0, 0), checkPixel(info.width - 1, 0),
      checkPixel(0, info.height - 1), checkPixel(info.width - 1, info.height - 1),
      checkPixel(Math.floor(info.width / 2), 0),
      checkPixel(Math.floor(info.width / 2), info.height - 1),
      checkPixel(0, Math.floor(info.height / 2)),
      checkPixel(info.width - 1, Math.floor(info.height / 2))
    ];

    // إذا كانت أغلب العينات فاتحة، نعتبرها خلفية تحتاج إزالة
    return samples.filter(c => c).length >= 5;
  } catch {
    return false;
  }
}

async function processImageToBase64(file: File, options?: { removeBg?: boolean }): Promise<string> {
  if (file.size > MAX_ORDER_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
  const mime = inferImageMime(file);
  if (!mime) throw new Error("IMAGE_BAD_TYPE");

  const arrayBuffer = await file.arrayBuffer();
  let buf: Buffer = Buffer.from(arrayBuffer);

  // 1. تصغير الصورة أولاً
  try {
    // إذا كان هناك طلب لإزالة الخلفية، نستخدم PNG للحفاظ على الشفافية لاحقاً
    const resized = await resizeImageBufferForShop(buf, options?.removeBg ? 'png' : 'jpeg');
    if (resized) buf = resized as Buffer;
  } catch (e) {
    console.error("Image resize failed", e);
  }

  if (options?.removeBg) {
    let successWithAI = false;

    // 2. محاولة استخدام AI (Remove.bg) أولاً
    try {
      const aiConfigs = await prisma.aIConfig.findMany({
        where: { provider: "removebg", isActive: true },
        orderBy: { createdAt: "asc" }
      });

      if (aiConfigs.length > 0) {
        for (const config of aiConfigs) {
          if (successWithAI) break;
          if (config.usedToday >= 50) continue;

          try {
            const formData = new FormData();
            formData.append("image_file", new Blob([buf], { type: "image/png" }), "image.png");
            formData.append("size", "auto");

            const response = await fetch("https://api.remove.bg/v1.0/removebg", {
              method: "POST",
              headers: { "X-Api-Key": config.apiKey },
              body: formData
            });

            if (response.ok) {
              const resBuf = await response.arrayBuffer();
              buf = Buffer.from(resBuf);
              successWithAI = true;
              await prisma.aIConfig.update({
                where: { id: config.id },
                data: { usedToday: { increment: 1 } }
              });
              console.log("AI background removal successful.");
            } else {
              const errTxt = await response.text();
              console.warn(`AI removal API returned error ${response.status}:`, errTxt);
            }
          } catch (err) {
            console.error("AI removal request failed", err);
          }
        }
      }
    } catch (err) {
      console.error("Smart BG processing AI step failed", err);
    }

    // 3. الممحاة البرمجية (Fallback): تعمل فقط إذا فشل الـ AI وكان هناك خلفية بيضاء/فاتحة
    if (!successWithAI) {
      const isWhite = await isLikelyWhiteBackground(buf);
      if (isWhite) {
        try {
          // ننشئ القناع بشكل منفصل مع عتبة أكثر مرونة
          const mask = await sharp(buf)
            .grayscale()
            .threshold(240) // تم تقليل العتبة من 250 إلى 240 لتشمل الرمادي الفاتح
            .negate()
            .toBuffer();

          buf = await sharp(buf)
            .ensureAlpha()
            .joinChannel(mask)
            .png({ quality: 90 })
            .toBuffer();

          console.log("Software eraser applied as fallback (Improved).");
        } catch (e) {
          console.error("Software eraser failed", e);
        }
      }
    }
  }

  const finalMime = options?.removeBg ? "image/png" : "image/jpeg";
  if (buf.length > MAX_BASE64_STORAGE_BYTES) throw new Error("IMAGE_TOO_LARGE_AFTER_RESIZE");
  return `data:${finalMime};base64,${buf.toString("base64")}`;
}

export async function saveOrderImageUploaded(file: File, _maxBytes: number) { return processImageToBase64(file); }
export async function saveCustomerDoorPhotoUploaded(file: File, _maxBytes: number) { return processImageToBase64(file); }
export async function saveShopDoorPhotoUploaded(file: File, _maxBytes: number) { return processImageToBase64(file); }
export async function saveCustomerProfilePhotoUploaded(file: File, _maxBytes: number) { return processImageToBase64(file); }
export async function saveStoreCategoryImageUploaded(file: File, _maxBytes: number) { return processImageToBase64(file, { removeBg: false }); }
export async function saveStoreProductImageUploaded(file: File, _maxBytes: number, options?: { removeBg?: boolean }) {
  return processImageToBase64(file, { removeBg: options?.removeBg ?? true });
}
export async function saveStoreBranchImageUploaded(file: File, _maxBytes: number) { return processImageToBase64(file, { removeBg: false }); }
export async function saveOrderImageFromResizedBuffer(jpegBuffer: Buffer, _maxBytes: number) { return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`; }
export async function saveCustomerDoorPhotoFromResizedBuffer(jpegBuffer: Buffer, _maxBytes: number) { return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`; }
export async function saveShopDoorPhotoFromResizedBuffer(jpegBuffer: Buffer, _maxBytes: number) { return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`; }
export async function saveShopPhotoUploaded(file: File, maxBytes: number) { return saveShopDoorPhotoUploaded(file, maxBytes); }
export async function saveShopPhotoFromResizedBuffer(jpegBuffer: Buffer, maxBytes: number) { return saveShopDoorPhotoFromResizedBuffer(jpegBuffer, maxBytes); }
