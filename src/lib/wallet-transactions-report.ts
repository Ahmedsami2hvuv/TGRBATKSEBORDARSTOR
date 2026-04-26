import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";

export type WalletTxnReportRow = {
  id: string;
  createdAt: Date;
  category: string;
  summary: string;
  ownerLabel: string;
  /**
   * موجب = وارد للمحفظة المعروضة، سالب = صادر.
   * عند null (تحويل في وضع «الكل») يُعرض absoluteAmountDinar بدون اتجاه موحّد.
   */
  signedAmountDinar: Decimal | null;
  absoluteAmountDinar: Decimal;
  /** لربط صف معاملات نقد الطلبات بصفحة الطلب في لوحة الإدارة */
  orderId?: string | null;
};

/** تصفية نتائج المستودع بنص حر (اسم، نوع، مبلغ، رقم طلب، …). */
export function filterWalletTxnRowsByQuery(
  rows: WalletTxnReportRow[],
  q: string,
): WalletTxnReportRow[] {
  const t = q.trim().toLowerCase();
  if (!t) return rows;
  return rows.filter((r) => {
    const blob = [
      r.category,
      r.summary,
      r.ownerLabel,
      r.id,
      r.orderId ?? "",
      r.absoluteAmountDinar.toString(),
      r.signedAmountDinar?.toString() ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(t);
  });
}

function moneyKindLabel(kind: string): string {
  if (kind === MONEY_KIND_PICKUP) return "صادر (تسليم للعميل)";
  if (kind === MONEY_KIND_DELIVERY) return "وارد (استلام من الزبون)";
  return kind;
}

function peerPartyLabel(
  k: string,
  courierId: string | null,
  employeeId: string | null,
  courierName?: string | null,
  employeeName?: string | null,
): string {
  if (k === "admin") return "الإدارة";
  if (k === "courier" && courierId) return `مندوب: ${courierName ?? courierId}`;
  if (k === "employee" && employeeId) return `موظف: ${employeeName ?? employeeId}`;
  return k;
}

export type PartyFilter =
  | { mode: "all" }
  | { mode: "courier"; courierId: string }
  | { mode: "employee"; employeeId: string }
  | { mode: "preparer"; preparerId: string };

export function parsePartyFilterFromSearchParams(sp: {
  party?: string;
}): PartyFilter {
  const raw = String(sp.party ?? "").trim();
  if (!raw) return { mode: "all" };
  const idx = raw.indexOf(":");
  if (idx <= 0) return { mode: "all" };
  const kind = raw.slice(0, idx);
  const id = raw.slice(idx + 1).trim();
  if (!id) return { mode: "all" };
  if (kind === "courier") return { mode: "courier", courierId: id };
  if (kind === "employee") return { mode: "employee", employeeId: id };
  if (kind === "preparer") return { mode: "preparer", preparerId: id };
  return { mode: "all" };
}

export function partyFilterToQueryParam(p: PartyFilter): string {
  if (p.mode === "all") return "";
  if (p.mode === "courier") return `courier:${p.courierId}`;
  if (p.mode === "employee") return `employee:${p.employeeId}`;
  return `preparer:${p.preparerId}`;
}

/**
 * تحميل سجل معاملات النقد (طلبات + محافظ + تحويلات) مع تصفية زمنية واختيارية حسب صاحب المعاملة.
 */
export async function loadWalletTransactionReport(
  from: Date,
  to: Date,
  filter: PartyFilter,
): Promise<WalletTxnReportRow[]> {
  const dateWhere = { gte: from, lte: to };

  const rows: WalletTxnReportRow[] = [];

  const pushOrderEvents = async () => {
    if (filter.mode === "employee") return;

    if (filter.mode === "courier") {
      const evs = await prisma.orderCourierMoneyEvent.findMany({
        where: {
          deletedAt: null,
          createdAt: dateWhere,
          courierId: filter.courierId,
        },
        include: {
          order: {
            select: {
              orderNumber: true,
              shop: { select: { name: true } },
            },
          },
          courier: { select: { name: true } },
          recordedByCompanyPreparer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      for (const e of evs) {
        const w = e.kind === MONEY_KIND_DELIVERY ? e.amountDinar : e.amountDinar.neg();
        rows.push({
          id: `oe:${e.id}`,
          createdAt: e.createdAt,
          category: "طلب (نقد)",
          summary: `${moneyKindLabel(e.kind)} — طلب #${e.order.orderNumber} — ${e.order.shop.name}`,
          ownerLabel: e.courier?.name?.trim()
            ? `مندوب: ${e.courier.name.trim()}`
            : e.recordedByCompanyPreparer?.name?.trim()
              ? `مجهز: ${e.recordedByCompanyPreparer.name.trim()}`
              : "—",
          signedAmountDinar: w,
          absoluteAmountDinar: e.amountDinar.abs(),
          orderId: e.orderId,
        });
      }
      return;
    }

    if (filter.mode === "preparer") {
      const prep = await prisma.companyPreparer.findUnique({
        where: { id: filter.preparerId },
        select: {
          id: true,
          name: true,
          walletEmployeeId: true,
          shopLinks: { select: { shopId: true } },
        },
      });
      if (!prep) return;
      const shopIds = prep.shopLinks.map((s) => s.shopId);
      const evs = await prisma.orderCourierMoneyEvent.findMany({
        where: {
          deletedAt: null,
          createdAt: dateWhere,
          OR: [
            ...(shopIds.length ? [{ order: { shopId: { in: shopIds } } }] : []),
            { recordedByCompanyPreparerId: prep.id },
          ],
        },
        include: {
          order: {
            select: {
              orderNumber: true,
              shop: { select: { name: true } },
            },
          },
          courier: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      for (const e of evs) {
        const w = e.kind === MONEY_KIND_DELIVERY ? e.amountDinar : e.amountDinar.neg();
        rows.push({
          id: `oe:${e.id}`,
          createdAt: e.createdAt,
          category: "طلب (نقد)",
          summary: `${moneyKindLabel(e.kind)} — طلب #${e.order.orderNumber} — ${e.order.shop.name}`,
          ownerLabel: e.courier?.name?.trim()
            ? `مجهز شركة: ${prep.name} — مندوب: ${e.courier.name.trim()}`
            : `مجهز شركة: ${prep.name}`,
          signedAmountDinar: w,
          absoluteAmountDinar: e.amountDinar.abs(),
          orderId: e.orderId,
        });
      }
      return;
    }

    const evs = await prisma.orderCourierMoneyEvent.findMany({
      where: { deletedAt: null, createdAt: dateWhere },
      include: {
        order: {
          select: {
            orderNumber: true,
            shop: { select: { name: true } },
          },
        },
        courier: { select: { name: true } },
        recordedByCompanyPreparer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    for (const e of evs) {
      const w = e.kind === MONEY_KIND_DELIVERY ? e.amountDinar : e.amountDinar.neg();
      const prep = e.recordedByCompanyPreparer;
      rows.push({
        id: `oe:${e.id}`,
        createdAt: e.createdAt,
        category: "طلب (نقد)",
        summary: `${moneyKindLabel(e.kind)} — طلب #${e.order.orderNumber} — ${e.order.shop.name}`,
        ownerLabel: (() => {
          const courierName = e.courier?.name?.trim() || "—";
          const prepName = prep?.name?.trim() || "";
          if (prepName) return `مندوب: ${courierName} — سجّلها المجهز ${prepName}`;
          return `مندوب: ${courierName}`;
        })(),
        signedAmountDinar: w,
        absoluteAmountDinar: e.amountDinar.abs(),
        orderId: e.orderId,
      });
    }
  };

  const pushCourierMisc = async () => {
    if (filter.mode === "employee" || filter.mode === "preparer") return;

    const where =
      filter.mode === "courier"
        ? {
            deletedAt: null,
            createdAt: dateWhere,
            courierId: filter.courierId,
          }
        : { deletedAt: null, createdAt: dateWhere };

    const entries = await prisma.courierWalletMiscEntry.findMany({
      where,
      include: { courier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    for (const m of entries) {
      const w = m.direction === "take" ? m.amountDinar : m.amountDinar.neg();
      rows.push({
        id: `cm:${m.id}`,
        createdAt: m.createdAt,
        category: "محفظة مندوب",
        summary: `${m.direction === "take" ? "أخذت" : "أعطيت"} — ${m.label}`,
        ownerLabel: `مندوب: ${m.courier.name}`,
        signedAmountDinar: w,
        absoluteAmountDinar: m.amountDinar.abs(),
      });
    }
  };

  const pushEmployeeMisc = async () => {
    if (filter.mode === "courier") return;

    let employeeIds: string[] | undefined;
    if (filter.mode === "employee") {
      employeeIds = [filter.employeeId];
    } else if (filter.mode === "preparer") {
      const prep = await prisma.companyPreparer.findUnique({
        where: { id: filter.preparerId },
        select: { walletEmployeeId: true, name: true },
      });
      if (!prep?.walletEmployeeId) return;
      employeeIds = [prep.walletEmployeeId];
    }

    const where =
      employeeIds != null
        ? {
            deletedAt: null,
            createdAt: dateWhere,
            employeeId: { in: employeeIds },
          }
        : { deletedAt: null, createdAt: dateWhere };

    const entries = await prisma.employeeWalletMiscEntry.findMany({
      where,
      include: {
        employee: {
          select: {
            name: true,
            shop: { select: { name: true } },
            walletForCompanyPreparer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    for (const m of entries) {
      const w = m.direction === "take" ? m.amountDinar : m.amountDinar.neg();
      const cp = m.employee.walletForCompanyPreparer;
      const owner = cp
        ? `مجهز شركة: ${cp.name}`
        : `موظف محل: ${m.employee.name} (${m.employee.shop.name})`;
      rows.push({
        id: `em:${m.id}`,
        createdAt: m.createdAt,
        category: "محفظة موظف / مجهز",
        summary: `${m.direction === "take" ? "أخذت" : "أعطيت"} — ${m.label}`,
        ownerLabel: owner,
        signedAmountDinar: w,
        absoluteAmountDinar: m.amountDinar.abs(),
      });
    }
  };

  const pushTransfers = async () => {
    if (filter.mode === "courier") {
      const cid = filter.courierId;
      const courierMeta = await prisma.courier.findUnique({
        where: { id: cid },
        select: { name: true },
      });
      const transfers = await prisma.walletPeerTransfer.findMany({
        where: {
          createdAt: dateWhere,
          OR: [{ fromCourierId: cid }, { toCourierId: cid }],
        },
        include: {
          fromCourier: { select: { name: true } },
          toCourier: { select: { name: true } },
          fromEmployee: { select: { name: true } },
          toEmployee: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      for (const t of transfers) {
        const fromL = peerPartyLabel(
          t.fromKind,
          t.fromCourierId,
          t.fromEmployeeId,
          t.fromCourier?.name,
          t.fromEmployee?.name,
        );
        const toL = peerPartyLabel(
          t.toKind,
          t.toCourierId,
          t.toEmployeeId,
          t.toCourier?.name,
          t.toEmployee?.name,
        );
        const incoming = t.toCourierId === cid;
        const signed = incoming ? t.amountDinar : t.amountDinar.neg();
        rows.push({
          id: `wt:${t.id}`,
          createdAt: t.createdAt,
          category: "تحويل محفظة",
          summary: `${fromL} ← ${t.amountDinar.toString()} د.ع → ${toL} — ${t.handoverLocation} — ${t.status === "pending" ? "معلّق" : t.status === "accepted" ? "مقبول" : "مرفوض"}`,
          ownerLabel: `مندوب: ${courierMeta?.name ?? cid}`,
          signedAmountDinar: signed,
          absoluteAmountDinar: t.amountDinar.abs(),
        });
      }
      return;
    }

    if (filter.mode === "employee") {
      const eid = filter.employeeId;
      const employeeMeta = await prisma.employee.findUnique({
        where: { id: eid },
        select: { name: true, shop: { select: { name: true } } },
      });
      const transfers = await prisma.walletPeerTransfer.findMany({
        where: {
          createdAt: dateWhere,
          OR: [{ fromEmployeeId: eid }, { toEmployeeId: eid }],
        },
        include: {
          fromCourier: { select: { name: true } },
          toCourier: { select: { name: true } },
          fromEmployee: { select: { name: true } },
          toEmployee: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      for (const t of transfers) {
        const fromL = peerPartyLabel(
          t.fromKind,
          t.fromCourierId,
          t.fromEmployeeId,
          t.fromCourier?.name,
          t.fromEmployee?.name,
        );
        const toL = peerPartyLabel(
          t.toKind,
          t.toCourierId,
          t.toEmployeeId,
          t.toCourier?.name,
          t.toEmployee?.name,
        );
        const incoming = t.toEmployeeId === eid;
        const signed = incoming ? t.amountDinar : t.amountDinar.neg();
        rows.push({
          id: `wt:${t.id}`,
          createdAt: t.createdAt,
          category: "تحويل محفظة",
          summary: `${fromL} ← ${t.amountDinar.toString()} د.ع → ${toL} — ${t.handoverLocation} — ${t.status === "pending" ? "معلّق" : t.status === "accepted" ? "مقبول" : "مرفوض"}`,
          ownerLabel: `موظف محل: ${employeeMeta?.name ?? eid} (${employeeMeta?.shop.name ?? "—"})`,
          signedAmountDinar: signed,
          absoluteAmountDinar: t.amountDinar.abs(),
        });
      }
      return;
    }

    if (filter.mode === "preparer") {
      const prep = await prisma.companyPreparer.findUnique({
        where: { id: filter.preparerId },
        select: { walletEmployeeId: true, name: true },
      });
      if (!prep?.walletEmployeeId) return;
      const wid = prep.walletEmployeeId;
      const transfers = await prisma.walletPeerTransfer.findMany({
        where: {
          createdAt: dateWhere,
          OR: [{ fromEmployeeId: wid }, { toEmployeeId: wid }],
        },
        include: {
          fromCourier: { select: { name: true } },
          toCourier: { select: { name: true } },
          fromEmployee: { select: { name: true } },
          toEmployee: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      for (const t of transfers) {
        const fromL = peerPartyLabel(
          t.fromKind,
          t.fromCourierId,
          t.fromEmployeeId,
          t.fromCourier?.name,
          t.fromEmployee?.name,
        );
        const toL = peerPartyLabel(
          t.toKind,
          t.toCourierId,
          t.toEmployeeId,
          t.toCourier?.name,
          t.toEmployee?.name,
        );
        const incoming = t.toEmployeeId === wid;
        const signed = incoming ? t.amountDinar : t.amountDinar.neg();
        rows.push({
          id: `wt:${t.id}`,
          createdAt: t.createdAt,
          category: "تحويل محفظة",
          summary: `${fromL} ← ${t.amountDinar.toString()} د.ع → ${toL} — ${t.handoverLocation} — ${t.status === "pending" ? "معلّق" : t.status === "accepted" ? "مقبول" : "مرفوض"}`,
          ownerLabel: `مجهز شركة: ${prep.name}`,
          signedAmountDinar: signed,
          absoluteAmountDinar: t.amountDinar.abs(),
        });
      }
      return;
    }

    const transfers = await prisma.walletPeerTransfer.findMany({
      where: { createdAt: dateWhere },
      include: {
        fromCourier: { select: { name: true } },
        toCourier: { select: { name: true } },
        fromEmployee: { select: { name: true } },
        toEmployee: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    for (const t of transfers) {
      const fromL = peerPartyLabel(
        t.fromKind,
        t.fromCourierId,
        t.fromEmployeeId,
        t.fromCourier?.name,
        t.fromEmployee?.name,
      );
      const toL = peerPartyLabel(
        t.toKind,
        t.toCourierId,
        t.toEmployeeId,
        t.toCourier?.name,
        t.toEmployee?.name,
      );
      rows.push({
        id: `wt:${t.id}`,
        createdAt: t.createdAt,
        category: "تحويل محفظة",
        summary: `${fromL} ← ${t.amountDinar.toString()} د.ع → ${toL} — ${t.handoverLocation} — ${t.status === "pending" ? "معلّق" : t.status === "accepted" ? "مقبول" : "مرفوض"}`,
        ownerLabel: `${fromL} ↔ ${toL}`,
        signedAmountDinar: null,
        absoluteAmountDinar: t.amountDinar.abs(),
      });
    }
  };

  await pushOrderEvents();
  await pushCourierMisc();
  await pushEmployeeMisc();
  await pushTransfers();

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return rows;
}
