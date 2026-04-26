import { resizeImageBufferForShop } from "@/lib/image-resize";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { randomUUID } from "crypto";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_ORDER_IMAGE_BYTES = 20 * 1024 * 1024;

export function inferImageMime(file: File): string | null {
  const t = file.type?.trim().toLowerCase();
  if (t && IMAGE_TYPES.has(t)) return t;
  const n = file.name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

async function isLikelyWhiteBackground(buffer: Buffer): Promise<boolean> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(100, 100, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const checkPixel = (x: number, y: number) => {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      return r > 230 && g > 230 && b > 230;
    };

    const samples = [
      checkPixel(0, 0), checkPixel(info.width - 1, 0),
      checkPixel(0, info.height - 1), checkPixel(info.width - 1, info.height - 1),
      checkPixel(Math.floor(info.width / 2), 0),
      checkPixel(Math.floor(info.width / 2), info.height - 1),
      checkPixel(0, Math.floor(info.height / 2)),
      checkPixel(info.width - 1, Math.floor(info.height / 2))
    ];

    return samples.filter(c => c).length >= 5;
  } catch {
    return false;
  }
}

async function processAndUploadImage(
  file: File | Buffer,
  folder: string,
  options?: { removeBg?: boolean, mime?: string }
): Promise<string> {
  let buf: Buffer;
  let mime: string;

  if (file instanceof File) {
    if (file.size > MAX_ORDER_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
    mime = inferImageMime(file) || "image/jpeg";
    buf = Buffer.from(await file.arrayBuffer());
  } else {
    buf = file;
    mime = options?.mime || "image/jpeg";
  }

  // 1. تصغير ومعالجة الصورة
  try {
    const resized = await resizeImageBufferForShop(buf, options?.removeBg ? 'png' : 'jpeg');
    if (resized) buf = resized as Buffer;
  } catch (e) {
    console.error("Image resize failed", e);
  }

  if (options?.removeBg) {
    let successWithAI = false;
    try {
      const aiConfigs = await prisma.aIConfig.findMany({
        where: { provider: "removebg", isActive: true },
        orderBy: { createdAt: "asc" }
      });

      for (const config of aiConfigs) {
        if (successWithAI) break;
        if (config.usedToday >= 50) continue;

        try {
          const formData = new FormData();
          formData.append("image_file", new Blob([buf], { type: "image/png" }), "image.png");
          const response = await fetch("https://api.remove.bg/v1.0/removebg", {
            method: "POST",
            headers: { "X-Api-Key": config.apiKey },
            body: formData
          });

          if (response.ok) {
            buf = Buffer.from(await response.arrayBuffer());
            successWithAI = true;
            await prisma.aIConfig.update({ where: { id: config.id }, data: { usedToday: { increment: 1 } } });
          }
        } catch (err) { console.error("AI removal failed", err); }
      }
    } catch (err) { console.error("AI step failed", err); }

    if (!successWithAI) {
      if (await isLikelyWhiteBackground(buf)) {
        try {
          const mask = await sharp(buf).grayscale().threshold(240).negate().toBuffer();
          buf = await sharp(buf).ensureAlpha().joinChannel(mask).png().toBuffer();
          mime = "image/png";
        } catch (e) { console.error("Software eraser failed", e); }
      }
    } else {
      mime = "image/png";
    }
  }

  // 2. الرفع إلى Cloudflare R2
  const fileName = `${randomUUID()}.${mime.split("/")[1]}`;
  const key = `${folder}/${fileName}`;

  const uploadedKey = await uploadToR2(buf, key, mime);

  if (uploadedKey) {
    // إرجاع مسار نسبي لكي تتعامل معه صفحة عرض الصور
    return `/uploads/${uploadedKey}`;
  }

  // Fallback: إذا فشل R2، نعود للـ Base64 لكي لا يتوقف العمل (مؤقتاً)
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function saveOrderImageUploaded(file: File, _mb: number) { return processAndUploadImage(file, "orders"); }
export async function saveCustomerDoorPhotoUploaded(file: File, _mb: number) { return processAndUploadImage(file, "customers"); }
export async function saveShopDoorPhotoUploaded(file: File, _mb: number) { return processAndUploadImage(file, "shops"); }
export async function saveCustomerProfilePhotoUploaded(file: File, _mb: number) { return processAndUploadImage(file, "profiles"); }
export async function saveStoreCategoryImageUploaded(file: File, _mb: number) { return processAndUploadImage(file, "categories", { removeBg: false }); }
export async function saveStoreProductImageUploaded(file: File, _mb: number, options?: { removeBg?: boolean }) {
  return processAndUploadImage(file, "products", { removeBg: options?.removeBg ?? true });
}
export async function saveStoreBranchImageUploaded(file: File, _mb: number) { return processAndUploadImage(file, "branches", { removeBg: false }); }
export async function saveOrderImageFromResizedBuffer(buf: Buffer, _mb: number) { return processAndUploadImage(buf, "orders"); }
export async function saveCustomerDoorPhotoFromResizedBuffer(buf: Buffer, _mb: number) { return processAndUploadImage(buf, "customers"); }
export async function saveShopDoorPhotoFromResizedBuffer(buf: Buffer, _mb: number) { return processAndUploadImage(buf, "shops"); }
export async function saveShopPhotoUploaded(file: File, mb: number) { return saveShopDoorPhotoUploaded(file, mb); }
export async function saveShopPhotoFromResizedBuffer(buf: Buffer, mb: number) { return saveShopDoorPhotoFromResizedBuffer(buf, mb); }
