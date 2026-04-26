"use server";

import { WalletPeerPartyKind } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { isCourierPortalBlocked } from "@/lib/courier-delegate-access";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { resolvePartyDisplayName, writeLedgerEntriesForAcceptedTransfer } from "@/lib/wallet-peer-transfer";
import { notifyTelegramCourierTransferEvent, notifyTelegramPreparerWalletEvent } from "@/lib/telegram-notify";

export type WalletPeerTransferState = { error?: string };

function revalidateAllSurfaces() {
  revalidatePath("/mandoub");
  revalidatePath("/mandoub/wallet");
  revalidatePath("/preparer");
  revalidatePath("/preparer/wallet");
  revalidatePath("/client/order/wallet");
}

/** إنشاء تحويل من المندوب */
export async function createWalletPeerTransferFromCourier(
  _prev: WalletPeerTransferState,
  formData: FormData,
): Promise<WalletPeerTransferState> {
  const c = String(formData.get("c") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const amountRaw = String(formData.get("amountAlf") ?? "").trim();
  const handoverLocation = String(formData.get("handoverLocation") ?? "").trim();
  const toKindRaw = String(formData.get("toKind") ?? "").trim();

  const v = verifyDelegatePortalQuery(c, exp, s);
  if (!v.ok) return { error: "الرابط غير صالح." };
  if (await isCourierPortalBlocked(v.courierId)) return { error: "الحساب محظور." };

  const parsed = parseAlfInputToDinarDecimalRequired(amountRaw);
  if (!parsed.ok) return { error: "المبلغ غير صالح." };
  const amountDinar = new Decimal(parsed.value);

  let toKind: WalletPeerPartyKind = toKindRaw as WalletPeerPartyKind;
  const toCourierId = formData.get("toCourierId") ? String(formData.get("toCourierId")) : null;
  const toEmployeeId = formData.get("toEmployeeId") ? String(formData.get("toEmployeeId")) : null;

  if (toKind === WalletPeerPartyKind.admin) {
    await prisma.$transaction(async (tx) => {
      const t = await tx.walletPeerTransfer.create({
        data: {
          status: "accepted", amountDinar, handoverLocation,
          fromKind: WalletPeerPartyKind.courier, fromCourierId: v.courierId,
          toKind: WalletPeerPartyKind.admin, respondedAt: new Date(),
        },
      });
      await writeLedgerEntriesForAcceptedTransfer(tx, t);
    });
  } else {
    const t = await prisma.walletPeerTransfer.create({
      data: {
        status: "pending", amountDinar, handoverLocation,
        fromKind: WalletPeerPartyKind.courier, fromCourierId: v.courierId,
        toKind, toCourierId, toEmployeeId,
      },
    });

    // إشعار للمستلم (إذا كان مندوباً)
    if (toKind === WalletPeerPartyKind.courier && toCourierId) {
      const fromName = await resolvePartyDisplayName(WalletPeerPartyKind.courier, v.courierId, null);
      await notifyTelegramCourierTransferEvent({
        courierId: toCourierId, kind: "incoming", amountDinar, partyName: fromName,
        location: handoverLocation, transferId: t.id
      });
    }
    // إشعار للمستلم (إذا كان مجهزاً)
    else if (toKind === WalletPeerPartyKind.employee && toEmployeeId) {
      const prep = await prisma.companyPreparer.findFirst({ where: { walletEmployeeId: toEmployeeId } });
      if (prep) {
        const fromName = await resolvePartyDisplayName(WalletPeerPartyKind.courier, v.courierId, null);
        await notifyTelegramPreparerWalletEvent({
          preparerId: prep.id, kind: "transfer_in", amountDinar, label: `تحويل واصل من ${fromName} — مكان التسليم: ${handoverLocation}`
        });
      }
    }
  }

  revalidateAllSurfaces();
  return {};
}

/** إنشاء تحويل من مجهز أو موظف */
export async function createWalletPeerTransferFromEmployee(
  _prev: WalletPeerTransferState,
  formData: FormData,
): Promise<WalletPeerTransferState> {
  const p = String(formData.get("p") ?? "");
  const e = String(formData.get("e") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const amountRaw = String(formData.get("amountAlf") ?? "").trim();
  const handoverLocation = String(formData.get("handoverLocation") ?? "").trim();
  const toKindRaw = String(formData.get("toKind") ?? "").trim();

  let selfEmployeeId: string | null = null;
  const vPrep = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (vPrep.ok) {
    const prep = await prisma.companyPreparer.findUnique({ where: { id: vPrep.preparerId } });
    selfEmployeeId = prep?.walletEmployeeId ?? null;
  } else {
    const vEmp = verifyEmployeeOrderPortalQuery(e, exp, s);
    if (vEmp.ok) selfEmployeeId = vEmp.employeeId;
  }

  if (!selfEmployeeId) return { error: "الرابط غير صالح." };

  const parsed = parseAlfInputToDinarDecimalRequired(amountRaw);
  if (!parsed.ok) return { error: "المبلغ غير صالح." };
  const amountDinar = new Decimal(parsed.value);

  const toKind = toKindRaw as WalletPeerPartyKind;
  const toCourierId = formData.get("toCourierId") ? String(formData.get("toCourierId")) : null;
  const toEmployeeId = formData.get("toEmployeeId") ? String(formData.get("toEmployeeId")) : null;

  if (toKind === WalletPeerPartyKind.admin) {
    await prisma.$transaction(async (tx) => {
      const t = await tx.walletPeerTransfer.create({
        data: {
          status: "accepted", amountDinar, handoverLocation,
          fromKind: WalletPeerPartyKind.employee, fromEmployeeId: selfEmployeeId,
          toKind: WalletPeerPartyKind.admin, respondedAt: new Date(),
        },
      });
      await writeLedgerEntriesForAcceptedTransfer(tx, t);
    });
  } else {
    const t = await prisma.walletPeerTransfer.create({
      data: {
        status: "pending", amountDinar, handoverLocation,
        fromKind: WalletPeerPartyKind.employee, fromEmployeeId: selfEmployeeId,
        toKind, toCourierId, toEmployeeId,
      },
    });

    const fromName = await resolvePartyDisplayName(WalletPeerPartyKind.employee, null, selfEmployeeId);

    // إشعار للمستلم (إذا كان مندوباً)
    if (toKind === WalletPeerPartyKind.courier && toCourierId) {
      await notifyTelegramCourierTransferEvent({
        courierId: toCourierId, kind: "incoming", amountDinar, partyName: fromName,
        location: handoverLocation, transferId: t.id
      });
    }
    // إشعار للمستلم (إذا كان مجهزاً)
    else if (toKind === WalletPeerPartyKind.employee && toEmployeeId) {
      const targetPrep = await prisma.companyPreparer.findFirst({ where: { walletEmployeeId: toEmployeeId } });
      if (targetPrep) {
        await notifyTelegramPreparerWalletEvent({
          preparerId: targetPrep.id, kind: "transfer_in", amountDinar, label: `تحويل واصل من ${fromName} — مكان التسليم: ${handoverLocation}`
        });
      }
    }
  }

  revalidateAllSurfaces();
  return {};
}

/** قبول أو رفض التحويل - يدعم المجهز والموظف والمندوب */
export async function respondWalletPeerTransferGeneral(
  _prev: WalletPeerTransferState,
  formData: FormData,
): Promise<WalletPeerTransferState> {
  const p = String(formData.get("p") ?? "");
  const c = String(formData.get("c") ?? "");
  const e = String(formData.get("e") ?? "");
  const exp = String(formData.get("exp") ?? "");
  const s = String(formData.get("s") ?? "");
  const transferId = String(formData.get("transferId") ?? "");
  const accept = formData.get("accept") === "1";

  let selfEmployeeId: string | null = null;
  let selfCourierId: string | null = null;
  let selfPreparerId: string | null = null;

  const vPrep = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (vPrep.ok) {
    const prep = await prisma.companyPreparer.findUnique({ where: { id: vPrep.preparerId } });
    selfEmployeeId = prep?.walletEmployeeId ?? null;
    selfPreparerId = prep?.id ?? null;
  }
  else {
    const vCourier = verifyDelegatePortalQuery(c, exp, s);
    if (vCourier.ok) {
      selfCourierId = vCourier.courierId;
    }
    else {
      const vEmp = verifyEmployeeOrderPortalQuery(e, exp, s);
      if (vEmp.ok) {
        selfEmployeeId = vEmp.employeeId;
      }
    }
  }

  if (!selfEmployeeId && !selfCourierId) return { error: "جلسة العمل غير صالحة." };

  const row = await prisma.walletPeerTransfer.findFirst({
    where: {
      id: transferId,
      status: "pending",
      OR: [
        { toEmployeeId: selfEmployeeId ? selfEmployeeId : undefined },
        { toCourierId: selfCourierId ? selfCourierId : undefined }
      ]
    },
  });

  if (!row) return { error: "التحويل غير موجود أو تمت معالجته." };

  const myKind = vPrep.ok ? WalletPeerPartyKind.employee : selfCourierId ? WalletPeerPartyKind.courier : WalletPeerPartyKind.employee;
  const myName = await resolvePartyDisplayName(myKind, selfCourierId, selfEmployeeId);

  if (accept) {
    await prisma.$transaction(async (tx) => {
      await writeLedgerEntriesForAcceptedTransfer(tx, row);
      await tx.walletPeerTransfer.update({
        where: { id: transferId },
        data: { status: "accepted", respondedAt: new Date() },
      });
    });

    // إشعار للمرسل
    if (row.fromKind === WalletPeerPartyKind.courier && row.fromCourierId) {
      await notifyTelegramCourierTransferEvent({
        courierId: row.fromCourierId, kind: "accepted", amountDinar: row.amountDinar,
        partyName: myName, location: row.handoverLocation
      });
    } else if (row.fromKind === WalletPeerPartyKind.employee && row.fromEmployeeId) {
      const fromPrep = await prisma.companyPreparer.findFirst({ where: { walletEmployeeId: row.fromEmployeeId } });
      if (fromPrep) {
        await notifyTelegramPreparerWalletEvent({
          preparerId: fromPrep.id, kind: "transfer_out_accepted", amountDinar: row.amountDinar,
          label: `تم قبول تحويلك من قبل ${myName}`
        });
      }
    }
  } else {
    await prisma.walletPeerTransfer.update({
      where: { id: transferId },
      data: { status: "rejected", respondedAt: new Date() },
    });

    // إشعار للمرسل عند الرفض
    if (row.fromKind === WalletPeerPartyKind.courier && row.fromCourierId) {
      await notifyTelegramCourierTransferEvent({
        courierId: row.fromCourierId, kind: "rejected", amountDinar: row.amountDinar,
        partyName: myName, location: row.handoverLocation
      });
    } else if (row.fromKind === WalletPeerPartyKind.employee && row.fromEmployeeId) {
      const fromPrep = await prisma.companyPreparer.findFirst({ where: { walletEmployeeId: row.fromEmployeeId } });
      if (fromPrep) {
        await notifyTelegramPreparerWalletEvent({
          preparerId: fromPrep.id, kind: "transfer_out_rejected", amountDinar: row.amountDinar,
          label: `تم رفض تحويلك من قبل ${myName}`
        });
      }
    }
  }

  revalidateAllSurfaces();
  return {};
}

export async function respondWalletPeerTransferByCourier(prev: any, fd: FormData) { return respondWalletPeerTransferGeneral(prev, fd); }
export async function respondWalletPeerTransferByEmployee(prev: any, fd: FormData) { return respondWalletPeerTransferGeneral(prev, fd); }
