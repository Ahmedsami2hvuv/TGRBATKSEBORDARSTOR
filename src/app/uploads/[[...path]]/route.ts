import { NextRequest, NextResponse } from "next/server";

// نستخدم الاستيراد الديناميكي لتجنب مشاكل Turbopack أثناء الـ Build
async function getS3Client() {
  if (typeof window !== 'undefined') return null;
  const { S3Client } = await import("@aws-sdk/client-s3");

  if (process.env.R2_ACCESS_KEY_ID && process.env.R2_ENDPOINT) {
    return new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ضمان عدم محاولة معالجة المسار أثناء البناء

function normalizeIncomingKey(originalKey: string): string {
  let key = (originalKey || "").trim().replace(/^\/+/, "");
  if (!key) return "";

  try {
    key = decodeURIComponent(key);
  } catch {
    // ignore invalid encoding
  }

  const lowered = key.toLowerCase();
  const uploadsAt = lowered.indexOf("/uploads/");
  if (uploadsAt >= 0) {
    key = key.slice(uploadsAt + "/uploads/".length);
  } else if (lowered.startsWith("uploads/")) {
    key = key.slice("uploads/".length);
  }

  return key.replace(/^\/+/, "");
}

function buildCandidateKeys(originalKey: string): string[] {
  const key = normalizeIncomingKey(originalKey);
  if (!key) return [];

  const out = new Set<string>([key]);
  const lower = key.toLowerCase();

  const extMap: Record<string, string[]> = {
    ".jpeg": [".jpg", ".png", ".webp"],
    ".jpg": [".jpeg", ".png", ".webp"],
    ".png": [".jpg", ".jpeg", ".webp"],
    ".webp": [".jpg", ".jpeg", ".png"],
  };

  const matchedExt = Object.keys(extMap).find((ext) => lower.endsWith(ext));
  if (matchedExt) {
    const base = key.slice(0, key.length - matchedExt.length);
    for (const alt of extMap[matchedExt]) {
      out.add(`${base}${alt}`);
    }
  }

  const slash = key.lastIndexOf("/");
  const fileName = slash >= 0 ? key.slice(slash + 1) : key;
  if (fileName) {
    const folders = ["market", "customers", "profiles", "orders", "customer-photos", "door-photos"];
    for (const folder of folders) {
      out.add(`${folder}/${fileName}`);
    }
  }

  return [...out];
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path: segments } = await context.params;
    const r2Client = await getS3Client();

    if (!segments?.length || !r2Client) {
      console.error("R2 Config Missing or Path Empty");
      return new NextResponse("Not found", { status: 404 });
    }

    const key = segments.join("/");
    const candidateKeys = buildCandidateKeys(key);

    let foundCandidate: string | null = null;
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");

    for (const candidate of candidateKeys) {
      try {
        await r2Client.send(
          new HeadObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: candidate,
          }),
        );
        foundCandidate = candidate;
        break;
      } catch {
        // continue to next candidate
      }
    }

    if (!foundCandidate) {
      return new NextResponse("File Not Found", { status: 404 });
    }

    // جلب الملف مباشرة من R2 كـ Buffer وإرجاعه للمتصفح لتفادي مشاكل الـ 401 مع الروابط العامة لـ R2
    try {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const res = await r2Client.send(new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: foundCandidate,
      }));

      if (!res.Body) {
        return new NextResponse("File Empty", { status: 404 });
      }

      const fileBytes = await res.Body.transformToByteArray();
      const fileBuffer = Buffer.from(fileBytes);
      const contentType = res.ContentType || "image/jpeg";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (s3Err) {
      console.error("Failed to stream file from R2 directly, trying fallback redirect:", s3Err);
      const r2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_BUCKET_DOMAIN || "https://pub-2f7b4947937d4575971a8f949826a575.r2.dev";
      const cleanDomain = r2Domain.replace(/\/$/, "");
      return NextResponse.redirect(`${cleanDomain}/${foundCandidate}`, 307);
    }
  } catch (error) {
    console.error("Error fetching or redirecting file from R2:", error);
    return new NextResponse("Image Not Found", { status: 404 });
  }
}
