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

/**
 * مطابقة الأرقام مع قاعدة بيانات الزبائن والتكرارات
 */
async function enrichItemsWithCustomerData(
  staffEmployeeId: string,
  currentListId: string | null,
  items: Array<{ id: string; phone: string }>
) {
  if (!items || items.length === 0) return {};

  const phones = items.map((i) => i.phone);
  const cleanDigitsList = phones
    .map((p) => p.replace(/\D/g, ""))
    .filter((d) => d.length >= 8);

  const last9List = Array.from(new Set(cleanDigitsList.map((d) => d.slice(-9))));

  // 1. فحص التكرارات في القوائم الأخرى لنفس الموظف
  let historyDuplicateMap = new Map<string, string>();
  try {
    const historyItems = await prisma.staffOutreachItem.findMany({
      where: {
        phone: { in: phones },
        list: { staffEmployeeId },
        ...(currentListId ? { listId: { not: currentListId } } : {}),
      },
      select: { phone: true, list: { select: { title: true } } },
    });

    for (const h of historyItems) {
      historyDuplicateMap.set(h.phone, h.list?.title || "قائمة سابقة");
    }
  } catch (e) {}

  // 2. جلب الملفات المسجلة من CustomerPhoneProfile
  let phoneProfiles: any[] = [];
  if (last9List.length > 0) {
    try {
      phoneProfiles = await prisma.customerPhoneProfile.findMany({
        where: {
          OR: last9List.map((l9) => ({ phone: { contains: l9 } })),
        },
        include: {
          region: { select: { name: true } },
        },
      });
    } catch (e) {}
  }

  // 3. جلب الطلبات السابقة من جدول Order
  let pastOrders: any[] = [];
  if (last9List.length > 0) {
    try {
      pastOrders = await prisma.order.findMany({
        where: {
          OR: last9List.map((l9) => ({
            OR: [{ customerPhone: { contains: l9 } }, { secondCustomerPhone: { contains: l9 } }],
          })),
        },
        select: {
          customerPhone: true,
          secondCustomerPhone: true,
          customerRegion: { select: { name: true } },
          secondCustomerRegion: { select: { name: true } },
        },
        take: 300,
      });
    } catch (e) {}
  }

  const resultMap: Record<
    string,
    {
      isDuplicateHistory: boolean;
      duplicateSource?: string;
      isExistingCustomer: boolean;
      regions: string[];
      ordersCount: number;
    }
  > = {};

  for (const item of items) {
    const p = item.phone;
    const digits = p.replace(/\D/g, "");
    const last9 = digits.length >= 8 ? digits.slice(-9) : null;

    const dupSource = historyDuplicateMap.get(p);
    const isDup = Boolean(dupSource);

    const regionsSet = new Set<string>();
    let ordersCount = 0;

    if (last9) {
      for (const cp of phoneProfiles) {
        if (cp.phone && cp.phone.includes(last9) && cp.region?.name) {
          regionsSet.add(cp.region.name);
        }
      }

      for (const ord of pastOrders) {
        const matchMain = ord.customerPhone && ord.customerPhone.includes(last9);
        const matchSec = ord.secondCustomerPhone && ord.secondCustomerPhone.includes(last9);
        if (matchMain || matchSec) {
          ordersCount += 1;
          if (ord.customerRegion?.name) regionsSet.add(ord.customerRegion.name);
          if (ord.secondCustomerRegion?.name) regionsSet.add(ord.secondCustomerRegion.name);
        }
      }
    }

    const isCustomer = regionsSet.size > 0 || ordersCount > 0;

    resultMap[item.id] = {
      isDuplicateHistory: isDup,
      duplicateSource: dupSource,
      isExistingCustomer: isCustomer,
      regions: Array.from(regionsSet),
      ordersCount,
    };
  }

  return resultMap;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { staffEmployeeId, token, sig, action, payload } = body;

    if (!staffEmployeeId || !token || !sig) {
      return NextResponse.json({ ok: false, error: "بيانات التحقق ناقصة." }, { status: 400 });
    }

    const emp = await verifyStaff(staffEmployeeId, token, sig);

    // 1. جلب البيانات مع مطابقة الزبائن والتكرار واسترجاع كافة القوائم السابقة
    if (action === "get_data") {
      const templates = await prisma.staffOutreachTemplate.findMany({
        where: {
          staffEmployeeId: emp.id,
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // 1. البحث عن القائمة الرئيسية الدائمة للموظف أو إنشاؤها
      let mainList = await prisma.staffOutreachList.findFirst({
        where: { staffEmployeeId: emp.id },
        orderBy: { createdAt: "asc" },
      });

      if (!mainList) {
        mainList = await prisma.staffOutreachList.create({
          data: {
            id: crypto.randomUUID(),
            staffEmployeeId: emp.id,
            title: "قائمة مهام التواصل الرئيسية",
          },
        });
      }

      // 2. دمج أي أرقام من قوائم سابقة أخرى للموظف ونقلها للقائمة الرئيسية فوراً
      try {
        const otherLists = await prisma.staffOutreachList.findMany({
          where: {
            staffEmployeeId: emp.id,
            id: { not: mainList.id },
          },
          select: { id: true },
        });

        if (otherLists.length > 0) {
          const otherListIds = otherLists.map((l) => l.id);
          await prisma.staffOutreachItem.updateMany({
            where: { listId: { in: otherListIds } },
            data: { listId: mainList.id },
          });
          await prisma.staffOutreachList.deleteMany({
            where: { id: { in: otherListIds } },
          });
        }
      } catch (e) {}

      // 3. جلب جميع الأرقام المحفوظة في قاعدة البيانات السحابية للموظف
      const allItems = await prisma.staffOutreachItem.findMany({
        where: { listId: mainList.id },
        orderBy: [
          { priority: "desc" },
          { createdAt: "asc" }
        ],
      });

      let enrichedMap: Record<string, any> = {};
      if (allItems.length > 0) {
        enrichedMap = await enrichItemsWithCustomerData(
          emp.id,
          mainList.id,
          allItems.map((i) => ({ id: i.id, phone: i.phone }))
        );
      }

      return NextResponse.json({
        ok: true,
        data: {
          list: {
            id: mainList.id,
            title: mainList.title,
            createdAt: mainList.createdAt.toISOString(),
            items: allItems.map((i) => {
              const extra = enrichedMap[i.id] || {
                isDuplicateHistory: false,
                isExistingCustomer: false,
                regions: [],
                ordersCount: 0,
              };
              return {
                id: i.id,
                phone: i.phone,
                originalInput: i.originalInput,
                status: i.status as "pending" | "whatsapp_opened" | "completed",
                templateUsed: i.templateUsed,
                source: i.source,
                availableAt: i.availableAt?.toISOString() || null,
                priority: i.priority,
                openedAt: i.openedAt?.toISOString() || null,
                completedAt: i.completedAt?.toISOString() || null,
                createdAt: i.createdAt.toISOString(),
                isDuplicateHistory: extra.isDuplicateHistory,
                duplicateSource: extra.duplicateSource,
                isExistingCustomer: extra.isExistingCustomer,
                regions: extra.regions,
                ordersCount: extra.ordersCount,
              };
            }),
          },
          templates: templates.map((t) => ({
            id: t.id,
            title: t.title,
            content: t.content,
            isActive: t.isActive,
          })),
        },
      });
    }

    // 2. إنشاء أو دمج أرقام في قاعدة البيانات السحابية الدائمة
    if (action === "create_list") {
      const extracted = extractPhonesPure(payload?.rawText || "");
      if (extracted.length === 0) {
        return NextResponse.json({ ok: false, error: "لم يتم العثور على أرقام هواتف أو يوزرات صالحة. تأكد من كتابة الرقم بشكل صحيح." }, { status: 400 });
      }

      // البحث عن القائمة الرئيسية الدائمة للموظف
      let mainList = await prisma.staffOutreachList.findFirst({
        where: { staffEmployeeId: emp.id },
        orderBy: { createdAt: "asc" },
      });

      if (!mainList) {
        mainList = await prisma.staffOutreachList.create({
          data: {
            id: crypto.randomUUID(),
            staffEmployeeId: emp.id,
            title: "قائمة مهام التواصل الرئيسية",
          },
        });
      }

      const targetListId = mainList.id;

      // فحص الأرقام المسجلة في القائمة ومعرفة حالتها بدقة
      const existingItems = await prisma.staffOutreachItem.findMany({
        where: { listId: targetListId },
        select: { id: true, phone: true, status: true },
      });

      const existingMap = new Map<string, { id: string; status: string }>();
      for (const item of existingItems) {
        existingMap.set(item.phone, { id: item.id, status: item.status });
      }

      // تصفية الأرقام المستخرجة ومطابقتها
      const uniqueExtractedMap = new Map<string, { phone: string; originalInput: string }>();
      for (const item of extracted) {
        if (!uniqueExtractedMap.has(item.phone)) {
          uniqueExtractedMap.set(item.phone, item);
        }
      }
      const uniqueExtracted = Array.from(uniqueExtractedMap.values());

      const newItems: typeof uniqueExtracted = [];
      const duplicateIdsToReactivate: string[] = [];

      for (const item of uniqueExtracted) {
        const exist = existingMap.get(item.phone);
        if (!exist) {
          newItems.push(item);
        } else {
          // إذا كان الرقم موجوداً مسبقاً في القائمة (سواء مكتمل أو قيد العمل)، نعيد تنشيطه فوراً ليصبح جاهزاً للعمل
          duplicateIdsToReactivate.push(exist.id);
        }
      }

      // إعادة تنشيط الأرقام الموجودة مسبقاً لتكون في قيد العمل
      if (duplicateIdsToReactivate.length > 0) {
        await prisma.staffOutreachItem.updateMany({
          where: { id: { in: duplicateIdsToReactivate } },
          data: {
            status: "pending",
            openedAt: null,
            completedAt: null,
            templateUsed: null,
            createdAt: new Date(),
          },
        });
      }

      // إضافة العناصر الجديدة
      if (newItems.length > 0) {
        await prisma.staffOutreachItem.createMany({
          data: newItems.map((item) => ({
            id: crypto.randomUUID(),
            listId: targetListId,
            phone: item.phone,
            originalInput: item.originalInput,
            status: "pending",
            createdAt: new Date(),
          })),
        });
      }

      const totalActiveNow = newItems.length + duplicateIdsToReactivate.length;

      return NextResponse.json({
        ok: true,
        message: `تمت إضافة وتنشيط ${totalActiveNow} رقم في قائمة قيد العمل بنجاح ✅`,
        listId: targetListId,
        summary: {
          totalExtracted: uniqueExtracted.length,
          newCount: newItems.length,
          reactivatedCount: duplicateIdsToReactivate.length,
        },
      });
    }

    // 2.1 إعادة تفعيل أرقام مكتملة ونقلها لقيد العمل
    if (action === "reactivate_completed") {
      const phones: string[] = payload?.phones || [];
      const itemIds: string[] = payload?.itemIds || [];

      let count = 0;
      if (itemIds.length > 0) {
        const res = await prisma.staffOutreachItem.updateMany({
          where: {
            id: { in: itemIds },
            list: { staffEmployeeId: emp.id },
          },
          data: {
            status: "pending",
            openedAt: null,
            completedAt: null,
          },
        });
        count = res.count;
      } else if (phones.length > 0) {
        const res = await prisma.staffOutreachItem.updateMany({
          where: {
            phone: { in: phones },
            list: { staffEmployeeId: emp.id },
          },
          data: {
            status: "pending",
            openedAt: null,
            completedAt: null,
          },
        });
        count = res.count;
      }

      return NextResponse.json({
        ok: true,
        message: `تمت إعادة ${count} أرقام إلى قائمة العمل بنجاح 🚀`,
        count,
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
      const content = (payload?.content || "").trim();
      let title = (payload?.title || "").trim();
      const templateId = payload?.templateId ? String(payload.templateId).trim() : null;

      if (!content) {
        return NextResponse.json({ ok: false, error: "يرجى كتابة أو لصق نص الرسالة." }, { status: 400 });
      }

      if (!title) {
        const firstLine = content.split("\n")[0].trim();
        title = firstLine.length > 45 ? firstLine.slice(0, 45) + "..." : firstLine || "نموذج رسالة";
      }

      if (templateId) {
        const existing = await prisma.staffOutreachTemplate.findUnique({
          where: { id: templateId },
        });

        if (existing) {
          await prisma.staffOutreachTemplate.update({
            where: { id: templateId },
            data: {
              title,
              content,
              isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
            },
          });
        } else {
          await prisma.staffOutreachTemplate.create({
            data: {
              id: templateId,
              staffEmployeeId: emp.id,
              title,
              content,
              isActive: true,
            },
          });
        }
      } else {
        await prisma.staffOutreachTemplate.create({
          data: {
            id: crypto.randomUUID(),
            staffEmployeeId: emp.id,
            title,
            content,
            isActive: true,
          },
        });
      }
      return NextResponse.json({ ok: true });
    }

    // 9. حذف نموذج
    if (action === "delete_template") {
      if (payload.templateId) {
        await prisma.staffOutreachTemplate.deleteMany({
          where: { id: payload.templateId },
        });
      }
      return NextResponse.json({ ok: true });
    }

    // 10. مسح كافة النماذج
    if (action === "reset_templates") {
      await prisma.staffOutreachTemplate.deleteMany({
        where: { staffEmployeeId: emp.id },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "إجراء غير معروف." }, { status: 400 });
  } catch (error: any) {
    console.error("Outreach API Error:", error);
    return NextResponse.json({ ok: false, error: error?.message || "خطأ أثناء معالجة الطلب." }, { status: 500 });
  }
}
