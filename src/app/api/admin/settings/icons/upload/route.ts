import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-session";
import { uploadToR2 } from "@/lib/upload-storage";

const MAX_ICON_BYTES = 5 * 1024 * 1024;

function normalizeExt(file: File): string {
  const type = file.type.toLowerCase();
  if (type === "image/gif") return "gif";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/svg+xml") return "svg";
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";

  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".gif")) return "gif";
  if (fileName.endsWith(".png")) return "png";
  if (fileName.endsWith(".webp")) return "webp";
  if (fileName.endsWith(".svg")) return "svg";
  return "jpg";
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const iconKeyRaw = formData.get("iconKey");
    const iconKey = typeof iconKeyRaw === "string" ? iconKeyRaw.trim() : "icon";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_ICON_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    const ext = normalizeExt(file);
    const safeKey = iconKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) || "icon";
    const key = `ui-icons/${safeKey}/${Date.now()}-${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadedKey = await uploadToR2(buffer, key, file.type || "image/jpeg");

    if (!uploadedKey) {
      return NextResponse.json({ error: "Upload to R2 failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      url: `/uploads/${uploadedKey}`,
      key: uploadedKey,
      contentType: file.type || "image/jpeg",
    });
  } catch (error) {
    console.error("Icon upload failed:", error);
    return NextResponse.json({ error: "Failed to upload icon" }, { status: 500 });
  }
}
