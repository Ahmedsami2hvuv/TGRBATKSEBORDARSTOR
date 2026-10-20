"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { computeMandoubAdminTotalAllTimeDinar, computeMandoubWalletRemainAllTimeDinar } from "@/lib/mandoub-wallet-carry";
import { getPreparerMoneyTotals } from "@/lib/preparer-combined-wallet-totals";
import { ensureMissingPreparerMoneyEvents } from "@/lib/preparer-shop-order-money-totals";
import { getPublicAppUrl } from "@/lib/app-url";
import { Decimal } from "@prisma/client/runtime/library";
import { CourierWalletMiscDirection, WalletPeerPartyKind } from "@prisma/client";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { syncOrderCourierMoneyExpectations } from "@/lib/order-courier-money-sync";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export type PartnerType = "courier" | "preparer" | "shop" | "customer" | "external" | "supplier";

export interface PartnerWithBalance {
  id: string;
  name: string;
  phone: string | null;
  type: PartnerType;
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;
  balance: number; // الرصيد الكلي = اليدوي + التلقائي
  manualBalance: number; // الرصيد اليدوي فقط
  autoBalance: number; // الرصيد التلقائي (المحفظة أو ديون الطلبات)
  totalGave: number;
  totalTook: number;
  walletRemain?: number; // متبقي المحفظة للمندوب/المجهز (من النظام)
  orderCount?: number; // عدد الطلبات التراكمية للمحل/الشريك
  notesSummary?: string; // ملخص تفاصيل وملاحظات المعاملات للبحث الشامل السريع
}

// دالة مساعدة لاستخراج تاريخ آخر تصفير للشريك من سجل معاملاته
function getPartnerLastZeroDate(transactions: { kind: string; note: string | null; createdAt: Date }[]): Date | null {
  const zeroTxs = transactions.filter(t => 
    t.note && (
      t.note.includes("تصفير") || 
      t.note.includes("تصفية") || 
      t.note.includes("تصفيه") || 
      t.note.includes("[مصفّرة]")
    )
  );
  if (zeroTxs.length === 0) return null;
  zeroTxs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return new Date(zeroTxs[0].createdAt);
}

// دالة مساعدة لجلب تاريخ التصفير العام لدفتر الديون
export async function getCreditBookGlobalResetDate(): Promise<Date | null> {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: {
          target: "credit_book",
          section: "system_global_reset"
        }
      }
    });
    if (setting && setting.config && typeof setting.config === "object") {
      const resetAt = (setting.config as any).resetAt;
      if (resetAt) return new Date(resetAt);
    }
    return null;
  } catch (e) {
    console.error("Failed to get credit book global reset date:", e);
    return null;
  }
}

// دالة مساعدة لحساب ديون طلبات المحلات غير المسددة من تاريخ آخر تصفير وصاعداً
async function getShopAutoDebt(shopId: string, lastZeroDate?: Date | null): Promise<{ autoDebt: number; orderCount: number; orders: any[] }> {
  await ensureMissingPreparerMoneyEvents(undefined, shopId);

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true }
  });

  if (!shop) return { autoDebt: 0, orderCount: 0, orders: [] };

  const whereClause: any = {
    shopId,
    shopCostPaidAt: null,
    OR: [
      { status: { in: ["delivered", "archived"] } },
      { archivedAt: { not: null } }
    ]
  };

  const globalResetDate = await getCreditBookGlobalResetDate();
  let effectiveStartDate: Date | null = null;
  if (globalResetDate && lastZeroDate) {
    effectiveStartDate = new Date(Math.max(globalResetDate.getTime(), lastZeroDate.getTime()));
  } else {
    effectiveStartDate = globalResetDate || lastZeroDate || null;
  }

  // احتساب الطلبات فقط من تاريخ آخر تصفير وصاعداً
  if (effectiveStartDate) {
    whereClause.createdAt = { gte: effectiveStartDate };
  }

  const orders = await prisma.order.findMany({
    where: whereClause,
    select: {
      id: true,
      orderNumber: true,
      orderSubtotal: true,
      prepaidAll: true,
      deliveryPrice: true,
      createdAt: true,
      moneyEvents: {
        where: {
          kind: { in: ["pickup_out", "delivery_in"] },
          deletedAt: null
        },
        select: {
          id: true,
          amountDinar: true,
          kind: true,
          createdAt: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  let autoGave = 0;
  let autoTook = 0;

  for (const o of orders) {
    const subtotal = Number(o.orderSubtotal || 0);
    if (subtotal > 0) {
      autoTook += subtotal;
    }

    const pickupPaid = o.moneyEvents
      .filter(me => me.kind === "pickup_out")
      .reduce((acc, me) => acc + Number(me.amountDinar || 0), 0);
    autoGave += pickupPaid;

    if (o.prepaidAll && Number(o.deliveryPrice || 0) > 0) {
      const delPrice = Number(o.deliveryPrice);
      const hasMatchingDeliveryIn = o.moneyEvents.some(
        me => me.kind === "delivery_in" && Number(me.amountDinar || 0) === delPrice
      );

      if (!hasMatchingDeliveryIn) {
        autoGave += delPrice;
      }
    }
  }

  return { autoDebt: autoTook - autoGave, orderCount: orders.length, orders };
}

// دالة مساعدة لحساب ذمة المندوب بدقة منذ تاريخ تصفير محدد
async function computeCourierAdminTotalSince(courierId: string, sinceDate: Date | null): Promise<number> {
  if (!sinceDate) {
    const adminTotal = await computeMandoubAdminTotalAllTimeDinar(courierId);
    return adminTotal.toNumber();
  }

  const whereEvent: any = {
    courierId,
    deletedAt: null,
    recordedByCompanyPreparerId: null,
    createdAt: { gte: sinceDate }
  };
  const whereMisc: any = {
    courierId,
    deletedAt: null,
    createdAt: { gte: sinceDate }
  };
  const whereTransfer: any = {
    fromCourierId: courierId,
    toKind: WalletPeerPartyKind.admin,
    status: "accepted",
    createdAt: { gte: sinceDate }
  };
  const whereEarnings: any = {
    status: { in: ["delivered", "archived"] },
    createdAt: { gte: sinceDate },
    OR: [
      { courierEarningForCourierId: courierId },
      { assignedCourierId: courierId },
    ]
  };

  const [orderSums, miscGroups, earningsOrders, transfersRes, tipsRes] = await Promise.all([
    prisma.orderCourierMoneyEvent.groupBy({
      by: ['kind'],
      where: whereEvent,
      _sum: { amountDinar: true },
    }),
    prisma.courierWalletMiscEntry.groupBy({
      by: ['direction'],
      where: whereMisc,
      _sum: { amountDinar: true },
    }),
    prisma.order.findMany({
      where: whereEarnings,
      select: {
        courierEarningDinar: true,
        courierEarningForCourierId: true,
        assignedCourierId: true,
        deliveryPrice: true,
        courier: { select: { vehicleType: true, zeroEarning: true } },
      }
    }),
    prisma.walletPeerTransfer.aggregate({
      where: whereTransfer,
      _sum: { amountDinar: true }
    }),
    prisma.courierWalletMiscEntry.aggregate({
      where: {
        ...whereMisc,
        direction: CourierWalletMiscDirection.take,
        label: { contains: "[إكرامية]" }
      },
      _sum: { amountDinar: true }
    })
  ]);

  const sumOrderWard = orderSums.find(g => g.kind === MONEY_KIND_DELIVERY)?._sum.amountDinar ?? new Decimal(0);
  const sumOrderSader = orderSums.find(g => g.kind === MONEY_KIND_PICKUP)?._sum.amountDinar ?? new Decimal(0);

  const sumMiscTake = miscGroups.find(g => g.direction === CourierWalletMiscDirection.take)?._sum.amountDinar ?? new Decimal(0);
  const sumMiscGive = miscGroups.find(g => g.direction === CourierWalletMiscDirection.give)?._sum.amountDinar ?? new Decimal(0);

  const ward = sumOrderWard.plus(sumMiscTake);
  const sader = sumOrderSader.plus(sumMiscGive);
  const transfers = transfersRes._sum.amountDinar ?? new Decimal(0);
  const tipsTakeDinar = tipsRes._sum.amountDinar ?? new Decimal(0);

  let earningsSum = new Decimal(0);
  for (const o of earningsOrders) {
    const isOwner =
      o.courierEarningForCourierId === courierId ||
      (!o.courierEarningForCourierId && o.assignedCourierId === courierId);
    if (!isOwner) continue;

    if (o.courierEarningDinar != null) {
      earningsSum = earningsSum.plus(o.courierEarningDinar);
    } else if (o.deliveryPrice != null && o.courier) {
      const { computeCourierDeliveryEarningDinar } = await import("@/lib/courier-earnings");
      const computed = computeCourierDeliveryEarningDinar(
        o.courier.vehicleType as any,
        o.deliveryPrice as any,
        o.courier.zeroEarning
      );
      if (computed != null) {
        earningsSum = earningsSum.plus(computed);
      }
    }
  }

  const netAdminDinar = ward.minus(sader).minus(earningsSum).minus(tipsTakeDinar).minus(transfers);
  return netAdminDinar.toNumber();
}

// دالة مساعدة لحساب ذمة المجهز بدقة منذ تاريخ تصفير محدد
async function computePreparerMoneyTotalsSince(
  preparerId: string,
  sinceDate: Date | null,
  preparerData?: any
): Promise<number> {
  if (!sinceDate) {
    const prepTotals = await getPreparerMoneyTotals(preparerId);
    return prepTotals ? prepTotals.remain.toNumber() : 0;
  }

  let preparer = preparerData;
  if (!preparer) {
    preparer = await prisma.companyPreparer.findFirst({
      where: { id: preparerId, active: true },
      select: {
        shopLinks: { select: { shopId: true } },
        walletEmployeeId: true,
      },
    });
  }
  if (!preparer) return 0;

  const shopIds = preparer.shopLinks?.map((l: any) => l.shopId) || [];
  if (shopIds.length === 0 && !preparer.walletEmployeeId) return 0;

  const orderWhere: any = {
    deletedAt: null,
    createdAt: { gte: sinceDate },
    OR: [
      { recordedByCompanyPreparerId: preparerId },
      ...(shopIds.length > 0 ? [{ order: { shopId: { in: shopIds } } }] : [])
    ]
  };

  const orderEvents = await prisma.orderCourierMoneyEvent.groupBy({
    by: ['kind'],
    where: orderWhere,
    _sum: { amountDinar: true }
  });

  const sumDeliveryIn = orderEvents.find(g => g.kind === "delivery_in")?._sum.amountDinar ?? new Decimal(0);
  const sumPickupOut = orderEvents.find(g => g.kind === "pickup_out")?._sum.amountDinar ?? new Decimal(0);

  let ward = sumDeliveryIn;
  let sader = sumPickupOut;
  let pendingOutgoing = new Decimal(0);

  const wid = preparer.walletEmployeeId;
  if (wid) {
    const [miscTake, miscGive, pOut, acceptedTransfers] = await Promise.all([
      prisma.employeeWalletMiscEntry.aggregate({
        where: { employeeId: wid, deletedAt: null, createdAt: { gte: sinceDate }, direction: CourierWalletMiscDirection.take },
        _sum: { amountDinar: true }
      }),
      prisma.employeeWalletMiscEntry.aggregate({
        where: { employeeId: wid, deletedAt: null, createdAt: { gte: sinceDate }, direction: CourierWalletMiscDirection.give },
        _sum: { amountDinar: true }
      }),
      prisma.walletPeerTransfer.aggregate({
        where: { fromEmployeeId: wid, status: "pending", createdAt: { gte: sinceDate } },
        _sum: { amountDinar: true }
      }),
      prisma.walletPeerTransfer.aggregate({
        where: { fromEmployeeId: wid, toKind: WalletPeerPartyKind.admin, status: "accepted", createdAt: { gte: sinceDate } },
        _sum: { amountDinar: true }
      })
    ]);

    ward = ward.plus(miscTake._sum.amountDinar ?? new Decimal(0));
    sader = sader.plus(miscGive._sum.amountDinar ?? new Decimal(0)).plus(acceptedTransfers._sum.amountDinar ?? new Decimal(0));
    pendingOutgoing = pOut._sum.amountDinar ?? new Decimal(0);
  }

  return ward.minus(sader).minus(pendingOutgoing).toNumber();
}

// دالة مساعدة لحساب معاملات وديون المورد التلقائية من مسواق المجهز
async function getSupplierAutoDebt(supplierId: string, sinceDate?: Date | null): Promise<{ autoDebt: number; orderCount: number; orders: any[]; transactions: any[] }> {
  const globalResetDate = await getCreditBookGlobalResetDate();
  let effectiveStartDate: Date | null = null;
  if (globalResetDate && sinceDate) {
    effectiveStartDate = new Date(Math.max(globalResetDate.getTime(), sinceDate.getTime()));
  } else {
    effectiveStartDate = globalResetDate || sinceDate || null;
  }

  const whereClause: any = {
    status: { notIn: ["cancelled"] },
    preparerShoppingJson: { not: null }
  };

  if (effectiveStartDate) {
    whereClause.createdAt = { gte: effectiveStartDate };
  }

  const orders = await prisma.order.findMany({
    where: whereClause,
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      status: true,
      customerRegion: { select: { name: true } },
      courier: { select: { name: true } },
      preparerShoppingJson: true
    },
    orderBy: { createdAt: "desc" }
  });

  let totalDue = 0;
  const autoTransactions: any[] = [];
  let orderCount = 0;

  for (const o of orders) {
    let json: any = {};
    try {
      json = typeof o.preparerShoppingJson === "string" ? JSON.parse(o.preparerShoppingJson) : o.preparerShoppingJson || {};
    } catch {
      continue;
    }

    const products = Array.isArray(json.products) ? json.products : [];
    const supplierProducts = products.filter((p: any) => p && typeof p.assignedPreparerId === "string" && p.assignedPreparerId.trim() === supplierId);
    if (supplierProducts.length === 0) continue;

    orderCount++;

    let orderBuyAlf = 0;
    const productLines: string[] = [];

    for (const p of supplierProducts) {
      const effectiveCost = (p.actualBuyAlf != null && !isNaN(Number(p.actualBuyAlf)) && Number(p.actualBuyAlf) >= 0)
        ? Number(p.actualBuyAlf)
        : Number(p.buyAlf || 0);
      orderBuyAlf += effectiveCost;
      productLines.push(p.line || "منتج");
    }

    const orderBuyDinar = orderBuyAlf * 1000;
    if (orderBuyDinar <= 0) continue;

    const isPaid = Boolean(json.supplierPaid);

    autoTransactions.push({
      id: `auto-supplier-order-${o.id}`,
      amount: orderBuyDinar,
      kind: "took",
      note: `طلب رقم: #${o.orderNumber} | مسواق بضاعة مورد | المنطقة: ${o.customerRegion?.name || "—"} | المنتجات: ${productLines.join("، ")} | المندوب: ${o.courier?.name || "—"}${isPaid ? " [مسددة ✅]" : ""}`,
      createdAt: o.createdAt,
      updatedAt: o.createdAt,
      isAuto: true,
      orderId: o.id,
      isPaid
    });

    if (!isPaid) {
      totalDue += orderBuyDinar;
    } else {
      autoTransactions.push({
        id: `auto-supplier-paid-${o.id}`,
        amount: orderBuyDinar,
        kind: "gave",
        note: `تسديد قيمة بضاعة الطلب #${o.orderNumber} للمورد`,
        createdAt: json.supplierPaidAt ? new Date(json.supplierPaidAt) : o.createdAt,
        updatedAt: json.supplierPaidAt ? new Date(json.supplierPaidAt) : o.createdAt,
        isAuto: true,
        orderId: o.id
      });
    }
  }

  return { autoDebt: totalDue, orderCount, orders, transactions: autoTransactions };
}

// دالة لتطهير الحسابات التالفة بسبب تكرار بادئات الحذف
async function cleanUpCorruptedPartners() {
  try {
    const corruptedPartners = await prisma.creditBookPartner.findMany({
      where: {
        type: {
          startsWith: "deleted_deleted_"
        }
      }
    });

    if (corruptedPartners.length === 0) return;

    for (const partner of corruptedPartners) {
      let baseType = partner.type;
      while (baseType.startsWith("deleted_")) {
        baseType = baseType.substring("deleted_".length);
      }
      const correctDeletedType = `deleted_${baseType}`;

      if (partner.externalId) {
        const duplicate = await prisma.creditBookPartner.findFirst({
          where: {
            externalId: partner.externalId,
            type: correctDeletedType,
            id: { not: partner.id }
          }
        });

        if (duplicate) {
          // دمج المعاملات إن وجدت
          await prisma.creditBookTransaction.updateMany({
            where: { partnerId: partner.id },
            data: { partnerId: duplicate.id }
          });
          // حذف الشريك التالف المكرر
          await prisma.creditBookPartner.delete({
            where: { id: partner.id }
          });
        } else {
          // تعديل النوع بأمان
          await prisma.creditBookPartner.update({
            where: { id: partner.id },
            data: { type: correctDeletedType }
          });
        }
      } else {
        await prisma.creditBookPartner.update({
          where: { id: partner.id },
          data: { type: correctDeletedType }
        });
      }
    }
  } catch (err) {
    console.error("Error in cleanUpCorruptedPartners:", err);
  }
}

// 1. جلب قائمة الأطراف مع احتساب الأرصدة اليدوية والتلقائية
export async function getPartners(searchQuery?: string, typeFilter?: string): Promise<PartnerWithBalance[]> {
  try {
    // هجرة صامتة لضمان وجود العمود في قاعدة البيانات الفعلية
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "hideFromCreditBook" BOOLEAN DEFAULT false;`
      );
    } catch (migErr) {
      console.error("[Prisma] Silent migration in getPartners failed:", migErr);
    }

    // تنظيف البيانات التالفة بصمت
    try {
      await cleanUpCorruptedPartners();
    } catch (cleanErr) {
      console.error("[Prisma] Clean up failed:", cleanErr);
    }

    // مزامنة صامتة وتلقائية للأطراف (المجهزين والمناديب والمحلات والموردين) لضمان دخول المجهزين الجدد تلقائياً في دفتر الديون
    try {
      await syncSystemPartners();
    } catch (syncErr) {
      console.error("[CreditBook] Auto sync system partners failed:", syncErr);
    }



    try {
      const rootExists = await prisma.creditBookPartner.findFirst({
        where: {
          externalId: "accumulated_salaries_root",
          type: "external"
        }
      });
      if (!rootExists) {
        await prisma.creditBookPartner.create({
          data: {
            name: "رواتب المجهزين المتراكمه",
            phone: null,
            type: "external",
            externalId: "accumulated_salaries_root"
          }
        });
      }
    } catch (rootErr) {
      console.error("Failed to ensure accumulated salaries root partner exists:", rootErr);
    }

    const whereClause: any = {
      NOT: {
        type: {
          startsWith: "deleted_"
        }
      }
    };

    if (searchQuery) {
      whereClause.name = {
        contains: searchQuery,
        mode: "insensitive",
      };
    }

    if (typeFilter && typeFilter !== "all") {
      whereClause.type = typeFilter;
    }

    const partners = await prisma.creditBookPartner.findMany({
      where: whereClause,
      include: {
        transactions: {
          select: {
            amount: true,
            kind: true,
            note: true,
            createdAt: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // حساب الأرصدة بالتوازي باستخدام Promise.all لتفادي التأخير والعمليات المتتالية البطئية
    const mapped = await Promise.all(
      partners.map(async (p) => {
        let totalGave = 0;
        let totalTook = 0;
        let latestActivity = new Date(p.updatedAt).getTime();

        p.transactions.forEach((t) => {
          const amt = Number(t.amount);
          const isExp = t.kind === "expense" || (t.note && t.note.includes("[مصروفات]"));
          if (isExp) {
            // للمحلات والمجهزين والموردين: المصروفات مستحقة لهم علينا (يطلبونا إياها وتزيد ما يطلبونه)
            if (p.type === "shop" || p.type === "preparer" || p.type === "supplier") {
              totalTook += amt;
            } else {
              totalGave += amt;
            }
          } else if (t.kind === "gave") {
            totalGave += amt;
          } else if (t.kind === "took") {
            totalTook += amt;
          }
          if (t.createdAt) {
            latestActivity = Math.max(latestActivity, new Date(t.createdAt).getTime());
          }
        });

        const manualBalance = totalGave - totalTook;
        let autoBalance = 0;
        let walletRemain = 0;
        let shopOrderCount = 0;

        if (p.type === "courier" && p.externalId) {
          try {
            const globalResetDate = await getCreditBookGlobalResetDate();
            const courier = await prisma.courier.findUnique({
              where: { id: p.externalId },
              select: { mandoubTotalsResetAt: true }
            });
            const lastZero = getPartnerLastZeroDate(p.transactions);

            let effectiveDate: Date | null = globalResetDate;
            if (courier?.mandoubTotalsResetAt) {
              if (!effectiveDate || courier.mandoubTotalsResetAt > effectiveDate) {
                effectiveDate = courier.mandoubTotalsResetAt;
              }
            }
            if (lastZero) {
              if (!effectiveDate || lastZero > effectiveDate) {
                effectiveDate = lastZero;
              }
            }

            autoBalance = await computeCourierAdminTotalSince(p.externalId, effectiveDate);
            walletRemain = autoBalance;
          } catch (e) {
            console.error(`Failed to get courier auto debt for ${p.name}:`, e);
          }
        } else if (p.type === "preparer" && p.externalId) {
          try {
            const globalResetDate = await getCreditBookGlobalResetDate();
            const preparer = await prisma.companyPreparer.findFirst({
              where: { id: p.externalId },
              select: { orderListResetAt: true, shopLinks: { select: { shopId: true } }, walletEmployeeId: true }
            });
            const lastZero = getPartnerLastZeroDate(p.transactions);

            let effectiveDate: Date | null = globalResetDate;
            if (preparer?.orderListResetAt) {
              if (!effectiveDate || preparer.orderListResetAt > effectiveDate) {
                effectiveDate = preparer.orderListResetAt;
              }
            }
            if (lastZero) {
              if (!effectiveDate || lastZero > effectiveDate) {
                effectiveDate = lastZero;
              }
            }

            autoBalance = await computePreparerMoneyTotalsSince(p.externalId, effectiveDate, preparer);
            walletRemain = autoBalance;
          } catch (e) {
            console.error(`Failed to get preparer auto debt for ${p.name}:`, e);
          }
        } else if (p.type === "external" && p.externalId === "accumulated_salaries_root") {
          try {
            const globalResetDate = await getCreditBookGlobalResetDate();
            if (globalResetDate) {
              autoBalance = 0;
            } else {
              const preparers = await prisma.companyPreparer.findMany({
                where: { active: true },
                select: { id: true }
              });
              const { calculateAccumulatedSalaryInternal } = await import("@/app/preparer/actions");
              let totalAccumulated = 0;
              for (const prep of preparers) {
                const salaryStats = await calculateAccumulatedSalaryInternal(prep.id);
                totalAccumulated += salaryStats.accumulatedSalary || 0;
              }
              autoBalance = -totalAccumulated;
            }
          } catch (e) {
            console.error("Failed to calculate total accumulated salaries for root partner:", e);
          }
        } else if (p.type === "supplier" && p.externalId) {
          try {
            const lastZero = getPartnerLastZeroDate(p.transactions);
            const { autoDebt, orderCount } = await getSupplierAutoDebt(p.externalId, lastZero);
            autoBalance = -autoDebt;
            shopOrderCount = orderCount;
          } catch (e) {
            console.error(`Failed to get supplier auto debt for ${p.name}:`, e);
          }
        } else if ((p.type === "shop" || p.type === "deleted_shop") || (!["courier", "preparer", "supplier", "external"].includes(p.type) && (p.externalId || p.name))) {
          try {
            let targetShopId = p.externalId;
            const cleanName = p.name.replace(/\s*\([^)]*\)\s*$/, "").replace(/[\(\)\[\]]/g, "").trim();

            if (!targetShopId || p.type !== "shop") {
              const matchedShop = await prisma.shop.findFirst({
                where: {
                  OR: [
                    ...(p.externalId ? [{ id: p.externalId }] : []),
                    { name: { equals: cleanName, mode: "insensitive" } },
                    { name: { contains: cleanName, mode: "insensitive" } }
                  ]
                },
                select: { id: true, name: true }
              });
              if (matchedShop) {
                targetShopId = matchedShop.id;
                if (!p.externalId || p.type !== "shop") {
                  prisma.creditBookPartner.update({
                    where: { id: p.id },
                    data: { externalId: matchedShop.id, type: "shop" }
                  }).catch(() => {});
                }
              }
            }

            if (targetShopId) {
              const lastZero = getPartnerLastZeroDate(p.transactions);
              const { autoDebt, orderCount } = await getShopAutoDebt(targetShopId, lastZero);
              autoBalance = -autoDebt;
              shopOrderCount = orderCount;
            }
          } catch (e) {
            console.error(`Failed to get shop auto debt for ${p.name}:`, e);
          }
        }

        const balance = manualBalance + autoBalance;

        // تم إلغاء الإخفاء التلقائي للمحلات المصفرة لكي لا تختفي الحسابات وتاريخ معاملاتها فجأة دون علم المستخدم

        const notesSummary = p.transactions
          ? p.transactions.map((t) => t.note).filter(Boolean).join(" ")
          : "";

        return {
          id: p.id,
          name: p.name,
          phone: p.phone,
          type: p.type as PartnerType,
          externalId: p.externalId,
          createdAt: p.createdAt,
          updatedAt: new Date(latestActivity),
          manualBalance,
          autoBalance,
          balance,
          totalGave,
          totalTook,
          walletRemain,
          orderCount: shopOrderCount,
          notesSummary: notesSummary.slice(0, 5000),
        };
      })
    );

    const result = mapped.filter((item) => item !== null) as PartnerWithBalance[];

    // فرز النتائج: الحسابات غير المصفّرة (غير الصفرية) تسبق المصفّرة (الصفرية)
    // مع الحفاظ على ترتيب تاريخ التحديث (آخر نشاط) تنازلياً لكل قسم.
    result.sort((a, b) => {
      const aZero = a.balance === 0;
      const bZero = b.balance === 0;
      if (aZero !== bZero) {
        return aZero ? 1 : -1;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return result;
  } catch (error) {
    console.error("Error in getPartners:", error);
    return [];
  }
}

// 2. جلب تفاصيل شريك وكشف حسابه (مدمج مع المعاملات التلقائية للطلبات والمحفظة)
export async function getPartnerDetails(partnerId: string) {
  try {
    const partner = await prisma.creditBookPartner.findUnique({
      where: { id: partnerId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!partner) return null;

    let totalGave = 0;
    let totalTook = 0;

    // جلب الحسابات التلقائية المدمجة
    let autoBalance = 0;
    let walletRemain = 0;
    const autoTransactions: any[] = [];

    if (partner.type === "courier" && partner.externalId) {
      try {
        const globalResetDate = await getCreditBookGlobalResetDate();
        const courier = await prisma.courier.findUnique({
          where: { id: partner.externalId },
          select: {
            mandoubTotalsResetAt: true,
            mandoubWalletCarryOverDinar: true
          }
        });
        const lastZero = getPartnerLastZeroDate(partner.transactions);

        let effectiveDate: Date | null = globalResetDate;
        if (courier?.mandoubTotalsResetAt) {
          if (!effectiveDate || courier.mandoubTotalsResetAt > effectiveDate) {
            effectiveDate = courier.mandoubTotalsResetAt;
          }
        }
        if (lastZero) {
          if (!effectiveDate || lastZero > effectiveDate) {
            effectiveDate = lastZero;
          }
        }

        autoBalance = await computeCourierAdminTotalSince(partner.externalId, effectiveDate);
        walletRemain = autoBalance;

        // 1. جلب حركات أموال الطلبات للمندوب
        const orderMoneyWhere: any = {
          courierId: partner.externalId,
          deletedAt: null
        };
        if (effectiveDate) {
          orderMoneyWhere.createdAt = { gte: effectiveDate };
        }

        const orderMoneyEvents = await prisma.orderCourierMoneyEvent.findMany({
          where: orderMoneyWhere,
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                orderType: true,
                customerRegion: { select: { name: true } }
              }
            }
          },
          orderBy: { createdAt: "desc" }
        });

        for (const me of orderMoneyEvents) {
          const amt = Number(me.amountDinar || 0);
          if (amt <= 0) continue;
          
          const prepLabel = me.recordedByCompanyPreparerId ? " [سجلها المجهز]" : "";

          if (me.kind === MONEY_KIND_DELIVERY) { // وارد للمندوب
            autoTransactions.push({
              id: `auto-courier-money-event-in-${me.id}`,
              partnerId: partner.id,
              amount: amt,
              kind: "gave", // أعطيت = زيادة الذمة/نطلبه
              note: `طلب توصيل #${me.order?.orderNumber || "—"} | استلام مبلغ من الزبون (المنطقة: ${me.order?.customerRegion?.name || "—"})${prepLabel}`,
              createdAt: me.createdAt,
              updatedAt: me.createdAt,
              isAuto: true,
              orderId: me.order?.id
            });
          } else if (me.kind === MONEY_KIND_PICKUP) { // صادر من المندوب للمحل
            autoTransactions.push({
              id: `auto-courier-money-event-out-${me.id}`,
              partnerId: partner.id,
              amount: amt,
              kind: "took", // أخذت = تسديد للذمة
              note: `طلب #${me.order?.orderNumber || "—"} | تسليم مبلغ للمجهز/المحل${prepLabel}`,
              createdAt: me.createdAt,
              updatedAt: me.createdAt,
              isAuto: true,
              orderId: me.order?.id
            });
          }
        }

        // 2. جلب قيود المحفظة اليدوية للمندوب
        const miscWhere: any = {
          courierId: partner.externalId,
          deletedAt: null
        };
        if (effectiveDate) {
          miscWhere.createdAt = { gte: effectiveDate };
        }

        const courierMiscEntries = await prisma.courierWalletMiscEntry.findMany({
          where: miscWhere,
          orderBy: { createdAt: "desc" }
        });

        for (const me of courierMiscEntries) {
          const amt = Number(me.amountDinar || 0);
          if (amt <= 0) continue;

          autoTransactions.push({
            id: `auto-courier-misc-${me.id}`,
            partnerId: partner.id,
            amount: amt,
            kind: me.direction === "take" ? "gave" : "took",
            note: me.label || "قيد يدوي في المحفظة للمندوب",
            createdAt: me.createdAt,
            updatedAt: me.createdAt,
            isAuto: true
          });

          // إضافة تسوية عكسية للإكراميات لأنها من حق المندوب (فتخصم من ذمته للإدارة)
          if (me.direction === "take" && me.label?.includes("[إكرامية]")) {
            autoTransactions.push({
              id: `auto-courier-misc-tip-offset-${me.id}`,
              partnerId: partner.id,
              amount: amt,
              kind: "took",
              note: `تسوية (إكرامية) لصالح المندوب`,
              createdAt: me.createdAt,
              updatedAt: me.createdAt,
              isAuto: true
            });
          }
        }

        // 3. جلب كافة تحويلات الأقران للمندوب
        const transferWhere: any = {
          OR: [
            { fromCourierId: partner.externalId },
            { toCourierId: partner.externalId }
          ]
        };
        if (effectiveDate) {
          transferWhere.createdAt = { gte: effectiveDate };
        }

        const courierTransfers = await prisma.walletPeerTransfer.findMany({
          where: transferWhere,
          orderBy: { createdAt: "desc" }
        });

        for (const t of courierTransfers) {
          const amt = Number(t.amountDinar || 0);
          if (amt <= 0) continue;

          const isToAdmin = t.toKind === WalletPeerPartyKind.admin;
          const isFromCourier = t.fromCourierId === partner.externalId;
          const isToCourier = t.toCourierId === partner.externalId;

          if (t.status === "accepted" && isToAdmin && isFromCourier) {
            autoTransactions.push({
              id: `auto-courier-transfer-admin-accepted-${t.id}`,
              partnerId: partner.id,
              amount: amt,
              kind: "took", // أخذت = تسديد للذمة
              note: `تحويل للإدارة (مقبول) | ${t.handoverLocation || "—"}${t.notes ? ` (${t.notes})` : ""}`,
              createdAt: t.createdAt,
              updatedAt: t.createdAt,
              isAuto: true
            });
          } else if (t.status === "pending") {
            if (isFromCourier) {
              autoTransactions.push({
                id: `auto-courier-transfer-pending-out-${t.id}`,
                partnerId: partner.id,
                amount: amt,
                kind: "took", // أخذت = معلق صادر يخصم من رصيد الكاش
                note: `تحويل صادر معلق | ${t.handoverLocation || "—"}${t.notes ? ` (${t.notes})` : ""}`,
                createdAt: t.createdAt,
                updatedAt: t.createdAt,
                isAuto: true
              });
            } else if (isToCourier) {
              autoTransactions.push({
                id: `auto-courier-transfer-pending-in-${t.id}`,
                partnerId: partner.id,
                amount: amt,
                kind: "gave", // أعطيت = معلق وارد
                note: `تحويل وارد معلق | ${t.handoverLocation || "—"}${t.notes ? ` (${t.notes})` : ""}`,
                createdAt: t.createdAt,
                updatedAt: t.createdAt,
                isAuto: true
              });
            }
          } else if (t.status === "rejected") {
            if (isFromCourier) {
              autoTransactions.push({
                id: `auto-courier-transfer-rejected-out-${t.id}`,
                partnerId: partner.id,
                amount: amt,
                kind: "took",
                note: `تحويل صادر مرفوض ❌ | ${t.handoverLocation || "—"}${t.notes ? ` (السبب: ${t.notes})` : ""}`,
                createdAt: t.createdAt,
                updatedAt: t.createdAt,
                isAuto: true
              });
              // إضافة تسوية عكسية للتحويل المرفوض لئلا يؤثر على رصيد المطلوب الفعلي للإدارة
              autoTransactions.push({
                id: `auto-courier-transfer-rejected-out-offset-${t.id}`,
                partnerId: partner.id,
                amount: amt,
                kind: "gave",
                note: `إلغاء أثر تحويل صادر مرفوض`,
                createdAt: t.createdAt,
                updatedAt: t.createdAt,
                isAuto: true
              });
            }
          }
        }

        // 4. أرباح التوصيل للطلبات المكتملة والمؤرشفة للمندوب
        const earningsWhere: any = {
          AND: [
            {
              OR: [
                { courierEarningForCourierId: partner.externalId },
                { courierId: partner.externalId }
              ]
            },
            {
              status: { in: ["delivered", "archived"] }
            },
            {
              courierEarningDinar: { gt: 0 }
            }
          ]
        };
        if (effectiveDate) {
          earningsWhere.AND.push({ createdAt: { gte: effectiveDate } });
        }

        const ordersWithEarnings = await prisma.order.findMany({
          where: earningsWhere,
          select: {
            id: true,
            orderNumber: true,
            courierEarningDinar: true,
            deliveredAt: true,
            createdAt: true
          },
          orderBy: { deliveredAt: "desc" }
        });

        for (const o of ordersWithEarnings) {
          const amt = Number(o.courierEarningDinar || 0);
          autoTransactions.push({
            id: `auto-courier-earning-${o.id}`,
            partnerId: partner.id,
            amount: amt,
            kind: "took", // أخذت = تسوية تخصم من ذمة المندوب لصالحه
            note: `أرباح التوصيل للطلب #${o.orderNumber}`,
            createdAt: o.deliveredAt || o.createdAt,
            updatedAt: o.deliveredAt || o.createdAt,
            isAuto: true,
            orderId: o.id
          });
        }

        // حساب الفارق بين الرصيد الفعلي التلقائي وصافي الحركات التلقائية المجلوبة لإجراء تسوية تطابق الرصيد التراكمي
        let courierAutoSum = 0;
        autoTransactions.forEach(tx => {
          if (tx.kind === "gave") courierAutoSum += tx.amount;
          else if (tx.kind === "took") courierAutoSum -= tx.amount;
        });

        // العثور على أقدم تاريخ معاملة لضمان وضع قيد التسوية الافتتاحي في البداية الزمنية المطلقة قبل كل الحركات
        let earliestDate = partner.createdAt.getTime();
        partner.transactions.forEach(t => {
          const tTime = new Date(t.createdAt).getTime();
          if (tTime < earliestDate) earliestDate = tTime;
        });
        autoTransactions.forEach(t => {
          const tTime = new Date(t.createdAt).getTime();
          if (tTime < earliestDate) earliestDate = tTime;
        });

        const initialBaselineDate = new Date(earliestDate - 60000);

        const courierDiff = autoBalance - courierAutoSum;
        if (Math.abs(courierDiff) > 0.001) {
          autoTransactions.push({
            id: `auto-courier-adjust-${partner.id}`,
            partnerId: partner.id,
            amount: Math.abs(courierDiff),
            kind: courierDiff > 0 ? "gave" : "took",
            note: `رصيد افتتاحي / تسوية وتصفية الحسابات السابقة للمندوب`,
            createdAt: initialBaselineDate,
            updatedAt: initialBaselineDate,
            isAuto: true
          });
        }
      } catch (e) {
        console.error("Error fetching courier auto transactions:", e);
      }
    } else if (partner.type === "preparer" && partner.externalId) {
      try {
        const globalResetDate = await getCreditBookGlobalResetDate();
        const preparer = await prisma.companyPreparer.findFirst({
          where: { id: partner.externalId, active: true },
          select: {
            orderListResetAt: true,
            shopLinks: { select: { shopId: true } },
            walletEmployeeId: true
          }
        });
        const lastZero = getPartnerLastZeroDate(partner.transactions);

        let effectiveDate: Date | null = globalResetDate;
        if (preparer?.orderListResetAt) {
          if (!effectiveDate || preparer.orderListResetAt > effectiveDate) {
            effectiveDate = preparer.orderListResetAt;
          }
        }
        if (lastZero) {
          if (!effectiveDate || lastZero > effectiveDate) {
            effectiveDate = lastZero;
          }
        }

        autoBalance = await computePreparerMoneyTotalsSince(partner.externalId, effectiveDate, preparer);
        walletRemain = autoBalance;

        if (preparer) {
          // 1. جلب حركات أموال الطلبات المسجلة بواسطة المجهز لمحلاته
          const shopIds = preparer.shopLinks.map((l) => l.shopId);
          if (shopIds.length > 0) {
            const prepOrderWhere: any = {
              deletedAt: null,
              OR: [
                { recordedByCompanyPreparerId: partner.externalId },
                { order: { shopId: { in: shopIds } } }
              ]
            };
            if (effectiveDate) {
              prepOrderWhere.createdAt = { gte: effectiveDate };
            }

            const orderMoneyEvents = await prisma.orderCourierMoneyEvent.findMany({
              where: prepOrderWhere,
              include: {
                order: {
                  select: {
                    id: true,
                    orderNumber: true
                  }
                }
              },
              orderBy: { createdAt: "desc" }
            });

            for (const me of orderMoneyEvents) {
              const amt = Number(me.amountDinar || 0);
              if (amt <= 0) continue;

              if (me.kind === MONEY_KIND_DELIVERY) { // وارد للمجهز
                autoTransactions.push({
                  id: `auto-preparer-money-event-in-${me.id}`,
                  partnerId: partner.id,
                  amount: amt,
                  kind: "gave", // أعطيت = زيادة الذمة/نطلبه
                  note: `طلب #${me.order?.orderNumber || "—"} | استلام دفعة من المندوب/الزبون`,
                  createdAt: me.createdAt,
                  updatedAt: me.createdAt,
                  isAuto: true,
                  orderId: me.order?.id
                });
              } else if (me.kind === MONEY_KIND_PICKUP) { // صادر من المجهز للمحل
                autoTransactions.push({
                  id: `auto-preparer-money-event-out-${me.id}`,
                  partnerId: partner.id,
                  amount: amt,
                  kind: "took", // أخذت = تسديد للذمة
                  note: `طلب #${me.order?.orderNumber || "—"} | تسليم مبلغ للمحل`,
                  createdAt: me.createdAt,
                  updatedAt: me.createdAt,
                  isAuto: true,
                  orderId: me.order?.id
                });
              }
            }
          }

          const wid = preparer.walletEmployeeId;
          if (wid) {
            // 2. قيود المحفظة اليدوية للموظف المربوط بالمجهز
            const prepMiscWhere: any = {
              employeeId: wid,
              deletedAt: null
            };
            if (effectiveDate) {
              prepMiscWhere.createdAt = { gte: effectiveDate };
            }

            const employeeMiscEntries = await prisma.employeeWalletMiscEntry.findMany({
              where: prepMiscWhere,
              orderBy: { createdAt: "desc" }
            });

            for (const me of employeeMiscEntries) {
              const amt = Number(me.amountDinar || 0);
              if (amt <= 0) continue;

            autoTransactions.push({
              id: `auto-preparer-misc-${me.id}`,
              partnerId: partner.id,
              amount: amt,
              kind: me.direction === "take" ? "gave" : "took",
              note: me.label || "قيد يدوي في المحفظة للمجهز",
              createdAt: me.createdAt,
              updatedAt: me.createdAt,
              isAuto: true
            });
            }

            // 3. التحويلات المقبولة للإدارة
            const prepTransferAdminWhere: any = {
              fromEmployeeId: wid,
              toKind: WalletPeerPartyKind.admin,
              status: "accepted"
            };
            if (effectiveDate) {
              prepTransferAdminWhere.createdAt = { gte: effectiveDate };
            }

            const employeeAdminTransfers = await prisma.walletPeerTransfer.findMany({
              where: prepTransferAdminWhere,
              orderBy: { createdAt: "desc" }
            });

            for (const t of employeeAdminTransfers) {
              const amt = Number(t.amountDinar || 0);
              if (amt <= 0) continue;

              autoTransactions.push({
                id: `auto-preparer-transfer-admin-${t.id}`,
                partnerId: partner.id,
                amount: amt,
                kind: "took", // أخذت = تسديد للذمة
                note: `تحويل للإدارة (مقبول) | ${t.handoverLocation || "—"}${t.notes ? ` (${t.notes})` : ""}`,
                createdAt: t.createdAt,
                updatedAt: t.createdAt,
                isAuto: true
              });
            }

            // 4. التحويلات الصادرة المعلقة
            const prepPendingWhere: any = {
              fromEmployeeId: wid,
              status: "pending"
            };
            if (effectiveDate) {
              prepPendingWhere.createdAt = { gte: effectiveDate };
            }

            const employeePendingOutgoingTransfers = await prisma.walletPeerTransfer.findMany({
              where: prepPendingWhere,
              orderBy: { createdAt: "desc" }
            });

            for (const t of employeePendingOutgoingTransfers) {
              const amt = Number(t.amountDinar || 0);
              if (amt <= 0) continue;

              autoTransactions.push({
                id: `auto-preparer-transfer-pending-${t.id}`,
                partnerId: partner.id,
                amount: amt,
                kind: "took", // أخذت = تسوية تخصم من ذمته
                note: `تحويل صادر معلق | ${t.handoverLocation || "—"}${t.notes ? ` (${t.notes})` : ""}`,
                createdAt: t.createdAt,
                updatedAt: t.createdAt,
                isAuto: true
              });
            }
          }
        }

        // حساب الفارق بين الرصيد الفعلي التلقائي وصافي الحركات التلقائية المجلوبة للمجهز لإجراء تسوية تطابق الرصيد التراكمي
        let prepAutoSum = 0;
        autoTransactions.forEach(tx => {
          if (tx.kind === "gave") prepAutoSum += tx.amount;
          else if (tx.kind === "took") prepAutoSum -= tx.amount;
        });

        // العثور على أقدم تاريخ معاملة للمجهز لضمان وضع قيد التسوية الافتتاحي في البداية الزمنية المطلقة
        let prepEarliestDate = partner.createdAt.getTime();
        partner.transactions.forEach(t => {
          const tTime = new Date(t.createdAt).getTime();
          if (tTime < prepEarliestDate) prepEarliestDate = tTime;
        });
        autoTransactions.forEach(t => {
          const tTime = new Date(t.createdAt).getTime();
          if (tTime < prepEarliestDate) prepEarliestDate = tTime;
        });

        const prepBaselineDate = new Date(prepEarliestDate - 60000);

        const prepDiff = autoBalance - prepAutoSum;
        if (!effectiveDate && Math.abs(prepDiff) > 0.001) {
          autoTransactions.push({
            id: `auto-preparer-adjust-${partner.id}`,
            partnerId: partner.id,
            amount: Math.abs(prepDiff),
            kind: prepDiff > 0 ? "gave" : "took",
            note: `رصيد افتتاحي / تسوية وتصفية الحسابات السابقة للمجهز`,
            createdAt: prepBaselineDate,
            updatedAt: prepBaselineDate,
            isAuto: true
          });
        }
      } catch (e) {
        console.error("Error fetching preparer auto transactions:", e);
      }
    } else if (partner.type === "supplier" && partner.externalId) {
      try {
        const lastZero = getPartnerLastZeroDate(partner.transactions);
        const { autoDebt, orderCount, transactions: suppTransactions } = await getSupplierAutoDebt(partner.externalId, lastZero);
        autoBalance = -autoDebt;
        autoTransactions.push(...suppTransactions);
      } catch (e) {
        console.error(`Failed to get supplier auto transactions for ${partner.name}:`, e);
      }
    } else if (partner.type === "external" && partner.externalId === "accumulated_salaries_root") {
      try {
        const preparers = await prisma.companyPreparer.findMany({
          where: { active: true },
          select: { id: true, name: true }
        });
        const { calculateAccumulatedSalaryInternal } = await import("@/app/preparer/actions");
        let totalAccumulated = 0;
        for (const prep of preparers) {
          const salaryStats = await calculateAccumulatedSalaryInternal(prep.id);
          const amt = salaryStats.accumulatedSalary || 0;
          if (amt > 0) {
            totalAccumulated += amt;
            autoTransactions.push({
              id: `auto-preparer-salary-root-${prep.id}`,
              partnerId: partner.id,
              amount: amt,
              kind: "took", // أخذت = يطلبنا
              note: `راتب المجهز المتراكم: ${prep.name}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              isAuto: true
            });
          }
        }
        autoBalance = -totalAccumulated;
      } catch (e) {
        console.error("Error compiling accumulated salaries for root partner:", e);
      }
    } else if ((partner.type === "shop" || partner.type === "deleted_shop") || (!["courier", "preparer", "supplier", "external"].includes(partner.type) && (partner.externalId || partner.name))) {
      try {
        let targetShopId = partner.externalId;
        const cleanName = partner.name
          .replace(/\s*\([^)]*\)\s*$/, "")
          .replace(/[\(\)\[\]]/g, "")
          .trim();

        if (!targetShopId || partner.type !== "shop") {
          const matchedShop = await prisma.shop.findFirst({
            where: {
              OR: [
                ...(partner.externalId ? [{ id: partner.externalId }] : []),
                { name: { equals: cleanName, mode: "insensitive" } },
                { name: { contains: cleanName, mode: "insensitive" } }
              ]
            },
            select: { id: true, name: true }
          });
          if (matchedShop) {
            targetShopId = matchedShop.id;
          }
        }

        if (targetShopId) {
          const lastZero = getPartnerLastZeroDate(partner.transactions);
          const { autoDebt, orderCount, orders } = await getShopAutoDebt(targetShopId, lastZero);
          autoBalance = -autoDebt;

          for (const o of orders) {
            const subtotal = Number(o.orderSubtotal || 0);
            if (subtotal > 0) {
              autoTransactions.push({
                id: `auto-shop-order-subtotal-${o.id}`,
                partnerId: partner.id,
                amount: subtotal,
                kind: "took", // أخذت = يطلبنا قيمة بضاعة المحل
                note: `طلب #${o.orderNumber || "—"} | مستحقات بضاعة المحل (تلقائي)`,
                createdAt: o.createdAt,
                updatedAt: o.createdAt,
                isAuto: true,
                orderId: o.id
              });
            }

            const pickupEvents = o.moneyEvents?.filter((me: any) => me.kind === "pickup_out") || [];
            for (const pe of pickupEvents) {
              const pAmt = Number(pe.amountDinar || 0);
              if (pAmt > 0) {
                autoTransactions.push({
                  id: `auto-shop-pickup-out-${pe.id}`,
                  partnerId: partner.id,
                  amount: pAmt,
                  kind: "gave", // أعطيت = تسديد للمحل نقداً عبر المندوب
                  note: `تسليم نقد للمحل للطلب #${o.orderNumber || "—"} (تلقائي)`,
                  createdAt: pe.createdAt,
                  updatedAt: pe.createdAt,
                  isAuto: true,
                  orderId: o.id
                });
              }
            }

            if (o.prepaidAll && Number(o.deliveryPrice || 0) > 0) {
              const delPrice = Number(o.deliveryPrice);
              const hasMatchingDeliveryIn = o.moneyEvents?.some(
                (me: any) => me.kind === "delivery_in" && Number(me.amountDinar || 0) === delPrice
              );
              if (!hasMatchingDeliveryIn) {
                autoTransactions.push({
                  id: `auto-shop-prepaid-delivery-${o.id}`,
                  partnerId: partner.id,
                  amount: delPrice,
                  kind: "gave", // أعطيت = تسديد كلفة التوصيل
                  note: `كلفة توصيل واصل كامل للطلب #${o.orderNumber || "—"} (تلقائي)`,
                  createdAt: o.createdAt,
                  updatedAt: o.createdAt,
                  isAuto: true,
                  orderId: o.id
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("Error fetching shop auto transactions:", e);
      }
    }

    // استخلاص أرقام الطلبيات المذكورة في ملاحظات المعاملات اليدوية للربط الذكي
    const orderNumbers = new Set<number>();
    partner.transactions.forEach(t => {
      if (t.note) {
        const matches = t.note.match(/(?:#|طلب(?:ة|ية)?(?:\s*رقم)?|وصل(?:\s*رقم)?|فاتورة|رقم|معامل(?:ة|ه))(?:\s*[:#\-\s]\s*)*(\d+)/g);
        if (matches) {
          matches.forEach(m => {
            const numMatch = m.match(/\d+/);
            if (numMatch) {
              orderNumbers.add(parseInt(numMatch[0], 10));
            }
          });
        }
      }
    });

    const ordersMap = new Map<number, { id: string, isPaidForSupplier: boolean }>();
    if (orderNumbers.size > 0) {
      try {
        const foundOrders = await prisma.order.findMany({
          where: {
            orderNumber: { in: Array.from(orderNumbers) }
          },
          select: { id: true, orderNumber: true, preparerShoppingJson: true }
        });
        for (const o of foundOrders) {
          let json: any = {};
          try {
            json = typeof o.preparerShoppingJson === "string"
              ? JSON.parse(o.preparerShoppingJson)
              : o.preparerShoppingJson || {};
          } catch {
            json = {};
          }
          ordersMap.set(o.orderNumber, {
            id: o.id,
            isPaidForSupplier: !!json.supplierPaid
          });
        }
      } catch (err) {
        console.error("Failed to fetch matching orders for notes:", err);
      }
    }

    // حساب المعاملات اليدوية بالدفتر
    const manualTransactions = partner.transactions.map((t) => {
      const amt = Number(t.amount);
      const isExp = t.kind === "expense" || (t.note && t.note.includes("[مصروفات]"));
      if (isExp) {
        // للمحلات والمجهزين والموردين: المصروفات مستحقة لهم علينا (يطلبونا إياها)
        if (partner.type === "shop" || partner.type === "preparer" || partner.type === "supplier") {
          totalTook += amt;
        } else {
          totalGave += amt;
        }
      } else if (t.kind === "gave") {
        totalGave += amt;
      } else if (t.kind === "took") {
        totalTook += amt;
      }

      let isPaid = false;
      let orderId: string | undefined = undefined;
      
      if (t.note) {
        const match = t.note.match(/(?:#|طلب(?:ة|ية)?(?:\s*رقم)?|وصل(?:\s*رقم)?|فاتورة|رقم|معامل(?:ة|ه))(?:\s*[:#\-\s]\s*)*(\d+)/);
        if (match) {
          const orderNum = parseInt(match[1], 10);
          const orderInfo = ordersMap.get(orderNum);
          if (orderInfo) {
            orderId = orderInfo.id;
            if (partner.type === "supplier") {
              isPaid = orderInfo.isPaidForSupplier;
            }
          }
        }
      }

      return {
        ...t,
        amount: amt,
        isAuto: false,
        isPaid,
        orderId
      };
    });

    const manualBalance = totalGave - totalTook;

    // حساب إجمالي الأعطيت والأخذت للمعاملات التلقائية بشكل دقيق
    let autoGaveSum = 0;
    let autoTookSum = 0;
    autoTransactions.forEach((tx) => {
      if (tx.kind === "gave") {
        autoGaveSum += tx.amount;
      } else if (tx.kind === "took") {
        autoTookSum += tx.amount;
      }
    });

    // دمج المعاملات التلقائية واليدوية
    const allTransactions = [...autoTransactions, ...manualTransactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // توليد رابط البوابة تلقائياً بناءً على نوع الحساب
    let portalUrl: string | null = null;
    const baseUrl = getPublicAppUrl();

    if (partner.externalId) {
      if (partner.type === "courier") {
        try {
          const { buildDelegatePortalUrl } = await import("@/lib/delegate-link");
          portalUrl = buildDelegatePortalUrl(partner.externalId, baseUrl);
        } catch (e) {
          console.error(e);
        }
      } else if (partner.type === "preparer") {
        try {
          const prep = await prisma.companyPreparer.findUnique({
            where: { id: partner.externalId },
            select: { portalToken: true }
          });
          if (prep?.portalToken) {
            const { buildCompanyPreparerPortalUrl } = await import("@/lib/company-preparer-portal-link");
            portalUrl = buildCompanyPreparerPortalUrl(partner.externalId, prep.portalToken, baseUrl);
          }
        } catch (e) {
          console.error(e);
        }
      } else if (partner.type === "shop") {
        try {
          const employee = await prisma.employee.findFirst({
            where: { shopId: partner.externalId },
            select: { id: true, orderPortalToken: true }
          });
          if (employee) {
            const { buildEmployeeOrderPortalUrl } = await import("@/lib/employee-order-portal-link");
            portalUrl = buildEmployeeOrderPortalUrl(employee.id, employee.orderPortalToken, baseUrl);
          }
        } catch (e) {
          console.error(e);
        }
      } else if (partner.type === "supplier") {
        try {
          const supp = await prisma.storeSupplier.findUnique({
            where: { id: partner.externalId },
            select: { portalToken: true }
          });
          if (supp?.portalToken) {
            portalUrl = `${baseUrl}/supplier?p=${partner.externalId}&t=${supp.portalToken}`;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    return {
      id: partner.id,
      name: partner.name,
      phone: partner.phone,
      type: partner.type as PartnerType,
      externalId: partner.externalId,
      createdAt: partner.createdAt,
      balance: manualBalance + autoBalance,
      manualBalance,
      autoBalance,
      totalGave: totalGave + autoGaveSum,
      totalTook: totalTook + autoTookSum,
      transactions: allTransactions,
      walletRemain,
      portalUrl
    };
  } catch (error) {
    console.error("Error in getPartnerDetails:", error);
    return null;
  }
}

// 3. إنشاء شريك جديد يدوياً
export async function createPartner(name: string, phone: string | null, type: PartnerType, externalId?: string) {
  try {
    if (!name.trim()) {
      return { success: false, error: "الرجاء إدخال اسم الشريك" };
    }

    if (externalId) {
      // التحقق من وجود شريك محذوف بنفس المعرف الخارجي والنوع الأصلي
      const existingDeleted = await prisma.creditBookPartner.findFirst({
        where: {
          externalId,
          type: { startsWith: `deleted_${type}` }
        }
      });

      if (existingDeleted) {
        // بدلاً من إنشاء شريك جديد مكرر، نقوم باستعادة الشريك القديم
        const partner = await prisma.creditBookPartner.update({
          where: { id: existingDeleted.id },
          data: {
            name: name.trim(),
            phone: phone?.trim() || null,
            type: type, // استعادة النوع الأصلي
            updatedAt: new Date()
          }
        });

        if (type === "supplier") {
          try {
            const { syncSupplierTransactions } = await import("@/lib/order-delivery-hook");
            await syncSupplierTransactions(externalId);
          } catch (err) {
            console.error("Failed to sync supplier transactions in createPartner (restore):", err);
          }
        }

        revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
        return { success: true, partner };
      }
    }

    const partner = await prisma.creditBookPartner.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        type,
        externalId: externalId || null,
      },
    });

    if (type === "supplier" && externalId) {
      try {
        const { syncSupplierTransactions } = await import("@/lib/order-delivery-hook");
        await syncSupplierTransactions(externalId);
      } catch (err) {
        console.error("Failed to sync supplier transactions in createPartner:", err);
      }
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    return { success: true, partner };
  } catch (error: any) {
    console.error("Error in createPartner:", error);
    if (error.code === "P2002") {
      return { success: false, error: "هذا الشريك مرتبط مسبقاً بالنظام" };
    }
    return { success: false, error: "حدث خطأ أثناء إنشاء الشريك" };
  }
}

// 4. إضافة معاملة مالية
export async function addTransaction(partnerId: string, amount: number, kind: "gave" | "took" | "expense", note: string | null, date?: Date, imageUrl?: string | null) {
  try {
    if (amount <= 0) {
      return { success: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
    }

    let finalNote = note?.trim() || null;
    if (kind === "expense") {
      if (!finalNote) {
        finalNote = "[مصروفات]";
      } else if (!finalNote.includes("[مصروفات]")) {
        finalNote = `[مصروفات] ${finalNote}`;
      }
    }

    const tx = await prisma.creditBookTransaction.create({
      data: {
        partnerId,
        amount,
        kind,
        note: finalNote,
        imageUrl: imageUrl || null,
        createdAt: date || new Date(),
      },
    });

    try {
      const { logTransactionAuthor } = await import("@/lib/transaction-logger");
      await logTransactionAuthor(tx.id, "create");
    } catch (logErr) {
      console.error("Failed to log transaction creator:", logErr);
    }

    // تحديث تاريخ تعديل الشريك لتعديل ترتيبه في القائمة
    await prisma.creditBookPartner.update({
      where: { id: partnerId },
      data: { updatedAt: new Date() }
    });

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${partnerId}`);
    return { success: true, transaction: tx };
  } catch (error) {
    console.error("Error in addTransaction:", error);
    return { success: false, error: "حدث خطأ أثناء إضافة المعاملة" };
  }
}

// دالة لرفع صور المعاملات اليدوية
export async function uploadTransactionImage(formData: FormData) {
  try {
    const { isAdminSession } = await import("@/lib/admin-session");
    if (!(await isAdminSession())) {
      return { success: false, error: "غير مصرح لك بالقيام بهذا الإجراء" };
    }

    const file = formData.get("image");
    if (!(file instanceof File) || file.size === 0) {
      return { success: true, url: null };
    }

    const { saveCustomerProfilePhotoUploaded } = await import("@/lib/order-image");
    const photoUrl = await saveCustomerProfilePhotoUploaded(file, 20); // 20 MB max
    return { success: true, url: photoUrl };
  } catch (error) {
    console.error("Error in uploadTransactionImage:", error);
    return { success: false, error: "فشل تحميل الصورة" };
  }
}

// 5. تعديل معاملة مالية
export async function updateTransaction(transactionId: string, amount: number, note: string | null, kind: "gave" | "took" | "expense", date?: Date, imageUrl?: string | null) {
  try {
    if (amount <= 0) {
      return { success: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
    }

    const originalTx = await prisma.creditBookTransaction.findUnique({
      where: { id: transactionId }
    });
    if (!originalTx) return { success: false, error: "المعاملة غير موجودة" };

    let finalNote = note?.trim() || null;
    if (kind === "expense") {
      if (!finalNote) {
        finalNote = "[مصروفات]";
      } else if (!finalNote.includes("[مصروفات]")) {
        finalNote = `[مصروفات] ${finalNote}`;
      }
    }

    const tx = await prisma.creditBookTransaction.update({
      where: { id: transactionId },
      data: {
        amount,
        note: finalNote,
        kind,
        imageUrl: imageUrl !== undefined ? imageUrl : undefined,
        createdAt: date || undefined,
      },
    });

    try {
      const { logTransactionChange, logTransactionAuthor } = await import("@/lib/transaction-logger");
      await logTransactionChange("modified", originalTx, tx);
      await logTransactionAuthor(tx.id, "update");
    } catch (logErr) {
      console.error("Failed to log transaction change/author:", logErr);
    }

    // تحديث تاريخ تعديل الشريك لتعديل ترتيبه في القائمة
    await prisma.creditBookPartner.update({
      where: { id: tx.partnerId },
      data: { updatedAt: new Date() }
    });

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${tx.partnerId}`);
    return { success: true, transaction: tx };
  } catch (error) {
    console.error("Error in updateTransaction:", error);
    return { success: false, error: "حدث خطأ أثناء تعديل المعاملة" };
  }
}

// 6. حذف معاملة مالية
export async function deleteTransaction(transactionId: string) {
  try {
    const tx = await prisma.creditBookTransaction.findUnique({
      where: { id: transactionId },
      include: { partner: true }
    });
    if (!tx) return { success: false, error: "المعاملة غير موجودة" };

    // إذا كان الشريك مورداً وكانت المعاملة مرتبطة بطلب، نضع علامة لحذف دين الطلب للمورد
    if (tx.partner?.type === "supplier" && tx.note) {
      const match = tx.note.match(/طلب رقم:\s*#(\d+)/);
      if (match) {
        const orderNum = parseInt(match[1], 10);
        const order = await prisma.order.findFirst({
          where: { orderNumber: orderNum }
        });
        if (order) {
          let json: any = {};
          try {
            json = typeof order.preparerShoppingJson === "string"
              ? JSON.parse(order.preparerShoppingJson)
              : order.preparerShoppingJson || {};
          } catch (e) {
            json = {};
          }
          json.supplierDebtDeleted = true;
          await prisma.order.update({
            where: { id: order.id },
            data: { preparerShoppingJson: json }
          });
        }
      }
    }

    await prisma.creditBookTransaction.delete({
      where: { id: transactionId },
    });

    try {
      const { logTransactionChange } = await import("@/lib/transaction-logger");
      await logTransactionChange("deleted", tx);
    } catch (logErr) {
      console.error("Failed to log transaction deletion:", logErr);
    }

    // تحديث تاريخ تعديل الشريك لتعديل ترتيبه في القائمة
    await prisma.creditBookPartner.update({
      where: { id: tx.partnerId },
      data: { updatedAt: new Date() }
    });

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${tx.partnerId}`);
    return { success: true };
  } catch (error) {
    console.error("Error in deleteTransaction:", error);
    return { success: false, error: "حدث خطأ أثناء حذف المعاملة" };
  }
}

// 7. حذف شريك بالكامل
export async function deletePartner(partnerId: string) {
  try {
    const partner = await prisma.creditBookPartner.findUnique({
      where: { id: partnerId },
      select: { type: true, externalId: true }
    });

    if (partner && partner.externalId) {
      // إذا كان مرتبطاً بالنظام، نقوم بحذفه ناعماً بتغيير نوعه وتحديث تاريخ التعديل
      const newType = partner.type.startsWith("deleted_") ? partner.type : `deleted_${partner.type}`;
      
      // لتفادي تعارض القيد الفريد [type, externalId] إذا كان الشريك محذوفاً سابقاً
      if (partner.externalId) {
        // أولاً: حذف كافة معاملات الشركاء المتعارضين لتجنب قيود المفتاح الأجنبي
        await prisma.creditBookTransaction.deleteMany({
          where: {
            partner: {
              type: newType,
              externalId: partner.externalId,
              id: { not: partnerId }
            }
          }
        });

        // ثانياً: حذف الشركاء المتعارضين أنفسهم
        await prisma.creditBookPartner.deleteMany({
          where: {
            type: newType,
            externalId: partner.externalId,
            id: { not: partnerId }
          }
        });
      }

      await prisma.creditBookPartner.update({
        where: { id: partnerId },
        data: {
          type: newType,
          updatedAt: new Date()
        }
      });
    } else {
      // إذا كان شريكاً خارجياً غير مرتبط بالنظام، نحذفه نهائياً
      // نحذف أولاً معاملاته لتجنب قيد المفتاح الأجنبي
      await prisma.creditBookTransaction.deleteMany({
        where: { partnerId }
      });
      await prisma.creditBookPartner.delete({
        where: { id: partnerId },
      });
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    return { success: true };
  } catch (error) {
    console.error("Error in deletePartner:", error);
    return { success: false, error: "حدث خطأ أثناء حذف الشريك" };
  }
}

// 8. حذف مجموعة من الأطراف المحددة (حذف دفعات)
export async function deletePartnersBatch(partnerIds: string[]) {
  try {
    if (!partnerIds || partnerIds.length === 0) {
      return { success: false, error: "الرجاء تحديد شريك واحد على الأقل للمسح" };
    }

    // جلب الأطراف لتحديد ما يجب حذفه ناعماً وما يجب حذفه نهائياً
    const partners = await prisma.creditBookPartner.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, type: true, externalId: true }
    });

    const externalLinked = partners.filter(p => p.externalId);
    const manualOnly = partners.filter(p => !p.externalId);

    if (externalLinked.length > 0) {
      // تحديث الأطراف المرتبطة بالنظام بشكل ناعم
      for (const p of externalLinked) {
        const newType = p.type.startsWith("deleted_") ? p.type : `deleted_${p.type}`;
        
        // لتفادي تعارض القيد الفريد [type, externalId] إذا كان الشريك محذوفاً سابقاً
        if (p.externalId) {
          // أولاً: حذف كافة معاملات الشركاء المتعارضين لتجنب قيود المفتاح الأجنبي
          await prisma.creditBookTransaction.deleteMany({
            where: {
              partner: {
                type: newType,
                externalId: p.externalId,
                id: { not: p.id }
              }
            }
          });

          // ثانياً: حذف الشركاء المتعارضين أنفسهم
          await prisma.creditBookPartner.deleteMany({
            where: {
              type: newType,
              externalId: p.externalId,
              id: { not: p.id }
            }
          });
        }

        await prisma.creditBookPartner.update({
          where: { id: p.id },
          data: {
            type: newType,
            updatedAt: new Date()
          }
        });
      }
    }

    if (manualOnly.length > 0) {
      // حذف الأطراف اليدوية نهائياً
      const manualIds = manualOnly.map(p => p.id);
      // نحذف أولاً كافة المعاملات المرتبطة بهؤلاء الشركاء اليدويين لتجنب قيود المفتاح الأجنبي
      await prisma.creditBookTransaction.deleteMany({
        where: { partnerId: { in: manualIds } }
      });
      // ثم نحذف الشركاء اليدويين نهائياً
      await prisma.creditBookPartner.deleteMany({
        where: { id: { in: manualIds } }
      });
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    return { success: true };
  } catch (error) {
    console.error("Error in deletePartnersBatch:", error);
    return { success: false, error: "حدث خطأ أثناء حذف الشركاء المحددين" };
  }
}

// 9. جلب دين الزبون من دفتر الديون بالاعتماد على رقم الهاتف
export async function getCustomerDebtByPhone(phone: string): Promise<number> {
  try {
    if (!phone) return 0;
    
    // تطهير رقم الهاتف لإيجاد تطابق
    const cleanPhone = phone.trim();
    if (!cleanPhone) return 0;

    const partner = await prisma.creditBookPartner.findFirst({
      where: { 
        phone: cleanPhone,
        type: "customer"
      },
      include: {
        transactions: {
          select: {
            amount: true,
            kind: true
          }
        }
      }
    });

    if (!partner) return 0;

    let totalGave = 0;
    let totalTook = 0;

    partner.transactions.forEach((t) => {
      const amt = Number(t.amount);
      if (t.kind === "gave") {
        totalGave += amt;
      } else if (t.kind === "took") {
        totalTook += amt;
      }
    });

    return totalGave - totalTook; // إيجابي = نطلبه، سلبي = يطلبنا
  } catch (error) {
    console.error("Error in getCustomerDebtByPhone:", error);
    return 0;
  }
}

// 10. مزامنة الأطراف تلقائياً مع النظام
export async function syncSystemPartners() {
  try {
    let importedCount = 0;

    // تأمين شريك رواتب المجهزين المتراكمة العام
    try {
      const rootExists = await prisma.creditBookPartner.findFirst({
        where: {
          externalId: "accumulated_salaries_root",
          type: "external"
        }
      });
      if (!rootExists) {
        await prisma.creditBookPartner.create({
          data: {
            name: "رواتب المجهزين المتراكمه",
            phone: null,
            type: "external",
            externalId: "accumulated_salaries_root"
          }
        });
        importedCount++;
      }
    } catch (rootErr) {
      console.error("Failed to ensure accumulated salaries root partner in sync:", rootErr);
    }

    // جلب جميع الشركاء الموجودين دفعة واحدة لتفادي تكرار الاستعلامات في الحلقات
    const existingPartners = await prisma.creditBookPartner.findMany({
      select: { id: true, name: true, phone: true, type: true, externalId: true }
    });

    const partnerMap = new Map<string, typeof existingPartners[0]>();
    for (const p of existingPartners) {
      if (p.externalId) {
        let cleanType = p.type;
        if (cleanType.startsWith("deleted_")) {
          cleanType = cleanType.replace("deleted_", "");
        }
        partnerMap.set(`${cleanType}_${p.externalId}`, p);
      }
    }

    // أ) استيراد ومزامنة المناديب
    const couriers = await prisma.courier.findMany({ where: { blocked: false } });
    for (const courier of couriers) {
      const key = `courier_${courier.id}`;
      const exists = partnerMap.get(key);
      const expectedName = `${courier.name} (مندوب)`;

      if (!exists) {
        await prisma.creditBookPartner.create({
          data: {
            name: expectedName,
            phone: courier.phone,
            type: "courier",
            externalId: courier.id,
          },
        }).catch(e => console.error("Err create courier partner", e));
        importedCount++;
      } else if (!exists.type.startsWith("deleted_")) {
        if (exists.name !== expectedName || exists.phone !== courier.phone) {
          await prisma.creditBookPartner.update({
            where: { id: exists.id },
            data: {
              name: expectedName,
              phone: courier.phone,
              updatedAt: new Date()
            }
          }).catch(e => console.error("Err update courier partner", e));
        }
      }
    }

    // ب) استيراد ومزامنة المجهزين (CompanyPreparer)
    const preparers = await prisma.companyPreparer.findMany();
    for (const prep of preparers) {
      const key = `preparer_${prep.id}`;
      const exists = partnerMap.get(key);
      const expectedName = `${prep.name} (مجهز)`;

      if (!exists) {
        await prisma.creditBookPartner.create({
          data: {
            name: expectedName,
            phone: prep.phone,
            type: "preparer",
            externalId: prep.id,
          },
        }).catch(e => console.error("Err create preparer partner", e));
        importedCount++;
      } else if (!exists.type.startsWith("deleted_")) {
        if (exists.name !== expectedName || exists.phone !== prep.phone) {
          await prisma.creditBookPartner.update({
            where: { id: exists.id },
            data: {
              name: expectedName,
              phone: prep.phone,
              updatedAt: new Date()
            }
          }).catch(e => console.error("Err update preparer partner", e));
        }
      }
    }

    // ج) استيراد ومزامنة المحلات
    const shops = await prisma.shop.findMany();
    const allSuppliersNames = new Set((await prisma.storeSupplier.findMany({ select: { name: true } })).map(s => s.name.trim().toLowerCase()));
    const allPreparersNames = new Set((await prisma.companyPreparer.findMany({ select: { name: true } })).map(p => p.name.trim().toLowerCase()));

    for (const shop of shops) {
      const key = `shop_${shop.id}`;
      const exists = partnerMap.get(key);
      const expectedName = `${shop.name}`;
      const trimmedName = shop.name.trim().toLowerCase();

      const isExcluded =
        trimmedName === "الإدارة".toLowerCase() ||
        trimmedName === "طلبات الإدارة العامة".toLowerCase();

      if (isExcluded) {
        if (exists && !exists.type.startsWith("deleted_")) {
          await prisma.creditBookPartner.update({
            where: { id: exists.id },
            data: {
              type: "deleted_shop",
              updatedAt: new Date()
            }
          }).catch(e => console.error("Err hide shop partner", e));
          importedCount++;
        }
        continue;
      }

      // إذا كان المحل محذوفاً بالخطأ، نقوم باستعادته فوراً كشريك نشط
      if (exists && exists.type === "deleted_shop") {
        await prisma.creditBookPartner.update({
          where: { id: exists.id },
          data: {
            type: "shop",
            name: expectedName,
            updatedAt: new Date()
          }
        }).catch(e => console.error("Err restore shop partner", e));
      }

      if (!exists) {
        // التحقق أولاً إن كان هناك شريك موجود مسبقاً بنفس الاسم لتفادي التكرار وربطه بالمحل تلقائياً
        const existingByName = await prisma.creditBookPartner.findFirst({
          where: {
            OR: [
              { name: expectedName },
              { name: { equals: shop.name.trim(), mode: "insensitive" } },
              { name: { contains: shop.name.trim(), mode: "insensitive" } }
            ],
            NOT: { type: { startsWith: "deleted_" } }
          }
        });

        if (existingByName) {
          await prisma.creditBookPartner.update({
            where: { id: existingByName.id },
            data: {
              type: "shop",
              externalId: shop.id,
              phone: existingByName.phone || shop.phone || null,
              updatedAt: new Date()
            }
          }).catch(e => console.error("Err link existing partner to shop", e));
        } else {
          await prisma.creditBookPartner.create({
            data: {
              name: expectedName,
              phone: shop.phone || null,
              type: "shop",
              externalId: shop.id,
            },
          }).catch(e => console.error("Err create shop partner", e));
          importedCount++;
        }
      } else if (!exists.type.startsWith("deleted_")) {
        // تنظيف الاسم إن كان يحتوي اللقب المشوه السابق (محل/مجهز)
        let cleanCurrentName = exists.name;
        if (cleanCurrentName.endsWith(" (محل/مجهز)")) {
          cleanCurrentName = cleanCurrentName.replace(" (محل/مجهز)", "");
        }
        if (cleanCurrentName !== expectedName || (exists.phone || null) !== (shop.phone || null)) {
          await prisma.creditBookPartner.update({
            where: { id: exists.id },
            data: {
              name: expectedName,
              phone: shop.phone || null,
              updatedAt: new Date()
            }
          }).catch(e => console.error("Err update shop partner", e));
        }
      }
    }

    // د) استيراد ومزامنة الموردين (StoreSupplier)
    const suppliers = await prisma.storeSupplier.findMany();
    for (const supp of suppliers) {
      const key = `supplier_${supp.id}`;
      const exists = partnerMap.get(key);
      const expectedName = `${supp.name} (مورد)`;

      if (!exists) {
        await prisma.creditBookPartner.create({
          data: {
            name: expectedName,
            phone: supp.phone || null,
            type: "supplier",
            externalId: supp.id,
          },
        }).catch(e => console.error("Err create supplier partner", e));
        importedCount++;
      } else if (!exists.type.startsWith("deleted_")) {
        if (exists.name !== expectedName || (exists.phone || null) !== (supp.phone || null)) {
          await prisma.creditBookPartner.update({
            where: { id: exists.id },
            data: {
              name: expectedName,
              phone: supp.phone || null,
              updatedAt: new Date()
            }
          }).catch(e => console.error("Err update supplier partner", e));
        }
      }
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    return { success: true, importedCount };
  } catch (error) {
    console.error("Error in syncSystemPartners:", error);
    return { success: false, error: "حدث خطأ أثناء المزامنة" };
  }
}

// تسجيل عملية دفع للطلب مباشرة من الإدارة (للمحلات) دون الحاجة لمندوب أو مجهز
export async function payShopOrderFromAdmin(orderId: string, amount: number) {
  try {
    const { isAdminSession } = await import("@/lib/admin-session");
    if (!(await isAdminSession())) {
      return { success: false, error: "غير مصرح لك بالقيام بهذا الإجراء" };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return { success: false, error: "الطلب غير موجود" };
    }

    // تسجيل حركة صادر (pickup_out) بقيمة المبلغ
    await prisma.orderCourierMoneyEvent.create({
      data: {
        orderId,
        courierId: null,
        kind: "pickup_out",
        amountDinar: new Decimal(amount),
        expectedDinar: order.orderSubtotal,
        matchesExpected: true,
        mismatchReason: "",
        mismatchNote: "تم الدفع وتصفية الحساب مباشرة من الإدارة (دفتر الديون)",
      }
    });

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${order.shopId}`);
    revalidatePath(`/abo1stor3hlaa2kbr8-47/orders/${orderId}`);

    return { success: true };
  } catch (error) {
    console.error("Error in payShopOrderFromAdmin:", error);
    return { success: false, error: "حدث خطأ أثناء تسجيل عملية الدفع" };
  }
}

// جلب الكيانات من النظام لربطها بدفتر الديون (يشمل كافة الكيانات مع حالة ما إذا كانت مضافة مسبقاً)
export async function getUnaddedSystemPartners(type: PartnerType) {
  try {
    const { isAdminSession } = await import("@/lib/admin-session");
    if (!(await isAdminSession())) {
      return [];
    }

    // جلب الحسابات الموجودة مسبقاً لنفس النوع (النشطة فقط)
    const activePartners = await prisma.creditBookPartner.findMany({
      where: {
        type,
        NOT: {
          type: {
            startsWith: "deleted_"
          }
        }
      },
      select: { id: true, externalId: true, name: true }
    });

    const addedMap = new Map<string, string>();
    for (const ap of activePartners) {
      if (ap.externalId) {
        addedMap.set(ap.externalId, ap.id);
      }
    }

    if (type === "courier") {
      const list = await prisma.courier.findMany({
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" }
      });
      return list.map(item => ({
        id: item.id,
        name: item.name,
        phone: item.phone,
        isAdded: addedMap.has(item.id),
        creditBookPartnerId: addedMap.get(item.id)
      }));
    }

    if (type === "preparer") {
      const list = await prisma.companyPreparer.findMany({
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" }
      });
      return list.map(item => ({
        id: item.id,
        name: item.name,
        phone: item.phone,
        isAdded: addedMap.has(item.id),
        creditBookPartnerId: addedMap.get(item.id)
      }));
    }

    if (type === "shop") {
      const list = await prisma.shop.findMany({
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" }
      });
      return list.map(item => ({
        id: item.id,
        name: item.name,
        phone: item.phone,
        isAdded: addedMap.has(item.id),
        creditBookPartnerId: addedMap.get(item.id)
      }));
    }

    if (type === "customer") {
      const list = await prisma.customer.findMany({
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
        take: 300
      });
      return list.map(item => ({
        id: item.id,
        name: item.name,
        phone: item.phone,
        isAdded: addedMap.has(item.id),
        creditBookPartnerId: addedMap.get(item.id)
      }));
    }

    if (type === "supplier") {
      const list = await prisma.storeSupplier.findMany({
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" }
      });
      return list.map(item => ({
        id: item.id,
        name: item.name,
        phone: item.phone,
        isAdded: addedMap.has(item.id),
        creditBookPartnerId: addedMap.get(item.id)
      }));
    }

    return [];
  } catch (error) {
    console.error("Error in getUnaddedSystemPartners:", error);
    return [];
  }
}

// 11. تعديل عملية دفع للطلب مباشرة من الإدارة
export async function updateAdminPaymentEvent(eventId: string, amount: number) {
  try {
    const { isAdminSession } = await import("@/lib/admin-session");
    if (!(await isAdminSession())) {
      return { success: false, error: "غير مصرح لك بالقيام بهذا الإجراء" };
    }

    if (amount <= 0) {
      return { success: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
    }

    const event = await prisma.orderCourierMoneyEvent.findUnique({
      where: { id: eventId },
      include: { order: true }
    });

    if (!event) {
      return { success: false, error: "المعاملة غير موجودة" };
    }

    await prisma.orderCourierMoneyEvent.update({
      where: { id: eventId },
      data: {
        amountDinar: new Decimal(amount)
      }
    });

    // تحديث تاريخ تعديل الشريك لتعديل ترتيبه في القائمة
    const partner = await prisma.creditBookPartner.findFirst({
      where: { type: "shop", externalId: event.order.shopId },
      select: { id: true }
    });
    if (partner) {
      await prisma.creditBookPartner.update({
        where: { id: partner.id },
        data: { updatedAt: new Date() }
      });
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${partner?.id || ""}`);
    return { success: true };
  } catch (error) {
    console.error("Error in updateAdminPaymentEvent:", error);
    return { success: false, error: "حدث خطأ أثناء تعديل المعاملة" };
  }
}

// 12. حذف عملية دفع للطلب مباشرة من الإدارة
export async function deleteAdminPaymentEvent(eventId: string) {
  try {
    const { isAdminSession } = await import("@/lib/admin-session");
    if (!(await isAdminSession())) {
      return { success: false, error: "غير مصرح لك بالقيام بهذا الإجراء" };
    }

    const event = await prisma.orderCourierMoneyEvent.findUnique({
      where: { id: eventId },
      include: { order: true }
    });

    if (!event) {
      return { success: false, error: "المعاملة غير موجودة" };
    }

    // حذف ناعم للحدث المالي
    await prisma.orderCourierMoneyEvent.update({
      where: { id: eventId },
      data: {
        deletedAt: new Date(),
        deletedReason: "manual_admin",
        deletedByDisplayName: "الإدارة"
      }
    });

    // تحديث تاريخ تعديل الشريك لتعديل ترتيبه في القائمة
    const partner = await prisma.creditBookPartner.findFirst({
      where: { type: "shop", externalId: event.order.shopId },
      select: { id: true }
    });
    if (partner) {
      await prisma.creditBookPartner.update({
        where: { id: partner.id },
        data: { updatedAt: new Date() }
      });
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${partner?.id || ""}`);
    return { success: true };
  } catch (error) {
    console.error("Error in deleteAdminPaymentEvent:", error);
    return { success: false, error: "حدث خطأ أثناء حذف المعاملة" };
  }
}

// 13. تصفير وتصفية حساب الشريك (فوري وبدقة 0.00 د.ع بدون أي تعليق أو تايم أوت)
export async function zeroPartnerAccount(partnerId: string) {
  try {
    const { isAdminSession } = await import("@/lib/admin-session");
    if (!(await isAdminSession())) {
      return { success: false, error: "غير مصرح لك بالقيام بهذا الإجراء" };
    }

    const partner = await prisma.creditBookPartner.findUnique({
      where: { id: partnerId },
      include: {
        transactions: {
          select: { id: true }
        }
      }
    });

    if (!partner) {
      return { success: false, error: "الشريك غير موجود" };
    }

    const now = new Date();

    // 1. إذا كان شريكاً من نوع محل (shop): تسديد كافة طلباته النشطة السابقة دفعة واحدة بسرعة فائقة
    if (partner.type === "shop" && partner.externalId) {
      try {
        await prisma.order.updateMany({
          where: {
            shopId: partner.externalId,
            shopCostPaidAt: null,
            createdAt: { lte: now }
          },
          data: {
            shopCostPaidAt: now
          }
        });
      } catch (e) {
        console.error("Shop batch order zero error:", e);
      }
    }

    // 2. إذا كان شريكاً من نوع مورد (supplier): تسديد طلبات المورد في النظام
    if (partner.type === "supplier" && partner.externalId) {
      try {
        const orders = await prisma.order.findMany({
          where: { preparerShoppingJson: { contains: partner.externalId } },
          select: { id: true, preparerShoppingJson: true }
        });
        for (const o of orders) {
          let json: any = {};
          try {
            json = typeof o.preparerShoppingJson === "string" ? JSON.parse(o.preparerShoppingJson) : o.preparerShoppingJson || {};
          } catch {
            json = {};
          }
          const products = Array.isArray(json.products) ? json.products : [];
          const hasSupplierProducts = products.some((p: any) => p && typeof p.assignedPreparerId === "string" && p.assignedPreparerId.trim() === partner.externalId);
          if ((hasSupplierProducts || json.supplierId === partner.externalId) && !json.supplierPaid) {
            json.supplierPaid = true;
            json.supplierPaidAt = now.toISOString();
            await prisma.order.update({
              where: { id: o.id },
              data: { preparerShoppingJson: JSON.stringify(json) }
            });
          }
        }
      } catch (e) {
        console.error("Supplier zero error:", e);
      }
    }

    // 3. إذا كان شريكاً من نوع مندوب (courier): تصفير تاريخ حساب المندوب
    if (partner.type === "courier" && partner.externalId) {
      try {
        await prisma.courier.update({
          where: { id: partner.externalId },
          data: { mandoubTotalsResetAt: now }
        });
      } catch (e) {
        console.error("Courier reset error:", e);
      }
    }

    // 4. إذا كان شريكاً من نوع مجهز (preparer): تصفير تاريخ حساب المجهز
    if (partner.type === "preparer" && partner.externalId) {
      try {
        await prisma.companyPreparer.update({
          where: { id: partner.externalId },
          data: { orderListResetAt: now }
        });
      } catch (e) {
        console.error("Preparer reset error:", e);
      }
    }

    // 5. مسح المعاملات اليدوية السابقة لهذا الشريك لضمان نظافة الحساب
    await prisma.creditBookTransaction.deleteMany({
      where: { partnerId: partner.id }
    });

    // 6. إنشاء قيد تصفير رسمي وواضح في كشف الحساب
    const zeroTx = await prisma.creditBookTransaction.create({
      data: {
        partnerId: partner.id,
        amount: 0,
        kind: "took",
        note: "تصفير وتصفية الرصيد الكلي بالكامل (0 د.ع) [مصفّرة]",
        createdAt: now,
      }
    });

    try {
      const { logTransactionAuthor } = await import("@/lib/transaction-logger");
      await logTransactionAuthor(zeroTx.id, "create", "النظام");
    } catch (logErr) {
      console.error("Failed to log zero transaction author:", logErr);
    }

    // تحديث تاريخ تعديل الشريك
    await prisma.creditBookPartner.update({
      where: { id: partnerId },
      data: { updatedAt: now }
    });

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${partnerId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in zeroPartnerAccount:", error);
    return { success: false, error: error?.message || "حدث خطأ أثناء تصفير الحساب" };
  }
}

// 12. جلب سجل التغييرات والمعاملات المحذوفة/المعدلة
export async function getTransactionLogs() {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "credit_book", section: "transaction_history_logs" } }
    });
    if (setting && setting.config && typeof setting.config === "object") {
      return (setting.config as any).logs || [];
    }
    return [];
  } catch (error) {
    console.error("Error in getTransactionLogs:", error);
    return [];
  }
}

// 13. إرجاع المعاملة المحذوفة
export async function restoreDeletedTransaction(logId: string) {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "credit_book", section: "transaction_history_logs" } }
    });
    if (!setting || !setting.config || typeof setting.config !== "object") {
      return { success: false, error: "السجل غير موجود" };
    }

    let logs = (setting.config as any).logs || [];
    const logIndex = logs.findIndex((l: any) => l.id === logId);
    if (logIndex === -1) {
      return { success: false, error: "سجل المعاملة غير موجود" };
    }

    const log = logs[logIndex];
    const { originalTx } = log;

    // التأكد من أن الشريك لا يزال موجوداً
    const partnerExists = await prisma.creditBookPartner.findUnique({
      where: { id: originalTx.partnerId }
    });
    if (!partnerExists) {
      return { success: false, error: "الشريك المرتبط بهذه المعاملة تم حذفه تماماً من النظام" };
    }

    // إعادة إنشاء المعاملة
    const restoredTx = await prisma.creditBookTransaction.create({
      data: {
        partnerId: originalTx.partnerId,
        amount: originalTx.amount,
        kind: originalTx.kind,
        note: originalTx.note,
        imageUrl: originalTx.imageUrl,
        createdAt: new Date(originalTx.createdAt),
      }
    });

    try {
      const { logTransactionAuthor } = await import("@/lib/transaction-logger");
      await logTransactionAuthor(restoredTx.id, "create");
    } catch (logErr) {
      console.error("Failed to log restored transaction creator:", logErr);
    }

    // تحديث تاريخ الشريك
    await prisma.creditBookPartner.update({
      where: { id: originalTx.partnerId },
      data: { updatedAt: new Date() }
    });

    // إزالة السجل من القائمة
    logs.splice(logIndex, 1);
    await prisma.uISystemSetting.update({
      where: { id: setting.id },
      data: { config: { logs } }
    });

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${originalTx.partnerId}`);
    return { success: true };
  } catch (error) {
    console.error("Error in restoreDeletedTransaction:", error);
    return { success: false, error: "حدث خطأ أثناء استعادة المعاملة" };
  }
}

// 14. إرجاع المعاملة المعدلة لحالتها الأصلية
export async function revertModifiedTransaction(logId: string) {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "credit_book", section: "transaction_history_logs" } }
    });
    if (!setting || !setting.config || typeof setting.config !== "object") {
      return { success: false, error: "السجل غير موجود" };
    }

    let logs = (setting.config as any).logs || [];
    const logIndex = logs.findIndex((l: any) => l.id === logId);
    if (logIndex === -1) {
      return { success: false, error: "سجل المعاملة غير موجود" };
    }

    const log = logs[logIndex];
    const { originalTx } = log;

    // التأكد من أن المعاملة لا تزال موجودة
    const txExists = await prisma.creditBookTransaction.findUnique({
      where: { id: originalTx.id }
    });
    if (!txExists) {
      return { success: false, error: "هذه المعاملة تم حذفها لاحقاً، ولا يمكن استرجاع تعديلها" };
    }

    // إرجاع الحقول لقيمها الأصلية
    const revertedTx = await prisma.creditBookTransaction.update({
      where: { id: originalTx.id },
      data: {
        amount: originalTx.amount,
        kind: originalTx.kind,
        note: originalTx.note,
        imageUrl: originalTx.imageUrl,
        createdAt: new Date(originalTx.createdAt),
      }
    });

    try {
      const { logTransactionAuthor } = await import("@/lib/transaction-logger");
      await logTransactionAuthor(revertedTx.id, "update");
    } catch (logErr) {
      console.error("Failed to log reverted transaction editor:", logErr);
    }

    // تحديث تاريخ الشريك
    await prisma.creditBookPartner.update({
      where: { id: originalTx.partnerId },
      data: { updatedAt: new Date() }
    });

    // إزالة السجل من القائمة
    logs.splice(logIndex, 1);
    await prisma.uISystemSetting.update({
      where: { id: setting.id },
      data: { config: { logs } }
    });

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${originalTx.partnerId}`);
    return { success: true };
  } catch (error) {
    console.error("Error in revertModifiedTransaction:", error);
    return { success: false, error: "حدث خطأ أثناء التراجع عن التعديل" };
  }
}

// 15. مسح السجلات بالكامل
export async function clearTransactionLogs() {
  try {
    await prisma.uISystemSetting.upsert({
      where: { target_section: { target: "credit_book", section: "transaction_history_logs" } },
      create: {
        target: "credit_book",
        section: "transaction_history_logs",
        config: { logs: [] }
      },
      update: {
        config: { logs: [] }
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Error in clearTransactionLogs:", error);
    return { success: false, error: "حدث خطأ أثناء مسح السجلات" };
  }
}

// 16. جلب بيانات كتاب المعاملات/المعدلين والمضيفين
export async function getTransactionAuthorsAction() {
  try {
    const { getTransactionAuthors } = await import("@/lib/transaction-logger");
    return await getTransactionAuthors();
  } catch (error) {
    console.error("Error in getTransactionAuthorsAction:", error);
    return {};
  }
}

// 17. جلب قائمة المحاسبين والروابط المولدة لهم
export async function getAccountants() {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "credit_book", section: "accountant_access_tokens" } }
    });
    if (setting && setting.config && typeof setting.config === "object") {
      return (setting.config as any).accountants || [];
    }
    return [];
  } catch (error) {
    console.error("Error in getAccountants:", error);
    return [];
  }
}

// 18. توليد رابط دخول لمحاسب جديد
export async function createAccountantLink(name: string, phone: string) {
  try {
    const { isAdminSession } = await import("@/lib/admin-session");
    if (!(await isAdminSession())) {
      return { success: false, error: "غير مصرح لك بالقيام بهذا الإجراء" };
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      return { success: false, error: "الرجاء إدخال الاسم ورقم الهاتف بالكامل" };
    }

    // توليد توكن عشوائي آمن
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const setting = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "credit_book", section: "accountant_access_tokens" } }
    });

    let accountants: any[] = [];
    if (setting && setting.config && typeof setting.config === "object") {
      accountants = (setting.config as any).accountants || [];
    }

    const newAcc = {
      id: Math.random().toString(36).substring(2, 11),
      name: trimmedName,
      phone: trimmedPhone,
      token,
      createdAt: new Date().toISOString(),
      active: true
    };

    accountants = [newAcc, ...accountants];

    await prisma.uISystemSetting.upsert({
      where: { target_section: { target: "credit_book", section: "accountant_access_tokens" } },
      create: {
        target: "credit_book",
        section: "accountant_access_tokens",
        config: { accountants }
      },
      update: {
        config: { accountants }
      }
    });

    return { success: true, accountant: newAcc };
  } catch (error) {
    console.error("Error in createAccountantLink:", error);
    return { success: false, error: "حدث خطأ أثناء توليد الرابط" };
  }
}

// 19. إلغاء صلاحية محاسب/رابط وصول
export async function revokeAccountantAccess(id: string) {
  try {
    const { isAdminSession } = await import("@/lib/admin-session");
    if (!(await isAdminSession())) {
      return { success: false, error: "غير مصرح لك بالقيام بهذا الإجراء" };
    }

    const setting = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "credit_book", section: "accountant_access_tokens" } }
    });

    if (!setting || !setting.config || typeof setting.config !== "object") {
      return { success: false, error: "السجل غير موجود" };
    }

    let accountants = (setting.config as any).accountants || [];
    const accIndex = accountants.findIndex((a: any) => a.id === id);
    if (accIndex === -1) {
      return { success: false, error: "المحاسب غير موجود" };
    }

    accountants.splice(accIndex, 1);

    await prisma.uISystemSetting.update({
      where: { id: setting.id },
      data: { config: { accountants } }
    });

    return { success: true };
  } catch (error) {
    console.error("Error in revokeAccountantAccess:", error);
    return { success: false, error: "حدث خطأ أثناء إلغاء صلاحية الوصول" };
  }
}

// 20. تسجيل دفع للمورد بقيمة الطلب وتحديث الطلب في المجهز
export async function paySupplierTransaction(transactionId: string) {
  try {
    const tx = await prisma.creditBookTransaction.findUnique({
      where: { id: transactionId },
      include: { partner: true }
    });
    if (!tx) return { success: false, error: "المعاملة غير موجودة" };

    if (tx.partner?.type !== "supplier") {
      return { success: false, error: "هذه المعاملة ليست لمورد" };
    }

    if (!tx.note) {
      return { success: false, error: "ملاحظة المعاملة فارغة" };
    }

    const match = tx.note.match(/طلب رقم:\s*#(\d+)/);
    if (!match) {
      return { success: false, error: "لم يتم العثور على رقم الطلب في ملاحظة المعاملة" };
    }

    const orderNum = parseInt(match[1], 10);
    const order = await prisma.order.findFirst({
      where: { orderNumber: orderNum }
    });

    if (!order) {
      return { success: false, error: `الطلب رقم #${orderNum} غير موجود في النظام` };
    }

    // 1. تحديث الطلب وإضافة علامة الدفع للمورد
    let json: any = {};
    try {
      json = typeof order.preparerShoppingJson === "string"
        ? JSON.parse(order.preparerShoppingJson)
        : order.preparerShoppingJson || {};
    } catch (e) {
      json = {};
    }

    if (json.supplierPaid) {
      return { success: false, error: "هذا الطلب مسدد بالفعل للمورد" };
    }

    json.supplierPaid = true;
    json.supplierPaidAt = new Date().toISOString();
    json.supplierPaidAmount = Number(tx.amount);

    await prisma.order.update({
      where: { id: order.id },
      data: { preparerShoppingJson: json }
    });

    // 2. إنشاء معاملة "gave" (أعطيت) للمورد بقيمة المعاملة الأصلية
    const payTx = await prisma.creditBookTransaction.create({
      data: {
        partnerId: tx.partnerId,
        amount: tx.amount,
        kind: "gave",
        note: `تسديد لطلب رقم: #${orderNum} | دفعت بواسطة الإدارة`,
        createdAt: new Date(),
      }
    });

    try {
      const { logTransactionAuthor } = await import("@/lib/transaction-logger");
      await logTransactionAuthor(payTx.id, "create");
    } catch (logErr) {
      console.error("Failed to log pay transaction creator:", logErr);
    }

    // تحديث تاريخ الشريك
    await prisma.creditBookPartner.update({
      where: { id: tx.partnerId },
      data: { updatedAt: new Date() }
    });

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${tx.partnerId}`);
    return { success: true };
  } catch (error) {
    console.error("Error in paySupplierTransaction:", error);
    return { success: false, error: "حدث خطأ أثناء معالجة الدفع للمورد" };
  }
}

// مزامنة الديون القديمة للزبائن بأثر رجعي
export async function syncOldCustomerDebts() {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ["delivered", "archived"] },
        totalAmount: { gt: 0 }
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        customerRegion: { select: { name: true } },
        courier: { select: { name: true } },
        shop: { select: { name: true } },
        moneyEvents: {
          where: {
            kind: "delivery_in",
            deletedAt: null
          }
        }
      }
    });

    let checkedCount = 0;
    let createdPartnersCount = 0;
    let createdTransactionsCount = 0;
    let updatedTxsCount = 0;
    let totalDebtAmount = 0;

    for (const order of orders) {
      checkedCount++;
      
      const expectedDinar = Number(order.totalAmount || 0);
      const receivedDinar = order.moneyEvents.reduce((sum, ev) => sum + Number(ev.amountDinar || 0), 0);
      const isPaidAll = order.prepaidAll || order.customerPaymentReceivedAt !== null;

      // إذا كان المستلم أقل من المطلوب وليس واصل الحساب
      if (expectedDinar > receivedDinar && !isPaidAll) {
        const difference = expectedDinar - receivedDinar;

        if (difference > 0) {
          // تحديث توقعات النقدية وعجز المندوب للطلب لتطابق الأسعار الجديدة تلقائياً
          try {
            await syncOrderCourierMoneyExpectations(prisma, order.id);
          } catch (syncErr) {
            console.error(`Failed to sync money expectations for order ${order.id} in sync:`, syncErr);
          }

          let customerId = order.customerId;
          let customer = order.customer;

          // إذا لم يكن الطلب مرتبطاً بزبون، نحاول البحث عن زبون بجميع احتمالات رقم الهاتف أو إنشائه تلقائياً
          if (!customerId && order.customerPhone) {
            const phoneLocal = order.customerPhone.trim();
            if (phoneLocal) {
              const normPhone = normalizeIraqMobileLocal11(phoneLocal);
              const cleanDigits = phoneLocal.replace(/\D/g, "");
              const phoneVariants = [phoneLocal, cleanDigits];
              if (normPhone) {
                phoneVariants.push(normPhone);
                if (normPhone.startsWith("0")) {
                  phoneVariants.push("964" + normPhone.slice(1));
                  phoneVariants.push(normPhone.slice(1));
                }
              }
              const uniqueVariants = Array.from(new Set(phoneVariants.filter(Boolean)));

              let foundCust = await prisma.customer.findFirst({
                where: {
                  phone: { in: uniqueVariants },
                  shopId: order.shopId
                }
              });

              if (!foundCust) {
                const custName = order.customerName?.trim() || "زبون";
                foundCust = await prisma.customer.create({
                  data: {
                    shopId: order.shopId,
                    name: custName,
                    phone: normPhone || phoneLocal,
                    customerRegionId: order.customerRegionId,
                    customerLocationUrl: order.customerLocationUrl || "",
                    customerLandmark: order.customerLandmark || "",
                  }
                });
              }
              customerId = foundCust.id;
              customer = foundCust;
              await prisma.order.update({
                where: { id: order.id },
                data: { customerId: foundCust.id }
              });
            }
          }

          if (!customerId && !order.customerPhone) continue;

          // 1. البحث عن حساب دفتر الديون للزبون أو إنشائه
          let cbPartner = null;
          if (customerId) {
            cbPartner = await prisma.creditBookPartner.findUnique({
              where: {
                type_externalId: {
                  type: "customer",
                  externalId: customerId
                }
              }
            });
          }

          if (!cbPartner && order.customerPhone) {
            const phoneLocal = order.customerPhone.trim();
            const normPhone = normalizeIraqMobileLocal11(phoneLocal);
            const cleanDigits = phoneLocal.replace(/\D/g, "");
            const phoneVariants = [phoneLocal, cleanDigits];
            if (normPhone) {
              phoneVariants.push(normPhone);
              if (normPhone.startsWith("0")) {
                phoneVariants.push("964" + normPhone.slice(1));
                phoneVariants.push(normPhone.slice(1));
              }
            }
            const uniqueVariants = Array.from(new Set(phoneVariants.filter(Boolean)));

            cbPartner = await prisma.creditBookPartner.findFirst({
              where: {
                type: "customer",
                phone: { in: uniqueVariants }
              }
            });
            if (cbPartner && customerId && !cbPartner.externalId) {
              await prisma.creditBookPartner.update({
                where: { id: cbPartner.id },
                data: { externalId: customerId }
              });
            }
          }

          const actualCustomerName = (order.customerName && order.customerName.trim()) 
            || (customer && customer.name && customer.name.trim() !== "زبون" ? customer.name.trim() : "") 
            || "زبون";

          if (!cbPartner) {
            cbPartner = await prisma.creditBookPartner.create({
              data: {
                name: actualCustomerName,
                phone: order.customerPhone || customer?.phone || null,
                type: "customer",
                externalId: customerId || null,
                updatedAt: new Date()
              }
            });
            createdPartnersCount++;
          } else {
            const shouldUpdateName = (cbPartner.name === "زبون" || !cbPartner.name) && actualCustomerName !== "زبون";
            await prisma.creditBookPartner.update({
              where: { id: cbPartner.id },
              data: {
                updatedAt: new Date(),
                ...(shouldUpdateName ? { name: actualCustomerName } : {}),
                ...(!cbPartner.phone && (order.customerPhone || customer?.phone) ? { phone: order.customerPhone || customer?.phone } : {})
              }
            });
          }

          // 2. التحقق من عدم وجود المعاملة بالفعل لتفادي التكرار
          const noteTextContains = `#${order.orderNumber}`;
          const exists = await prisma.creditBookTransaction.findFirst({
            where: {
              partnerId: cbPartner.id,
              note: {
                contains: noteTextContains
              }
            }
          });

          const regionName = order.customerRegion?.name || "غير محدد";
          const courierName = order.courier?.name || "بدون مندوب";
          const orderType = order.orderType || "توصيل";
          const shopName = order.shop?.name || "المتجر";
          const phoneDisplay = order.customerPhone || customer?.phone || "بدون هاتف";
          const nameDisplay = actualCustomerName;

          const noteText = `طلب رقم: #${order.orderNumber} | نطلبه (دين تسليم) | المتجر: ${shopName} | الزبون: ${nameDisplay} (${phoneDisplay}) | المنطقة: ${regionName} | المندوب: ${courierName} | نوع الطلب: ${orderType} | المطلوب الكلي: ${expectedDinar.toLocaleString()} د.ع | الوارد المستلم: ${receivedDinar.toLocaleString()} د.ع | المتبقي بذمته: ${difference.toLocaleString()} د.ع`;

          if (!exists) {
            const newTx = await prisma.creditBookTransaction.create({
              data: {
                partnerId: cbPartner.id,
                amount: difference,
                kind: "gave", // أعطيت = نطلبه
                note: noteText,
                createdAt: order.createdAt
              }
            });

            try {
              const { logTransactionAuthor } = await import("@/lib/transaction-logger");
              await logTransactionAuthor(newTx.id, "create", "النظام");
            } catch (logErr) {
              console.error("Failed to log transaction creator as System:", logErr);
            }

            createdTransactionsCount++;
            totalDebtAmount += difference;
          } else {
            if (exists.note !== noteText || Number(exists.amount) !== difference || exists.kind !== "gave") {
              await prisma.creditBookTransaction.update({
                where: { id: exists.id },
                data: {
                  amount: difference,
                  kind: "gave",
                  note: noteText
                }
              });
              updatedTxsCount++;
            }
          }
        }
      } else {
        // إذا كان واصلاً بالكامل أو تلاشى الفرق
        // نبحث عن أي معاملة قديمة لهذا الطلب ونحذفها لتصفير الدين تلقائياً
        try {
          await syncOrderCourierMoneyExpectations(prisma, order.id);
        } catch (syncErr) {
          console.error(`Failed to sync money expectations for order ${order.id} in sync (else):`, syncErr);
        }
        if (order.customerId || order.customerPhone) {
          let cbPartner = null;
          if (order.customerId) {
            cbPartner = await prisma.creditBookPartner.findUnique({
              where: {
                type_externalId: {
                  type: "customer",
                  externalId: order.customerId
                }
              }
            });
          }
          if (!cbPartner && order.customerPhone) {
            const phoneLocal = order.customerPhone.trim();
            const normPhone = normalizeIraqMobileLocal11(phoneLocal);
            const cleanDigits = phoneLocal.replace(/\D/g, "");
            const phoneVariants = [phoneLocal, cleanDigits];
            if (normPhone) {
              phoneVariants.push(normPhone);
              if (normPhone.startsWith("0")) {
                phoneVariants.push("964" + normPhone.slice(1));
                phoneVariants.push(normPhone.slice(1));
              }
            }
            const uniqueVariants = Array.from(new Set(phoneVariants.filter(Boolean)));
            cbPartner = await prisma.creditBookPartner.findFirst({
              where: {
                type: "customer",
                phone: { in: uniqueVariants }
              }
            });
          }
          if (cbPartner) {
            const exists = await prisma.creditBookTransaction.findFirst({
              where: {
                partnerId: cbPartner.id,
                note: {
                  contains: `#${order.orderNumber}`
                }
              }
            });
            if (exists) {
              await prisma.creditBookTransaction.delete({
                where: { id: exists.id }
              });
            }
          }
        }
      }
    }

    // 3. تحديث الملاحظات للمعاملات القديمة المسجلة مسبقاً بنص قديم لتأخذ التنسيق المفصل
    const existingCustomerTxs = await prisma.creditBookTransaction.findMany({
      where: {
        OR: [
          { note: { contains: "طلب رقم:" } },
          { note: { contains: "#" } }
        ],
        partner: {
          type: "customer"
        }
      }
    });

    for (const tx of existingCustomerTxs) {
      const match = tx.note?.match(/#(\d+)/);
      if (match && match[1]) {
        const orderNumber = parseInt(match[1]);
        
        const order = await prisma.order.findFirst({
          where: { orderNumber },
          include: {
            customerRegion: { select: { name: true } },
            courier: { select: { name: true } },
            shop: { select: { name: true } },
            moneyEvents: {
              where: {
                kind: "delivery_in",
                deletedAt: null
              }
            }
          }
        });

        if (order) {
          const expectedDinar = Number(order.totalAmount || 0);
          const receivedDinar = order.moneyEvents.reduce((sum, ev) => sum + Number(ev.amountDinar || 0), 0);
          const difference = expectedDinar - receivedDinar;

          const regionName = order.customerRegion?.name || "غير محدد";
          const courierName = order.courier?.name || "بدون مندوب";
          const orderType = order.orderType || "توصيل";
          const shopName = order.shop?.name || "المتجر";
          const phoneDisplay = order.customerPhone || "بدون هاتف";
          const nameDisplay = order.customerName || "زبون";
          
          const newNote = `طلب رقم: #${order.orderNumber} | نطلبه (دين تسليم) | المتجر: ${shopName} | الزبون: ${nameDisplay} (${phoneDisplay}) | المنطقة: ${regionName} | المندوب: ${courierName} | نوع الطلب: ${orderType} | المطلوب الكلي: ${expectedDinar.toLocaleString()} د.ع | الوارد المستلم: ${receivedDinar.toLocaleString()} د.ع | المتبقي بذمته: ${difference.toLocaleString()} د.ع`;

          if (tx.note !== newNote || Number(tx.amount) !== difference || tx.kind !== "gave") {
            await prisma.creditBookTransaction.update({
              where: { id: tx.id },
              data: { 
                note: newNote,
                amount: difference,
                kind: "gave"
              }
            });
            updatedTxsCount++;
          }
        }
      }
    }



    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    
    return {
      success: true,
      checkedCount,
      createdPartnersCount,
      createdTransactionsCount,
      updatedTxsCount,
      totalDebtAmount
    };

  } catch (error: any) {
    console.error("Error in syncOldCustomerDebts:", error);
    return { success: false, error: error.message || "حدث خطأ غير متوقع" };
  }
}

// تعديل اسم الشريك والزبون المرتبط به مباشرة
export async function updatePartnerName(partnerId: string, newName: string) {
  try {
    const cleanName = newName.trim();
    if (!cleanName) {
      return { success: false, error: "الرجاء إدخال اسم صالح" };
    }

    const partner = await prisma.creditBookPartner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return { success: false, error: "الشريك غير موجود" };
    }

    // 1. تحديث اسم الشريك في دفتر الديون
    await prisma.creditBookPartner.update({
      where: { id: partnerId },
      data: { name: cleanName }
    });

    // 2. إذا كان الشريك زبوناً، نقوم بتحديث اسمه في جدول الزبائن أيضاً
    if (partner.type === "customer" && partner.externalId) {
      await prisma.customer.update({
        where: { id: partner.externalId },
        data: { name: cleanName }
      });
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${partnerId}`);
    
    return { success: true };
  } catch (error: any) {
    console.error("Error in updatePartnerName:", error);
    return { success: false, error: error.message || "حدث خطأ أثناء تحديث الاسم" };
  }
}

// تعديل اسم ورقم هاتف الشريك والزبون المرتبط به
export async function updatePartnerDetails(partnerId: string, newName: string, newPhone: string | null) {
  try {
    const cleanName = newName.trim();
    if (!cleanName) {
      return { success: false, error: "الرجاء إدخال اسم صالح" };
    }

    const partner = await prisma.creditBookPartner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return { success: false, error: "الشريك غير موجود" };
    }

    // 1. تحديث الاسم والهاتف في دفتر الديون
    await prisma.creditBookPartner.update({
      where: { id: partnerId },
      data: { 
        name: cleanName,
        phone: newPhone ? newPhone.trim() : null
      }
    });

    // 2. إذا كان الشريك زبوناً، نقوم بتحديث اسمه وهاتفه في جدول الزبائن أيضاً
    if (partner.type === "customer" && partner.externalId) {
      await prisma.customer.update({
        where: { id: partner.externalId },
        data: { 
          name: cleanName,
          phone: newPhone ? newPhone.trim() : ""
        }
      });
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${partnerId}`);
    
    return { success: true };
  } catch (error: any) {
    console.error("Error in updatePartnerDetails:", error);
    return { success: false, error: error.message || "حدث خطأ غير متوقع" };
  }
}

// 17. تصفير دفتر الديون بالكامل وبدء صفحة جديدة نظيفة (0 د.ع) مع إبقاء الآلية التلقائية لطلبات الغد
export async function resetAndZeroCreditBookCompletely() {
  try {
    const now = new Date();

    // 1. تسجيل تاريخ التصفير العام للنظام فورياً (يتم في 10 ميلي ثانية بدون أي تعليق)
    await prisma.uISystemSetting.upsert({
      where: {
        target_section: {
          target: "credit_book",
          section: "system_global_reset"
        }
      },
      create: {
        target: "credit_book",
        section: "system_global_reset",
        config: { resetAt: now.toISOString() }
      },
      update: {
        config: { resetAt: now.toISOString() }
      }
    });

    // 2. حذف كافة المعاملات السابقة في دفتر الديون بالكامل
    await prisma.creditBookTransaction.deleteMany({});

    // 3. تسديد كافة طلبات المحلات السابقة دفعة واحدة بسرعة فائقة لتصفيرها
    try {
      await prisma.order.updateMany({
        where: {
          shopCostPaidAt: null,
          createdAt: { lte: now }
        },
        data: {
          shopCostPaidAt: now
        }
      });
    } catch (e) {
      console.error("Batch update shopCostPaidAt failed:", e);
    }

    // 4. حذف كافة الحسابات اليدوية غير المربوطة بالنظام (مثل حساب الموجود)
    await prisma.creditBookPartner.deleteMany({
      where: {
        externalId: null
      }
    });

    // 4. تصفير تاريخ المناديب والمجهزين
    try {
      await prisma.courier.updateMany({
        data: { mandoubTotalsResetAt: now }
      });
      await prisma.companyPreparer.updateMany({
        data: { orderListResetAt: now }
      });
    } catch (e) {
      console.error("courier/preparer reset update error:", e);
    }

    // 5. مسح سجلات التعديلات القديمة
    try {
      await clearTransactionLogs();
    } catch (e) {
      console.error("Failed to clear logs during reset:", e);
    }

    // 6. مزامنة أطراف النظام من جديد لتظهر كل المحلات والمناديب والمجهزين والزبائن مصفّرة وجاهزة لطلبات الغد
    await syncSystemPartners();

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    return { success: true };
  } catch (error: any) {
    console.error("Error in resetAndZeroCreditBookCompletely:", error);
    return { success: false, error: error.message || "حدث خطأ أثناء تصفير دفتر الديون" };
  }
}



