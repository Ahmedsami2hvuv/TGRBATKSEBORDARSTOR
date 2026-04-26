"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { adminCookieName, verifyAdminToken } from "@/lib/auth";
import { Decimal } from "@prisma/client/runtime/library";

async function assertAdmin(): Promise<boolean> {
  const jar = await cookies();
  const t = jar.get(adminCookieName)?.value ?? "";
  return !!(t && (await verifyAdminToken(t)));
}

export async function payCourierTipAction(formData: FormData) {
  if (!(await assertAdmin())) {
    throw new Error("غير مصرّح.");
  }

  const courierId = String(formData.get("courierId") ?? "");
  const amountAlf = Number(formData.get("amountAlf") ?? 0);

  if (!courierId || amountAlf <= 0) {
    throw new Error("بيانات غير صالحة.");
  }

  const amountDinar = new Decimal(amountAlf * 1000);

  // نستخدم جدول CourierWalletMiscEntry
  // التغيير: direction: "give" لكي يتم خصم المبلغ من متبقي الإدارة (ما بذمة المندوب)
  await prisma.courierWalletMiscEntry.create({
    data: {
      courierId,
      amountDinar,
      direction: "give",
      label: "[إكرامية] من الإدارة",
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/reports/courier-mandoub");
  revalidatePath("/mandoub/wallet");

  return { ok: true };
}
