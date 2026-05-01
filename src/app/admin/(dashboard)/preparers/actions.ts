"use server";

import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { CourierWalletMiscDirection } from "@prisma/client";
import { Decimal, PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
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

/** ربط محلات المجهز وتفعيل محفظة الموظف — لا يمس تفويض أفرع المتجر. */
export async function setPreparerShopLinks(_prev: PreparerFormState, formData: FormData): Promise<PreparerFormState> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const preparerId = String(formData.get("preparerId") ?? "").trim();
  const shopIds = [
    ...new Set(
      formData
        .getAll("shopIds")
        .map((x) => String(x).trim())
        .filter(Boolean),
    ),
  ];

  if (!preparerId) return { error: "معرّف المجهز مفقود." };

  const preparerExists = await prisma.companyPreparer.findFirst({
    where: { id: preparerId },
    select: { id: true },
  });
  if (!preparerExists) return { error: "المجهز غير موجود. حدّث الصفحة." };

  if (shopIds.length > 0) {
    const found = await prisma.shop.count({ where: { id: { in: shopIds } } });
    if (found !== shopIds.length) {
      return { error: "أحد المحلات المختارة غير موجود. حدّث الصفحة ثم أعد المحاولة." };
    }
  }

  try {
    await prisma.preparerShop.deleteMany({ where: { preparerId } });
    if (shopIds.length > 0) {
      await prisma.preparerShop.createMany({
        data: shopIds.map((shopId) => ({
          preparerId,
          shopId,
          canSubmitOrders: true,
        })),
      });
    }

    const cp = await prisma.companyPreparer.findUnique({
      where: { id: preparerId },
      select: { walletEmployeeId: true, name: true, phone: true },
    });
    if (cp && !cp.walletEmployeeId && shopIds.length > 0) {
      const phoneRaw = (cp.phone ?? "").trim();
      const phone = phoneRaw.length > 0 ? phoneRaw : `__prep_wallet__${preparerId}`;
      const em = await prisma.employee.create({
        data: { name: (cp.name ?? "").trim() || "مجهز", phone, shopId: shopIds[0]! },
      });
      try {
        await prisma.companyPreparer.update({
          where: { id: preparerId },
          data: { walletEmployeeId: em.id },
        });
      } catch (linkErr) {
        await prisma.employee.delete({ where: { id: em.id } }).catch(() => {});
        throw linkErr;
      }
    }
  } catch (e) {
    console.error("setPreparerShopLinks", e);
    if (e instanceof PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return {
          error:
            "تعارض أثناء الحفظ (طلبان معاً). انتظر ثانية ثم أعد التأشير، أو حدّث الصفحة.",
        };
      }
      if (e.code === "P2003") {
        return { error: "بيانات غير صالحة: المجهز أو المحل غير مرتبط بشكل صحيح في قاعدة البيانات." };
      }
    }
    const raw = e instanceof Error ? e.message : String(e);
    const lower = raw.toLowerCase();
    if (
      lower.includes("can't reach database") ||
      lower.includes("server has closed the connection") ||
      lower.includes("econnrefused") ||
      lower.includes("timeout")
    ) {
      return {
        error:
          "تعذّر الاتصال بقاعدة البيانات (انقطاع أو مهلة). جرّب بعد قليل أو تحقق من إعدادات الاستضافة (مثل Supabase / الرابط المباشر).",
      };
    }
    if (lower.includes("unique constraint") || lower.includes("duplicate key")) {
      return {
        error:
          "تعارض أثناء الحفظ (محل مكرر أو طلبان معاً). حدّث الصفحة ثم أعد المحاولة.",
      };
    }
    if (lower.includes("prepared statement") || lower.includes("pgbouncer")) {
      return {
        error:
          "إعدادات اتصال قاعدة البيانات تمنع هذه العملية (غالباً موازن الاتصالات). راجع DATABASE_URL أو استخدم الرابط المباشر غير الموازن للكتابة.",
      };
    }
    if (process.env.NODE_ENV !== "production") {
      return { error: `تعذّر الحفظ (وضع التطوير): ${raw.slice(0, 280)}` };
    }
    return { error: "تعذّر حفظ المحلات أو تفعيل المحفظة. تحقق أن المحل صالح وأن الاتصال بالخادم سليم." };
  }

  revalidatePath("/admin/preparers");
  return { ok: true };
}

/** تفويض أقسام/أفرع المتجر فقط — لا يغيّر ربط المحلات. */
export async function setPreparerBranchDelegations(
  _prev: PreparerFormState,
  formData: FormData,
): Promise<PreparerFormState> {
  const denied = await requireAdmin();
  if (denied) return denied;
  const preparerId = String(formData.get("preparerId") ?? "").trim();
  const branchIds = formData
    .getAll("branchIds")
    .map((x) => String(x).trim())
    .filter(Boolean);
  const categoryIds = formData
    .getAll("categoryIds")
    .map((x) => String(x).trim())
    .filter(Boolean);

  if (!preparerId) return { error: "معرّف المجهز مفقود." };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.storeBranch.updateMany({
        where: { authorizedPreparerId: preparerId },
        data: { authorizedPreparerId: null },
      });

      if (categoryIds.length > 0) {
        await tx.storeBranch.updateMany({
          where: { categoryId: { in: categoryIds } },
          data: { authorizedPreparerId: preparerId },
        });
      }

      if (branchIds.length > 0) {
        await tx.storeBranch.updateMany({
          where: { id: { in: branchIds } },
          data: { authorizedPreparerId: preparerId },
        });
      }
    });
  } catch (e) {
    console.error("setPreparerBranchDelegations", e);
    return { error: "تعذّر حفظ التفويض. حاول مرة أخرى." };
  }

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
