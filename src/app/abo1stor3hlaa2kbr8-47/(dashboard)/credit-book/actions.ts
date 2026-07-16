"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { computeMandoubAdminTotalAllTimeDinar, computeMandoubWalletRemainAllTimeDinar } from "@/lib/mandoub-wallet-carry";
import { getPreparerMoneyTotals } from "@/lib/preparer-combined-wallet-totals";
import { getPublicAppUrl } from "@/lib/app-url";
import { Decimal } from "@prisma/client/runtime/library";
import { CourierWalletMiscDirection, WalletPeerPartyKind } from "@prisma/client";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";

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
}

// دالة مساعدة لحساب الديون التلقائية للمحلات (الطلبات غير المسددة)
async function getShopAutoDebt(shopId: string): Promise<number> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { hideFromCreditBook: true }
  });
  if (!shop || shop.hideFromCreditBook) return 0;

  const orders = await prisma.order.findMany({
    where: {
      shopId,
      shopCostPaidAt: null,
      status: { in: ["delivered", "archived"] },
      OR: [
        { orderSubtotal: { gt: 0 } },
        { prepaidAll: true }
      ]
    },
    select: {
      orderSubtotal: true,
      prepaidAll: true,
      deliveryPrice: true,
      moneyEvents: {
        where: {
          kind: { in: ["pickup_out", "delivery_in"] },
          deletedAt: null
        },
        select: {
          amountDinar: true,
          kind: true
        }
      }
    }
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

  return autoTook - autoGave;
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

        p.transactions.forEach((t) => {
          const amt = Number(t.amount);
          if (t.kind === "gave") {
            totalGave += amt;
          } else if (t.kind === "took") {
            totalTook += amt;
          }
        });

        const manualBalance = totalGave - totalTook;
        let autoBalance = 0;
        let walletRemain = 0;

        if (p.type === "courier" && p.externalId) {
          try {
            const [adminTotal, walletRem] = await Promise.all([
              computeMandoubAdminTotalAllTimeDinar(p.externalId),
              computeMandoubWalletRemainAllTimeDinar(p.externalId)
            ]);
            autoBalance = adminTotal.toNumber();
            walletRemain = walletRem.toNumber();
          } catch (e) {
            console.error(`Failed to get courier auto debt for ${p.name}:`, e);
          }
        } else if (p.type === "preparer" && p.externalId) {
          try {
            const prepTotals = await getPreparerMoneyTotals(p.externalId);
            if (prepTotals) {
              autoBalance = prepTotals.remain.toNumber();
              walletRemain = prepTotals.remain.toNumber();
            }
          } catch (e) {
            console.error(`Failed to get preparer auto debt for ${p.name}:`, e);
          }
        } else if (p.type === "external" && p.externalId === "accumulated_salaries_root") {
          try {
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
          } catch (e) {
            console.error("Failed to calculate total accumulated salaries for root partner:", e);
          }
        } else if (p.type === "shop" && p.externalId) {
          try {
            const shopUnpaid = await getShopAutoDebt(p.externalId);
            autoBalance = -shopUnpaid;
          } catch (e) {
            console.error(`Failed to get shop auto debt for ${p.name}:`, e);
          }
        }

        let latestActivity = new Date(p.updatedAt).getTime();

        // 1. أحدث معاملة يدوية للشريك في الدفتر
        const latestTx = await prisma.creditBookTransaction.findFirst({
          where: { partnerId: p.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true }
        });
        if (latestTx) {
          latestActivity = Math.max(latestActivity, new Date(latestTx.createdAt).getTime());
        }

        // 2. العمليات التلقائية بالنظام (حركات محفظة أو طلبات)
        if (p.type === "courier" && p.externalId) {
          const latestWallet = await prisma.courierWalletMiscEntry.findFirst({
            where: { courierId: p.externalId, deletedAt: null },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
          });
          if (latestWallet) {
            latestActivity = Math.max(latestActivity, new Date(latestWallet.createdAt).getTime());
          }
          const latestEvent = await prisma.orderCourierMoneyEvent.findFirst({
            where: { courierId: p.externalId, deletedAt: null },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
          });
          if (latestEvent) {
            latestActivity = Math.max(latestActivity, new Date(latestEvent.createdAt).getTime());
          }
        } else if (p.type === "preparer" && p.externalId) {
          const prep = await prisma.companyPreparer.findFirst({
            where: { id: p.externalId },
            select: { walletEmployeeId: true, shopLinks: { select: { shopId: true } } }
          });
          if (prep) {
            if (prep.walletEmployeeId) {
              const latestWallet = await prisma.employeeWalletMiscEntry.findFirst({
                where: { employeeId: prep.walletEmployeeId, deletedAt: null },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true }
              });
              if (latestWallet) {
                latestActivity = Math.max(latestActivity, new Date(latestWallet.createdAt).getTime());
              }
              const latestTransfer = await prisma.walletPeerTransfer.findFirst({
                where: {
                  OR: [
                    { fromEmployeeId: prep.walletEmployeeId },
                    { toEmployeeId: prep.walletEmployeeId }
                  ]
                },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true }
              });
              if (latestTransfer) {
                latestActivity = Math.max(latestActivity, new Date(latestTransfer.createdAt).getTime());
              }
            }
            const shopIds = prep.shopLinks.map(l => l.shopId);
            if (shopIds.length > 0) {
              const latestOrder = await prisma.order.findFirst({
                where: { shopId: { in: shopIds } },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true }
              });
              if (latestOrder) {
                latestActivity = Math.max(latestActivity, new Date(latestOrder.createdAt).getTime());
              }
              const latestEvent = await prisma.orderCourierMoneyEvent.findFirst({
                where: { order: { shopId: { in: shopIds } }, deletedAt: null },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true }
              });
              if (latestEvent) {
                latestActivity = Math.max(latestActivity, new Date(latestEvent.createdAt).getTime());
              }
            }
          }
        } else if (p.type === "shop" && p.externalId) {
          const latestOrder = await prisma.order.findFirst({
            where: { shopId: p.externalId },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
          });
          if (latestOrder) {
            latestActivity = Math.max(latestActivity, new Date(latestOrder.createdAt).getTime());
          }
          const latestEvent = await prisma.orderCourierMoneyEvent.findFirst({
            where: { order: { shopId: p.externalId }, deletedAt: null },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
          });
          if (latestEvent) {
            latestActivity = Math.max(latestActivity, new Date(latestEvent.createdAt).getTime());
          }
        }

        const balance = manualBalance + autoBalance;

        // تم إلغاء الإخفاء التلقائي للمحلات المصفرة لكي لا تختفي الحسابات وتاريخ معاملاتها فجأة دون علم المستخدم

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
          walletRemain
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
    const briefPartner = await prisma.creditBookPartner.findUnique({
      where: { id: partnerId },
      select: { type: true, externalId: true }
    });

    if (briefPartner && briefPartner.type === "supplier" && briefPartner.externalId) {
      try {
        const { syncSupplierTransactions } = await import("@/lib/order-delivery-hook");
        await syncSupplierTransactions(briefPartner.externalId);
      } catch (err) {
        console.error("Failed to sync supplier transactions in getPartnerDetails:", err);
      }
    }

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
        const adminTotal = await computeMandoubAdminTotalAllTimeDinar(partner.externalId);
        autoBalance = adminTotal.toNumber();
        
        // جلب تفاصيل المندوب لمعرفة تاريخ التصفير والمبلغ المدور
        const courier = await prisma.courier.findUnique({
          where: { id: partner.externalId },
          select: {
            mandoubTotalsResetAt: true,
            mandoubWalletCarryOverDinar: true
          }
        });

        const resetAt = courier?.mandoubTotalsResetAt || null;

        // متبقي المحفظة للإدارة هو نفسه ذمة المندوب الحالية للتلقائي لتجنب التعارض في الواجهة
        walletRemain = autoBalance;

        // 1. جلب حركات أموال الطلبات للمندوب بالكامل تاريخياً
        const orderMoneyEvents = await prisma.orderCourierMoneyEvent.findMany({
          where: {
            courierId: partner.externalId,
            deletedAt: null
          },
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

        // 2. جلب قيود المحفظة اليدوية للمندوب بالكامل تاريخياً
        const courierMiscEntries = await prisma.courierWalletMiscEntry.findMany({
          where: {
            courierId: partner.externalId,
            deletedAt: null
          },
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

        // 3. جلب التحويلات المقبولة للإدارة للمندوب بالكامل تاريخياً
        // 3. جلب كافة تحويلات الأقران للمندوب بجميع حالاتها (مقبول، معلق، مرفوض)
        const courierTransfers = await prisma.walletPeerTransfer.findMany({
          where: {
            OR: [
              { fromCourierId: partner.externalId },
              { toCourierId: partner.externalId }
            ]
          },
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

        // 4. أرباح التوصيل للطلبات المكتملة والمؤرشفة للمندوب بالكامل تاريخياً
        const ordersWithEarnings = await prisma.order.findMany({
          where: {
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
          },
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

        const courierDiff = autoBalance - courierAutoSum;
        if (Math.abs(courierDiff) > 0.001) {
          autoTransactions.push({
            id: `auto-courier-adjust-${partner.id}`,
            partnerId: partner.id,
            amount: Math.abs(courierDiff),
            kind: courierDiff > 0 ? "gave" : "took",
            note: `تسويات وتصفية أرباح ومحفظة المندوب النشطة`,
            createdAt: resetAt || partner.createdAt,
            updatedAt: resetAt || partner.createdAt,
            isAuto: true
          });
        }
      } catch (e) {
        console.error("Error fetching courier auto transactions:", e);
      }
    } else if (partner.type === "preparer" && partner.externalId) {
      try {
        const prepTotals = await getPreparerMoneyTotals(partner.externalId);
        if (prepTotals) {
          autoBalance = prepTotals.remain.toNumber();
          walletRemain = prepTotals.remain.toNumber();
        }

        const preparer = await prisma.companyPreparer.findFirst({
          where: { id: partner.externalId, active: true },
          select: {
            shopLinks: { select: { shopId: true } },
            walletEmployeeId: true
          }
        });

        if (preparer) {
          // 1. جلب حركات أموال الطلبات المسجلة بواسطة المجهز لمحلاته
          const shopIds = preparer.shopLinks.map((l) => l.shopId);
          if (shopIds.length > 0) {
            const orderMoneyEvents = await prisma.orderCourierMoneyEvent.findMany({
              where: {
                deletedAt: null,
                recordedByCompanyPreparerId: partner.externalId,
                order: { shopId: { in: shopIds } }
              },
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
            const employeeMiscEntries = await prisma.employeeWalletMiscEntry.findMany({
              where: {
                employeeId: wid,
                deletedAt: null
              },
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
            const employeeAdminTransfers = await prisma.walletPeerTransfer.findMany({
              where: {
                fromEmployeeId: wid,
                toKind: WalletPeerPartyKind.admin,
                status: "accepted"
              },
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
            const employeePendingOutgoingTransfers = await prisma.walletPeerTransfer.findMany({
              where: {
                fromEmployeeId: wid,
                status: "pending"
              },
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

        const prepDiff = autoBalance - prepAutoSum;
        if (Math.abs(prepDiff) > 0.001) {
          autoTransactions.push({
            id: `auto-preparer-adjust-${partner.id}`,
            partnerId: partner.id,
            amount: Math.abs(prepDiff),
            kind: prepDiff > 0 ? "gave" : "took",
            note: `تسويات وتصفية أرباح ومحفظة المجهز النشطة`,
            createdAt: partner.createdAt,
            updatedAt: partner.createdAt,
            isAuto: true
          });
        }
      } catch (e) {
        console.error("Error fetching preparer auto transactions:", e);
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
    } else if (partner.type === "shop" && partner.externalId) {
      // للمحلات: جلب تفاصيل الطلبات وتوليد قيود تلقائية للديون وعمليات التسديد
      try {
        const orders = await prisma.order.findMany({
          where: {
            shopId: partner.externalId,
            shopCostPaidAt: null,
            status: { in: ["delivered", "archived"] },
            OR: [
              { orderSubtotal: { gt: 0 } },
              { prepaidAll: true }
            ]
          },
          include: {
            customerRegion: { select: { name: true } },
            courier: { select: { name: true } },
            moneyEvents: {
              where: {
                kind: { in: ["pickup_out", "delivery_in"] },
                deletedAt: null
              },
              select: {
                id: true,
                amountDinar: true,
                createdAt: true,
                courierId: true,
                recordedByCompanyPreparerId: true,
                mismatchNote: true,
                kind: true,
                courier: { select: { name: true } },
                recordedByCompanyPreparer: { select: { name: true } }
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 150
        });

        let autoGave = 0;
        let autoTook = 0;

        for (const o of orders) {
          const subtotal = Number(o.orderSubtotal || 0);
          const pickupPaid = o.moneyEvents
            .filter(me => me.kind === "pickup_out")
            .reduce((acc, me) => acc + Number(me.amountDinar || 0), 0);
          const isSettled = o.shopCostPaidAt !== null || pickupPaid >= subtotal;

          // 1. إضافة قيد الطلب كدين علينا (took)
          if (subtotal > 0) {
            autoTook += subtotal;
            autoTransactions.push({
              id: `auto-order-${o.id}`,
              partnerId: partner.id,
              amount: subtotal,
              kind: "took", // أخذت = يطلبنا
              note: `طلب رقم #${o.orderNumber} | نوع الطلب: ${o.orderType || "—"} | المنطقة: ${o.customerRegion?.name || "—"} | المندوب: ${o.courier?.name || "—"}${isSettled ? " (مسدد)" : ""}`,
              createdAt: o.createdAt,
              updatedAt: o.updatedAt,
              isAuto: true,
              isPaid: isSettled,
              remainingAmount: Math.max(0, subtotal - pickupPaid),
              orderId: o.id
            });
          }

          // 2. إضافة حركات الدفع (صادر) كحركات تسديد (gave)
          const pickupEvents = o.moneyEvents.filter(me => me.kind === "pickup_out");
          for (const me of pickupEvents) {
            const amt = Number(me.amountDinar || 0);
            autoGave += amt;
            
            let payer = "الإدارة";
            if (me.recordedByCompanyPreparer?.name) {
              payer = `المجهز: ${me.recordedByCompanyPreparer.name}`;
            } else if (me.courier?.name) {
              payer = `المندوب: ${me.courier.name}`;
            } else if (me.courierId) {
              payer = "المندوب";
            }

            autoTransactions.push({
              id: `auto-payment-${me.id}`,
              partnerId: partner.id,
              amount: amt,
              kind: "gave", // أعطيت = تسديد
              note: `تسديد للطلب #${o.orderNumber} | الجهة: ${payer}${me.mismatchNote ? ` (${me.mismatchNote})` : ""}`,
              createdAt: me.createdAt,
              updatedAt: me.createdAt,
              isAuto: true,
              isAdminPayment: !me.courierId && !me.recordedByCompanyPreparerId,
              orderId: o.id
            });
          }

          // 3. إضافة استقطاع أجور التوصيل للطلبيات "كل شيء واصل" (prepaidAll) إذا لم يكن بها وارد توصيل كاش
          if (o.prepaidAll && Number(o.deliveryPrice || 0) > 0) {
            const delPrice = Number(o.deliveryPrice);
            // نتحقق مما إذا كان هناك حركة وارد توصيل (delivery_in) بقيمة تطابق delPrice
            const hasMatchingDeliveryIn = o.moneyEvents.some(
              me => me.kind === "delivery_in" && Number(me.amountDinar || 0) === delPrice
            );

            if (!hasMatchingDeliveryIn) {
              autoGave += delPrice;
              autoTransactions.push({
                id: `auto-delivery-deduct-${o.id}`,
                partnerId: partner.id,
                amount: delPrice,
                kind: "gave", // أعطيت
                note: `أجور توصيل مستقطعة للطلب #${o.orderNumber} (كل شيء واصل)`,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
                isAuto: true,
                orderId: o.id
              });
            }
          }
        }
        
        autoBalance = autoGave - autoTook;
      } catch (e) {
        console.error(e);
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
    if (orderNumbers.size > 0 || (partner.type === "supplier" && partner.externalId)) {
      try {
        const foundOrders = await prisma.order.findMany({
          where: {
            OR: [
              orderNumbers.size > 0 ? { orderNumber: { in: Array.from(orderNumbers) } } : {},
              partner.type === "supplier" ? { preparerShoppingJson: { not: null } } : {}
            ].filter(cond => Object.keys(cond).length > 0)
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
      if (t.kind === "gave") {
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
          const prep = await prisma.preparer.findUnique({
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
export async function addTransaction(partnerId: string, amount: number, kind: "gave" | "took", note: string | null, date?: Date, imageUrl?: string | null) {
  try {
    if (amount <= 0) {
      return { success: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
    }

    const tx = await prisma.creditBookTransaction.create({
      data: {
        partnerId,
        amount,
        kind,
        note: note?.trim() || null,
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
export async function updateTransaction(transactionId: string, amount: number, note: string | null, kind: "gave" | "took", date?: Date, imageUrl?: string | null) {
  try {
    if (amount <= 0) {
      return { success: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
    }

    const originalTx = await prisma.creditBookTransaction.findUnique({
      where: { id: transactionId }
    });
    if (!originalTx) return { success: false, error: "المعاملة غير موجودة" };

    const tx = await prisma.creditBookTransaction.update({
      where: { id: transactionId },
      data: {
        amount,
        note: note?.trim() || null,
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

    // أ) استيراد المناديب
    const couriers = await prisma.courier.findMany({ where: { blocked: false } });
    for (const courier of couriers) {
      const exists = await prisma.creditBookPartner.findFirst({
        where: {
          externalId: courier.id,
          OR: [
            { type: "courier" },
            { type: { startsWith: "deleted_courier" } }
          ]
        },
      });
      if (!exists) {
        await prisma.creditBookPartner.create({
          data: {
            name: `${courier.name} (مندوب)`,
            phone: courier.phone,
            type: "courier",
            externalId: courier.id,
          },
        });
        importedCount++;
      } else {
        const expectedName = `${courier.name} (مندوب)`;
        if (exists.name !== expectedName || exists.phone !== courier.phone) {
          await prisma.creditBookPartner.update({
            where: { id: exists.id },
            data: {
              name: expectedName,
              phone: courier.phone,
              updatedAt: new Date()
            }
          });
        }
      }
    }

    // ب) استيراد المجهزين
    const preparers = await prisma.companyPreparer.findMany();
    for (const prep of preparers) {
      const exists = await prisma.creditBookPartner.findFirst({
        where: {
          externalId: prep.id,
          OR: [
            { type: "preparer" },
            { type: { startsWith: "deleted_preparer" } }
          ]
        },
      });
      if (!exists) {
        await prisma.creditBookPartner.create({
          data: {
            name: `${prep.name} (مجهز)`,
            phone: prep.phone,
            type: "preparer",
            externalId: prep.id,
          },
        });
        importedCount++;
      } else {
        const expectedName = `${prep.name} (مجهز)`;
        if (exists.name !== expectedName || exists.phone !== prep.phone) {
          await prisma.creditBookPartner.update({
            where: { id: exists.id },
            data: {
              name: expectedName,
              phone: prep.phone,
              updatedAt: new Date()
            }
          });
        }
      }
    }

    // ج) استيراد المحلات
    const shops = await prisma.shop.findMany();
    for (const shop of shops) {
      const exists = await prisma.creditBookPartner.findFirst({
        where: {
          externalId: shop.id,
          OR: [
            { type: "shop" },
            { type: { startsWith: "deleted_shop" } }
          ]
        },
      });
      if (shop.hideFromCreditBook) {
        if (exists && !exists.type.startsWith("deleted_")) {
          await prisma.creditBookPartner.update({
            where: { id: exists.id },
            data: {
              type: "deleted_shop",
              updatedAt: new Date()
            }
          });
          importedCount++;
        }
        continue;
      }
      if (!exists) {
        await prisma.creditBookPartner.create({
          data: {
            name: `${shop.name} (محل/مجهز)`,
            phone: shop.phone || null,
            type: "shop",
            externalId: shop.id,
          },
        });
        importedCount++;
      } else {
        const expectedName = `${shop.name} (محل/مجهز)`;
        if (exists.name !== expectedName || (exists.phone || null) !== (shop.phone || null)) {
          await prisma.creditBookPartner.update({
            where: { id: exists.id },
            data: {
              name: expectedName,
              phone: shop.phone || null,
              updatedAt: new Date()
            }
          });
        }
      }
    }

    // د) استيراد الزبائن
    const customers = await prisma.customer.findMany({ take: 300 });
    for (const cust of customers) {
      const exists = await prisma.creditBookPartner.findFirst({
        where: {
          externalId: cust.id,
          OR: [
            { type: "customer" },
            { type: { startsWith: "deleted_customer" } }
          ]
        },
      });
      if (!exists) {
        await prisma.creditBookPartner.create({
          data: {
            name: `${cust.name} (زبون)`,
            phone: cust.phone,
            type: "customer",
            externalId: cust.id,
          },
        });
        importedCount++;
      } else {
        const expectedName = `${cust.name} (زبون)`;
        if (exists.name !== expectedName || exists.phone !== cust.phone) {
          await prisma.creditBookPartner.update({
            where: { id: exists.id },
            data: {
              name: expectedName,
              phone: cust.phone,
              updatedAt: new Date()
            }
          });
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

// جلب الكيانات من النظام التي لم تُضاف بعد كشركاء لدفتر الديون
export async function getUnaddedSystemPartners(type: PartnerType) {
  try {
    const { isAdminSession } = await import("@/lib/admin-session");
    if (!(await isAdminSession())) {
      return [];
    }

    // جلب معرفات الأطراف المضافة بالفعل لنفس النوع (النشطة فقط - لإتاحة إمكانية استعادة المحذوفة ناعماً)
    const addedExternalIds = await prisma.creditBookPartner.findMany({
      where: {
        type
      },
      select: { externalId: true }
    }).then(list => list.map(p => p.externalId).filter(Boolean) as string[]);

    if (type === "courier") {
      const list = await prisma.courier.findMany({
        where: { id: { notIn: addedExternalIds } },
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" }
      });
      return list;
    }

    if (type === "preparer") {
      const list = await prisma.companyPreparer.findMany({
        where: { id: { notIn: addedExternalIds } },
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" }
      });
      return list;
    }

    if (type === "shop") {
      const list = await prisma.shop.findMany({
        where: {
          id: { notIn: addedExternalIds },
          hideFromCreditBook: false
        },
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" }
      });
      return list;
    }

    if (type === "customer") {
      const list = await prisma.customer.findMany({
        where: { id: { notIn: addedExternalIds } },
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
        take: 100
      });
      return list;
    }

    if (type === "supplier") {
      const list = await prisma.storeSupplier.findMany({
        where: { id: { notIn: addedExternalIds } },
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" }
      });
      return list;
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

// 13. تصفير وتصفية حساب الشريك (مع تسديد الطلبات التلقائية للمحلات وحركات محفظة المناديب)
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
          select: {
            amount: true,
            kind: true
          }
        }
      }
    });

    if (!partner) {
      return { success: false, error: "الشريك غير موجود" };
    }

    // 1. حساب الرصيد اليدوي الحالي
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
    const manualBalance = totalGave - totalTook;

    // 2. إذا كان شريكا من نوع محل (shop)، نقوم بتسديد كافة طلباته النشطة غير المسددة في النظام
    if (partner.type === "shop" && partner.externalId) {
      const unpaidOrders = await prisma.order.findMany({
        where: {
          shopId: partner.externalId,
          shopCostPaidAt: null,
          status: { in: ["delivered", "archived"] },
          orderSubtotal: { gt: 0 }
        },
        include: {
          moneyEvents: {
            where: { kind: "pickup_out", deletedAt: null }
          }
        }
      });

      for (const order of unpaidOrders) {
        const subtotal = Number(order.orderSubtotal || 0);
        const pickupPaid = order.moneyEvents.reduce((acc, me) => acc + Number(me.amountDinar || 0), 0);
        const remaining = subtotal - pickupPaid;

        if (remaining > 0) {
          // تسجيل حركة صادر (pickup_out) بقيمة المبلغ المتبقي للطلب
          await prisma.orderCourierMoneyEvent.create({
            data: {
              orderId: order.id,
              courierId: null,
              kind: "pickup_out",
              amountDinar: new Decimal(remaining),
              expectedDinar: order.orderSubtotal,
              matchesExpected: true,
              mismatchReason: "",
              mismatchNote: "تم التسديد وتصفية الحساب تلقائياً عبر عملية تصفير الحساب في دفتر الديون",
            }
          });
        }
      }
    }

    // 3. إذا كان شريكا من نوع مندوب (courier)، نقوم بتصفية مبالغ الإدارة الخاصة به في النظام
    if (partner.type === "courier" && partner.externalId) {
      const adminTotal = await computeMandoubAdminTotalAllTimeDinar(partner.externalId);
      const adminTotalNum = adminTotal.toNumber();
      if (adminTotalNum !== 0) {
        // إضافة قيد محفظة منوع لتصفية حساب الإدارة
        const direction = adminTotalNum > 0 ? CourierWalletMiscDirection.give : CourierWalletMiscDirection.take;
        await prisma.courierWalletMiscEntry.create({
          data: {
            courierId: partner.externalId,
            direction,
            amountDinar: new Decimal(Math.abs(adminTotalNum)),
            label: "تسوية وتصفير الحساب عبر دفتر الديون (موازنة تلقائية)"
          }
        });
      }
    }

    // 4. تصفية الرصيد اليدوي بإضافة معاملة موازنة يدوية إذا كان غير صفري
    if (manualBalance !== 0) {
      const zeroAmt = Math.abs(manualBalance);
      const zeroKind = manualBalance > 0 ? "took" : "gave";
      const zeroNote = "تصفير وتصفية الرصيد اليدوي بالكامل (موازنة تلقائية)";

      await prisma.creditBookTransaction.create({
        data: {
          partnerId: partner.id,
          amount: zeroAmt,
          kind: zeroKind,
          note: zeroNote,
          createdAt: new Date(),
        }
      });
    }

    // تحديث تاريخ تعديل الشريك
    await prisma.creditBookPartner.update({
      where: { id: partnerId },
      data: { updatedAt: new Date() }
    });

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${partnerId}`);
    return { success: true };
  } catch (error) {
    console.error("Error in zeroPartnerAccount:", error);
    return { success: false, error: "حدث خطأ أثناء تصفير الحساب" };
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
          let customerId = order.customerId;
          let customer = order.customer;

          // إذا لم يكن الطلب مرتبطاً بزبون، نحاول البحث عن زبون بنفس رقم الهاتف وربطه تلقائياً
          if (!customerId && order.customerPhone) {
            const phoneLocal = order.customerPhone.trim();
            if (phoneLocal) {
              const foundCust = await prisma.customer.findFirst({
                where: {
                  phone: phoneLocal,
                  shopId: order.shopId
                }
              });
              if (foundCust) {
                customerId = foundCust.id;
                customer = foundCust;
                await prisma.order.update({
                  where: { id: order.id },
                  data: { customerId: foundCust.id }
                });
              }
            }
          }

          if (!customerId || !customer) continue;

          // 1. البحث عن حساب دفتر الديون للزبون أو إنشائه
          let cbPartner = await prisma.creditBookPartner.findUnique({
            where: {
              type_externalId: {
                type: "customer",
                externalId: customerId
              }
            }
          });

          if (!cbPartner) {
            cbPartner = await prisma.creditBookPartner.create({
              data: {
                name: `${customer.name || 'زبون'} (زبون)`,
                phone: customer.phone || order.customerPhone || null,
                type: "customer",
                externalId: customerId,
                updatedAt: new Date()
              }
            });
            createdPartnersCount++;
          } else {
            await prisma.creditBookPartner.update({
              where: { id: cbPartner.id },
              data: { updatedAt: new Date() }
            });
          }

          // 2. التحقق من عدم وجود المعاملة بالفعل لتفادي التكرار
          const noteTextContains = `#${order.orderNumber} |`;
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
          const orderType = order.orderType || "غير محدد";
          const shopName = order.shop?.name || "بدون محل";
          const noteText = `#${order.orderNumber} | ${regionName} | ${shopName} | ${orderType} | ${courierName} | الكلي: ${expectedDinar.toLocaleString()} د.ع | المستلم: ${receivedDinar.toLocaleString()} د.ع | المتبقي: ${difference.toLocaleString()} د.ع`;

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
            if (exists.note !== noteText || Number(exists.amount) !== difference) {
              await prisma.creditBookTransaction.update({
                where: { id: exists.id },
                data: {
                  amount: difference,
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
        if (order.customerId) {
          let cbPartner = await prisma.creditBookPartner.findUnique({
            where: {
              type_externalId: {
                type: "customer",
                externalId: order.customerId
              }
            }
          });
          if (cbPartner) {
            const noteTextContains = `#${order.orderNumber} |`;
            const exists = await prisma.creditBookTransaction.findFirst({
              where: {
                partnerId: cbPartner.id,
                note: {
                  contains: noteTextContains
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
          const orderType = order.orderType || "غير محدد";
          const shopName = order.shop?.name || "بدون محل";
          
          const newNote = `#${order.orderNumber} | ${regionName} | ${shopName} | ${orderType} | ${courierName} | الكلي: ${expectedDinar.toLocaleString()} د.ع | المستلم: ${receivedDinar.toLocaleString()} د.ع | المتبقي: ${difference.toLocaleString()} د.ع`;

          if (tx.note !== newNote || Number(tx.amount) !== difference) {
            await prisma.creditBookTransaction.update({
              where: { id: tx.id },
              data: { 
                note: newNote,
                amount: difference
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



