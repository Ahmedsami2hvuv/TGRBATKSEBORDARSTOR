"use server";

import { revalidatePath } from "next/cache";
import { assertAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export type PrepNoticeAdminState = { error?: string; ok?: boolean };

export async function createAdminPrepNotices(
  _prev: PrepNoticeAdminState,
  formData: FormData,
): Promise<PrepNoticeAdminState> {
  try {
    await assertAdminSession();
  } catch {
    return { error: "غير مصرّح." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const idsRaw = formData.getAll("preparerId");
  const preparerIds = idsRaw.map((x) => String(x).trim()).filter(Boolean);

  if (!title.length) {
    return { error: "العنوان مطلوب." };
  }
  if (title.length > 200) {
    return { error: "العنوان طويل جداً." };
  }
  if (body.length > 8000) {
    return { error: "النص طويل جداً." };
  }
  if (preparerIds.length === 0) {
    return { error: "اختر مجهزاً واحداً على الأقل." };
  }

  const preparers = await prisma.companyPreparer.findMany({
    where: { id: { in: preparerIds }, active: true },
    select: { id: true },
  });
  if (preparers.length !== preparerIds.length) {
    return { error: "أحد المجهزين غير صالح أو غير مفعّل." };
  }

  await prisma.$transaction(
    preparerIds.map((pid) =>
      prisma.companyPreparerPrepNotice.create({
        data: {
          title,
          body,
          preparerId: pid,
        },
      }),
    ),
  );

  revalidatePath("/admin/prep-notices");
  revalidatePath("/preparer");
  return { ok: true };
}
