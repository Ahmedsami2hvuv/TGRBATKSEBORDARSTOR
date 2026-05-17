import { prisma } from "./prisma";
import {
  deleteTelegramMessage,
  sendTelegramHtmlToChat,
  sendTelegramMessageWithKeyboardToChat,
  type TelegramInlineKeyboard,
} from "./telegram";
import { buildEmployeeOrderPortalUrl, verifyEmployeeOrderPortalQuery } from "./employee-order-portal-link";
import { getPublicAppUrl } from "./app-url";
import { Decimal } from "@prisma/client/runtime/library";
import { formatDinarAsAlf, normalizeNumerals } from "./money-alf";
import { notifyTelegramNewOrder } from "./telegram-notify";

/**
 * مساعد لترجمة حالة الطلب بالألوان والرموز الموحدة (Harmonized with Courier Bot)
 */
function statusAr(status: string): string {
  switch (status) {
    case "pending":
      return "🔴وصل للادارة ";
    case "assigned":
      return "🔴 بانتظار المندوب";
    case "delivering":
      return "🟠 عند المندوب";
    case "delivered":
      return "🟢 تم التسليم";
    case "canceled":
      return "❌ ملغي";
    case "archived":
      return "مؤرشف";
    default:
      return status;
  }
}

/**
 * بناء لوحة تحكم العميل (الموظف)
 */
function buildCustomerKeyboard(portalUrl: string): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "📦 رفع طلب جديد", callback_data: "new_order" },
      ],
      [
        { text: "📜 سجل الطلبات", url: portalUrl.replace("/order", "/order/history") },
        { text: "📊 إحصائياتي", url: portalUrl.replace("/order", "/order/account") }
      ],
      [
        { text: "🚪 تسجيل الخروج", callback_data: "logout" }
      ]
    ]
  };
}

/**
 * معالجة رسائل بوت العملاء الخاصة
 */
export async function handleCustomerPrivateMessage(msg: any, botToken: string): Promise<void> {
  const telegramUserId = String(msg.from.id);
  const chatId = String(msg.chat.id);
  const text = msg.text?.trim() || "";

  // دالة لمحاولة استخراج البيانات من الرابط (سواء كان في الـ start أو كرسالة عادية)
  const tryParsePortalUrl = async (input: string) => {
    try {
      let urlStr = input;
      // إذا كان النص قادماً من /start payload
      if (input.startsWith("/start ")) {
        const payload = input.split(" ")[1];

        // التعامل مع الروابط المختصرة المخزنة في SchemaPlaceholder
        if (payload.startsWith("pl_")) {
          const stored = await prisma.schemaPlaceholder.findUnique({
            where: { id: payload }
          });
          if (stored && stored.note.startsWith("http")) {
            urlStr = stored.note;
          } else {
            return null;
          }
        } else {
          // المحاولة القديمة: Base64
          try {
            urlStr = Buffer.from(payload, "base64").toString("utf-8");
          } catch {
            return null;
          }
        }
      }

      const urlObj = new URL(urlStr);
      const e = urlObj.searchParams.get("e");
      const exp = urlObj.searchParams.get("exp");
      const s = urlObj.searchParams.get("s");

      if (e && exp && s) {
        const v = verifyEmployeeOrderPortalQuery(e, exp, s);
        return { ok: v.ok, employeeId: v.employeeId, url: urlStr };
      }
    } catch (err) {
      return null;
    }
    return null;
  };

  const v = await tryParsePortalUrl(text);

  // البحث عن الموظف أولاً لاستخدامه في حالة عدم وجود رابط
  const employee = await prisma.employee.findUnique({
    where: { telegramUserId },
    include: { shop: true }
  });

  if (v && v.ok) {
    const targetEmployee = await prisma.employee.findUnique({
      where: { id: v.employeeId },
      include: { shop: true }
    });

    if (targetEmployee) {
      // استخدام Transaction لضمان الذرية ومنع Race Conditions
      await prisma.$transaction([
        // 1. إلغاء أي ربط سابق لهذا المستخدم لضمان عدم حدوث خطأ Unique constraint
        prisma.employee.updateMany({
          where: { telegramUserId },
          data: { telegramUserId: null }
        }),
        // 2. ربط الحساب بالتيليجرام
        prisma.employee.update({
          where: { id: targetEmployee.id },
          data: { telegramUserId }
        })
      ]);

      const welcomeMsg = `<b>أهلاً بك يا ${targetEmployee.name}</b>\nمن محل <b>${targetEmployee.shop.name}</b>\n\nلقد تم تفعيل حسابك بنجاح. يمكنك استخدام الأزرار أدناه:`;

      await sendTelegramMessageWithKeyboardToChat(chatId, welcomeMsg, buildCustomerKeyboard(v.url), botToken);
      return;
    }
  }

  // إذا كان المستخدم مسجلاً، نتحقق من وجود جلسة نشطة لرفع طلب
  if (employee) {
    const sessionHandled = await processCustomerSession(msg, employee, botToken);
    if (sessionHandled) return;
  }

  // إذا لم يكن رابطاً، نتحقق إذا كان المستخدم مسجلاً مسبقاً
  if (employee) {
    const portalUrl = buildEmployeeOrderPortalUrl(employee.id, employee.orderPortalToken, getPublicAppUrl());
    if (text.startsWith("/start")) {
      const msgText = `<b>أهلاً ${employee.name}</b>\nمحل: <b>${employee.shop.name}</b>\n\nاختر من الأزرار أدناه للتنقل:`;
      await sendTelegramMessageWithKeyboardToChat(chatId, msgText, buildCustomerKeyboard(portalUrl), botToken);
    } else {
      // إذا أرسل رسالة عادية وهو مسجل، نذكره بالخيارات
      const msgText = `أهلاً بك. لرفع طلب جديد اضغط على الزر أدناه:`;
      await sendTelegramMessageWithKeyboardToChat(chatId, msgText, buildCustomerKeyboard(portalUrl), botToken);
    }
    return;
  }

  // الرد الافتراضي لغير المسجلين
  if (text.startsWith("/start")) {
    await sendTelegramHtmlToChat(
      chatId,
      "مرحباً بك في بوت العملاء.\n\nيرجى العودة لصفحة المتصفح والضغط على زر <b>(إرسال الرابط للبوت)</b> ليتم تفعيل خياراتك هنا.",
      botToken
    );
    return;
  }

  await sendTelegramHtmlToChat(
    chatId,
    "عذراً، لم أتعرف على هذا الرابط. يرجى إرسال رابط بوابة العميل الصحيح من المتصفح.",
    botToken
  );
}

/**
 * معالجة الـ Callbacks لبوت العملاء
 */
export async function handleCustomerCallback(cb: any, botToken: string): Promise<void> {
  const { answerCallbackQuery, deleteTelegramMessage, sendTelegramHtmlToChat } = await import("./telegram");
  const telegramUserId = String(cb.from.id);
  const chatId = String(cb.message.chat.id);

  if (cb.data === "logout") {
    await prisma.employee.updateMany({
      where: { telegramUserId },
      data: { telegramUserId: null }
    });
    await answerCallbackQuery(cb.id, "تم تسجيل الخروج", true, botToken);
    await deleteTelegramMessage(chatId, cb.message.message_id, botToken).catch(() => {});
    await sendTelegramHtmlToChat(chatId, "👋 تم تسجيل الخروج بنجاح. يمكنك العودة في أي وقت باستخدام الرابط من المتصفح.", botToken);
    return;
  }

  if (cb.data === "new_order") {
    await prisma.telegramBotSession.upsert({
      where: { telegramUserId },
      create: { telegramUserId, chatId, step: "customer_new_order_input" },
      update: { step: "customer_new_order_input", payload: "{}" }
    });

    await answerCallbackQuery(cb.id, "جاري البدء...", false, botToken).catch(() => {});
    const text = `<b>📦 رفع طلب جديد</b>\n\n` +
      `يرجى إرسال تفاصيل الطلب في رسالة واحدة كل سطر يحتوي على معلومة كالتالي:\n\n` +
      `نوع الطلب\n` +
      `السعر\n` +
      `المنطقة\n` +
      `رقم الزبون\n` +
      `شوكت تحب يجيك المندوب\n\n` +
      `<b>مثال:</b>\n` +
      `<code>بوكيه ورد\n` +
      `15\n` +
      `جيكور\n` +
      `077333921468\n` +
      `ب4 العصر</code>`;

    await deleteTelegramMessage(chatId, cb.message.message_id, botToken).catch(() => {});
    await sendTelegramMessageWithKeyboardToChat(
      chatId,
      text,
      { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "customer_main" }]] },
      botToken
    );
    return;
  }

  if (cb.data.startsWith("reg_sel:")) {
    const regionId = cb.data.split(":")[1];
    const session = await prisma.telegramBotSession.findUnique({ where: { telegramUserId } });
    if (session && session.step === "customer_new_order_input") {
      const payload = JSON.parse(session.payload || "{}");
      payload.regionId = regionId;
      await prisma.telegramBotSession.update({
        where: { telegramUserId },
        data: { payload: JSON.stringify(payload) }
      });
      await answerCallbackQuery(cb.id, "تم اختيار المنطقة", false, botToken);

      // نتحقق من الحقول الناقصة مرة أخرى
      await processParsedOrder(chatId, telegramUserId, payload, botToken);
      return;
    }
  }

  if (cb.data === "confirm_order") {
    const session = await prisma.telegramBotSession.findUnique({ where: { telegramUserId } });
    if (session && session.step === "customer_new_order_input") {
      const payload = JSON.parse(session.payload || "{}");
      const employee = await prisma.employee.findUnique({ where: { telegramUserId }, include: { shop: true } });

      if (employee && payload.type && payload.price && payload.regionId && payload.phone) {
        const region = await prisma.region.findUnique({ where: { id: payload.regionId } });
        const subtotal = new Decimal(payload.price);
        const deliveryPrice = region?.deliveryPrice || new Decimal(0);

        const order = await prisma.order.create({
          data: {
            shopId: employee.shopId,
            submittedByEmployeeId: employee.id,
            orderType: payload.type,
            customerPhone: payload.phone,
            customerRegionId: payload.regionId,
            orderSubtotal: subtotal,
            deliveryPrice: deliveryPrice,
            totalAmount: subtotal.plus(deliveryPrice),
            status: "pending",
            submissionSource: "telegram_customer",
            orderNoteTime: payload.noteTime
          }
        });

        // إرسال إشعار للإدارة والمجهزين
        void notifyTelegramNewOrder(order.id).catch(console.error);

        await prisma.telegramBotSession.update({
          where: { telegramUserId },
          data: { step: "idle", payload: "" }
        });

    const waText = `طلب جديد: ${payload.type}\nالسعر: ${formatDinarAsAlf(subtotal)}\nالعنوان: ${region?.name}\nالوقت: ${payload.noteTime || 'فوري'}`;
        const waUrl = `https://wa.me/${payload.phone.replace(/^0/, '964')}?text=${encodeURIComponent(waText)}`;

        const successKb = {
          inline_keyboard: [
            [{ text: "💬 إرسال للواتساب", url: waUrl }],
            [
              { text: "📦 طلب جديد", callback_data: "new_order" },
              { text: "🏠 الرئيسية", callback_data: "customer_main" }
            ]
          ]
        };

        await answerCallbackQuery(cb.id, "تم  رفع الطلب بنجاح", true, botToken);
        await deleteTelegramMessage(chatId, cb.message.message_id, botToken).catch(() => {});
        await sendTelegramMessageWithKeyboardToChat(
          chatId,
          `✅ <b>تم ترفع الطلب بنجاح!</b>\n\nالآن: ${statusAr("pending")}`,
          successKb,
          botToken
        );
        return;
      }
    }
  }

  if (cb.data === "customer_main") {
    await answerCallbackQuery(cb.id, undefined, false, botToken).catch(() => {});
    await prisma.telegramBotSession.update({
      where: { telegramUserId },
      data: { step: "idle", payload: "" }
    }).catch(() => {});

    const employee = await prisma.employee.findUnique({
      where: { telegramUserId },
      include: { shop: true }
    });

    if (employee) {
      const portalUrl = buildEmployeeOrderPortalUrl(employee.id, employee.orderPortalToken, getPublicAppUrl());
      const welcomeMsg = `<b>أهلاً ${employee.name}</b>\nمحل: <b>${employee.shop.name}</b>\n\nاختر من الأزرار أدناه للتنقل:`;
      await deleteTelegramMessage(chatId, cb.message.message_id, botToken).catch(() => {});
      await sendTelegramMessageWithKeyboardToChat(chatId, welcomeMsg, buildCustomerKeyboard(portalUrl), botToken);
    }
    return;
  }

  if (cb.data === "cancel_order") {
    await prisma.telegramBotSession.update({
      where: { telegramUserId },
      data: { step: "idle", payload: "" }
    });
    await answerCallbackQuery(cb.id, "تم الإلغاء", false, botToken);
    const employee = await prisma.employee.findUnique({
      where: { telegramUserId },
      include: { shop: true }
    });
    if (employee) {
      const portalUrl = buildEmployeeOrderPortalUrl(employee.id, employee.orderPortalToken, getPublicAppUrl());
      await deleteTelegramMessage(chatId, cb.message.message_id, botToken).catch(() => {});
      await sendTelegramMessageWithKeyboardToChat(chatId, "❌ تم إلغاء رفع الطلب.", buildCustomerKeyboard(portalUrl), botToken);
    }
    return;
  }

  await answerCallbackQuery(cb.id, "جاري المعالجة...", false, botToken).catch(() => {});
}

/**
 * معالجة مدخلات الجلسة للعميل
 */
async function processCustomerSession(msg: any, employee: any, botToken: string): Promise<boolean> {
  const telegramUserId = String(msg.from.id);
  const chatId = String(msg.chat.id);
  const text = msg.text?.trim() || "";

  const session = await prisma.telegramBotSession.findUnique({ where: { telegramUserId } });
  if (!session || !session.step.startsWith("customer_")) return false;

  if (session.step === "customer_new_order_input") {
    const payload = JSON.parse(session.payload || "{}");
    const lines = text.split("\n").map(l => l.trim()).filter(l => l !== "");

    // Store the current user input for reference
    const currentUserInput = text;

    if (lines.length === 1 && !text.includes(":") && !text.includes("=")) {
      // رد على سؤال محدد - نملأ أول حقل ناقص بالترتيب المنطقي للعملية
      if (!payload.price) {
        const priceMatch = text.match(/\d+(\.\d+)?/);
        payload.price = priceMatch ? priceMatch[0] : text;
      } else if (!payload.type) {
        payload.type = text;
      } else if (!payload.phone) {
        const phoneMatch = text.match(/(?:964|0)?7[789]\d{8,11}/);
        payload.phone = phoneMatch ? phoneMatch[0] : text;
      } else if (!payload.noteTime) {
        // إذا كنا ننتظر الوقت، أي مدخل من المستخدم هو الوقت
        payload.noteTime = text;
        // إزالة العلامات المساعدة
        delete payload._askingForTime;
        delete payload._lastUserInput;
      } else if (!payload.regionId && !payload.regionName) {
        payload.regionName = text;
      }
    } else {
      // إدخال متعدد الأسطر أو معنّون
      const newFields = parseOrderText(text);
      // دمج الحقول الجديدة مع الحفاظ على القديمة (إلا إذا كان الإدخال صريحاً بالعناوين)
      const hasLabels = text.includes(":") || text.includes("=");

      if (newFields.type && (hasLabels || !payload.type)) payload.type = newFields.type;
      if (newFields.price && (hasLabels || !payload.price)) payload.price = newFields.price;
      if (newFields.regionName && (hasLabels || !payload.regionName)) payload.regionName = newFields.regionName;
      if (newFields.phone && (hasLabels || !payload.phone)) payload.phone = newFields.phone;
      if (newFields.noteTime && (hasLabels || !payload.noteTime)) {
        payload.noteTime = newFields.noteTime;
        // إزالة العلامات المساعدة
        delete payload._askingForTime;
        delete payload._lastUserInput;
      }
      
      // إذا لم يتم العثور على حقول محددة لكن النص قد يكون وقتاً أو منطقة، نحاول ملأ الحقول الناقصة
      if (!hasLabels && !payload.noteTime && payload.price && payload.type && payload.phone) {
        // قد يكون هذا وقتاً - خاصة إذا كنا ننتظر الوقت
        if (payload._askingForTime) {
          payload.noteTime = text;
          delete payload._askingForTime;
          delete payload._lastUserInput;
        } else {
          payload.noteTime = text;
        }
      }
    }

    await prisma.telegramBotSession.update({
      where: { telegramUserId },
      data: { payload: JSON.stringify(payload) }
    });

    await processParsedOrder(chatId, telegramUserId, payload, botToken);
    return true;
  }

  return false;
}

function parseOrderText(text: string) {
  const normalized = normalizeNumerals(text);
  const lines = normalized.split("\n").map(l => l.trim()).filter(l => l !== "");
  const result: any = {};

  for (const line of lines) {
    const parts = line.split(/[:=]/); // support : or =
    if (parts.length > 1) {
      const key = parts[0].trim();
      const value = parts.slice(1).join(":").trim();

      if (key.includes("نوع") || key.includes("طلب")) result.type = value;
      if (key.includes("سعر") || key.includes("مبلغ")) {
        const priceMatch = value.match(/\d+(\.\d+)?/);
        if (priceMatch) result.price = priceMatch[0];
      }
      if (key.includes("منطقة") || key.includes("عنوان") || key.includes("مكان")) result.regionName = value;
      if (key.includes("رقم") || key.includes("هاتف") || key.includes("موبايل")) {
        const phoneMatch = value.match(/07[789]\d{8}/);
        if (phoneMatch) result.phone = phoneMatch[0];
      }
      if (key.includes("وقت") || key.includes("ساعة") || key.includes("متى") || key.includes("شوكت") || key.includes("ايمتى")) {
        result.noteTime = value;
      }
    }
  }

  // Fallback: search anywhere if fields are still missing
  if (!result.phone) {
    const phoneMatch = normalized.match(/(?:964|0)?7[789]\d{8,11}/);
    if (phoneMatch) result.phone = phoneMatch[0];
  }
  if (!result.price) {
    const prices = normalized.match(/\b\d+(\.\d+)?\b/g);
    if (prices) {
      for (const p of prices) {
        // Price is usually shorter than a phone number
        if (p !== result.phone && p.length < 7) {
          result.price = p;
          break;
        }
      }
    }
  }

  // إذا كان هناك 5 أسطر على الأقل، نعتبر الأخير هو الوقت إذا لم يتم تحديده مسبقاً
  if (lines.length >= 5 && !result.noteTime) {
    const last = lines[lines.length - 1];
    if (last !== result.phone && last !== result.price && last !== result.regionName && last !== result.type) {
      result.noteTime = last;
    }
  }

  if (!result.regionName || !result.type) {
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.includes(":") || t.includes("=")) continue;
      if (t === result.phone || t === result.price || t === result.noteTime) continue;

      if (!result.type) {
        result.type = t;
      } else if (!result.regionName) {
        result.regionName = t;
      }
    }
  }

  return result;
}

async function processParsedOrder(chatId: string, telegramUserId: string, payload: any, botToken: string) {
  const { sendTelegramHtmlToChat, sendTelegramMessageWithKeyboardToChat } = await import("./telegram");

  // 1. التحقق من السعر
  if (!payload.price) {
    await sendTelegramHtmlToChat(chatId, "⚠️ يرجى تزويدنا <b>بسعر الطلب</b> (بالآلاف، مثلاً 15 أو 22.5):", botToken);
    return;
  }

  // 2. التحقق من النوع
  if (!payload.type) {
    await sendTelegramHtmlToChat(chatId, "⚠️ يرجى تزويدنا <b>بنوع الطلب</b> (مثلاً: وجبة، غسالة، إلخ):", botToken);
    return;
  }

  // 3. التحقق من الرقم
  if (!payload.phone) {
    await sendTelegramHtmlToChat(chatId, "⚠️ يرجى تزويدنا <b>برقم هاتف الزبون</b> (07...):", botToken);
    return;
  }

  // 4. التحقق من الوقت (جديد)
  if (!payload.noteTime) {
    // ضع علامة بأننا طلبنا الوقت
    payload._askingForTime = true;
    await prisma.telegramBotSession.update({
      where: { telegramUserId },
      data: { payload: JSON.stringify(payload) }
    });
    await sendTelegramHtmlToChat(chatId, "⚠️ <b>شوكت تحب يجيك المندوب؟</b>\n(مثلاً: هسة، العصر، بـ 6 مساءً):", botToken);
    return;
  }

  // 5. التحقق من المنطقة
  if (!payload.regionId) {
    if (!payload.regionName) {
      await sendTelegramHtmlToChat(chatId, "⚠️ يرجى تزويدنا <b>بمنطقة الزبون</b>:", botToken);
      return;
    }

    // البحث عن المناطق التي تطابق الاسم
    const regions = await prisma.region.findMany();
    const searchName = payload.regionName.trim();

    // البحث عن تطابق تام أولاً
    const exactMatch = regions.find(r => r.name === searchName);

    // البحث عن تطابقات جزئية (إذا كتب "جيكور" يجد كل الجيكورات)
    const allMatches = regions.filter(r =>
      r.name === searchName ||
      r.name.includes(searchName) ||
      searchName.includes(r.name)
    );

    if (exactMatch && allMatches.length === 1) {
      payload.regionId = exactMatch.id;
      await prisma.telegramBotSession.update({
        where: { telegramUserId },
        data: { payload: JSON.stringify(payload) }
      });
      // استمرار المعالجة لعرض رسالة التأكيد مباشرة
    } else if (allMatches.length > 0) {
      // إذا وجد أكثر من منطقة (مثل جيكور حزبة 1 و 2) نعرض خيارات
      const kb = {
        inline_keyboard: allMatches.slice(0, 8).map(r => [{ text: r.name, callback_data: `reg_sel:${r.id}` }])
      };
      await sendTelegramMessageWithKeyboardToChat(chatId, `وجدت عدة مناطق باسم "${searchName}". يرجى اختيار المنطقة الصحيحة:`, kb, botToken);
      return;
    } else {
      // البحث عن كلمات مشابهة
      const suggestions = regions.filter(r =>
        r.name.split(" ").some(word => word.length > 2 && searchName.includes(word))
      ).slice(0, 5);

      if (suggestions.length > 0) {
        const kb = {
          inline_keyboard: suggestions.map(r => [{ text: r.name, callback_data: `reg_sel:${r.id}` }])
        };
        await sendTelegramMessageWithKeyboardToChat(chatId, `لم أتعرف بدقة على المنطقة "${searchName}". هل تقصد إحدى هذه؟`, kb, botToken);
      } else {
        await sendTelegramHtmlToChat(chatId, `عذراً، لم أجد منطقة باسم "${searchName}". يرجى كتابة اسم المنطقة بشكل أوضح أو منطقة قريبة منها:`, botToken);
      }
      return;
    }
  }

  // إذا اكتملت البيانات، نعرض التأكيد
  if (payload.type && payload.price && payload.regionId && payload.phone && payload.noteTime) {
    const region = await prisma.region.findUnique({ where: { id: payload.regionId } });
    const subtotal = new Decimal(payload.price);
    const delivery = region?.deliveryPrice || new Decimal(0);
    const total = subtotal.plus(delivery);

    const confirmText = `<b>تأكيد الطلب:</b>\n\n` +
      `📦 النوع: ${payload.type}\n` +
      `💵 السعر: ${formatDinarAsAlf(subtotal)} الف\n` +
      `📍 المنطقة: ${region?.name}\n` +
      `📞 الزبون: ${payload.phone}\n` +
      `⏰ الوقت: ${payload.noteTime}\n` +
      `🚚 التوصيل: ${formatDinarAsAlf(delivery)} الف\n` +
      `💰 الإجمالي: ${formatDinarAsAlf(total)} الف\n\n` +
      `هل البيانات صحيحة؟`;

    const kb = {
      inline_keyboard: [
        [{ text: "✅ نعم، حفظ الطلب", callback_data: "confirm_order" }],
        [{ text: "❌ إلغاء", callback_data: "cancel_order" }]
      ]
    };

    await sendTelegramMessageWithKeyboardToChat(chatId, confirmText, kb, botToken);
  }
}
