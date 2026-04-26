import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { uploadsAbsoluteDir } from "@/lib/upload-storage";

/** ~10 ثوانٍ بصيغة مضغوطة تكفي عادةً؛ حد أعلى آمن للرفع */
export const MAX_VOICE_NOTE_BYTES = 2 * 1024 * 1024;

/** عند فشل الكتابة على القرص (مثلاً نظام ملفات للقراءة فقط) نخزّن كاملاً كـ data URL حتى يعمل التشغيل */
const MAX_DATA_FALLBACK = MAX_VOICE_NOTE_BYTES;

/** قبول أنواع شائعة من المتصفح (webm، m4a، …) */
export function inferVoiceMime(file: File): string | null {
  const raw = file.type?.trim().toLowerCase() || "";
  const t = raw.split(";")[0]?.trim() || "";
  const n = file.name.toLowerCase();

  if (t === "audio/webm" || t === "video/webm") return "audio/webm";
  if (t.startsWith("audio/ogg")) return "audio/ogg";
  if (t === "audio/mp4" || t === "audio/x-m4a" || t === "audio/m4a") return "audio/mp4";
  if (t === "audio/mpeg" || t === "audio/mp3") return "audio/mpeg";
  if (t === "audio/wav" || t === "audio/x-wav") return "audio/wav";

  if (n.endsWith(".webm")) return "audio/webm";
  if (n.endsWith(".ogg") || n.endsWith(".oga")) return "audio/ogg";
  if (n.endsWith(".m4a") || n.endsWith(".mp4")) return "audio/mp4";
  if (n.endsWith(".mp3")) return "audio/mpeg";
  if (n.endsWith(".wav")) return "audio/wav";

  return null;
}

function extForMime(mime: string): string {
  if (mime === "audio/webm") return "webm";
  if (mime === "audio/ogg") return "ogg";
  if (mime === "audio/mp4") return "m4a";
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "audio/wav") return "wav";
  return "webm";
}

export async function saveVoiceNoteUploaded(
  file: File,
  maxBytes: number,
): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error("VOICE_TOO_LARGE");
  }
  const mime = inferVoiceMime(file);
  if (!mime) {
    throw new Error("VOICE_BAD_TYPE");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = extForMime(mime);
  const name = `${randomUUID()}.${ext}`;
  const rel = `/uploads/voice-notes/${name}`;

  // حل سريع ودائم ضد "Not found": نخزن البصمة الصوتية داخل قاعدة البيانات (كـ data URL).
  // هذا يتفادى أي مشاكل عدم ثبات مجلد uploads على Railway بدون Volume.
  if (buf.length <= MAX_DATA_FALLBACK) {
    return `data:${mime};base64,${buf.toString("base64")}`;
  }

  // احتياط: نظرياً لن يحدث لأن `maxBytes` مُساوٍ لـ MAX_VOICE_NOTE_BYTES.
  // إذا حدث، نحاول fallback إلى رفع ملف (قد يفشل على Railway بدون Volume).
  try {
    const absDir = uploadsAbsoluteDir("voice-notes");
    const absFile = path.join(absDir, name);
    await mkdir(absDir, { recursive: true });
    await writeFile(absFile, buf);
    return rel;
  } catch {
    throw new Error("VOICE_STORAGE_FAILED");
  }
}
