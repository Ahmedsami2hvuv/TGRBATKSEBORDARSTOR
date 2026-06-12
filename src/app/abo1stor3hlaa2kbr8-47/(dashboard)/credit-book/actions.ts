"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { computeMandoubAdminTotalAllTimeDinar, computeMandoubWalletRemainAllTimeDinar } from "@/lib/mandoub-wallet-carry";
import { getPreparerMoneyTotals } from "@/lib/preparer-combined-wallet-totals";
import { Decimal } from "@prisma/client/runtime/library";

export type PartnerType = "courier" | "preparer" | "shop" | "customer" | "external";

export interface PartnerWithBalance {
  id: string;
  name: string;
  phone: string | null;
  type: PartnerType;
  externalId: string | null;
  createdAt: Date;
  balance: number; // الرصيد الكلي = اليدوي + التلقائي
  manualBalance: number; // الرصيد اليدوي فقط
  autoBalance: number; // الرصيد التلقائي (المحفظة أو ديون الطلبات)
  totalGave: number;
  totalTook: number;
  walletRemain?: number; // متبقي المحفظة للمندوب/المجهز (من النظام)
}

// دالة مساعدة لحساب الديون التلقائية للمحلات (الطلبات غير المسددة)
async function getShopAutoDebt(shopId: string): Promise<number> {
  const unpaidOrders = await prisma.order.findMany({
    where: {
      shopId,
      shopCostPaidAt: null,
      status: { notIn: ["cancelled"] },
      orderSubtotal: { gt: 0 }
    },
    select: {
      orderSubtotal: true
    }
  });
  
  return unpaidOrders.reduce((sum, o) => sum + Number(o.orderSubtotal || 0), 0);
}

// 1. جلب قائمة الأطراف مع احتساب الأرصدة اليدوية والتلقائية
export async function getPartners(searchQuery?: string, typeFilter?: string): Promise<PartnerWithBalance[]> {
  try {
    const whereClause: any = {};

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

    const result: PartnerWithBalance[] = [];

    for (const p of partners) {
      let totalGave = 0;
      let totalTook = 0;

      // حساب الرصيد اليدوي بالدفتر
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

      // حساب الحسابات التلقائية المدمجة بناءً على نوع الطرف
      if (p.type === "courier" && p.externalId) {
        // للمناديب: جلب ما بذمته للإدارة
        try {
          const adminTotal = await computeMandoubAdminTotalAllTimeDinar(p.externalId);
          autoBalance = adminTotal.toNumber(); // موجب = نطلبه (gave)، سالب = يطلبنا (took)
          
          // متبقي المحفظة للمندوب
          const walletRem = await computeMandoubWalletRemainAllTimeDinar(p.externalId);
          walletRemain = walletRem.toNumber();
        } catch (e) {
          console.error(`Failed to get courier auto debt for ${p.name}:`, e);
        }
      } else if (p.type === "preparer" && p.externalId) {
        // للمجهزين: جلب رصيد المحفظة
        try {
          const prepTotals = await getPreparerMoneyTotals(p.externalId);
          if (prepTotals) {
            autoBalance = prepTotals.remain.toNumber(); // موجب = نطلبه، سالب = يطلبنا
            walletRemain = prepTotals.remain.toNumber();
          }
        } catch (e) {
          console.error(`Failed to get preparer auto debt for ${p.name}:`, e);
        }
      } else if (p.type === "shop" && p.externalId) {
        // للمحلات: الطلبات غير المسددة هي ديون علينا لهم (أي أخذت - took)
        try {
          const shopUnpaid = await getShopAutoDebt(p.externalId);
          autoBalance = -shopUnpaid; // سالب لأننا مدينين للمحل بالطلبات غير المسددة
        } catch (e) {
          console.error(`Failed to get shop auto debt for ${p.name}:`, e);
        }
      }

      result.push({
        id: p.id,
        name: p.name,
        phone: p.phone,
        type: p.type as PartnerType,
        externalId: p.externalId,
        createdAt: p.createdAt,
        manualBalance,
        autoBalance,
        balance: manualBalance + autoBalance,
        totalGave,
        totalTook,
        walletRemain
      });
    }

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
        const adminTotal = await computeMandoubAdminTotalAllTimeDinar(partner.externalId);
        autoBalance = adminTotal.toNumber();
        
        const walletRem = await computeMandoubWalletRemainAllTimeDinar(partner.externalId);
        walletRemain = walletRem.toNumber();

        // إضافة بند تلقائي لكشف الحساب يمثل رصيد محفظة المندوب
        if (autoBalance !== 0) {
          autoTransactions.push({
            id: `auto-wallet-${partner.id}`,
            partnerId: partner.id,
            amount: Math.abs(autoBalance),
            kind: autoBalance > 0 ? "gave" : "took",
            note: "متبقي المحفظة للإدارة (تلقائي من الطلبات وحركات الصادر والوارد)",
            createdAt: new Date(),
            updatedAt: new Date(),
            isAuto: true
          });
        }
      } catch (e) {
        console.error(e);
      }
    } else if (partner.type === "preparer" && partner.externalId) {
      try {
        const prepTotals = await getPreparerMoneyTotals(partner.externalId);
        if (prepTotals) {
          autoBalance = prepTotals.remain.toNumber();
          walletRemain = prepTotals.remain.toNumber();

          if (autoBalance !== 0) {
            autoTransactions.push({
              id: `auto-wallet-${partner.id}`,
              partnerId: partner.id,
              amount: Math.abs(autoBalance),
              kind: autoBalance > 0 ? "gave" : "took",
              note: "متبقي المحفظة للإدارة (تلقائي من الطلبات وحركات الصادر والوارد للمجهز)",
              createdAt: new Date(),
              updatedAt: new Date(),
              isAuto: true
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
    } else if (partner.type === "shop" && partner.externalId) {
      // للمحلات: جلب تفاصيل الطلبات التي لم تسدد للمحل وتوليد قيود تلقائية لها
      try {
        const unpaidOrders = await prisma.order.findMany({
          where: {
            shopId: partner.externalId,
            shopCostPaidAt: null,
            status: { notIn: ["cancelled"] },
            orderSubtotal: { gt: 0 }
          },
          include: {
            customerRegion: { select: { name: true } },
            courier: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" }
        });

        for (const o of unpaidOrders) {
          const amt = Number(o.orderSubtotal || 0);
          autoBalance -= amt; // المبالغ يطلبنا بها المحل (took)

          autoTransactions.push({
            id: `auto-order-${o.id}`,
            partnerId: partner.id,
            amount: amt,
            kind: "took", // أخذت = يطلبنا
            note: `طلب رقم #${o.orderNumber} | نوع الطلب: ${o.orderType || "—"} | المنطقة: ${o.customerRegion?.name || "—"} | المندوب: ${o.courier?.name || "—"}`,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
            isAuto: true
          });
        }
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

    // دمج المعاملات التلقائية واليدوية
    const allTransactions = [...autoTransactions, ...manualTransactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

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
      totalGave: totalGave + (autoBalance > 0 ? autoBalance : 0),
      totalTook: totalTook + (autoBalance < 0 ? Math.abs(autoBalance) : 0),
      transactions: allTransactions,
      walletRemain
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

    const partner = await prisma.creditBookPartner.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        type,
        externalId: externalId || null,
      },
    });

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
export async function addTransaction(partnerId: string, amount: number, kind: "gave" | "took", note: string | null, date?: Date) {
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
        createdAt: date || new Date(),
      },
    });

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/credit-book/${partnerId}`);
    return { success: true, transaction: tx };
  } catch (error) {
    console.error("Error in addTransaction:", error);
    return { success: false, error: "حدث خطأ أثناء إضافة المعاملة" };
  }
}

// 5. تعديل معاملة مالية
export async function updateTransaction(transactionId: string, amount: number, note: string | null, kind: "gave" | "took", date?: Date) {
  try {
    if (amount <= 0) {
      return { success: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
    }

    const tx = await prisma.creditBookTransaction.update({
      where: { id: transactionId },
      data: {
        amount,
        note: note?.trim() || null,
        kind,
        createdAt: date || undefined,
      },
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
    const tx = await prisma.creditBookTransaction.delete({
      where: { id: transactionId },
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
    await prisma.creditBookPartner.delete({
      where: { id: partnerId },
    });

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

    await prisma.creditBookPartner.deleteMany({
      where: {
        id: { in: partnerIds }
      }
    });

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
        where: { type: "courier", externalId: courier.id },
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
      }
    }

    // ب) استيراد المجهزين
    const preparers = await prisma.companyPreparer.findMany({ where: { active: true } });
    for (const prep of preparers) {
      const exists = await prisma.creditBookPartner.findFirst({
        where: { type: "preparer", externalId: prep.id },
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
      }
    }

    // ج) استيراد المحلات
    const shops = await prisma.shop.findMany();
    for (const shop of shops) {
      const exists = await prisma.creditBookPartner.findFirst({
        where: { type: "shop", externalId: shop.id },
      });
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
      }
    }

    // د) استيراد الزبائن
    const customers = await prisma.customer.findMany({ take: 300 });
    for (const cust of customers) {
      const exists = await prisma.creditBookPartner.findFirst({
        where: { type: "customer", externalId: cust.id },
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
      }
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47/credit-book");
    return { success: true, importedCount };
  } catch (error) {
    console.error("Error in syncSystemPartners:", error);
    return { success: false, error: "حدث خطأ أثناء المزامنة" };
  }
}
