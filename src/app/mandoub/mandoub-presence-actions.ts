"use server";

import { revalidatePath } from "next/cache";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { prisma } from "@/lib/prisma";
import { notifyTelegramPresenceChange } from "@/lib/telegram-notify";
import { pushNotifyAdminsPresenceChange } from "@/lib/web-push-server";

export type MandoubPresenceState = { ok?: boolean; error?: string };

export async function setCourierPresenceFromForm(
  _prev: MandoubPresenceState,
  formData: FormData,
): Promise<MandoubPresenceState> {
  const c = String(formData.get("c") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const s = String(formData.get("s") ?? "").trim();
  const availableRaw = String(formData.get("available") ?? "").trim();
  const available = availableRaw === "true" || availableRaw === "on";

  const v = verifyDelegatePortalQuery(c, exp || undefined, s);
  if (!v.ok) {
    return { error: "الرابط غير صالح." };
  }

  const courier = await prisma.courier.findUnique({ where: { id: v.courierId } });
  if (!courier || courier.blocked) {
    return { error: "لا يمكن تحديث الحالة." };
  }

  if (courier.availableForAssignment === available) {
    revalidatePath("/mandoub");
    return { ok: true };
  }

  await prisma.courier.update({
    where: { id: courier.id },
    data: { availableForAssignment: available },
  });

  void notifyTelegramPresenceChange({
    kind: "courier",
    name: courier.name,
    available,
  });
  void pushNotifyAdminsPresenceChange({
    kind: "courier",
    name: courier.name,
    available,
  });

  revalidatePath("/mandoub");
  return { ok: true };
}
