"use server";

import { CourierWalletMiscDirection, WalletPeerPartyKind } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import { notifyTelegramCourierTransferEvent, notifyTelegramPreparerWalletEvent } from "@/lib/telegram-notify";
import { resolvePartyDisplayName, writeLedgerEntriesForAcceptedTransfer } from "@/lib/wallet-peer-transfer";

export type WalletPeerTransferState = { error?: string };
export type EmployeeWalletMiscState = { error?: string };

function revalidateAll() {
  revalidatePath("/preparer/wallet");
  revalidatePath("/mandoub/wallet");
  revalidatePath("/mandoub");
  revalidatePath("/client/order/wallet");
}

/** تسجيل وارد أو صادر يدوي للمجهز */
export async function submitEmployeeWalletMiscEntryFromCompanyPreparer(_prev: EmployeeWalletMiscState, formData: FormData): Promise<EmployeeWalletMiscState> {
  const p = String(formData.get("p") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) return { error: "الرابط غير صالح." };

  const directionRaw = String(formData.get("direction") ?? "");
  const label = String(formData.get("label") ?? "");
  const amountRaw = String(formData.get("amountAlf") ?? "");
  const parsed = parseAlfInputToDinarDecimalRequired(amountRaw);
  if (!parsed.ok) return { error: "المبلغ غير صالح." };

  const amountDinar = new Decimal(parsed.value);
  const cp = await prisma.companyPreparer.findUnique({ where: { id: v.preparerId } });
  if (!cp?.walletEmployeeId) return { error: "المحفظة غير مربوطة بالحساب." };

  await prisma.employeeWalletMiscEntry.create({
    data: {
      employeeId: cp.walletEmployeeId,
      direction: directionRaw === "take" ? "take" : "give",
      amountDinar,
      label,
    },
  });

  await notifyTelegramPreparerWalletEvent({
    preparerId: v.preparerId,
    kind: directionRaw === "take" ? "take" : "give",
    amountDinar,
    label
  });

  revalidateAll();
  return {};
}

/** مسح معاملة محفظة يدوية للمجهز */
export async function softDeleteEmployeeWalletMiscEntryFromCompanyPreparer(
  _prev: EmployeeWalletMiscState,
  formData: FormData
): Promise<EmployeeWalletMiscState> {
  const p = String(formData.get("p") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) return { error: "الرابط غير صالح." };

  const entryId = String(formData.get("miscEntryId") ?? "").trim();
  if (!entryId) return { error: "المعرف مطلوب." };

  const preparer = await prisma.companyPreparer.findUnique({ where: { id: v.preparerId } });
  const deletedBy = preparer?.name?.trim() ? `مجهز: ${preparer.name.trim()}` : "مجهز";

  await prisma.employeeWalletMiscEntry.update({
    where: { id: entryId },
    data: {
      deletedAt: new Date(),
      deletedReason: "manual_preparer",
      deletedByDisplayName: deletedBy,
    },
  });

  revalidateAll();
  return {};
}

/** إنشاء طلب تحويل أموال من المجهز */
export async function createWalletPeerTransferFromCompanyPreparer(_prev: WalletPeerTransferState, formData: FormData): Promise<WalletPeerTransferState> {
  const p = String(formData.get("p") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) return { error: "الرابط غير صالح." };

  const amountRaw = String(formData.get("amountAlf") ?? "");
  const parsed = parseAlfInputToDinarDecimalRequired(amountRaw);
  if (!parsed.ok) return { error: "المبلغ غير صالح." };
  const amountDinar = new Decimal(parsed.value);

  const cp = await prisma.companyPreparer.findUnique({ where: { id: v.preparerId } });
  if (!cp?.walletEmployeeId) return { error: "المحفظة غير مربوطة بالحساب." };

  const toKind = String(formData.get("toKind") ?? "") as WalletPeerPartyKind;
  const handoverLocation = String(formData.get("handoverLocation") ?? "");
  const toCourierId = formData.get("toCourierId") ? String(formData.get("toCourierId")) : null;
  const toEmployeeId = formData.get("toEmployeeId") ? String(formData.get("toEmployeeId")) : null;

  if (toKind === WalletPeerPartyKind.admin) {
    // التحويل للإدارة يُقبل فوراً
    await prisma.$transaction(async (tx) => {
      const t = await tx.walletPeerTransfer.create({
        data: {
          status: "accepted", amountDinar, handoverLocation,
          fromKind: WalletPeerPartyKind.employee, fromEmployeeId: cp.walletEmployeeId,
          toKind: WalletPeerPartyKind.admin, respondedAt: new Date(),
        },
      });
      await writeLedgerEntriesForAcceptedTransfer(tx, t);
    });
  } else {
    // تحويل لمندوب أو مجهز آخر (يبقى معلقاً)
    const t = await prisma.walletPeerTransfer.create({
      data: {
        status: "pending", amountDinar, handoverLocation,
        fromKind: WalletPeerPartyKind.employee, fromEmployeeId: cp.walletEmployeeId,
        toKind, toCourierId, toEmployeeId,
      }
    });

    const fromName = await resolvePartyDisplayName(WalletPeerPartyKind.employee, null, cp.walletEmployeeId);

    // إشعار المستلم (إذا كان مندوباً)
    if (toKind === WalletPeerPartyKind.courier && toCourierId) {
      await notifyTelegramCourierTransferEvent({
        courierId: toCourierId, kind: "incoming", amountDinar, partyName: fromName,
        location: handoverLocation, transferId: t.id
      });
    }
    // إشعار المستلم (إذا كان مجهزاً)
    else if (toKind === WalletPeerPartyKind.employee && toEmployeeId) {
      const targetPrep = await prisma.companyPreparer.findFirst({ where: { walletEmployeeId: toEmployeeId } });
      if (targetPrep) {
        await notifyTelegramPreparerWalletEvent({
          preparerId: targetPrep.id, kind: "transfer_in", amountDinar,
          label: `تحويل واصل من ${fromName} — مكان التسليم: ${handoverLocation}`
        });
      }
    }
  }

  revalidateAll();
  return {};
}

/** قبول أو رفض تحويل مرسل للمجهز */
export async function respondWalletPeerTransferByCompanyPreparer(_prev: WalletPeerTransferState, formData: FormData): Promise<WalletPeerTransferState> {
  const p = String(formData.get("p") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) return { error: "الرابط غير صالح." };

  const transferId = String(formData.get("transferId") ?? "");
  const accept = formData.get("accept") === "1";

  const cp = await prisma.companyPreparer.findUnique({ where: { id: v.preparerId } });
  if (!cp?.walletEmployeeId) return { error: "المحفظة غير مربوطة." };

  const t = await prisma.walletPeerTransfer.findFirst({
    where: { id: transferId, toEmployeeId: cp.walletEmployeeId, status: "pending" }
  });
  if (!t) return { error: "التحويل غير موجود أو تمت معالجته مسبقاً." };

  const myName = await resolvePartyDisplayName(WalletPeerPartyKind.employee, null, cp.walletEmployeeId);

  if (accept) {
    await prisma.$transaction(async (tx) => {
      await tx.walletPeerTransfer.update({
        where: { id: transferId },
        data: { status: "accepted", respondedAt: new Date() }
      });
      await writeLedgerEntriesForAcceptedTransfer(tx, t);
    });

    // إشعار للمرسل
    if (t.fromKind === WalletPeerPartyKind.courier && t.fromCourierId) {
      await notifyTelegramCourierTransferEvent({
        courierId: t.fromCourierId, kind: "accepted", amountDinar: t.amountDinar,
        partyName: myName, location: t.handoverLocation
      });
    } else if (t.fromKind === WalletPeerPartyKind.employee && t.fromEmployeeId) {
      const fromPrep = await prisma.companyPreparer.findFirst({ where: { walletEmployeeId: t.fromEmployeeId } });
      if (fromPrep) {
        await notifyTelegramPreparerWalletEvent({
          preparerId: fromPrep.id, kind: "transfer_accepted", amountDinar: t.amountDinar,
          label: `تم قبول تحويلك من قبل ${myName}`
        });
      }
    }
  } else {
    await prisma.walletPeerTransfer.update({
      where: { id: transferId },
      data: { status: "rejected", respondedAt: new Date() }
    });

    // إشعار للمرسل عند الرفض
    if (t.fromKind === WalletPeerPartyKind.courier && t.fromCourierId) {
      await notifyTelegramCourierTransferEvent({
        courierId: t.fromCourierId, kind: "rejected", amountDinar: t.amountDinar,
        partyName: myName, location: t.handoverLocation
      });
    } else if (t.fromKind === WalletPeerPartyKind.employee && t.fromEmployeeId) {
      const fromPrep = await prisma.companyPreparer.findFirst({ where: { walletEmployeeId: t.fromEmployeeId } });
      if (fromPrep) {
        await notifyTelegramPreparerWalletEvent({
          preparerId: fromPrep.id, kind: "transfer_rejected", amountDinar: t.amountDinar,
          label: `تم رفض تحويلك من قبل ${myName}`
        });
      }
    }
  }

  revalidateAll();
  return {};
}
