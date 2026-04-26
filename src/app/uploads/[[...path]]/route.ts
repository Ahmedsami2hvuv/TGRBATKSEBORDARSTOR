import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getUploadsRoot } from "@/lib/upload-storage";

export const runtime = "nodejs";

function contentTypeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".svg": "image/svg+xml",
  };
  return map[ext] ?? "application/octet-stream";
}

/**
 * يخدم ملفات `/uploads/...` من `UPLOAD_DIR` أو `public/uploads`.
 * ضروري عند ربط وحدة تخزين خارج مجلد `public`.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path: segments } = await context.params;
  if (!segments?.length) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const root = path.resolve(/* turbopackIgnore: true */ getUploadsRoot());
  const full = path.resolve(/* turbopackIgnore: true */ root, ...segments);
  const relative = path.relative(root, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const st = await stat(full);
    if (!st.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }
    const ct = contentTypeForFile(full);
    const range = req.headers.get("range");
    const size = st.size;

    if (range && /^bytes=\d*-\d*$/.test(range)) {
      const raw = range.replace("bytes=", "");
      const [startRaw, endRaw] = raw.split("-");
      let start = startRaw ? Number.parseInt(startRaw, 10) : 0;
      let end = endRaw ? Number.parseInt(endRaw, 10) : size - 1;
      if (!Number.isFinite(start) || start < 0) start = 0;
      if (!Number.isFinite(end) || end < start || end >= size) end = size - 1;
      const chunkLen = end - start + 1;
      const stream = createReadStream(full, { start, end });
      return new NextResponse(stream as any, {
        status: 206,
        headers: {
          "Content-Type": ct,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(chunkLen),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const stream = createReadStream(full);
    return new NextResponse(stream as any, {
      headers: {
        "Content-Type": ct,
        "Accept-Ranges": "bytes",
        "Content-Length": String(size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

export async function HEAD(
  _req: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path: segments } = await context.params;
  if (!segments?.length) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const root = path.resolve(/* turbopackIgnore: true */ getUploadsRoot());
  const full = path.resolve(/* turbopackIgnore: true */ root, ...segments);
  const relative = path.relative(root, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const st = await stat(full);
    if (!st.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }

    const ct = contentTypeForFile(full);
    const size = st.size;

    return new NextResponse(null, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Accept-Ranges": "bytes",
        "Content-Length": String(size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
