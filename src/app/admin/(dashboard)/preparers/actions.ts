"use server";

import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { CourierWalletMiscDirection } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import { EMPLOYEE_DAILY_SALARY_LABEL_PREFIX } from "@/lib/wallet-peer-transfer";
import { notifyTelegramPreparerWalletEvent } from "@/lib/telegram-notify";
import { randomUUID } from "crypto";

async function requireAdmin(): Promise<PreparerFormState | null> {
  if (!(await isAdminSession())) return { error: "غير مصرّح." };
  return null;
}

export type PreparerFormState = { error?: string; ok?: boolean };

export async function createCompanyPreparer(_prev: PreparerFormState, formData: FormData): Promise<PreparerFormState> {
  const denied = await requireAdmin(); if (denied) return denied;
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const telegramUserId = String(formData.get("telegramUserId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "اسم المجهز مطلوب." };

  await prisma.companyPreparer.create({
    data: {
      name,
      phone,
      telegramUserId,
      notes,
      portalToken: randomUUID()
    }
  });

  revalidatePath("/admin/preparers");
  return { ok: true };
}

export async function deleteCompanyPreparer(_prev: PreparerFormState, formData: FormData): Promise<PreparerFormState> {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "معرّف المجهز مفقود." };

  try {
    await prisma.$transaction(async (tx) => {
      // حذف الروابط مع المحلات أولاً
      await tx.preparerShop.deleteMany({ where: { preparerId: id } });
      // حذف المجهز نفسه
      await tx.companyPreparer.delete({ where: { id } });
    });
    revalidatePath("/admin/preparers");
    return { ok: true };
  } catch (e) {
    console.error("deleteCompanyPreparer", e);
    return { error: "تعذّر الحذف. قد يكون المجهز مرتبطاً بطلبات حالية." };
  }
}

export async function payDailySalaryForCompanyPreparer(_prev: PreparerFormState, formData: FormData): Promise<PreparerFormState> {
  const denied = await requireAdmin(); if (denied) return denied;
  const preparerId = String(formData.get("preparerId") ?? "").trim();
  const amountRaw = String(formData.get("amountAlf") ?? "").trim();
  const parsed = parseAlfInputToDinarDecimalRequired(amountRaw);
  if (!parsed.ok) return { error: "المبلغ غير صالح." };

  const amountDinar = new Decimal(parsed.value);
  const cp = await prisma.companyPreparer.findUnique({ where: { id: preparerId } });
  if (!cp?.walletEmployeeId) return { error: "المحفظة غير مربوطة." };

  await prisma.employeeWalletMiscEntry.create({
    data: {
      employeeId: cp.walletEmployeeId,
      direction: CourierWalletMiscDirection.give, // صادر
      amountDinar,
      label: EMPLOYEE_DAILY_SALARY_LABEL_PREFIX,
    },
  });

  await notifyTelegramPreparerWalletEvent({
    preparerId, kind: "give", amountDinar, label: "استلام راتب يومي"
  });

  revalidatePath("/admin/preparers");
  return { ok: true };
}

export async function updateCompanyPreparer(_prev: PreparerFormState, formData: FormData): Promise<PreparerFormState> {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const telegramUserId = String(formData.get("telegramUserId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const active = formData.get("active") === "1" || formData.get("active") === "on";

  await prisma.companyPreparer.update({
    where: { id },
    data: {
      name,
      phone,
      telegramUserId,
      notes,
      active
    }
  });

  revalidatePath("/admin/preparers");
  return { ok: true };
}

export async function renewCompanyPreparerPortalToken(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  await prisma.companyPreparer.update({ where: { id }, data: { portalToken: randomUUID() } });
  revalidatePath("/admin/preparers");
}

export async function setPreparerShops(_prev: PreparerFormState, formData: FormData): Promise<PreparerFormState> {
  const denied = await requireAdmin(); if (denied) return denied;
  const preparerId = String(formData.get("preparerId") ?? "").trim();
  const shopIds = formData.getAll("shopIds").map(x => String(x));
  const branchIds = formData.getAll("branchIds").map(x => String(x));
  const categoryIds = formData.getAll("categoryIds").map(x => String(x));

  await prisma.$transaction(async (tx) => {
    // تحديث المحلات
    await tx.preparerShop.deleteMany({ where: { preparerId } });
    for (const shopId of shopIds) await tx.preparerShop.create({ data: { preparerId, shopId, canSubmitOrders: true } });

    // تفويض الأفرع الفردية
    await tx.storeBranch.updateMany({
      where: { authorizedPreparerId: preparerId },
      data: { authorizedPreparerId: null }
    });

    // تفويض أفرع الأقسام المختارة
    if (categoryIds.length > 0) {
      await tx.storeBranch.updateMany({
        where: { categoryId: { in: categoryIds } },
        data: { authorizedPreparerId: preparerId }
      });
    }

    // تفويض الأفرع المختارة يدوياً (تأكيد)
    if (branchIds.length > 0) {
      await tx.storeBranch.updateMany({
        where: { id: { in: branchIds } },
        data: { authorizedPreparerId: preparerId }
      });
    }

    const cp = await tx.companyPreparer.findUnique({ where: { id: preparerId } });
    if (cp && !cp.walletEmployeeId && shopIds.length > 0) {
      const em = await tx.employee.create({ data: { name: cp.name, phone: cp.phone, shopId: shopIds[0]! } });
      await tx.companyPreparer.update({ where: { id: preparerId }, data: { walletEmployeeId: em.id } });
    }
  });
  revalidatePath("/admin/preparers");
  return { ok: true };
}

export async function setPreparerMonthlySalaryResetConfig(
  _prev: PreparerFormState,
  formData: FormData
): Promise<PreparerFormState> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const id = String(formData.get("preparerId") ?? "").trim();
  const mode = String(formData.get("mode") ?? "calendar_month");
  const everyDays = formData.get("everyDays")
    ? Number(formData.get("everyDays"))
    : null;
  await prisma.companyPreparer.update({
    where: { id },
    data: {
      preparerMonthlySalaryResetMode: mode as any,
      preparerMonthlySalaryResetEveryDays: everyDays,
    },
  });
  revalidatePath("/admin/preparers");
  return { ok: true };
}
