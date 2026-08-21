"use server";

import { revalidatePath } from "next/cache";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { prisma } from "@/lib/prisma";

export async function updateCourierSetting(
  auth: { c: string; exp: string; s: string },
  settingName: "showLocationBtn" | "showDoorBtn" | "showCallBtn" | "showWhatsAppBtn" | "showMoneyBoxes" | "showNotesBtn" | "showVoiceNotesBtn" | "rotate180Photos",
  value: boolean
) {
  const v = verifyDelegatePortalQuery(auth.c, auth.exp || undefined, auth.s);
  if (!v.ok) {
    return { ok: false, error: "الرابط غير صالح." };
  }

  const courier = await prisma.courier.findUnique({ where: { id: v.courierId } });
  if (!courier || courier.blocked) {
    return { ok: false, error: "المندوب غير موجود أو تم حظره." };
  }

  const allowedSettings = [
    "showLocationBtn",
    "useFloatingMap",
    "showDoorBtn",
    "showCallBtn",
    "showWhatsAppBtn",
    "showMoneyBoxes",
    "showNotesBtn",
    "showVoiceNotesBtn",
    "rotate180Photos",
  ];

  if (!allowedSettings.includes(settingName)) {
    return { ok: false, error: "خيارات غير صالحة." };
  }

  await prisma.courier.update({
    where: { id: courier.id },
    data: {
      [settingName]: value,
    },
  });

  revalidatePath("/mandoub");
  revalidatePath(`/mandoub/order`);
  return { ok: true };
}
