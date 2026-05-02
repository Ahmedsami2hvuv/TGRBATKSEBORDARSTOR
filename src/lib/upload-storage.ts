import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import sharp from "sharp";

const r2Client = (typeof process !== 'undefined' && process.env.R2_ACCESS_KEY_ID) ? new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
}) : null;

export async function uploadToR2(buffer: Buffer, key: string, contentType: string) {
  if (!r2Client) return null;
  
  let finalBuffer = buffer;
  let finalContentType = contentType;

  if (contentType.startsWith("image/") && !contentType.includes("gif")) {
    try {
      finalBuffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      finalContentType = "image/jpeg";
      if (!key.endsWith(".jpg") && !key.endsWith(".jpeg")) {
        key = key.replace(/\.[^/.]+$/, "") + ".jpg";
      }
    } catch (e) {
      console.warn("Failed to compress image:", e);
    }
  }

  try {
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: finalBuffer,
      ContentType: finalContentType,
    }));
    return key;
  } catch (error) {
    console.error("Error uploading to R2:", error);
    return null;
  }
}

export async function deleteFromR2(key: string | null | undefined) {
  if (!r2Client || !key) return;
  let actualKey = key;
  if (key.includes("http")) {
    try {
      const url = new URL(key);
      actualKey = decodeURIComponent(url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname);
    } catch (e) { return; }
  }
  try {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: actualKey,
    }));
  } catch (error) {
    console.error("Failed to delete from R2:", error);
  }
}

function extractR2Key(input: string): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  if (raw.startsWith("/uploads/")) {
    return raw.slice("/uploads/".length);
  }

  if (raw.includes("/uploads/")) {
    const idx = raw.indexOf("/uploads/");
    return raw.slice(idx + "/uploads/".length);
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      const pathname = decodeURIComponent(parsed.pathname || "");
      if (pathname.startsWith("/uploads/")) {
        return pathname.slice("/uploads/".length);
      }
      if (pathname.startsWith("/")) return pathname.slice(1);
      return pathname || null;
    } catch {
      return null;
    }
  }

  return raw.replace(/^\/+/, "");
}

export async function r2ObjectExistsByUrl(urlOrKey: string | null | undefined): Promise<boolean> {
  if (!r2Client || !urlOrKey) return false;
  const key = extractR2Key(String(urlOrKey));
  if (!key) return false;

  try {
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

// إعادة الدوال اللازمة للنظام القديم والطلبات لضمان عمل الـ Build
export function getUploadsRoot(): string {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads");
}

export function uploadsAbsoluteDir(...segments: string[]): string {
  return path.join(getUploadsRoot(), ...segments);
}
