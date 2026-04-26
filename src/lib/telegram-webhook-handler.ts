import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import {
  escapeTelegramHtml,
  sendTelegramHtmlToChat,
  sendTelegramMessageWithKeyboardToChat,
  type TelegramCallbackQuery,
  type TelegramInlineKeyboard,
  type TelegramMessage,
} from "@/lib/telegram";
import { formatDinarAsAlf, parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { syncOrderCourierMoneyExpectations } from "@/lib/order-courier-money-sync";
import { getPublicAppUrl } from "./app-url";

type WebhookContext = {
  chatId: string;
  fromId: string;
  fromName: string;
};

/**
 * معالج الـ Webhook الخاص بتلقرام.
 * يدعم:
 * 1. Callback Queries: الأزرار التفاعلية (مثل تحويل لمندوب، تعديل الطلب).
 * 2. Messages: النصوص (مثل الرد على تعديل حقل معين).
 */
export async function handleTelegramWebhook(body: any): Promise<void> {
  // 1. معالجة الضغط على الأزرار (Callback Query)
  if (body.callback_query) {
    const cb = body.callback_query as TelegramCallbackQuery;
    const ctx: WebhookContext = {
      chatId: String(cb.message.chat.id),
      fromId: String(cb.from.id),
      fromName: cb.from.first_name || "",
    };
    await handleCallbackQuery(cb, ctx);
    return;
  }

  // 2. معالجة الرسائل النصية
  if (body.message) {
    const msg = body.message as TelegramMessage;
    if (!msg.text) return;

    const ctx: WebhookContext = {
      chatId: String(msg.chat.id),
      fromId: String(msg.from?.id || ""),
      fromName: msg.from?.first_name || "",
    };

    // أوامر البداية
    if (msg.text.startsWith("/start")) {
      await sendTelegramHtmlToChat(ctx.chatId, "أهلاً بك في نظام <b>أبو الأكبر للتوصيل</b>. استخدم الأزرار المرفقة مع إشعارات الطلبات للتحكم.");
      return;
    }

    // التحقق من وجود جلسة تعديل نصية نشطة
    const session = await prisma.telegramBotSession.findUnique({
      where: { telegramUserId: ctx.fromId },
    });

    if (session && session.step.startsWith("edit_") && session.orderNumber) {
      await handleTextEditInput(session.step, session.orderNumber, msg.text, session.telegramUserId, ctx);
      return;
    }
  }
}

async function handleCallbackQuery(cb: TelegramCallbackQuery, ctx: WebhookContext): Promise<void> {
  const data = cb.data || "";

  // l[orderNumber]: قائمة المناديب للإسناد
  if (data.startsWith("l")) {
    const on = parseInt(data.substring(1));
    await showCourierListForAssign(on, ctx);
  }
  // a[orderNumber]_[courierId]: إسناد فعلي لمندوب
  else if (data.startsWith("a")) {
    const parts = data.substring(1).split("_");
    const on = parseInt(parts[0]);
    const cid = parts[1];
    await assignOrderToCourier(on, cid, ctx);
  }
  // e[orderNumber]: خيارات تعديل الطلب
  else if (data.startsWith("e")) {
    const on = parseInt(data.substring(1));
    await showEditOptions(on, ctx);
  }
  // es[orderNumber]_[field]: بدء تعديل حقل نصي
  else if (data.startsWith("es")) {
    const parts = data.substring(2).split("_");
    const on = parseInt(parts[0]);
    const field = parts[1];
    await startTextEdit(on, field, ctx);
  }
  // acc_t_[transferId]: قبول تحويل مالي (من إشعار المحفظة)
  else if (data.startsWith("acc_t_")) {
    const tid = data.replace("acc_t_", "");
    await respondTransferFromTelegram(tid, true, ctx);
  }
  // rej_t_[transferId]: رفض تحويل مالي
  else if (data.startsWith("rej_t_")) {
    const tid = data.replace("rej_t_", "");
    await respondTransferFromTelegram(tid, false, ctx);
  }
}

async function showCourierListForAssign(orderNumber: number, ctx: WebhookContext): Promise<void> {
  const couriers = await prisma.courier.findMany({
    where: { blocked: false, availableForAssignment: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (couriers.length === 0) {
    await sendTelegramHtmlToChat(ctx.chatId, "❌ لا يوجد مناديب متاحين حالياً.");
    return;
  }

  const kb: TelegramInlineKeyboard = {
    inline_keyboard: couriers.map((c) => [
      { text: c.name, callback_data: `a${orderNumber}_${c.id}` },
    ]),
  };

  await sendTelegramMessageWithKeyboardToChat(
    ctx.chatId,
    `اختر المندوب لإسناد الطلب رقم <b>#${orderNumber}</b>:`,
    kb
  );
}

async function assignOrderToCourier(orderNumber: number, courierId: string, ctx: WebhookContext): Promise<void> {
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  const courier = await prisma.courier.findUnique({ where: { id: courierId } });

  if (!order || !courier) {
    await sendTelegramHtmlToChat(ctx.chatId, "❌ تعذّر العثور على الطلب أو المندوب.");
    return;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { assignedCourierId: courierId, status: "assigned" },
  });

  await sendTelegramHtmlToChat(
    ctx.chatId,
    `✅ تم إسناد الطلب <b>#${orderNumber}</b> إلى المندوب <b>${courier.name}</b> بنجاح.`
  );
}

async function showEditOptions(orderNumber: number, ctx: WebhookContext): Promise<void> {
  const kb: TelegramInlineKeyboard = {
    inline_keyboard: [
      [
        { text: "📦 النوع", callback_data: `es${orderNumber}_type` },
        { text: "💰 السعر", callback_data: `es${orderNumber}_price` },
      ],
      [
        { text: "📞 الهاتف", callback_data: `es${orderNumber}_phone` },
        { text: "📝 الملاحظات", callback_data: `es${orderNumber}_summary` },
      ],
      [
        { text: "📍 العنوان/الرابط", callback_data: `es${orderNumber}_location_url` },
        { text: "🏢 علامة دالة", callback_data: `es${orderNumber}_landmark` },
      ],
    ],
  };

  await sendTelegramMessageWithKeyboardToChat(
    ctx.chatId,
    `تعديل الطلب رقم <b>#${orderNumber}</b>. اختر الحقل المراد تعديله:`,
    kb
  );
}

async function startTextEdit(orderNumber: number, field: string, ctx: WebhookContext): Promise<void> {
  let prompt = "";
  let step = "edit_" + field;

  switch (field) {
    case "type": prompt = "أرسل نوع الطلب الجديد (مثلاً: ملابس، طرد…):"; break;
    case "price": prompt = "أرسل سعر الطلب الجديد بالألف (مثلاً: 25.5):"; break;
    case "phone": prompt = "أرسل رقم الهاتف الجديد (11 رقم):"; break;
    case "summary": prompt = "أرسل ملاحظات الطلب الجديدة:"; break;
    case "location_url": prompt = "أرسل رابط الموقع الجديد (خرائط جوجل):"; break;
    case "landmark": prompt = "أرسل العلامة الدالة الجديدة:"; break;
    default: return;
  }

  await prisma.telegramBotSession.upsert({
    where: { telegramUserId: ctx.fromId },
    create: { telegramUserId: ctx.fromId, chatId: ctx.chatId, step, orderNumber },
    update: { chatId: ctx.chatId, step, orderNumber },
  });

  await sendTelegramHtmlToChat(ctx.chatId, `⌨️ ${prompt}\n(أرسل أي نص للإلغاء إذا لم تكن متأكداً)`);
}

async function handleTextEditInput(step: string, on: number, txt: string, uid: string, ctx: WebhookContext): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { orderNumber: on },
    include: { customer: true }
  });
  if (!order) {
    await finishTextEdit(uid, ctx.chatId, on, ctx);
    return;
  }

  try {
    switch (step) {
      case "edit_type": {
        await prisma.order.update({ where: { id: order.id }, data: { orderType: txt } });
        await finishTextEdit(uid, ctx.chatId, on, ctx);
        break;
      }
      case "edit_price": {
        const p = parseAlfInputToDinarDecimalRequired(txt);
        if (!p.ok) { await sendTelegramHtmlToChat(ctx.chatId, "❌ مبلغ غير صالح. أرسل الرقم بالألف (مثلاً 10.5)."); break; }
        const oldSub = order.orderSubtotal || new Decimal(0);
        const oldDel = order.deliveryPrice || new Decimal(0);
        const newSub = new Decimal(p.value);
        await prisma.order.update({ where: { id: order.id }, data: { orderSubtotal: newSub, totalAmount: newSub.plus(oldDel) } });
        await syncOrderCourierMoneyExpectations(prisma, order.id);
        await finishTextEdit(uid, ctx.chatId, on, ctx);
        break;
      }
      case "edit_phone": {
        const ph = normalizeIraqMobileLocal11(txt);
        if (!ph) { await sendTelegramHtmlToChat(ctx.chatId, "❌ رقم هاتف غير صالح (مثلاً 0770…)."); break; }

        const ops: Prisma.PrismaPromise<any>[] = [
          prisma.order.update({ where: { id: order.id }, data: { customerPhone: ph } })
        ];
        if (order.customerId) {
          ops.push(prisma.customer.update({ where: { id: order.customerId }, data: { phone: ph } }));
        }
        await prisma.$transaction(ops);

        await finishTextEdit(uid, ctx.chatId, on, ctx);
        break;
      }
      case "edit_summary": { await prisma.order.update({ where: { id: order.id }, data: { summary: txt } }); await finishTextEdit(uid, ctx.chatId, on, ctx); break; }
      case "edit_alt_phone": {
        const ph = txt === "—" || txt === "-" ? null : normalizeIraqMobileLocal11(txt);
        if (txt !== "—" && txt !== "-" && !ph) { await sendTelegramHtmlToChat(ctx.chatId, "❌ رقم غير صالح أو أرسل — للمسح."); break; }

        const ops: Prisma.PrismaPromise<any>[] = [
          prisma.order.update({ where: { id: order.id }, data: { alternatePhone: ph } })
        ];
        if (order.customerId) {
          ops.push(prisma.customer.update({ where: { id: order.customerId }, data: { alternatePhone: ph } }));
        }
        await prisma.$transaction(ops);

        await finishTextEdit(uid, ctx.chatId, on, ctx);
        break;
      }
      case "edit_location_url": {
        let url = txt;
        if (!url.startsWith("http")) url = "https://" + url;
        try { new URL(url); } catch { await sendTelegramHtmlToChat(ctx.chatId, "❌ رابط غير صالح."); break; }

        const ops: Prisma.PrismaPromise<any>[] = [
          prisma.order.update({ where: { id: order.id }, data: { customerLocationUrl: url } })
        ];
        if (order.customerId) {
          ops.push(prisma.customer.update({ where: { id: order.customerId }, data: { customerLocationUrl: url } }));
        }
        await prisma.$transaction(ops);

        await finishTextEdit(uid, ctx.chatId, on, ctx);
        break;
      }
      case "edit_landmark": {
        const ops: Prisma.PrismaPromise<any>[] = [
          prisma.order.update({ where: { id: order.id }, data: { customerLandmark: txt } })
        ];
        if (order.customerId) {
          ops.push(prisma.customer.update({ where: { id: order.customerId }, data: { customerLandmark: txt } }));
        }
        await prisma.$transaction(ops);

        await finishTextEdit(uid, ctx.chatId, on, ctx);
        break;
      }
      default: { await finishTextEdit(uid, ctx.chatId, on, ctx); }
    }
  } catch (e) {
    console.error("Telegram edit error:", e);
    await sendTelegramHtmlToChat(ctx.chatId, "❌ حدث خطأ أثناء التحديث.");
    await finishTextEdit(uid, ctx.chatId, on, ctx);
  }
}

async function finishTextEdit(uid: string, chatId: string, on: number, ctx: WebhookContext): Promise<void> {
  await prisma.telegramBotSession.deleteMany({ where: { telegramUserId: uid } });
  await sendTelegramHtmlToChat(chatId, `✅ تم تحديث الطلب <b>#${on}</b> بنجاح.`);
}

/** الرد على طلب تحويل مالي من تلقرام */
async function respondTransferFromTelegram(transferId: string, accept: boolean, ctx: WebhookContext): Promise<void> {
  const label = accept ? "لقبول" : "لرفض";
  await sendTelegramHtmlToChat(ctx.chatId, `يرجى استخدام رابط المحفظة الخاص بك ${label} التحويل.`);
}
