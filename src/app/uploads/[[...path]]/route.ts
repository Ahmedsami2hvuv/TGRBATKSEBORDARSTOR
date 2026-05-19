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
    const folders = ["customers", "profiles", "orders", "customer-photos", "door-photos"];
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

    let response: any = null;
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");

    for (const candidate of candidateKeys) {
      try {
        response = await r2Client.send(
          new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: candidate,
          }),
        );
        if (response?.Body) break;
      } catch {
        response = null;
      }
    }

    if (!response?.Body) {
      return new NextResponse("File Empty", { status: 404 });
    }

    const byteArray = await response.Body.transformToByteArray();

    let contentType = response.ContentType;
    if (!contentType || contentType === "application/octet-stream") {
      const lowerCandidate = candidateKeys[0]?.toLowerCase() || "";
      if (lowerCandidate.endsWith(".jpg") || lowerCandidate.endsWith(".jpeg")) contentType = "image/jpeg";
      else if (lowerCandidate.endsWith(".png")) contentType = "image/png";
      else if (lowerCandidate.endsWith(".webp")) contentType = "image/webp";
      else if (lowerCandidate.endsWith(".mp3")) contentType = "audio/mpeg";
      else contentType = "image/jpeg";
    }

    return new NextResponse(byteArray, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error fetching from R2:", error);
    return new NextResponse("Image Not Found", { status: 404 });
  }
}
