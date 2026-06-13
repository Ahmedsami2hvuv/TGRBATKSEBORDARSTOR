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
      status: { notIn: ["cancelled"] },
      orderSubtotal: { gt: 0 }
    },
    select: {
      orderSubtotal: true,
      moneyEvents: {
        where: {
          kind: "pickup_out",
          deletedAt: null
        },
        select: {
          amountDinar: true
        }
      }
    }
  });
  
  let totalSubtotals = 0;
  let totalPayments = 0;

  for (const o of orders) {
    totalSubtotals += Number(o.orderSubtotal || 0);
    for (const me of o.moneyEvents) {
      totalPayments += Number(me.amountDinar || 0);
    }
  }

  return totalSubtotals - totalPayments;
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

    // 1. مزامنة تلقائية سريعة بالخلفية للمحلات والمناديب والمجهزين عند كل تحميل للصفحة فقط في حال عدم وجود كلمة بحث لتفادي البطء أثناء الكتابة
    if (!searchQuery) {
      try {
        const [allShops, allCouriers, allPreparers] = await Promise.all([
          prisma.shop.findMany({ select: { id: true, name: true, phone: true, hideFromCreditBook: true } }),
          prisma.courier.findMany({ where: { blocked: false }, select: { id: true, name: true, phone: true } }),
          prisma.companyPreparer.findMany({ select: { id: true, name: true, phone: true, walletEmployeeId: true } })
        ]);

        const existingPartners = await prisma.creditBookPartner.findMany({
          select: { type: true, externalId: true, updatedAt: true }
        });

        const existingShops = new Set(existingPartners.filter(p => p.type === "shop").map(p => p.externalId));
        const existingCouriers = new Set(existingPartners.filter(p => p.type === "courier").map(p => p.externalId));
        const existingPreparers = new Set(existingPartners.filter(p => p.type === "preparer").map(p => p.externalId));

        const deletedShopsMap = new Map(existingPartners.filter(p => p.type.startsWith("deleted_shop") && p.externalId).map(p => [p.externalId as string, p.updatedAt]));
        const deletedCouriersMap = new Map(existingPartners.filter(p => p.type.startsWith("deleted_courier") && p.externalId).map(p => [p.externalId as string, p.updatedAt]));
        const deletedPreparersMap = new Map(existingPartners.filter(p => p.type.startsWith("deleted_preparer") && p.externalId).map(p => [p.externalId as string, p.updatedAt]));

        // جلب معرفات المحلات التي لديها طلبات غير مسددة نشطة
        const shopsWithUnpaidOrders = await prisma.order.findMany({
          where: {
            shopCostPaidAt: null,
            status: { notIn: ["cancelled"] },
            orderSubtotal: { gt: 0 }
          },
          select: { shopId: true },
          distinct: ["shopId"]
        }).then(list => new Set(list.map(o => o.shopId).filter(Boolean)));

        const partnersToCreate: any[] = [];
        const partnersToRestore: string[] = [];
        const partnersToDeleteDueToHide: string[] = [];

        // التحقق من تفعيل واستعادة المحلات بالتوازي
        const shopRestoreChecks = await Promise.all(
          allShops.map(async (s) => {
            if (s.hideFromCreditBook) {
              const activeShopInPartner = existingPartners.find(p => p.type === "shop" && p.externalId === s.id);
              if (activeShopInPartner) {
                return { action: 'delete_due_to_hide', id: s.id };
              }
              return null;
            }

            if (!existingShops.has(s.id)) {
              const deletedAt = deletedShopsMap.get(s.id);
              if (deletedAt) {
                const hasNewUnpaidOrder = await prisma.order.findFirst({
                  where: {
                    shopId: s.id,
                    shopCostPaidAt: null,
                    status: { notIn: ["cancelled"] },
                    orderSubtotal: { gt: 0 },
                    createdAt: { gt: deletedAt }
                  },
                  select: { id: true }
                });
                if (hasNewUnpaidOrder) {
                  return { action: 'restore', id: s.id };
                }
              } else if (shopsWithUnpaidOrders.has(s.id)) {
                return {
                  action: 'create',
                  data: {
                    name: `${s.name} (محل/مجهز)`,
                    phone: s.phone || null,
                    type: "shop",
                    externalId: s.id
                  }
                };
              }
            }
            return null;
          })
        );

        // التحقق من تفعيل واستعادة المناديب بالتوازي
        const courierRestoreChecks = await Promise.all(
          allCouriers.map(async (c) => {
            if (!existingCouriers.has(c.id)) {
              const deletedAt = deletedCouriersMap.get(c.id);
              if (deletedAt) {
                const [hasNewOrderEvent, hasNewMiscEntry] = await Promise.all([
                  prisma.orderCourierMoneyEvent.findFirst({
                    where: {
                      courierId: c.id,
                      deletedAt: null,
                      createdAt: { gt: deletedAt }
                    },
                    select: { id: true }
                  }),
                  prisma.courierWalletMiscEntry.findFirst({
                    where: {
                      courierId: c.id,
                      deletedAt: null,
                      createdAt: { gt: deletedAt }
                    },
                    select: { id: true }
                  })
                ]);
                if (hasNewOrderEvent || hasNewMiscEntry) {
                  return { action: 'restore', id: c.id };
                }
              } else {
                const adminTotal = await computeMandoubAdminTotalAllTimeDinar(c.id);
                const walletRem = await computeMandoubWalletRemainAllTimeDinar(c.id);
                if (adminTotal.toNumber() !== 0 || walletRem.toNumber() !== 0) {
                  return {
                    action: 'create',
                    data: {
                      name: `${c.name} (مندوب)`,
                      phone: c.phone,
                      type: "courier",
                      externalId: c.id
                    }
                  };
                }
              }
            }
            return null;
          })
        );

        // التحقق من تفعيل واستعادة المجهزين بالتوازي
        const preparerRestoreChecks = await Promise.all(
          allPreparers.map(async (pr) => {
            if (!existingPreparers.has(pr.id)) {
              const deletedAt = deletedPreparersMap.get(pr.id);
              if (deletedAt) {
                const [hasNewMiscEntry, hasNewTransfer, hasNewOrder, hasNewEvent] = await Promise.all([
                  pr.walletEmployeeId ? prisma.employeeWalletMiscEntry.findFirst({
                    where: { employeeId: pr.walletEmployeeId, deletedAt: null, createdAt: { gt: deletedAt } },
                    select: { id: true }
                  }) : Promise.resolve(null),
                  pr.walletEmployeeId ? prisma.walletPeerTransfer.findFirst({
                    where: {
                      OR: [
                        { fromEmployeeId: pr.walletEmployeeId },
                        { toEmployeeId: pr.walletEmployeeId }
                      ],
                      createdAt: { gt: deletedAt }
                    },
                    select: { id: true }
                  }) : Promise.resolve(null),
                  prisma.order.findFirst({
                    where: {
                      shop: { preparerLinks: { some: { preparerId: pr.id } } },
                      createdAt: { gt: deletedAt }
                    },
                    select: { id: true }
                  }),
                  prisma.orderCourierMoneyEvent.findFirst({
                    where: {
                      order: { shop: { preparerLinks: { some: { preparerId: pr.id } } } },
                      deletedAt: null,
                      createdAt: { gt: deletedAt }
                    },
                    select: { id: true }
                  })
                ]);

                if (hasNewMiscEntry || hasNewTransfer || hasNewOrder || hasNewEvent) {
                  return { action: 'restore', id: pr.id };
                }
              } else {
                const prepTotals = await getPreparerMoneyTotals(pr.id);
                if (prepTotals && prepTotals.remain.toNumber() !== 0) {
                  return {
                    action: 'create',
                    data: {
                      name: `${pr.name} (مجهز)`,
                      phone: pr.phone,
                      type: "preparer",
                      externalId: pr.id
                    }
                  };
                }
              }
            }
            return null;
          })
        );

        const allChecks = [...shopRestoreChecks, ...courierRestoreChecks, ...preparerRestoreChecks].filter(Boolean);

        for (const item of allChecks) {
          if (item?.action === 'restore') {
            partnersToRestore.push(item.id);
          } else if (item?.action === 'create') {
            partnersToCreate.push(item.data);
          } else if (item?.action === 'delete_due_to_hide') {
            partnersToDeleteDueToHide.push(item.id);
          }
        }

        if (partnersToDeleteDueToHide.length > 0) {
          for (const extId of partnersToDeleteDueToHide) {
            const partner = await prisma.creditBookPartner.findFirst({
              where: {
                externalId: extId,
                type: "shop"
              },
              select: { id: true }
            });
            if (partner) {
              await prisma.creditBookPartner.update({
                where: { id: partner.id },
                data: {
                  type: "deleted_shop",
                  updatedAt: new Date()
                }
              });
            }
          }
        }

        if (partnersToRestore.length > 0) {
          for (const extId of partnersToRestore) {
            const partner = await prisma.creditBookPartner.findFirst({
              where: {
                externalId: extId,
                type: { startsWith: "deleted_" }
              },
              select: { id: true, type: true }
            });
            if (partner) {
              const originalType = partner.type.replace("deleted_", "");
              await prisma.creditBookPartner.update({
                where: { id: partner.id },
                data: {
                  type: originalType,
                  updatedAt: new Date()
                }
              });
            }
          }
        }

        if (partnersToCreate.length > 0) {
          await prisma.creditBookPartner.createMany({
            data: partnersToCreate,
            skipDuplicates: true
          });
        }
      } catch (syncErr) {
        console.error("Auto sync in getPartners failed:", syncErr);
      }
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

        // إذا كان المحل مصفراً بالكامل ومضى على آخر نشاط له أكثر من 5 ساعات، يتم إخفاؤه تلقائياً
        if (p.type === "shop" && balance === 0) {
          const fiveHours = 5 * 60 * 60 * 1000;
          if (Date.now() - latestActivity > fiveHours) {
            try {
              await prisma.creditBookPartner.update({
                where: { id: p.id },
                data: {
                  type: "deleted_shop",
                  updatedAt: new Date()
                }
              });
            } catch (err) {
              console.error(`Failed to auto-hide zero balance shop ${p.name}:`, err);
            }
            return null;
          }
        }

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

    const result = mapped.filter((item): item is PartnerWithBalance => item !== null);

    // فرز النتائج: حسب تاريخ التحديث (آخر نشاط) تنازلياً لكي يصعد من يُعدل أو يضاف له بالبداية
    result.sort((a, b) => {
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
        
        const walletRem = await computeMandoubWalletRemainAllTimeDinar(partner.externalId);
        walletRemain = walletRem.toNumber();

        // 1. جلب حركات أموال الطلبات للمندوب
        const orderMoneyEvents = await prisma.orderCourierMoneyEvent.findMany({
          where: {
            courierId: partner.externalId,
            deletedAt: null,
            recordedByCompanyPreparerId: null
          },
          include: {
            order: {
              select: {
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
          
          if (me.kind === MONEY_KIND_DELIVERY) { // وارد للمندوب
            autoTransactions.push({
              id: `auto-courier-money-event-in-${me.id}`,
              partnerId: partner.id,
              amount: amt,
              kind: "took", // أخذت = دين عليه للإدارة
              note: `طلب توصيل #${me.order?.orderNumber || "—"} | استلام مبلغ من الزبون (المنطقة: ${me.order?.customerRegion?.name || "—"})`,
              createdAt: me.createdAt,
              updatedAt: me.createdAt,
              isAuto: true
            });
          } else if (me.kind === MONEY_KIND_PICKUP) { // صادر من المندوب للمحل
            autoTransactions.push({
              id: `auto-courier-money-event-out-${me.id}`,
              partnerId: partner.id,
              amount: amt,
              kind: "gave", // أعطيت = تسديد للذمة
              note: `طلب #${me.order?.orderNumber || "—"} | تسليم مبلغ للمجهز/المحل`,
              createdAt: me.createdAt,
              updatedAt: me.createdAt,
              isAuto: true
            });
          }
        }

        // 2. جلب قيود المحفظة اليدوية للمندوب
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
            kind: me.direction === "take" ? "took" : "gave",
            note: me.label || "قيد يدوي في المحفظة للمندوب",
            createdAt: me.createdAt,
            updatedAt: me.createdAt,
            isAuto: true
          });
        }

        // 3. جلب التحويلات المقبولة للإدارة
        const adminTransfers = await prisma.walletPeerTransfer.findMany({
          where: {
            fromCourierId: partner.externalId,
            toKind: WalletPeerPartyKind.admin,
            status: "accepted"
          },
          orderBy: { createdAt: "desc" }
        });

        for (const t of adminTransfers) {
          const amt = Number(t.amountDinar || 0);
          if (amt <= 0) continue;

          autoTransactions.push({
            id: `auto-courier-transfer-admin-${t.id}`,
            partnerId: partner.id,
            amount: amt,
            kind: "gave", // أعطيت
            note: `تحويل للإدارة (مقبول) | ${t.handoverLocation || "—"}${t.notes ? ` (${t.notes})` : ""}`,
            createdAt: t.createdAt,
            updatedAt: t.createdAt,
            isAuto: true
          });
        }

        // 4. أرباح التوصيل للطلبات المكتملة والمؤرشفة
        const ordersWithEarnings = await prisma.order.findMany({
          where: {
            courierEarningForCourierId: partner.externalId,
            status: { in: ["delivered", "archived"] },
            courierEarningDinar: { gt: 0 }
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
            kind: "gave", // أعطيت = يخصم من ذمة المندوب لصالحه
            note: `أرباح التوصيل للطلب #${o.orderNumber}`,
            createdAt: o.deliveredAt || o.createdAt,
            updatedAt: o.deliveredAt || o.createdAt,
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
                  kind: "took", // أخذت
                  note: `طلب #${me.order?.orderNumber || "—"} | استلام دفعة من المندوب/الزبون`,
                  createdAt: me.createdAt,
                  updatedAt: me.createdAt,
                  isAuto: true
                });
              } else if (me.kind === MONEY_KIND_PICKUP) { // صادر من المجهز للمحل
                autoTransactions.push({
                  id: `auto-preparer-money-event-out-${me.id}`,
                  partnerId: partner.id,
                  amount: amt,
                  kind: "gave", // أعطيت
                  note: `طلب #${me.order?.orderNumber || "—"} | تسليم مبلغ للمحل`,
                  createdAt: me.createdAt,
                  updatedAt: me.createdAt,
                  isAuto: true
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
                kind: me.direction === "take" ? "took" : "gave",
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
                kind: "gave", // أعطيت
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
                kind: "gave", // أعطيت
                note: `تحويل صادر معلق | ${t.handoverLocation || "—"}${t.notes ? ` (${t.notes})` : ""}`,
                createdAt: t.createdAt,
                updatedAt: t.createdAt,
                isAuto: true
              });
            }
          }
        }
      } catch (e) {
        console.error("Error fetching preparer auto transactions:", e);
      }
    } else if (partner.type === "shop" && partner.externalId) {
      // للمحلات: جلب تفاصيل الطلبات وتوليد قيود تلقائية للديون وعمليات التسديد
      try {
        const orders = await prisma.order.findMany({
          where: {
            shopId: partner.externalId,
            shopCostPaidAt: null,
            status: { notIn: ["cancelled"] },
            orderSubtotal: { gt: 0 }
          },
          include: {
            customerRegion: { select: { name: true } },
            courier: { select: { name: true } },
            moneyEvents: {
              where: {
                kind: "pickup_out",
                deletedAt: null
              },
              select: {
                id: true,
                amountDinar: true,
                createdAt: true,
                courierId: true,
                recordedByCompanyPreparerId: true,
                mismatchNote: true,
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
          const pickupPaid = o.moneyEvents.reduce((acc, me) => acc + Number(me.amountDinar || 0), 0);
          const isSettled = o.shopCostPaidAt !== null || pickupPaid >= subtotal;

          // 1. إضافة قيد الطلب كدين علينا (took)
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
            remainingAmount: Math.max(0, subtotal - pickupPaid)
          });

          // 2. إضافة حركات الدفع (صادر) كحركات تسديد (gave)
          for (const me of o.moneyEvents) {
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
              isAdminPayment: !me.courierId && !me.recordedByCompanyPreparerId
            });
          }
        }
        
        autoBalance = autoGave - autoTook;
      } catch (e) {
        console.error(e);
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

      return {
        ...t,
        amount: amt,
        isAuto: false
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
      where: { id: transactionId }
    });
    if (!tx) return { success: false, error: "المعاملة غير موجودة" };

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
      await prisma.creditBookPartner.update({
        where: { id: partnerId },
        data: {
          type: newType,
          updatedAt: new Date()
        }
      });
    } else {
      // إذا كان شريكاً خارجياً غير مرتبط بالنظام، نحذفه نهائياً
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
      await prisma.creditBookPartner.deleteMany({
        where: { id: { in: manualOnly.map(p => p.id) } }
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

    // جلب معرفات الأطراف المضافة بالفعل لنفس النوع (نشطة ومحذوفة)
    const addedExternalIds = await prisma.creditBookPartner.findMany({
      where: {
        OR: [
          { type },
          { type: { startsWith: `deleted_${type}` } }
        ]
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
          status: { notIn: ["cancelled"] },
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

