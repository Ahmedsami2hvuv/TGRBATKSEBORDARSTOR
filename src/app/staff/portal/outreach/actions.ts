"use server";

import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { revalidatePath } from "next/cache";
import { DEFAULT_OUTREACH_TEMPLATES, extractPhonesPure } from "./constants";

/**
 * التحقق من صلاحية وصول الموظف عبر التوقيع وضمان وجود الجداول
 */
async function verifyStaff(staffEmployeeId: string, token: string, sig: string) {
  const { ensureOutreachTablesExist } = await import("@/lib/db-self-heal-outreach");
  await ensureOutreachTablesExist();

  const v = verifyStaffEmployeePortalQuery(staffEmployeeId, token, sig);
  if (!v.ok) throw new Error("جلسة الموظف غير صالحة أو منتهية.");
  const emp = await prisma.staffEmployee.findUnique({
    where: { id: staffEmployeeId },
  });
  if (!emp || !emp.active) throw new Error("حساب الموظف غير نشط.");
  return emp;
}

/**
 * جلب بيانات المهمة للموظف (القائمة النشطة، الأرقام المكتملة، والنماذج)
 */
export async function getOutreachDataAction(staffEmployeeId: string, token: string, sig: string) {
  try {
    const emp = await verifyStaff(staffEmployeeId, token, sig);

    // 1. جلب النماذج الإعلانية الخاصة بالموظف أو العامة
    let templates = await prisma.staffOutreachTemplate.findMany({
      where: {
        OR: [{ staffEmployeeId: emp.id }, { staffEmployeeId: null }],
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // إذا لم تكن هناك أي نماذج، ننشئ النماذج الافتراضية الـ 24 تلقائياً
    if (templates.length === 0) {
      await prisma.staffOutreachTemplate.createMany({
        data: DEFAULT_OUTREACH_TEMPLATES.map((t) => ({
          staffEmployeeId: emp.id,
          title: t.title,
          content: t.content,
          isActive: true,
        })),
      });

      templates = await prisma.staffOutreachTemplate.findMany({
        where: { staffEmployeeId: emp.id, isActive: true },
        orderBy: { createdAt: "asc" },
      });
    }

    // 2. جلب آخر قائمة نشطة للموظف
    let latestList = await prisma.staffOutreachList.findFirst({
      where: { staffEmployeeId: emp.id },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return {
      ok: true,
      data: {
        list: latestList ? {
          id: latestList.id,
          title: latestList.title,
          createdAt: latestList.createdAt.toISOString(),
          items: latestList.items.map((i) => ({
            id: i.id,
            phone: i.phone,
            originalInput: i.originalInput,
            status: i.status as "pending" | "whatsapp_opened" | "completed",
            templateUsed: i.templateUsed,
            openedAt: i.openedAt?.toISOString() || null,
            completedAt: i.completedAt?.toISOString() || null,
            createdAt: i.createdAt.toISOString(),
          })),
        } : null,
        templates: templates.map((t) => ({
          id: t.id,
          title: t.title,
          content: t.content,
          isActive: t.isActive,
        })),
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في جلب البيانات." };
  }
}

/**
 * إنشاء أو استيراد قائمة أرقام جديدة
 */
export async function createOutreachListAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { title?: string; rawText: string; appendToExisting?: boolean }
) {
  try {
    const emp = await verifyStaff(staffEmployeeId, token, sig);
    const extracted = extractPhonesPure(payload.rawText);

    if (extracted.length === 0) {
      return { ok: false, error: "لم يتم العثور على أي أرقام هواتف أو روابط صالحة في النص المكتوب." };
    }

    let targetListId: string;

    if (payload.appendToExisting) {
      const existing = await prisma.staffOutreachList.findFirst({
        where: { staffEmployeeId: emp.id },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        targetListId = existing.id;
      } else {
        const newList = await prisma.staffOutreachList.create({
          data: {
            staffEmployeeId: emp.id,
            title: payload.title?.trim() || `قائمة ${new Date().toLocaleDateString("ar-IQ")}`,
          },
        });
        targetListId = newList.id;
      }
    } else {
      const newList = await prisma.staffOutreachList.create({
        data: {
          staffEmployeeId: emp.id,
          title: payload.title?.trim() || `قائمة زبائن (${extracted.length} رقم) - ${new Date().toLocaleDateString("ar-IQ")}`,
        },
      });
      targetListId = newList.id;
    }

    // تجنب إضافة أرقام مكررة موجودة مسبقاً في نفس القائمة
    const existingItems = await prisma.staffOutreachItem.findMany({
      where: { listId: targetListId },
      select: { phone: true },
    });
    const existingPhones = new Set(existingItems.map((i) => i.phone));

    const newItems = extracted.filter((e) => !existingPhones.has(e.phone));

    if (newItems.length > 0) {
      await prisma.staffOutreachItem.createMany({
        data: newItems.map((item) => ({
          listId: targetListId,
          phone: item.phone,
          originalInput: item.originalInput,
          status: "pending",
        })),
      });
    }

    revalidatePath("/staff/portal/outreach");
    return {
      ok: true,
      message: `تم إضافة ${newItems.length} رقم بنجاح ${extracted.length > newItems.length ? `(تم تجاهل ${extracted.length - newItems.length} رقم مكرر)` : ""}`,
      listId: targetListId,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في إنشاء القائمة." };
  }
}

/**
 * تحديث حالة رقم معين (تم فتح الواتساب أو تم الاتصال/مكتمل)
 */
export async function updateItemStatusAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { itemId: string; status: "pending" | "whatsapp_opened" | "completed"; templateUsed?: string }
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);

    const updateData: any = {
      status: payload.status,
    };

    if (payload.templateUsed) {
      updateData.templateUsed = payload.templateUsed;
    }

    if (payload.status === "whatsapp_opened") {
      updateData.openedAt = new Date();
    } else if (payload.status === "completed") {
      updateData.completedAt = new Date();
    } else if (payload.status === "pending") {
      updateData.openedAt = null;
      updateData.completedAt = null;
    }

    await prisma.staffOutreachItem.update({
      where: { id: payload.itemId },
      data: updateData,
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في تحديث حالة الرقم." };
  }
}

/**
 * حذف رقم معين من القائمة
 */
export async function deleteItemAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { itemId: string }
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);
    await prisma.staffOutreachItem.delete({
      where: { id: payload.itemId },
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في حذف الرقم." };
  }
}

/**
 * تفريغ أو مسح القائمة
 */
export async function clearListAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { listId: string; onlyCompleted?: boolean }
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);
    if (payload.onlyCompleted) {
      await prisma.staffOutreachItem.deleteMany({
        where: { listId: payload.listId, status: "completed" },
      });
    } else {
      await prisma.staffOutreachItem.deleteMany({
        where: { listId: payload.listId },
      });
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في مسح القائمة." };
  }
}

/**
 * إضافة أو تعديل نموذج رسالة إعلانية
 */
export async function saveTemplateAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { templateId?: string; title: string; content: string; isActive?: boolean }
) {
  try {
    const emp = await verifyStaff(staffEmployeeId, token, sig);

    if (payload.templateId) {
      await prisma.staffOutreachTemplate.update({
        where: { id: payload.templateId },
        data: {
          title: payload.title.trim(),
          content: payload.content.trim(),
          isActive: payload.isActive !== undefined ? payload.isActive : true,
        },
      });
    } else {
      await prisma.staffOutreachTemplate.create({
        data: {
          staffEmployeeId: emp.id,
          title: payload.title.trim(),
          content: payload.content.trim(),
          isActive: true,
        },
      });
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في حفظ النموذج." };
  }
}

/**
 * حذف نموذج رسالة
 */
export async function deleteTemplateAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { templateId: string }
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);
    await prisma.staffOutreachTemplate.delete({
      where: { id: payload.templateId },
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في حذف النموذج." };
  }
}

/**
 * حذف أرقام متعددة دفعة واحدة (Bulk Delete)
 */
export async function bulkDeleteItemsAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { itemIds: string[] }
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);
    if (!payload.itemIds || payload.itemIds.length === 0) {
      return { ok: false, error: "لم يتم تحديد أي أرقام للحذف." };
    }

    await prisma.staffOutreachItem.deleteMany({
      where: { id: { in: payload.itemIds } },
    });

    return { ok: true, count: payload.itemIds.length };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في حذف الأرقام المحددة." };
  }
}

/**
 * تحديث حالة أرقام متعددة دفعة واحدة (Bulk Status Update)
 */
export async function bulkUpdateItemStatusAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { itemIds: string[]; status: "pending" | "whatsapp_opened" | "completed" }
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);
    if (!payload.itemIds || payload.itemIds.length === 0) {
      return { ok: false, error: "لم يتم تحديد أي أرقام." };
    }

    const updateData: any = { status: payload.status };
    if (payload.status === "completed") {
      updateData.completedAt = new Date();
    } else if (payload.status === "whatsapp_opened") {
      updateData.openedAt = new Date();
    } else if (payload.status === "pending") {
      updateData.openedAt = null;
      updateData.completedAt = null;
    }

    await prisma.staffOutreachItem.updateMany({
      where: { id: { in: payload.itemIds } },
      data: updateData,
    });

    return { ok: true, count: payload.itemIds.length };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في تحديث حالة الأرقام المحددة." };
  }
}

/**
 * استعادة النماذج الـ 24 الافتراضية
 */
export async function resetDefaultTemplatesAction(staffEmployeeId: string, token: string, sig: string) {
  try {
    const emp = await verifyStaff(staffEmployeeId, token, sig);
    await prisma.staffOutreachTemplate.deleteMany({
      where: { staffEmployeeId: emp.id },
    });

    await prisma.staffOutreachTemplate.createMany({
      data: DEFAULT_OUTREACH_TEMPLATES.map((t) => ({
        staffEmployeeId: emp.id,
        title: t.title,
        content: t.content,
        isActive: true,
      })),
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في استعادة النماذج." };
  }
}
