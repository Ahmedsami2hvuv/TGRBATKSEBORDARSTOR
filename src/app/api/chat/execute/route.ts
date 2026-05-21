import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin-session";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { PreparerShoppingDraftStatus } from "@prisma/client";
import { resolvePortalChatActor } from "@/lib/portal-chat-auth";

type ExecuteAction = {
  type: string;
  payload?: any;
};

function normalizeProducts(input: any): string[] {
  if (Array.isArray(input)) {
    return input.map((x) => String(x || "").trim()).filter(Boolean);
  }
  const text = String(input || "").trim();
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function resolveRegionId(payload: any): Promise<string | null> {
  const regionId = String(payload?.regionId || "").trim();
  if (regionId) {
    const found = await prisma.region.findUnique({ where: { id: regionId }, select: { id: true } });
    if (found) return found.id;
  }
  const regionName = String(payload?.regionName || "").trim();
  if (!regionName) return null;
  const foundByName = await prisma.region.findFirst({
    where: { name: { contains: regionName, mode: "insensitive" } },
    select: { id: true },
  });
  return foundByName?.id ?? null;
}

async function executeCreateCustomerReference(payload: any) {
  const phone = normalizeIraqMobileLocal11(String(payload?.phone || ""));
  if (!phone) return { ok: false, text: "رقم الهاتف غير صالح." };

  const regionId = await resolveRegionId(payload);
  if (!regionId) return { ok: false, text: "ما قدرت أحدد المنطقة. اكتب اسم المنطقة بشكل أوضح." };

  const locationUrl = String(payload?.locationUrl || "").trim();
  const landmark = String(payload?.landmark || "").trim();
  const notes = String(payload?.notes || "").trim();
  const alternatePhoneRaw = String(payload?.alternatePhone || "").trim();
  const alternatePhone = alternatePhoneRaw ? normalizeIraqMobileLocal11(alternatePhoneRaw) : null;

  await prisma.customerPhoneProfile.upsert({
    where: { phone_regionId: { phone, regionId } },
    create: {
      phone,
      regionId,
      locationUrl,
      landmark,
      notes,
      alternatePhone: alternatePhone || null,
      photoUrl: "",
    },
    update: {
      locationUrl,
      landmark,
      notes,
      alternatePhone: alternatePhone || null,
    },
  });

  return { ok: true, text: "تم حفظ الزبون المرجعي بنجاح." };
}

async function executeCreatePreparationDraft(payload: any) {
  const titleLine = String(payload?.titleLine || payload?.customerName || "طلب تجهيز من الدردشة").trim();
  const customerPhone = normalizeIraqMobileLocal11(String(payload?.customerPhone || "")) || String(payload?.customerPhone || "").trim();
  const customerName = String(payload?.customerName || "").trim() || customerPhone || "زبون";
  const customerLandmark = String(payload?.customerLandmark || payload?.landmark || "").trim();
  const orderTime = String(payload?.orderTime || "فوري").trim();
  const products = normalizeProducts(payload?.products);
  const preparerIds: string[] = Array.isArray(payload?.preparerIds)
    ? payload.preparerIds.map((x: any) => String(x || "").trim()).filter(Boolean)
    : String(payload?.preparerId || "").trim()
      ? [String(payload.preparerId).trim()]
      : [];

  if (products.length === 0) {
    return { ok: false, text: "ماكو مواد بالطلب. اكتب المواد أولاً." };
  }

  const customerRegionId = await resolveRegionId(payload);
  if (!customerRegionId) return { ok: false, text: "ما قدرت أحدد المنطقة للطلب." };

  if (preparerIds.length === 0) {
    const preparers = await prisma.companyPreparer.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return {
      ok: false,
      text: "حدد المجهز أولاً حتى أسوي الإسناد.",
      actions: [
        {
          type: "SHOW_OPTIONS",
          payload: {
            items: preparers.map((p) => ({ id: p.id, name: p.name })),
          },
        },
      ],
    };
  }

  const groupId = `chat-${Date.now()}`;
  const createdDraftIds: string[] = [];
  for (const preparerId of preparerIds) {
    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: preparerId },
      select: { id: true, name: true },
    });
    if (!preparer) continue;

    const draft = await prisma.companyPreparerShoppingDraft.create({
      data: {
        preparerId,
        status: PreparerShoppingDraftStatus.draft,
        titleLine,
        rawListText: products.join("\n"),
        customerRegionId,
        customerPhone: customerPhone || "",
        customerName,
        customerLandmark,
        orderTime,
        data: {
          version: 1,
          groupId,
          products: products.map((line) => ({ line, buyAlf: null, sellAlf: null, pricedBy: null })),
          fromAdminName: "AI Chat",
        },
      },
      select: { id: true },
    });
    createdDraftIds.push(draft.id);

    await prisma.companyPreparerPrepNotice.create({
      data: {
        preparerId,
        title: "طلب تجهيز جديد (من الشات)",
        body: `تم إرسال طلب تجهيز جديد: ${titleLine}`,
      },
    });
  }

  if (createdDraftIds.length === 0) {
    return { ok: false, text: "ما قدرت أسند الطلب للمجهز المحدد." };
  }

  return {
    ok: true,
    text: `تم إنشاء طلب تجهيز وإسناده بنجاح (${createdDraftIds.length}). تريد أسند مندوب هسة لو نخليه لاحقاً؟`,
    actions: [
      {
        type: "SHOW_OPTIONS",
        payload: {
          items: [
            {
              id: "assign_now",
              title: "إسناد مندوب الآن",
              action: {
                type: "PROMPT_ASSIGN_COURIER_FOR_GROUP",
                payload: { groupId },
              },
            },
            {
              id: "assign_later",
              title: "لاحقاً",
              action: {
                type: "SKIP_COURIER_ASSIGN",
                payload: { groupId },
              },
            },
          ],
        },
      },
    ],
  };
}

async function executeAssignOrderToCourier(payload: any) {
  const courierId = String(payload?.courierId || "").trim();
  if (!courierId) {
    const couriers = await prisma.courier.findMany({
      where: { availableForAssignment: true, blocked: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return {
      ok: false,
      text: "حدد المندوب أولاً.",
      actions: [{ type: "SHOW_OPTIONS", payload: { items: couriers.map((c) => ({ id: c.id, name: c.name })) } }],
    };
  }

  const orderIdFromPayload = String(payload?.orderId || "").trim();
  const orderNumberRaw = String(payload?.orderNumber || "").trim();

  let orderId = orderIdFromPayload;
  if (!orderId && orderNumberRaw) {
    const orderNumber = Number(orderNumberRaw);
    if (!Number.isNaN(orderNumber)) {
      const row = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
      orderId = row?.id ?? "";
    }
  }
  if (!orderId) return { ok: false, text: "ما قدرت أحدد الطلب المطلوب للإسناد." };

  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { id: true, name: true },
  });
  if (!courier) return { ok: false, text: "المندوب غير موجود." };

  await prisma.order.update({
    where: { id: orderId },
    data: { assignedCourierId: courier.id, status: "assigned" },
  });

  return {
    ok: true,
    text: `تم إسناد الطلب للمندوب ${courier.name}.`,
    actions: [
      {
        type: "SHOW_OPTIONS",
        payload: {
          items: [
            {
              id: "open_pending_orders",
              title: "فتح الطلبات المعلقة",
              action: {
                type: "NAVIGATE",
                payload: { url: `${SECRET_ADMIN_PATH}/orders/pending` },
              },
            },
          ],
        },
      },
    ],
  };
}

async function executePromptAssignCourierForGroup(payload: any) {
  const groupId = String(payload?.groupId || "").trim();
  if (!groupId) return { ok: false, text: "ما حصلت معرف مجموعة الطلبات." };

  const couriers = await prisma.courier.findMany({
    where: { availableForAssignment: true, blocked: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
    take: 20,
  });

  if (couriers.length === 0) return { ok: false, text: "ماكو مندوبين متاحين هسه." };

  return {
    ok: true,
    text: "اختار المندوب اللي تريد تسنده للطلب:",
    actions: [
      {
        type: "SHOW_OPTIONS",
        payload: {
          items: couriers.map((c) => ({
            id: c.id,
            name: c.name,
            action: {
              type: "ASSIGN_COURIER_TO_DRAFT_GROUP",
              payload: { groupId, courierId: c.id },
            },
          })),
        },
      },
    ],
  };
}

async function executeAssignCourierToDraftGroup(payload: any) {
  const groupId = String(payload?.groupId || "").trim();
  const courierId = String(payload?.courierId || "").trim();
  if (!groupId || !courierId) {
    return { ok: false, text: "بيانات الإسناد ناقصة." };
  }

  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { id: true, name: true },
  });
  if (!courier) return { ok: false, text: "المندوب غير موجود." };

  const related = await prisma.companyPreparerShoppingDraft.findMany({
    where: { data: { path: ["groupId"], equals: groupId } },
    select: { id: true, data: true },
  });

  if (related.length === 0) return { ok: false, text: "ما لقيت مسودات مرتبطة بهذا الطلب." };

  for (const row of related) {
    const currentData = ((row.data as any) || {}) as Record<string, any>;
    await prisma.companyPreparerShoppingDraft.update({
      where: { id: row.id },
      data: {
        data: {
          ...currentData,
          autoCourierId: courier.id,
          autoCourierName: courier.name,
        },
      },
    });
  }

  return {
    ok: true,
    text: `تم تعيين المندوب ${courier.name} للطلب (تحويل تلقائي عند الإرسال النهائي).`,
    actions: [
      {
        type: "SHOW_OPTIONS",
        payload: {
          items: [
            {
              id: "open_pending_orders",
              title: "فتح الطلبات المعلقة",
              action: {
                type: "NAVIGATE",
                payload: { url: `${SECRET_ADMIN_PATH}/orders/pending` },
              },
            },
          ],
        },
      },
    ],
  };
}

async function executeSkipCourierAssign() {
  return { ok: true, text: "تمام، تركنا إسناد المندوب لاحقاً." };
}

async function executeBulkUpdateStatus(payload: any, actor: any) {
    if (!actor) return { ok: false, text: "غير مخوّل." };
    const status = payload.status || "delivered";

    if (actor.role === "mandoub") {
        const result = await prisma.order.updateMany({
            where: {
                assignedCourierId: actor.actorId,
                status: { in: ["assigned", "delivering"] }
            },
            data: { status: status === "delivered" ? "delivered" : status }
        });
        return { ok: true, text: `تم تحديث ${result.count} طلبات إلى حالة تم الاستلام بنجاح.` };
    }

    if (actor.role === "preparer") {
        const result = await prisma.companyPreparerShoppingDraft.updateMany({
            where: {
                preparerId: actor.actorId,
                status: "priced"
            },
            data: { status: "sent" }
        });
        return { ok: true, text: `تم تحويل ${result.count} قوائم جاهزة إلى 'تم الإرسال'.` };
    }

    if (actor.role === "admin") {
        // Admin can update all pending/delivering to delivered if they really want to, but let's keep it safe.
        return { ok: false, text: "يرجى تحديد الطلبات المراد تحديثها من لوحة التحكم." };
    }

    return { ok: false, text: "هذا الأمر غير متاح لدورك الحالي." };
}

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, auth } = body as { action?: ExecuteAction, auth?: any };

    if (!action?.type) return NextResponse.json({ ok: false, text: "Action مفقود." }, { status: 400 });

    const actor = await resolvePortalChatActor(auth);
    if (!actor) {
        return NextResponse.json({ ok: false, text: "غير مخوّل أو انتهت الجلسة." }, { status: 401 });
    }

    // Admin-only actions
    const adminOnlyActions = ["CREATE_CUSTOMER_REFERENCE", "CREATE_PREPARATION_DRAFT", "ASSIGN_ORDER_TO_COURIER", "PROMPT_ASSIGN_COURIER_FOR_GROUP", "ASSIGN_COURIER_TO_DRAFT_GROUP"];
    if (adminOnlyActions.includes(action.type) && actor.role !== "admin") {
        return NextResponse.json({ ok: false, text: "هذا الأمر متاح للمدير فقط." }, { status: 403 });
    }

    if (action.type === "CREATE_CUSTOMER_REFERENCE") {
      return NextResponse.json(await executeCreateCustomerReference(action.payload));
    }
    if (action.type === "CREATE_PREPARATION_DRAFT") {
      return NextResponse.json(await executeCreatePreparationDraft(action.payload));
    }
    if (action.type === "ASSIGN_ORDER_TO_COURIER") {
      return NextResponse.json(await executeAssignOrderToCourier(action.payload));
    }
    if (action.type === "PROMPT_ASSIGN_COURIER_FOR_GROUP") {
      return NextResponse.json(await executePromptAssignCourierForGroup(action.payload));
    }
    if (action.type === "ASSIGN_COURIER_TO_DRAFT_GROUP") {
      return NextResponse.json(await executeAssignCourierToDraftGroup(action.payload));
    }
    if (action.type === "SKIP_COURIER_ASSIGN") {
      return NextResponse.json(await executeSkipCourierAssign());
    }
    if (action.type === "BULK_UPDATE_STATUS") {
      return NextResponse.json(await executeBulkUpdateStatus(action.payload, actor));
    }

    return NextResponse.json({ ok: false, text: `نوع الأمر غير مدعوم: ${action.type}` }, { status: 400 });
  } catch (error) {
    console.error("Execute action error:", error);
    return NextResponse.json({ ok: false, text: "فشل تنفيذ العملية." }, { status: 500 });
  }
}
