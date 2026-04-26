"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Decimal } from "@prisma/client/runtime/library";
import { OrderCourierMoneyDeletionReason } from "@prisma/client";
import { ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE } from "@/lib/mandoub-cash-constants";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export type WalletLedgerPurgeState = { ok?: boolean; error?: string };

export type WalletLedgerDeleteState = { error?: string };

function revalidateWalletReportsAfterMutation(orderIdForPaths?: string) {
  revalidatePath("/admin/reports/wallet-ledger");
  revalidatePath("/admin/reports/general");
  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/orders", "layout");
  revalidatePath("/mandoub", "layout");
  revalidatePath("/preparer", "layout");
  revalidatePath("/mandoub/wallet");
  revalidatePath("/preparer/wallet");
  if (orderIdForPaths) {
    revalidatePath(`/mandoub/order/${orderIdForPaths}`);
    revalidatePath(`/preparer/order/${orderIdForPaths}`);
    revalidatePath(`/admin/orders/${orderIdForPaths}`);
    revalidatePath(`/admin/orders/${orderIdForPaths}/edit`);
  }
}

function safeReturnUrl(u: string): string {
  const t = u.trim();
  if (t.startsWith("/admin/reports/wallet-ledger")) return t;
  return "/admin/reports/wallet-ledger";
}

function withRefreshParam(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}__r=${Date.now()}`;
}

function parseRowId(rowId: string): { kind: "oe" | "cm" | "em" | "wt"; id: string } | null {
  const m = /^(oe|cm|em|wt):(.+)$/.exec(rowId.trim());
  if (!m) return null;
  return { kind: m[1] as "oe" | "cm" | "em" | "wt", id: m[2] };
}

async function softDeleteWalletLedgerRowCore(
  rowId: string,
): Promise<{ ok: true; orderId?: string } | { ok: false; error: string }> {
  const parsed = parseRowId(rowId);
  if (!parsed) return { ok: false, error: "معرّف غير صالح." };

  if (parsed.kind === "oe") {
    const ev = await prisma.orderCourierMoneyEvent.findFirst({
      where: { id: parsed.id, deletedAt: null },
    });
    if (!ev) return { ok: false, error: "معاملة الطلب غير موجودة أو مُلغاة." };
    await prisma.$transaction(async (tx) => {
      await tx.orderCourierMoneyEvent.update({
        where: { id: parsed.id },
        data: {
          deletedAt: new Date(),
          deletedReason: OrderCourierMoneyDeletionReason.manual_admin,
          deletedByDisplayName: "لوحة الإدارة — مستودع المحافظ",
        },
      });
    });
    return { ok: true, orderId: ev.orderId };
  }

  if (parsed.kind === "cm") {
    const row = await prisma.courierWalletMiscEntry.findFirst({
      where: { id: parsed.id, deletedAt: null },
    });
    if (!row) return { ok: false, error: "معاملة المندوب غير موجودة أو مُلغاة." };
    await prisma.courierWalletMiscEntry.update({
      where: { id: parsed.id },
      data: {
        deletedAt: new Date(),
        deletedReason: OrderCourierMoneyDeletionReason.manual_admin,
        deletedByDisplayName: "لوحة الإدارة — مستودع المحافظ",
      },
    });
    return { ok: true };
  }

  if (parsed.kind === "em") {
    const row = await prisma.employeeWalletMiscEntry.findFirst({
      where: { id: parsed.id, deletedAt: null },
    });
    if (!row) return { ok: false, error: "معاملة الموظف/المجهز غير موجودة أو مُلغاة." };
    await prisma.employeeWalletMiscEntry.update({
      where: { id: parsed.id },
      data: {
        deletedAt: new Date(),
        deletedReason: OrderCourierMoneyDeletionReason.manual_admin,
        deletedByDisplayName: "لوحة الإدارة — مستودع المحافظ",
      },
    });
    return { ok: true };
  }

  return { ok: false, error: "لا يوجد مسح ناعم لتحويلات المحفظة — استخدم الحذف النهائي." };
}

async function hardDeleteWalletLedgerRowCore(
  rowId: string,
): Promise<{ ok: true; orderId?: string } | { ok: false; error: string }> {
  const parsed = parseRowId(rowId);
  if (!parsed) return { ok: false, error: "معرّف غير صالح." };

  if (parsed.kind === "oe") {
    const ev = await prisma.orderCourierMoneyEvent.findFirst({ where: { id: parsed.id } });
    if (!ev) return { ok: false, error: "غير موجودة." };
    const oid = ev.orderId;
    await prisma.$transaction(async (tx) => {
      await tx.orderCourierMoneyEvent.delete({ where: { id: parsed.id } });
    });
    return { ok: true, orderId: oid };
  }

  if (parsed.kind === "cm") {
    await prisma.courierWalletMiscEntry.delete({ where: { id: parsed.id } });
    return { ok: true };
  }

  if (parsed.kind === "em") {
    await prisma.employeeWalletMiscEntry.delete({ where: { id: parsed.id } });
    return { ok: true };
  }

  if (parsed.kind === "wt") {
    await prisma.walletPeerTransfer.delete({ where: { id: parsed.id } });
    return { ok: true };
  }

  return { ok: false, error: "نوع غير معروف." };
}

export async function softDeleteWalletLedgerRow(
  _prev: WalletLedgerDeleteState,
  formData: FormData,
): Promise<WalletLedgerDeleteState> {
  if (!(await isAdminSession())) {
    return { error: "غير مصرّح." };
  }
  const rowId = String(formData.get("rowId") ?? "").trim();
  const returnUrl = safeReturnUrl(String(formData.get("returnUrl") ?? ""));
  const r = await softDeleteWalletLedgerRowCore(rowId);
  if (!r.ok) {
    return { error: r.error };
  }
  revalidateWalletReportsAfterMutation(r.orderId);
  redirect(withRefreshParam(returnUrl));
}

export async function hardDeleteWalletLedgerRow(
  _prev: WalletLedgerDeleteState,
  formData: FormData,
): Promise<WalletLedgerDeleteState> {
  if (!(await isAdminSession())) {
    return { error: "غير مصرّح." };
  }
  const rowId = String(formData.get("rowId") ?? "").trim();
  const returnUrl = safeReturnUrl(String(formData.get("returnUrl") ?? ""));
  const confirmPhrase = String(formData.get("confirmPhrase") ?? "").trim();
  if (confirmPhrase !== ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE) {
    return {
      error: `اكتب بالضبط «${ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE}» للتأكيد.`,
    };
  }
  const r = await hardDeleteWalletLedgerRowCore(rowId);
  if (!r.ok) {
    return { error: r.error };
  }
  revalidateWalletReportsAfterMutation(r.orderId);
  redirect(withRefreshParam(returnUrl));
}

export async function bulkSoftDeleteWalletLedgerRows(
  _prev: WalletLedgerDeleteState,
  formData: FormData,
): Promise<WalletLedgerDeleteState> {
  if (!(await isAdminSession())) {
    return { error: "غير مصرّح." };
  }
  const raw = String(formData.get("rowIds") ?? "").trim();
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const returnUrl = safeReturnUrl(String(formData.get("returnUrl") ?? ""));
  if (ids.length === 0) {
    return { error: "لم يُحدد أي معاملة." };
  }
  let lastOrderId: string | undefined;
  for (const rowId of ids) {
    const r = await softDeleteWalletLedgerRowCore(rowId);
    if (!r.ok) {
      return { error: `${rowId}: ${r.error}` };
    }
    if (r.orderId) lastOrderId = r.orderId;
  }
  revalidateWalletReportsAfterMutation(lastOrderId);
  redirect(withRefreshParam(returnUrl));
}

export async function bulkHardDeleteWalletLedgerRows(
  _prev: WalletLedgerDeleteState,
  formData: FormData,
): Promise<WalletLedgerDeleteState> {
  if (!(await isAdminSession())) {
    return { error: "غير مصرّح." };
  }
  const raw = String(formData.get("rowIds") ?? "").trim();
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const returnUrl = safeReturnUrl(String(formData.get("returnUrl") ?? ""));
  const confirmPhrase = String(formData.get("confirmPhrase") ?? "").trim();
  if (confirmPhrase !== ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE) {
    return {
      error: `اكتب بالضبط «${ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE}» للتأكيد.`,
    };
  }
  if (ids.length === 0) {
    return { error: "لم يُحدد أي معاملة." };
  }
  let lastOrderId: string | undefined;
  for (const rowId of ids) {
    const r = await hardDeleteWalletLedgerRowCore(rowId);
    if (!r.ok) {
      return { error: `${rowId}: ${r.error}` };
    }
    if (r.orderId) lastOrderId = r.orderId;
  }
  revalidateWalletReportsAfterMutation(lastOrderId);
  redirect(withRefreshParam(returnUrl));
}

/**
 * حذف جميع سجلات معاملات المحافظ من PostgreSQL (قاعدة Railway)،
 * وإعادة تصفير حقول «تصفير لوحة المندوب» للمندوبين.
 * لا يحذف الطلبات ولا المندوبين ولا الموظفين.
 */
export async function purgeWalletLedgerData(
  _prev: WalletLedgerPurgeState,
  formData: FormData,
): Promise<WalletLedgerPurgeState> {
  if (!(await isAdminSession())) {
    return { error: "غير مصرّح. سجّل الدخول من لوحة الإدارة." };
  }
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "مسح") {
    return { error: "اكتب كلمة «مسح» في حقل التأكيد تماماً." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderCourierMoneyEvent.deleteMany({});
    await tx.walletPeerTransfer.deleteMany({});
    await tx.courierWalletMiscEntry.deleteMany({});
    await tx.employeeWalletMiscEntry.deleteMany({});
    await tx.courier.updateMany({
      data: {
        mandoubTotalsResetAt: null,
        mandoubWalletCarryOverDinar: new Decimal(0),
      },
    });
  });

  revalidatePath("/admin/reports/wallet-ledger");
  revalidatePath("/admin/reports/general");
  revalidatePath("/admin/reports/courier-mandoub");
  revalidatePath("/mandoub", "layout");
  revalidatePath("/preparer", "layout");
  return { ok: true };
}
