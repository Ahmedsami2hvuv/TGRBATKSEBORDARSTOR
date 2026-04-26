import type { Prisma } from "@prisma/client";
import { CourierWalletMiscDirection, WalletPeerPartyKind } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";

export const EMPLOYEE_DAILY_SALARY_LABEL_PREFIX = "راتب يومي";

export async function sumPendingOutgoingForCourier(courierId: string): Promise<Decimal> {
  const agg = await prisma.walletPeerTransfer.aggregate({
    where: { fromCourierId: courierId, status: "pending" },
    _sum: { amountDinar: true },
  });
  return agg._sum.amountDinar ?? new Decimal(0);
}

export async function sumPendingIncomingForCourier(courierId: string): Promise<Decimal> {
  const agg = await prisma.walletPeerTransfer.aggregate({
    where: { toCourierId: courierId, status: "pending" },
    _sum: { amountDinar: true },
  });
  return agg._sum.amountDinar ?? new Decimal(0);
}

export async function fetchWalletInOutDisplayForCourier(
  courierId: string,
  baseline: Date | null,
): Promise<{ walletIn: Decimal; walletOut: Decimal; pendingIncoming: Decimal; pendingOutgoing: Decimal }> {
  const [miscRows, pendingIncomingAgg, pendingOutgoingAgg, acceptedTransfers] = await Promise.all([
    prisma.courierWalletMiscEntry.findMany({
      where: {
        courierId,
        deletedAt: null,
        ...(baseline ? { createdAt: { gt: baseline } } : {}),
      },
      select: { direction: true, amountDinar: true },
    }),
    prisma.walletPeerTransfer.aggregate({
      where: {
        toCourierId: courierId,
        status: "pending",
      },
      _sum: { amountDinar: true },
    }),
    prisma.walletPeerTransfer.aggregate({
      where: {
        fromCourierId: courierId,
        status: "pending",
      },
      _sum: { amountDinar: true },
    }),
    prisma.walletPeerTransfer.findMany({
      where: {
        status: "accepted",
        OR: [{ fromCourierId: courierId }, { toCourierId: courierId }],
        ...(baseline ? { respondedAt: { gt: baseline } } : {}),
      },
      select: { amountDinar: true, fromCourierId: true, toCourierId: true },
    }),
  ]);

  let take = new Decimal(0);
  let give = new Decimal(0);

  // القيود اليدوية
  for (const r of miscRows) {
    if (r.direction === CourierWalletMiscDirection.take) {
      take = take.plus(r.amountDinar);
    } else {
      give = give.plus(r.amountDinar);
    }
  }

  // التحويلات المقبولة
  for (const t of acceptedTransfers) {
    if (t.toCourierId === courierId) {
      take = take.plus(t.amountDinar);
    } else if (t.fromCourierId === courierId) {
      give = give.plus(t.amountDinar);
    }
  }

  return {
    walletIn: take,
    walletOut: give,
    pendingIncoming: pendingIncomingAgg._sum.amountDinar ?? new Decimal(0),
    pendingOutgoing: pendingOutgoingAgg._sum.amountDinar ?? new Decimal(0),
  };
}

export async function sumPendingOutgoingForEmployee(employeeId: string): Promise<Decimal> {
  const agg = await prisma.walletPeerTransfer.aggregate({
    where: { fromEmployeeId: employeeId, status: "pending" },
    _sum: { amountDinar: true },
  });
  return agg._sum.amountDinar ?? new Decimal(0);
}

export async function sumPendingIncomingForEmployee(employeeId: string): Promise<Decimal> {
  const agg = await prisma.walletPeerTransfer.aggregate({
    where: { toEmployeeId: employeeId, status: "pending" },
    _sum: { amountDinar: true },
  });
  return agg._sum.amountDinar ?? new Decimal(0);
}

export async function employeeWalletRemainFromMisc(employeeId: string): Promise<Decimal> {
  const rows = await prisma.employeeWalletMiscEntry.findMany({
    where: { employeeId, deletedAt: null },
    select: { direction: true, amountDinar: true },
  });
  let balance = new Decimal(0);
  for (const r of rows) {
    if (r.direction === CourierWalletMiscDirection.take) {
      balance = balance.plus(r.amountDinar);
    } else {
      balance = balance.minus(r.amountDinar);
    }
  }
  return balance;
}

export async function sumMiscTakeForEmployee(employeeId: string): Promise<Decimal> {
  const agg = await prisma.employeeWalletMiscEntry.aggregate({
    where: { employeeId, deletedAt: null, direction: CourierWalletMiscDirection.take },
    _sum: { amountDinar: true },
  });
  return agg._sum.amountDinar ?? new Decimal(0);
}

export async function sumMiscGiveForEmployee(employeeId: string): Promise<Decimal> {
  const agg = await prisma.employeeWalletMiscEntry.aggregate({
    where: { employeeId, deletedAt: null, direction: CourierWalletMiscDirection.give },
    _sum: { amountDinar: true },
  });
  return agg._sum.amountDinar ?? new Decimal(0);
}

export async function resolvePartyDisplayName(
  kind: WalletPeerPartyKind,
  courierId: string | null | undefined,
  employeeId: string | null | undefined,
): Promise<string> {
  if (kind === WalletPeerPartyKind.admin) return "الإدارة";
  if (kind === WalletPeerPartyKind.courier && courierId) {
    const c = await prisma.courier.findUnique({ where: { id: courierId }, select: { name: true } });
    return c?.name?.trim() || "مندوب";
  }
  if (kind === WalletPeerPartyKind.employee && employeeId) {
    const prep = await prisma.companyPreparer.findFirst({ where: { walletEmployeeId: employeeId }, select: { name: true } });
    if (prep) return `مجهز · ${prep.name}`;
    const e = await prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true } });
    return e?.name?.trim() || "مجهز";
  }
  return "—";
}

type Tx = Prisma.TransactionClient;

/**
 * دالة تسجيل القيود المالية المزدوجة (الطرفين) فور قبول التحويل.
 */
export async function writeLedgerEntriesForAcceptedTransfer(
  tx: Tx,
  transfer: {
    id: string;
    amountDinar: Decimal;
    handoverLocation: string;
    fromKind: WalletPeerPartyKind;
    fromCourierId: string | null;
    fromEmployeeId: string | null;
    toKind: WalletPeerPartyKind;
    toCourierId: string | null;
    toEmployeeId: string | null;
  }
): Promise<void> {
  const fromName = await resolvePartyDisplayName(transfer.fromKind, transfer.fromCourierId, transfer.fromEmployeeId);
  const toName = await resolvePartyDisplayName(transfer.toKind, transfer.toCourierId, transfer.toEmployeeId);
  const loc = transfer.handoverLocation.trim() || "—";

  // تعديل: إذا كان التحويل موجهاً للإدارة، لا نسجل "أعطيت" في سجل المحفظة للمندوب
  // لأن المبلغ سيُستقطع مباشرة من خانة "للإدارة" في الحسابات الكلية.
  const isToAdmin = transfer.toKind === WalletPeerPartyKind.admin;

  // 1. تسجيل الصادر (أعطيت) عند المرسل - فقط إذا لم يكن المستلم هو الإدارة
  if (!isToAdmin) {
    if (transfer.fromKind === WalletPeerPartyKind.courier && transfer.fromCourierId) {
      await tx.courierWalletMiscEntry.create({
        data: {
          courierId: transfer.fromCourierId,
          direction: CourierWalletMiscDirection.give,
          amountDinar: transfer.amountDinar,
          label: `تحويل إلى ${toName} — ${loc}`,
        },
      });
    } else if (transfer.fromKind === WalletPeerPartyKind.employee && transfer.fromEmployeeId) {
      await tx.employeeWalletMiscEntry.create({
        data: {
          employeeId: transfer.fromEmployeeId,
          direction: CourierWalletMiscDirection.give,
          amountDinar: transfer.amountDinar,
          label: `تحويل إلى ${toName} — ${loc}`,
        },
      });
    }
  }

  // 2. تسجيل الوارد (أخذت) عند المستلم
  if (isToAdmin) return; // الإدارة لا تسجل في ledger المحفظة اليدوية

  if (transfer.toKind === WalletPeerPartyKind.courier && transfer.toCourierId) {
    await tx.courierWalletMiscEntry.create({
      data: {
        courierId: transfer.toCourierId,
        direction: CourierWalletMiscDirection.take,
        amountDinar: transfer.amountDinar,
        label: `تحويل من ${fromName} — ${loc}`,
      },
    });
  } else if (transfer.toKind === WalletPeerPartyKind.employee && transfer.toEmployeeId) {
    await tx.employeeWalletMiscEntry.create({
      data: {
        employeeId: transfer.toEmployeeId,
        direction: CourierWalletMiscDirection.take,
        amountDinar: transfer.amountDinar,
        label: `تحويل من ${fromName} — ${loc}`,
      },
    });
  }
}
