import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { DEFAULT_OUTREACH_TEMPLATES, extractPhonesPure } from "@/app/staff/portal/outreach/constants";
import { ensureOutreachTablesExist } from "@/lib/db-self-heal-outreach";

export const dynamic = "force-dynamic";

async function verifyStaff(staffEmployeeId: string, token: string, sig: string) {
  await ensureOutreachTablesExist();

  const v = verifyStaffEmployeePortalQuery(staffEmployeeId, token, sig);
  if (!v.ok) throw new Error("جلسة الموظف غير صالحة أو منتهية.");
  const emp = await prisma.staffEmployee.findUnique({
    where: { id: staffEmployeeId },
  });
  if (!emp || !emp.active) throw new Error("حساب الموظف غير نشط.");
  return emp;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { staffEmployeeId, token, sig, action, payload } = body;

    if (!staffEmployeeId || !token || !sig) {
      return NextResponse.json({ ok: false, error: "بيانات التحقق ناقصة." }, { status: 400 });
    }

    const emp = await verifyStaff(staffEmployeeId, token, sig);

    // 1. جلب البيانات
    if (action === "get_data") {
      let templates = await prisma.staffOutreachTemplate.findMany({
        where: {
          OR: [{ staffEmployeeId: emp.id }, { staffEmployeeId: null }],
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      });

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

      const latestList = await prisma.staffOutreachList.findFirst({
        where: { staffEmployeeId: emp.id },
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return NextResponse.json({
        ok: true,
        data: {
          list: latestList
            ? {
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
              }
            : null,
          templates: templates.map((t) => ({
            id: t.id,
            title: t.title,
            content: t.content,
            isActive: t.isActive,
          })),
        },
      });
    }

    // 2. إنشاء أو دمج قائمة
    if (action === "create_list") {
      const extracted = extractPhonesPure(payload?.rawText || "");
      if (extracted.length === 0) {
        return NextResponse.json({ ok: false, error: "لم يتم العثور على أرقام هواتف صالحة." }, { status: 400 });
      }

      let targetListId: string;

      if (payload?.appendToExisting) {
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
              title: payload?.title?.trim() || `قائمة ${new Date().toLocaleDateString("ar-IQ")}`,
            },
          });
          targetListId = newList.id;
        }
      } else {
        const newList = await prisma.staffOutreachList.create({
          data: {
            staffEmployeeId: emp.id,
            title: payload?.title?.trim() || `قائمة (${extracted.length} رقم) - ${new Date().toLocaleDateString("ar-IQ")}`,
          },
        });
        targetListId = newList.id;
      }

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

      return NextResponse.json({
        ok: true,
        message: `تمت إضافة ${newItems.length} رقم بنجاح ${extracted.length > newItems.length ? `(تم تجاهل ${extracted.length - newItems.length} مكرر)` : ""}`,
        listId: targetListId,
      });
    }

    // 3. تحديث حالة رقم
    if (action === "update_status") {
      const updateData: any = { status: payload.status };
      if (payload.templateUsed) updateData.templateUsed = payload.templateUsed;
      if (payload.status === "whatsapp_opened") updateData.openedAt = new Date();
      else if (payload.status === "completed") updateData.completedAt = new Date();
      else if (payload.status === "pending") {
        updateData.openedAt = null;
        updateData.completedAt = null;
      }

      await prisma.staffOutreachItem.update({
        where: { id: payload.itemId },
        data: updateData,
      });

      return NextResponse.json({ ok: true });
    }

    // 4. حذف رقم
    if (action === "delete_item") {
      await prisma.staffOutreachItem.delete({
        where: { id: payload.itemId },
      });
      return NextResponse.json({ ok: true });
    }

    // 5. حذف متعدد
    if (action === "bulk_delete") {
      await prisma.staffOutreachItem.deleteMany({
        where: { id: { in: payload.itemIds } },
      });
      return NextResponse.json({ ok: true, count: payload.itemIds.length });
    }

    // 6. تحديث متعدد
    if (action === "bulk_update") {
      const updateData: any = { status: payload.status };
      if (payload.status === "completed") updateData.completedAt = new Date();
      else if (payload.status === "whatsapp_opened") updateData.openedAt = new Date();
      else if (payload.status === "pending") {
        updateData.openedAt = null;
        updateData.completedAt = null;
      }

      await prisma.staffOutreachItem.updateMany({
        where: { id: { in: payload.itemIds } },
        data: updateData,
      });
      return NextResponse.json({ ok: true, count: payload.itemIds.length });
    }

    // 7. تفريغ القائمة
    if (action === "clear_list") {
      if (payload.onlyCompleted) {
        await prisma.staffOutreachItem.deleteMany({
          where: { listId: payload.listId, status: "completed" },
        });
      } else {
        await prisma.staffOutreachItem.deleteMany({
          where: { listId: payload.listId },
        });
      }
      return NextResponse.json({ ok: true });
    }

    // 8. حفظ نموذج
    if (action === "save_template") {
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
      return NextResponse.json({ ok: true });
    }

    // 9. حذف نموذج
    if (action === "delete_template") {
      await prisma.staffOutreachTemplate.delete({
        where: { id: payload.templateId },
      });
      return NextResponse.json({ ok: true });
    }

    // 10. استعادة النماذج الـ 24
    if (action === "reset_templates") {
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

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "إجراء غير معروف." }, { status: 400 });
  } catch (error: any) {
    console.error("Outreach API Error:", error);
    return NextResponse.json({ ok: false, error: error?.message || "خطأ أثناء معالجة الطلب." }, { status: 500 });
  }
}
