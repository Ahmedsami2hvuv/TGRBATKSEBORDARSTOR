"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type PartnerType = "courier" | "preparer" | "shop" | "customer" | "external";

export interface PartnerWithBalance {
  id: string;
  name: string;
  phone: string | null;
  type: PartnerType;
  externalId: string | null;
  createdAt: Date;
  balance: number; // positive = we are owed (gave > took), negative = we owe (took > gave)
  totalGave: number;
  totalTook: number;
}

// 1. جلب قائمة الأطراف مع احتساب الأرصدة
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

    return partners.map((p) => {
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

      return {
        id: p.id,
        name: p.name,
        phone: p.phone,
        type: p.type as PartnerType,
        externalId: p.externalId,
        createdAt: p.createdAt,
        balance: totalGave - totalTook,
        totalGave,
        totalTook,
      };
    });
  } catch (error) {
    console.error("Error in getPartners:", error);
    return [];
  }
}

// 2. جلب تفاصيل شريك وكشف حسابه
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

    const transactions = partner.transactions.map((t) => {
      const amt = Number(t.amount);
      if (t.kind === "gave") {
        totalGave += amt;
      } else if (t.kind === "took") {
        totalTook += amt;
      }

      return {
        ...t,
        amount: amt,
      };
    });

    return {
      id: partner.id,
      name: partner.name,
      phone: partner.phone,
      type: partner.type as PartnerType,
      externalId: partner.externalId,
      createdAt: partner.createdAt,
      balance: totalGave - totalTook,
      totalGave,
      totalTook,
      transactions,
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

// 8. مزامنة الأطراف تلقائياً مع النظام
// تقوم هذه الدالة باستيراد المناديب والمجهزين والمحلات والزبائن من جداول النظام إلى دفتر الديون
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
    const customers = await prisma.customer.findMany({ take: 150 }); // نأخذ عينة لتفادي الضغط
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
