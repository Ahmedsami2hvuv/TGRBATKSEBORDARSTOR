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

    return samples.filter(c => c).length >= 6;
  } catch {
    return false;
  }
}

async function hasReasonableCutoutAlpha(buffer: Buffer): Promise<boolean> {
  try {
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    if (channels < 4) return false;

    let nonTransparent = 0;
    const total = info.width * info.height;
    for (let i = 0; i < data.length; i += channels) {
      const alpha = data[i + 3] ?? 255;
      if (alpha > 16) nonTransparent++;
    }

    const ratio = nonTransparent / Math.max(1, total);
    // Too tiny or almost full image means the fallback mask likely failed.
    return ratio >= 0.08 && ratio <= 0.92;
  } catch {
    return false;
  }
}

async function detectSolidBackgroundColor(buffer: Buffer): Promise<{ r: number; g: number; b: number } | null> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(80, 80, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const sample = (x: number, y: number) => {
      const idx = (y * info.width + x) * info.channels;
      return { r: data[idx] ?? 0, g: data[idx + 1] ?? 0, b: data[idx + 2] ?? 0 };
    };

    const pts = [
      sample(0, 0),
      sample(info.width - 1, 0),
      sample(0, info.height - 1),
      sample(info.width - 1, info.height - 1),
      sample(Math.floor(info.width / 2), 0),
      sample(Math.floor(info.width / 2), info.height - 1),
      sample(0, Math.floor(info.height / 2)),
      sample(info.width - 1, Math.floor(info.height / 2)),
    ];

    const avg = pts.reduce(
      (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
      { r: 0, g: 0, b: 0 },
    );
    const mean = { r: avg.r / pts.length, g: avg.g / pts.length, b: avg.b / pts.length };

    const dist = (p: { r: number; g: number; b: number }) => {
      const dr = p.r - mean.r;
      const dg = p.g - mean.g;
      const db = p.b - mean.b;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };

    const maxDist = Math.max(...pts.map(dist));
    // إذا زوايا الصورة متقاربة جداً → خلفية "لون واحد" غالباً.
    if (maxDist <= 22) {
      return { r: Math.round(mean.r), g: Math.round(mean.g), b: Math.round(mean.b) };
    }
    return null;
  } catch {
    return null;
  }
}

async function tryColorKeyBackgroundRemoval(buffer: Buffer): Promise<Buffer | null> {
  try {
    const bg = await detectSolidBackgroundColor(buffer);
    if (!bg) return null;

    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const ch = info.channels;
    if (ch < 4) return null;

    // Tolerance: أكبر شوي لأن بعض الخلفيات مو لون واحد 100%
    const tol = 55;
    const tol2 = tol * tol;

    const out = Buffer.from(data); // copy
    for (let i = 0; i < out.length; i += ch) {
      const r = out[i] ?? 0;
      const g = out[i + 1] ?? 0;
      const b = out[i + 2] ?? 0;
      const dr = r - bg.r;
      const dg = g - bg.g;
      const db = b - bg.b;
      const d2 = dr * dr + dg * dg + db * db;

      // قريب من لون الخلفية → شفافية
      if (d2 <= tol2) {
        out[i + 3] = 0;
      }
    }

    const candidate = await sharp(out, { raw: { width: info.width, height: info.height, channels: ch } })
      .png()
      .toBuffer();

    if (await hasReasonableCutoutAlpha(candidate)) return candidate;
    return null;
  } catch {
    return null;
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
    const sourceBeforeRemoval = buf;
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
          const mask = await sharp(buf)
            .removeAlpha()
            .grayscale()
            .blur(0.6)
            .threshold(245)
            .negate()
            .toBuffer();
          const candidate = await sharp(buf).ensureAlpha().joinChannel(mask).png().toBuffer();
          if (await hasReasonableCutoutAlpha(candidate)) {
            buf = candidate;
            mime = "image/png";
          } else {
            buf = sourceBeforeRemoval;
          }
        } catch (e) { console.error("Software eraser failed", e); }
      }

      // إذا الخلفية مو بيضاء بس "لون واحد" (مثل الأسود)، نجرب أداة مجانية ثانية
      if (buf === sourceBeforeRemoval) {
        const keyed = await tryColorKeyBackgroundRemoval(buf);
        if (keyed) {
          buf = keyed;
          mime = "image/png";
        }
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
