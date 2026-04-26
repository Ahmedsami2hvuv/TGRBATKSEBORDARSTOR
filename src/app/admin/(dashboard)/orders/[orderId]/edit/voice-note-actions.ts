"use server";

import { unlink } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { adminCookieName, verifyAdminToken } from "@/lib/auth";
import { getUploadsRoot } from "@/lib/upload-storage";
import { prisma } from "@/lib/prisma";
import { MAX_VOICE_NOTE_BYTES, saveVoiceNoteUploaded } from "@/lib/voice-note";

export type VoiceNoteActionState = { ok?: boolean; error?: string };

async function assertAdmin(): Promise<boolean> {
  const jar = await cookies();
  const t = jar.get(adminCookieName)?.value ?? "";
  return !!(t && (await verifyAdminToken(t)));
}

export async function deleteOrderVoiceNote(orderId: string): Promise<VoiceNoteActionState> {
  if (!(await assertAdmin())) {
    return { error: "غير مصرّح" };
  }
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { voiceNoteUrl: true },
  });
  if (!o) {
    return { error: "الطلب غير موجود" };
  }
  const url = o.voiceNoteUrl?.trim();
  if (!url) {
    return { ok: true };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { voiceNoteUrl: null },
  });

  if (url.startsWith("/uploads/")) {
    try {
      const rel = url.replace(/^\/uploads\/?/, "");
      await unlink(path.join(getUploadsRoot(), rel));
    } catch {
      /* ملف مفقود أو قرص للقراءة فقط */
    }
  }

  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/orders/pending");
  revalidatePath("/mandoub");
  revalidatePath(`/admin/orders/${orderId}/edit`);
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

async function unlinkUploadIfAny(url: string | null | undefined): Promise<void> {
  const u = url?.trim();
  if (!u || !u.startsWith("/uploads/")) return;
  try {
    const rel = u.replace(/^\/uploads\/?/, "");
    await unlink(path.join(getUploadsRoot(), rel));
  } catch {
    /* ملف مفقود */
  }
}

export async function uploadAdminVoiceNote(
  formData: FormData,
): Promise<VoiceNoteActionState> {
  if (!(await assertAdmin())) {
    return { error: "غير مصرّح" };
  }
  const orderId = String(formData.get("orderId") ?? "").trim();
  const file = formData.get("adminVoice");
  if (!orderId) {
    return { error: "معرّف الطلب مفقود" };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "اختر ملفاً صوتياً" };
  }

  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { adminVoiceNoteUrl: true },
  });
  if (!existing) {
    return { error: "الطلب غير موجود" };
  }

  let relUrl: string;
  try {
    relUrl = await saveVoiceNoteUploaded(file, MAX_VOICE_NOTE_BYTES);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "VOICE_TOO_LARGE") {
      return { error: "الملف الصوتي كبير جداً (الحد 2 ميجابايت)" };
    }
    if (code === "VOICE_BAD_TYPE") {
      return { error: "نوع الملف الصوتي غير مدعوم" };
    }
    if (code === "VOICE_STORAGE_FAILED") {
      return { error: "تعذّر حفظ الملف على الخادم" };
    }
    return { error: "تعذّر رفع الملاحظة الصوتية" };
  }

  await unlinkUploadIfAny(existing.adminVoiceNoteUrl);

  await prisma.order.update({
    where: { id: orderId },
    data: { adminVoiceNoteUrl: relUrl },
  });

  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/orders/pending");
  revalidatePath("/mandoub");
  revalidatePath(`/admin/orders/${orderId}/edit`);
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function deleteAdminVoiceNote(orderId: string): Promise<VoiceNoteActionState> {
  if (!(await assertAdmin())) {
    return { error: "غير مصرّح" };
  }
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { adminVoiceNoteUrl: true },
  });
  if (!o) {
    return { error: "الطلب غير موجود" };
  }
  const url = o.adminVoiceNoteUrl?.trim();
  if (!url) {
    return { ok: true };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { adminVoiceNoteUrl: null },
  });

  await unlinkUploadIfAny(url);

  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/orders/pending");
  revalidatePath("/mandoub");
  revalidatePath(`/admin/orders/${orderId}/edit`);
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}
