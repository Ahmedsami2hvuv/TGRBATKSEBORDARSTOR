import { prisma } from "./prisma";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { findMatchingLearnedRule, compileAndSaveNewIntent } from "./ai-intent-compiler";
import { executeAutonomousGeminiAgent } from "./ai-autonomous-agent";
import { handleOrderCreationWizard, OrderDraftState, calculateSimilarity } from "./ai-order-wizard";
import { getCachedShops, getCachedRegions, getCachedCouriers } from "./ai-data-cache";

type ChatSessionContext = {
  lastOrderNumber?: number | null;
  lastOrderType?: string | null;
  activeFocusedOrderId?: string | null;
  orderDraft?: OrderDraftState | null;
  waitingForCarHours?: boolean | null;
  updatedAt?: number;
};

// ذاكرة سياق منفصلة لكل محادثة/أدمن بدالة Map
const chatSessionContexts: Map<string, ChatSessionContext> = new Map();

function getSessionContext(sessionKey: string): ChatSessionContext {
  if (!chatSessionContexts.has(sessionKey)) {
    chatSessionContexts.set(sessionKey, {});
  }
  return chatSessionContexts.get(sessionKey)!;
}

/**
 * جلب سياق المحادثة الدائم من قاعدة البيانات سوبابيس (لضمان الاستمرارية عبر كل خوادم Vercel Serverless)
 */
export async function getPersistentSessionContext(sessionKey: string): Promise<ChatSessionContext> {
  const localCtx = getSessionContext(sessionKey);
  try {
    const row = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: {
          target: "ai_chat_session",
          section: sessionKey
        }
      }
    });
    if (row && row.config && typeof row.config === "object") {
      const dbConfig = row.config as ChatSessionContext;
      // إذا كان وقت تحديث قاعدة البيانات أحدث من الذاكرة المحلية أو الذاكرة المحلية فارغة
      if (!localCtx.updatedAt || (dbConfig.updatedAt && dbConfig.updatedAt >= localCtx.updatedAt)) {
        Object.assign(localCtx, dbConfig);
      }
    }
  } catch (e) {}
  return localCtx;
}

/**
 * حفظ سياق المحادثة الدائم في قاعدة البيانات سوبابيس
 */
export async function savePersistentSessionContext(sessionKey: string, ctx: ChatSessionContext) {
  try {
    ctx.updatedAt = Date.now();
    const localCtx = getSessionContext(sessionKey);
    Object.assign(localCtx, ctx);

    await prisma.uISystemSetting.upsert({
      where: {
        target_section: {
          target: "ai_chat_session",
          section: sessionKey
        }
      },
      update: {
        config: ctx as any,
        updatedAt: new Date()
      },
      create: {
        target: "ai_chat_session",
        section: sessionKey,
        config: ctx as any
      }
    });
  } catch (e) {}
}

/**
 * تصفير وإعادة ضبط ذاكرة سياق محادثة معينة بـ sessionKey أو تصفير الكل
 */
export async function resetChatSessionContext(sessionKey?: string) {
  if (sessionKey) {
    chatSessionContexts.delete(sessionKey);
  } else {
    chatSessionContexts.clear();
  }
  chatSessionContexts.delete("default");
  chatSessionContexts.delete("voice_admin");
  chatSessionContexts.delete("android_power_button_admin");
  chatSessionContexts.delete("web_admin_floating_widget");

  // حذفها أيضاً بشكل قاطع من قاعدة البيانات
  try {
    if (sessionKey) {
      await prisma.uISystemSetting.deleteMany({
        where: {
          target: "ai_chat_session",
          section: { in: [sessionKey, "default", "voice_admin", "web_admin_floating_widget", "android_power_button_admin"] }
        }
      });
    } else {
      await prisma.uISystemSetting.deleteMany({
        where: {
          target: "ai_chat_session"
        }
      });
    }
  } catch (e) {}
}

/**
 * تعيين وتحديث الطلب النشط المفتوح حالياً بمحادثة معينة
 */
export async function setActiveFocusedOrder(sessionKeyOrOrderId: string | number, possibleOrderId?: string | number) {
  let sessionKey = "default";
  let orderIdOrNumber: string | number;

  if (possibleOrderId !== undefined) {
    sessionKey = String(sessionKeyOrOrderId);
    orderIdOrNumber = possibleOrderId;
  } else {
    orderIdOrNumber = sessionKeyOrOrderId;
  }

  const ctx = await getPersistentSessionContext(sessionKey);
  if (typeof orderIdOrNumber === "number") {
    ctx.lastOrderNumber = orderIdOrNumber;
  } else {
    ctx.activeFocusedOrderId = String(orderIdOrNumber);
  }
  ctx.updatedAt = Date.now();
  await savePersistentSessionContext(sessionKey, ctx);
}

/**
 * محرك الذكاء الاصطناعي المصحح والمصمّم الذاتي (Self-Correcting LLM Intent Engine)
 * يفهم القصد من كلام أبو الأكبر التلقائي، يعيد صياغته فوراً بـ 0 ميلي ثانية وينفذه بالداتابيز
 */
function parseCustomSystemIntent(userText: string): any {
  if (!userText) return { category: "general_qa" };
  const text = userText.trim();
  const normalizedText = text
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟]/g, "")
    .trim();

  const cleanQ = normalizedText.toLowerCase();
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0] ? lines[0].toLowerCase() : cleanQ;

  // 0.005 أرشفة جماعية لطلبات المندوبين المسلمة أو المكتملة
  const isArchiveCommand =
    cleanQ.includes("ارشف") ||
    cleanQ.includes("أرشف") ||
    cleanQ.includes("ارشفه") ||
    cleanQ.includes("أرشفة") ||
    cleanQ.includes("ارشيف") ||
    cleanQ.includes("أرشيف") ||
    cleanQ.includes("للارشيف") ||
    cleanQ.includes("للأرشيف") ||
    cleanQ.includes("بالارشيف") ||
    cleanQ.includes("بالأرشيف") ||
    cleanQ.includes("صفّي") ||
    cleanQ.includes("صفي") ||
    cleanQ.includes("تؤرشف") ||
    cleanQ.includes("تأرشف") ||
    (cleanQ.includes("ذبه") && (cleanQ.includes("ارشيف") || cleanQ.includes("أرشيف")));

  if (isArchiveCommand) {
    let status = "completed";
    if (cleanQ.includes("مرفوض")) status = "rejected";
    else if (cleanQ.includes("مسلم") || cleanQ.includes("مسلمه") || cleanQ.includes("مسلمة") || cleanQ.includes("مسلمات") || cleanQ.includes("المسلمات") || cleanQ.includes("المسلم") || cleanQ.includes("مكتمل") || cleanQ.includes("مكتملة") || cleanQ.includes("مكتمله") || cleanQ.includes("المكتملة") || cleanQ.includes("واصل") || cleanQ.includes("واصلة") || cleanQ.includes("الواصلة") || cleanQ.includes("تسلمت") || cleanQ.includes("التسلمت")) {
      status = "completed";
    }

    return {
      category: "orders_bulk_archive",
      status: status,
      raw_text: text
    };
  }

  // 0.006 استعلام القواعد المبرمجة والمتعلمة في سوبابيس
  if (
    cleanQ.includes("سوبابيس") ||
    cleanQ.includes("سوبا بيس") ||
    cleanQ.includes("القواعد المبرمجه") ||
    cleanQ.includes("القواعد المبرمجة") ||
    cleanQ.includes("الاوامر المبرمجه") ||
    cleanQ.includes("الاوامر المبرمجة") ||
    cleanQ.includes("القواعد بسوبابيس") ||
    cleanQ.includes("الاوامر بسوبابيس") ||
    cleanQ.includes("اوامر سوبابيس") ||
    cleanQ.includes("قواعد سوبابيس") ||
    cleanQ.includes("شلون اتاكد") ||
    cleanQ.includes("شلون اتأكد") ||
    cleanQ.includes("شنو مبرمج") ||
    cleanQ.includes("شنو تعلمت")
  ) {
    return { category: "get_learned_rules_list" };
  }

  // 0.01 التحايا والسوالف والترحيب
  if (
    cleanQ === "شلونك" ||
    cleanQ === "شلونك شو اخبارك" ||
    cleanQ === "شلونك شو أخبارك" ||
    cleanQ === "شخبارك" ||
    cleanQ.includes("شلونك") ||
    cleanQ.includes("شخبارك") ||
    cleanQ.includes("شو اخبارك") ||
    cleanQ.includes("شو أخبارك") ||
    cleanQ === "مرحبا" ||
    cleanQ === "هلا" ||
    cleanQ === "السلام عليكم" ||
    cleanQ === "سلام عليكم" ||
    cleanQ === "صباح الخير" ||
    cleanQ === "مساء الخير" ||
    cleanQ.includes("الحمد لله شلونك") ||
    cleanQ.includes("الحمدلله شلونك")
  ) {
    return { category: "friendly_greeting" };
  }

  // 0.02 فئة رفض أو إلغاء الطلب الصريحة (مثل: طلب رقم 2070 سوي له رفض / ارفض طلب 2070 / سوي رفض / ارفض الطلب)
  if (
    cleanQ.includes("سوي له رفض") ||
    cleanQ.includes("سوي رفض") ||
    cleanQ.includes("سوي له الغاء") ||
    cleanQ.includes("سوي الغاء") ||
    cleanQ.includes("سوي مرفوض") ||
    cleanQ.includes("سوي الطلب مرفوض") ||
    cleanQ.includes("ارفض") ||
    cleanQ.includes("رفض") ||
    cleanQ.includes("مرفوض") ||
    cleanQ.includes("الغي") ||
    cleanQ.includes("إلغاء") ||
    cleanQ.includes("الغاء") ||
    cleanQ.includes("طير الطلب") ||
    cleanQ.includes("طيره")
  ) {
    const validOrderNums = (text.match(/\b\d{3,5}\b/g) || [])
      .map(Number)
      .filter(n => !n.toString().startsWith("07") && !n.toString().startsWith("77"));
    const orderNum = validOrderNums.length > 0 ? validOrderNums[0] : null;

    let shopMatch = text.match(/(?:طلب|محل)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:سوي|ارفض|رفض|الغي|ملغي|طير)|$)/i);
    let shopName = shopMatch ? shopMatch[1].trim() : null;

    return {
      category: "order_cancel_or_reject",
      order_number: orderNum,
      shop_name: shopName,
      raw_text: text
    };
  }

  // 0.0 فئة الملخص والتقرير اليومي للأرباح والطلبات
  if (
    cleanQ.includes("انطيني ملخص اليوم") ||
    cleanQ.includes("ملخص اليوم") ||
    cleanQ.includes("تقرير اليوم") ||
    cleanQ.includes("شكد ارباحنا اليوم") ||
    cleanQ.includes("شكد أرباحنا اليوم") ||
    cleanQ.includes("ارباح اليوم") ||
    cleanQ.includes("أرباح اليوم") ||
    cleanQ.includes("ملخص طلبات اليوم") ||
    cleanQ.includes("تقرير الارباح") ||
    cleanQ.includes("تقرير الأرباح")
  ) {
    return { category: "daily_summary_report" };
  }

  // 0.03 فئة عرض واستعلام الطلبات الجديدة (مثل: الطلبات الجديده / اريد اعرف الطلبات الجديده)
  if (
    cleanQ.includes("الطلبات الجديده") ||
    cleanQ.includes("الطلبات الجديدة") ||
    cleanQ.includes("طلبات جديدة") ||
    cleanQ.includes("طلبات جديده") ||
    cleanQ.includes("عرض الطلبات الجديدة") ||
    cleanQ.includes("شكو طلبات جديدة") ||
    cleanQ.includes("شكو طلبات جديده")
  ) {
    return { category: "pending_orders_list" };
  }

  // 0.04 فئة تفاصيل أحدث/آخر طلب مسجل بالنظام كلياً
  if (
    cleanQ.includes("اخر طلب") ||
    cleanQ.includes("أخر طلب") ||
    cleanQ.includes("اخر طلب دخل") ||
    cleanQ.includes("شنو اخر طلب") ||
    cleanQ.includes("انطيني اخر طلب") ||
    cleanQ.includes("عرض اخر طلب")
  ) {
    return { category: "last_order_details" };
  }

  // 0.05 أسبقية إنشاء طلب مبيعات صريحة (مثل: سوي لي طلب / سوي طلب جديد / ضيف طلب)
  if (
    cleanQ.includes("سوي لي طلب") ||
    cleanQ.includes("سوي طلب") ||
    cleanQ.includes("سويلي طلب") ||
    cleanQ.includes("طلب جديد") ||
    cleanQ.includes("ضيف طلب") ||
    cleanQ.includes("ضيفلي طلب") ||
    cleanQ.includes("انشئ طلب") ||
    cleanQ.includes("انشئ لي طلب")
  ) {
    let phoneMatch = text.match(/(?:07\d{9}|07\d{2}\s*\d{7,8}|\d{10,11})/);
    let phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : null;

    return {
      category: "order_create",
      raw_query: text,
      phone: phone
    };
  }

  // 0.05 استعلام واستعراض الطلبات المسندة للمندوبين
  if (
    (cleanQ.includes("طلبات") || cleanQ.includes("اوردرات") || cleanQ.includes("طلبيات") || cleanQ.includes("شنو") || cleanQ.includes("عرض") || cleanQ.includes("استعرض") || cleanQ.includes("قائمة")) &&
    (cleanQ.includes("مسنده") || cleanQ.includes("مسندة") || cleanQ.includes("المسنده") || cleanQ.includes("المسندة") || cleanQ.includes("عند المندوب") || cleanQ.includes("عند المندوبين")) &&
    !cleanQ.includes("اسند") && !cleanQ.includes("حول")
  ) {
    let courierMatch = text.match(/(?:للمندوب|للمنجوب|للكابتن|عند المندوب|عند الكابتن|المندوب|كابتن)\s*([أ-يa-zA-Z\s]+?)$/i);
    let courierName = courierMatch ? courierMatch[1].trim() : null;
    return {
      category: "orders_assigned_list",
      courier_name: courierName,
      raw_text: text
    };
  }

  // 0.1 فئة الإسناد الصريح المباشر للطلبات
  const isExplicitAssignCommand =
    (cleanQ.includes("اسند") ||
      cleanQ.includes("إسناد") ||
      cleanQ.includes("اسناد") ||
      cleanQ.includes("سوي له اسناد") ||
      cleanQ.includes("سوي اسناد") ||
      cleanQ.includes("سوي لي اسناد") ||
      cleanQ.includes("حول الطلب") ||
      cleanQ.includes("حول طلب")) &&
    !cleanQ.includes("شنو") &&
    !cleanQ.includes("ماهي") &&
    !cleanQ.includes("عرض") &&
    !cleanQ.includes("استعرض") &&
    !cleanQ.includes("صفر") &&
    !cleanQ.includes("تصفير") &&
    !cleanQ.includes("حساب");

  if (isExplicitAssignCommand) {
    let courierMatch = text.match(/(?:للمندوب|للمنجوب|إلى المندوب|الي المندوب|المندوب|كابتن|لكابتن|إلى|الي|لـ|ل)\s*([أ-يa-zA-Z\s]+?)$/i);
    let courierName = courierMatch ? courierMatch[1].trim() : null;

    let status = "pending";
    if (cleanQ.includes("مرفوض") || cleanQ.includes("ملغي")) status = "rejected";
    else if (cleanQ.includes("جديد") || cleanQ.includes("جديدة") || cleanQ.includes("جديده") || cleanQ.includes("الجديد")) status = "pending";
    else if (cleanQ.includes("معلق")) status = "pending";

    let searchQuery = text
      .replace(/طلب|بحالة|بحاله|جديدة|جديده|الجديد|جديد|معلق|مرفوض|ملغي|سوي|لي|له|اسناد|إسناد|اسند|للمندوب|للمنجوب|إلى|الي|المندوب|كابتن|لكابتن/gi, "")
      .trim();

    return {
      category: "dynamic_assign_order",
      courier_name: courierName,
      target_status: status,
      search_query: searchQuery,
      raw_text: text
    };
  }

  // 0.15 إلغاء إسناد طلب أو إرجاعه لحالة جديد صريحة
  if (
    cleanQ.includes("الغي الاسناد") ||
    cleanQ.includes("الغي الإسناد") ||
    cleanQ.includes("إلغاء الاسناد") ||
    cleanQ.includes("إلغاء الإسناد") ||
    cleanQ.includes("الغاء الاسناد") ||
    cleanQ.includes("الغاء الإسناد") ||
    cleanQ.includes("ارجاع للحاله") ||
    cleanQ.includes("ارجاع للحالة") ||
    cleanQ.includes("حتى يصير جديد") ||
    cleanQ.includes("سوي جديد") ||
    cleanQ.includes("رجعه جديد")
  ) {
    const validOrderNums = (text.match(/\b\d{3,5}\b/g) || [])
      .map(Number)
      .filter(n => !n.toString().startsWith("07") && !n.toString().startsWith("77"));
    const orderNum = validOrderNums.length > 0 ? validOrderNums[0] : null;

    let shopMatch = text.match(/(?:طلب|محل)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:المسند|للمندوب|سوي|ارجاع|الغي|حتى)|$)/i);
    let shopName = shopMatch ? shopMatch[1].trim() : null;

    return {
      category: "order_unassign",
      order_number: orderNum,
      shop_name: shopName,
      raw_text: text
    };
  }

  // 0.2 إخفاء المندوب
  if (
    cleanQ.includes("اخفي لي المندوب") ||
    cleanQ.includes("اخفي المندوب") ||
    cleanQ.includes("اخفي لي كابتن") ||
    cleanQ.includes("اخفي كابتن") ||
    (cleanQ.includes("اخفي") && (cleanQ.includes("مندوب") || cleanQ.includes("كابتن")))
  ) {
    let cleanName = text
      .replace(/اخفي لي المندوب|اخفي المندوب|اخفي لي كابتن|اخفي كابتن|اخفي لي|اخفي|مندوب|كابتن|المندوب|الكابتن/gi, "")
      .trim();

    return {
      category: "courier_hide",
      clean_name: cleanName || null
    };
  }

  // 0.3 إظهار المندوب
  if (
    cleanQ.includes("اظهر لي المندوب") ||
    cleanQ.includes("اظهر المندوب") ||
    cleanQ.includes("اظهر لي كابتن") ||
    cleanQ.includes("اظهر كابتن") ||
    (cleanQ.includes("اظهر") && (cleanQ.includes("مندوب") || cleanQ.includes("كابتن")))
  ) {
    let cleanName = text
      .replace(/اظهر لي المندوب|اظهر المندوب|اظهر لي كابتن|اظهر كابتن|اظهر لي|اظهر|مندوب|كابتن|المندوب|الكابتن/gi, "")
      .trim();

    return {
      category: "courier_unhide",
      clean_name: cleanName || null
    };
  }

  // 0.35 عرض تفاصيل طلب محدد صريح بالرقم (فقط في حال الاستعلام الصريح)
  const hasActionVerb =
    cleanQ.includes("رفض") ||
    cleanQ.includes("ارفض") ||
    cleanQ.includes("مرفوض") ||
    cleanQ.includes("الغي") ||
    cleanQ.includes("الغاء") ||
    cleanQ.includes("إلغاء") ||
    cleanQ.includes("عدل") ||
    cleanQ.includes("تعديل") ||
    cleanQ.includes("اسند") ||
    cleanQ.includes("اسناد") ||
    cleanQ.includes("ارشف") ||
    cleanQ.includes("سوي جديد") ||
    cleanQ.includes("طير");

  if (
    !hasActionVerb &&
    (cleanQ.includes("تفاصيل طلب") ||
      cleanQ.includes("شوفلي طلب") ||
      cleanQ.includes("شوف طلب") ||
      cleanQ.includes("عرض طلب") ||
      cleanQ.startsWith("طلب ") ||
      cleanQ.includes("تفاصيل الطلب"))
  ) {
    const orderNumMatch = text.match(/\b\d{3,5}\b/);
    const orderNum = orderNumMatch ? Number(orderNumMatch[0]) : null;

    if (orderNum) {
      return {
        category: "order_details",
        order_number: orderNum
      };
    }
  }

  // 0.38 تعديل وتصحيح اسم المندوب أو الكابتن
  if (
    (cleanQ.includes("مندوب") || cleanQ.includes("كابتن") || cleanQ.includes("المندوب") || cleanQ.includes("الكابتن") || cleanQ.includes("اسمه") || cleanQ.includes("إسمه")) &&
    (cleanQ.includes("عدل") || cleanQ.includes("تعديل") || cleanQ.includes("غير") || cleanQ.includes("بدل") || cleanQ.includes("صحح") || cleanQ.includes("سويه") || cleanQ.includes("اكتبه") || cleanQ.includes("خطأ") || cleanQ.includes("خطا"))
  ) {
    let oldName = null;
    let newName = null;

    const oldMatch = text.match(/(?:المندوب|كابتن|لكابتن)\s*([أ-يa-zA-Z]+)/i);
    if (oldMatch) oldName = oldMatch[1].trim();

    const newMatch = text.match(/(?:وسويه|سويه|سوي|اكتبه|غيره إلى|غيره الي|الى|الي)\s*([أ-يa-zA-Z]+)/i);
    if (newMatch) newName = newMatch[1].trim();

    return {
      category: "courier_update_name",
      old_name: oldName,
      new_name: newName,
      raw_text: text
    };
  }

  // 0.4 تعديل تفاصيل الطلب النشط المفتوح حالياً
  const hasEditFieldWord = cleanQ.includes("سعر") || cleanQ.includes("رقم") || cleanQ.includes("منطقه") || cleanQ.includes("منطقة") || cleanQ.includes("توصيل") || cleanQ.includes("تعديل") || cleanQ.includes("نوع") || cleanQ.includes("النوع");
  if (
    !cleanQ.includes("مندوب") &&
    !cleanQ.includes("كابتن") &&
    (cleanQ.includes("عدل") ||
      cleanQ.includes("تعديل") ||
      cleanQ.includes("سوي تعديل") ||
      cleanQ.includes("نوع الطلب") ||
      cleanQ.includes("عدل نوع") ||
      cleanQ.includes("غير نوع") ||
      cleanQ.includes("بدل نوع") ||
      cleanQ.includes("سوي النوع") ||
      cleanQ.includes("سوي نوع") ||
      cleanQ.includes("سوي المنطقة") ||
      cleanQ.includes("سوي المنطقه") ||
      cleanQ.includes("عدل الرقم") ||
      cleanQ.includes("عدل السعر") ||
      cleanQ.includes("عدل سعر") ||
      cleanQ.includes("عدل سعر التوصيل") ||
      cleanQ.includes("عدل المنطقة") ||
      cleanQ.includes("عدل المنطقه") ||
      (cleanQ.includes("بدل") && hasEditFieldWord) ||
      cleanQ.includes("غير السعر") ||
      cleanQ.includes("غير الرقم") ||
      cleanQ.includes("غير المنطقة"))
  ) {
    const explicitOrderMatch = text.match(/(?:رقم|#)\s*#?\s*(\d{2,6})/);
    const explicitOrderNum = explicitOrderMatch ? Number(explicitOrderMatch[1]) : null;

    let fieldToEdit = "subtotal";
    if (cleanQ.includes("نوع") || cleanQ.includes("النوع")) fieldToEdit = "order_type";
    else if ((cleanQ.includes("رقم") || cleanQ.includes("هاتف")) && !cleanQ.includes("سعر")) fieldToEdit = "phone";
    else if (cleanQ.includes("سعر التوصيل") || cleanQ.includes("توصيل")) fieldToEdit = "delivery_price";
    else if (cleanQ.includes("منطقه") || cleanQ.includes("منطقة") || cleanQ.includes("المنطقه") || cleanQ.includes("المنطقة")) fieldToEdit = "region";
    else if (cleanQ.includes("سعر")) fieldToEdit = "subtotal";

    const allNums = (text.match(/\d+/g) || []).map(Number).filter(n => !n.toString().startsWith("77"));
    const valueCandidates = explicitOrderNum !== null ? allNums.filter(n => n !== explicitOrderNum) : allNums;
    const newVal = valueCandidates.length > 0 ? valueCandidates[valueCandidates.length - 1] : null;

    return {
      category: "focused_order_edit",
      explicit_order_number: explicitOrderNum,
      field: fieldToEdit,
      raw_text: text,
      number_val: newVal
    };
  }

  // 0.5 استعلام آخر طلب مرفوض أو ملغي
  if (
    cleanQ.includes("اخر طلب مرفوض") ||
    cleanQ.includes("اخر طلب ملغي") ||
    cleanQ.includes("طلب مرفوض") ||
    cleanQ.includes("طلب ملغي") ||
    cleanQ.includes("تفاصيل اخر طلب مرفوض") ||
    cleanQ.includes("تفاصيل اخر طلب ملغي") ||
    cleanQ.includes("انطيني تفاصيل اخر طلب مرفوض") ||
    cleanQ.includes("انطيني تفاصيل اخر طلب ملغي") ||
    cleanQ.includes("الطلب المرفوض") ||
    cleanQ.includes("الطلب الملغي")
  ) {
    return { category: "last_rejected_order" };
  }

  // 0.60 الالتقاط التلقائي الشامل لأي رقم طلب ومعه أي لفظ حالة (مثل: طلب رقم 2054 سوي مرفوض / طلب 2042 حوله إلى مرفوض / 2042 مرفوض)
  const validOrderNums = (text.match(/\b\d{3,5}\b/g) || [])
    .map(Number)
    .filter(n => !n.toString().startsWith("07") && !n.toString().startsWith("77") && !n.toString().startsWith("773"));
  const orderNumGeneral = validOrderNums.length > 0 ? validOrderNums[0] : null;

  if (
    orderNumGeneral &&
    (cleanQ.includes("مرفوض") ||
      cleanQ.includes("ملغي") ||
      cleanQ.includes("إلغاء") ||
      cleanQ.includes("الغاء") ||
      cleanQ.includes("رفض") ||
      cleanQ.includes("طير") ||
      cleanQ.includes("مسلم") ||
      cleanQ.includes("تسليم") ||
      cleanQ.includes("مكتمل") ||
      cleanQ.includes("مستلم") ||
      cleanQ.includes("استلام") ||
      cleanQ.includes("واصل") ||
      cleanQ.includes("مؤرشف") ||
      cleanQ.includes("ارشيف") ||
      cleanQ.includes("أرشيف") ||
      cleanQ.includes("مسند") ||
      cleanQ.includes("إسناد") ||
      cleanQ.includes("اسناد") ||
      cleanQ.includes("جديد") ||
      cleanQ.includes("معلق"))
  ) {
    let targetStatus = "rejected";
    if (cleanQ.includes("مرفوض") || cleanQ.includes("ملغي") || cleanQ.includes("إلغاء") || cleanQ.includes("الغاء") || cleanQ.includes("رفض") || cleanQ.includes("طير")) targetStatus = "rejected";
    else if (cleanQ.includes("مسلم") || cleanQ.includes("تسليم") || cleanQ.includes("مكتمل")) targetStatus = "completed";
    else if (cleanQ.includes("مستلم") || cleanQ.includes("استلام") || cleanQ.includes("واصل")) targetStatus = "delivered";
    else if (cleanQ.includes("مؤرشف") || cleanQ.includes("ارشيف") || cleanQ.includes("أرشيف")) targetStatus = "archived";
    else if (cleanQ.includes("مسند") || cleanQ.includes("إسناد") || cleanQ.includes("اسناد")) targetStatus = "assigned";
    else if (cleanQ.includes("جديد") || cleanQ.includes("معلق")) targetStatus = "pending";

    return {
      category: "order_single_status_change",
      order_number: orderNumGeneral,
      target_status: targetStatus
    };
  }

  // 0.61 أسئلة التعريف والترحيب العامة (مثل: من أنت، مين انت)
  if (cleanQ.includes("من انت") || cleanQ.includes("من انت") || cleanQ.includes("مين انت") || cleanQ.includes("شنو انت")) {
    return { category: "who_are_you" };
  }

  // 1. التحديث الجماعي لحالات طلبات محلات أو مندوبين معينين
  if (
    cleanQ.includes("سويهن") ||
    cleanQ.includes("سوي كل") ||
    cleanQ.includes("غير كل") ||
    (cleanQ.includes("طلبات") && (cleanQ.includes("تم الاستلام") || cleanQ.includes("مكتمل") || cleanQ.includes("واصل") || cleanQ.includes("مرفوض") || cleanQ.includes("مسند")))
  ) {
    let targetStatus = "delivered";
    if (cleanQ.includes("تم الاستلام") || cleanQ.includes("واصل")) targetStatus = "delivered";
    else if (cleanQ.includes("مكتمل") || cleanQ.includes("مكتملة")) targetStatus = "completed";
    else if (cleanQ.includes("مرفوض") || cleanQ.includes("مرفوضة")) targetStatus = "rejected";
    else if (cleanQ.includes("جديد") || cleanQ.includes("جديدة") || cleanQ.includes("معلق")) targetStatus = "pending";
    else if (cleanQ.includes("مسند") || cleanQ.includes("بانتظار")) targetStatus = "assigned";

    let courierMatch = text.match(/(?:مندوب|المندوب|كابتن|الكابتن)\s*([أ-يa-zA-Z\s]+?)(?=\s*(?:اللي|الي|سويهن|سويها|كلها|كلهن)|$)/i);
    let courierName = courierMatch ? courierMatch[1].trim() : null;

    let shopMatch = text.match(/(?:محل|المحل|طلبات محل)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:اللي|الي|سويهن|سويها|كلها|كلهن)|$)/i);
    let shopName = shopMatch ? shopMatch[1].trim() : null;

    return {
      category: "bulk_order_status_update",
      target_status: targetStatus,
      courier_name: courierName,
      shop_name: shopName
    };
  }

  // 2. طلب تجهيز ومشتريات صريح
  const knownRegions = ["جيكور", "شيخ ابراهيم", "الخصيب", "حمدان", "السراجي", "مهيجران", "ابو الخصيب", "الفاو", "القرنة", "الهارثة", "الزبير"];
  const isStartsWithRegion = knownRegions.some(r => firstLine.includes(r) || cleanQ.startsWith(r));
  const hasExplicitShop = cleanQ.includes("محل") || cleanQ.includes("لوازم") || cleanQ.includes("الكوثر");

  if ((isStartsWithRegion && !hasExplicitShop) || cleanQ.includes("تجهيز") || cleanQ.includes("مسودة") || cleanQ.includes("مشتريات")) {
    return {
      category: "prep_draft",
      raw_query: text
    };
  }

  // 3. إسناد وتعديل الطلبات للمندوبين
  if (
    cleanQ.includes("إسناد") ||
    cleanQ.includes("اسناد") ||
    cleanQ.includes("الاسناد") ||
    cleanQ.includes("الإسناد") ||
    cleanQ.includes("اسند") ||
    cleanQ.includes("حول الطلب") ||
    cleanQ.includes("حوله على") ||
    cleanQ.includes("غير المندوب") ||
    cleanQ.includes("لكابتن") ||
    cleanQ.includes("كابتن")
  ) {
    const orderNumMatch = text.match(/(?:رقم|#)\s*#?\s*(\d{2,6})/) || text.match(/\b\d{3,5}\b/);
    const orderNum = orderNumMatch ? Number(orderNumMatch[1] ?? orderNumMatch[0]) : null;

    let courierName = text
      .replace(/.*إسناد إلى|.*إسناد الي|.*الاسناد إلى|.*الاسناد الي|.*الإسناد إلى|.*الإسناد الي|.*اسناد إلى|.*اسناد الي|.*اسند لـ|.*اسند إلى|.*حول إلى|.*حوله على|.*غير المندوب لـ|.*لكابتن|.*كابتن|.*إلى|.*الي/gi, "")
      .replace(/هذا|الطلب|سوي|الإسناد|الاسناد|إسناد|اسناد|طلب|رقم|رقمه|#|\d+|[.,؟]/gi, "")
      .trim();

    return {
      category: "order_update",
      order_number: orderNum,
      clean_name: courierName || text
    };
  }

  // 4. رصد وتنزيل الديون للشركاء والموردين والمندوبين
  if (
    cleanQ.includes("نطيت") ||
    cleanQ.includes("انطيت") ||
    cleanQ.includes("أعطيت") ||
    cleanQ.includes("اعطيت") ||
    cleanQ.includes("اخذت") ||
    cleanQ.includes("أخذت") ||
    cleanQ.includes("تنزيل") ||
    cleanQ.includes("سدد")
  ) {
    const isTook = cleanQ.includes("اخذت") || cleanQ.includes("أخذت") || cleanQ.includes("تنزيل") || cleanQ.includes("سدد");
    const kind = isTook ? "took" : "gave";

    let cleaned = text
      .replace(/(?:مية الف|خمسين الف|ثلاثين الف|عشرين الف|خمسة الاف|الفين|الف|مية|تسعين|خمسين|عشرين|عشرة|خمسة|خمسه|خمس|\d+)/gi, "")
      .replace(/أخذت|اخذت|أعطيت|اعطيت|أنطيت|انطيت|نطيت|تنزيل|سدد|رصد|حساب/gi, "")
      .replace(/محل|مندوب|مجهز|مورد|زبون|شريك|حساب/gi, "")
      .trim();
    cleaned = cleaned.replace(/^(?:للـ|لـ|من|ع|على|إلى|الي)\s*/gi, "").trim();
    const partnerName = cleaned || null;

    const nums = (text.match(/\d+/g) || []).map(Number).filter(n => n > 0 && n < 1000000 && !n.toString().startsWith("77"));
    const amount = nums.length > 0 ? nums[nums.length - 1] : null;

    return {
      category: "debt_record",
      clean_name: partnerName,
      amount: amount,
      debt_kind: kind
    };
  }

  // 5. إنشاء طلب مبيعات جديد من محل
  const phoneMatch = text.match(/(?:\+964|0)?7[3-9][\d\s]{7,12}\d/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : null;

  if (hasExplicitShop || cleanQ.includes("سوي لي طلب") || cleanQ.includes("سوي طلب") || cleanQ.includes("ارفع طلب")) {
    return {
      category: "order_create",
      raw_query: text,
      phone: phone
    };
  }

  // 6. تصفير حسابات ورواتب المندوبين
  if (
    (cleanQ.includes("صفر") || cleanQ.includes("تصفير")) &&
    (cleanQ.includes("مندوب") || cleanQ.includes("كابتن") || cleanQ.includes("حساب") || cleanQ.includes("مستحقات"))
  ) {
    let cleanName = text
      .replace(/صفر لي|صفرلي|صفر|تصفير|حسابي|حسابه|حسابهم|حساب|حسابات|مستحقات|مستحقاته|مستحقاتهم|المندوب|الكابتن|كابتن|مندوب|لـ|ل/gi, "")
      .trim();
    return {
      category: "courier_zero",
      clean_name: cleanName || null
    };
  }

  // 7. إضافة وتسجيل مندوب جديد بالاسم والرقم الصريحين
  if (
    cleanQ.includes("سويلي مندوب") ||
    cleanQ.includes("سوي لي مندوب") ||
    cleanQ.includes("سوي مندوب") ||
    cleanQ.includes("ضيفلي مندوب") ||
    cleanQ.includes("ضيف لي مندوب") ||
    cleanQ.includes("ضيف مندوب") ||
    cleanQ.includes("مندوب جديد") ||
    cleanQ.includes("حساب مندوب")
  ) {
    let nameMatch = text.match(/(?:اسمه|اسم المندوب|اسم|مندوب|كابتن)\s*([أ-يa-zA-Z\s]+?)(?=\s*(?:ورقم|ورقمه|و رقم|رقم|تلفونه|هاتف|07|\d)|$)/i);
    let courierName = nameMatch ? nameMatch[1].trim() : text.replace(/سوي لي|سوي|ضيف لي|ضيف|مندوب|جديد|حساب|اسمه/gi, "").trim();
    courierName = courierName.replace(/ورقم.*|ورقمه.*|و رقم.*|رقم.*|07\d+.*/gi, "").replace(/\s+و$/i, "").trim();

    return {
      category: "courier_create",
      clean_name: courierName || null,
      phone: phone || null
    };
  }

  return { category: "general_qa" };
}

/**
 * تنظيف وتوحيد النصوص العربية للمقارنة
 */
function cleanArabicTextForMatch(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\bابي\b/g, "ابو")
    .replace(/\bابا\b/g, "ابو")
    .replace(/\bابن\b/g, "ابو")
    .replace(/\bال/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * بحث آمن عن أفضل تطابق بقائمة أسماء ومنع التخمين العشوائي
 */
function findBestMatch<T extends { name: string }>(
  items: T[],
  queryName: string | null | undefined
): { match: T | null; ambiguous: T[] } {
  if (!queryName || !queryName.trim()) return { match: null, ambiguous: [] };
  const cleanQuery = cleanArabicTextForMatch(queryName);
  if (cleanQuery.length < 1) return { match: null, ambiguous: [] };

  // 1. تطابق تام مباشر
  const exact = items.find(i => cleanArabicTextForMatch(i.name) === cleanQuery);
  if (exact) return { match: exact, ambiguous: [] };

  // 2. فحص صريح: هل احتوت الرسالة المنطوقة على اسم أي عنصر مسجل ككلمة مستقلة؟
  const foundItems = items.filter(i => {
    const cleanItemName = cleanArabicTextForMatch(i.name);
    if (!cleanItemName) return false;
    return cleanQuery.includes(cleanItemName) || cleanItemName.includes(cleanQuery);
  });

  if (foundItems.length === 1) return { match: foundItems[0], ambiguous: [] };
  if (foundItems.length > 1) {
    const sorted = [...foundItems].sort((a, b) => b.name.length - a.name.length);
    if (cleanArabicTextForMatch(sorted[0].name).length > cleanArabicTextForMatch(sorted[1].name).length) {
      return { match: sorted[0], ambiguous: [] };
    }
    return { match: null, ambiguous: foundItems };
  }

  // 3. تطابق جزئي احترافي
  const partial = items.filter(i => {
    const cleanName = cleanArabicTextForMatch(i.name);
    return cleanName.length >= 2 && (cleanName.includes(cleanQuery) || cleanQuery.includes(cleanName));
  });

  if (partial.length === 1) return { match: partial[0], ambiguous: [] };
  if (partial.length > 1) return { match: null, ambiguous: partial };
  return { match: null, ambiguous: [] };
}

function namesListForReply(items: { name: string }[], max: number = 6): string {
  return items.slice(0, max).map(i => i.name).join("، ");
}

/**
 * استخراج المنتجات والمواد من نص رسالة التجهيز والمشتريات
 */
function extractPrepItemsFromText(text: string): string {
  if (!text) return "";

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const itemLines = lines.filter(l => !l.startsWith("07") && !l.includes("جيكور") && !l.includes("تجهيز") && !l.includes("طلب"));

  if (itemLines.length > 0) {
    return itemLines.join("، ");
  }

  let cleanText = text
    .replace(/سوي لي طلب تجهيز|سوي طلب تجهيز|سويلي طلب تجهيز|ارفع لي طلب تجهيز|ارفع طلب تجهيز|مسودة تجهيز|تجهيز|مشتريات/gi, "")
    .replace(/مجهز.*|المجهز.*|مورد.*|المورد.*/gi, "")
    .replace(/هاتف.*|تلفون.*|07\d+/gi, "")
    .trim();

  return cleanText;
}

/**
 * استخراج مبلغ الطلب الفعلي من النص
 */
function extractOrderAmountFromText(text: string, phone: string | null): number | null {
  if (!text) return null;

  const normalized = text.toLowerCase();

  // 1. فحص صريح لكلمة صفر أو بلاش أو 0 بعد كلمة السعر
  if (
    normalized.includes("سعر الطلب صفر") ||
    normalized.includes("السعر صفر") ||
    normalized.includes("سعر صفر") ||
    normalized.includes("سعر الطلب 0") ||
    normalized.includes("السعر 0") ||
    normalized.includes("سعر 0") ||
    normalized.includes("بلاش") ||
    normalized.includes("مجاني")
  ) {
    return 0;
  }

  // 2. البحث الصريح والقاطع أولاً بعد الكلمات الدلالية للسعر (مثل سعر الطلب 10)
  const explicitMatch = text.match(/(?:سعر الطلب|السعر|سعر|بـ|ب)\s*(\d{1,4})/i);
  if (explicitMatch) {
    const val = Number(explicitMatch[1]);
    if (val >= 0 && val < 1000) return val;
  }

  // 3. تنظيف أرقام الهواتف من النص
  let cleanText = text;
  if (phone) {
    cleanText = cleanText.replace(phone, "");
  }
  cleanText = cleanText.replace(/07\d[\d\s]{7,12}/g, "");

  // 4. البحث عن الأرقام المعقولة المتبقية
  const nums = (cleanText.match(/\d+/g) || [])
    .map(Number)
    .filter(n => n >= 0 && n < 1000 && !n.toString().startsWith("07") && !n.toString().startsWith("77"));

  if (nums.length === 0) return null;
  return nums[0];
}

/**
 * المحرك المباشر للتحكم الشامل بمفاصل النظام
 */
export async function executeSuperSystemAgent(
  args: any,
  userText: string,
  sessionKey: string = "default",
  aiParsed?: any
) {
  const rawText = userText || "";
  const ctx = await getPersistentSessionContext(sessionKey);

  // 0.1 فحص إذا كانت هناك جلسة تفاعلية نشطة لإنشاء طلب خطوة بخطوة
  if (ctx.orderDraft && ctx.orderDraft.step) {
    const wizardRes = await handleOrderCreationWizard(rawText, ctx.orderDraft, ctx);
    if (wizardRes.handled) {
      ctx.orderDraft = wizardRes.nextDraft || null;
      ctx.updatedAt = Date.now();
      await savePersistentSessionContext(sessionKey, ctx);
      return { reply: wizardRes.reply!, buttons: wizardRes.buttons };
    }
  }

  // 0.15 فحص إذا كانت الرسالة عبارة عن طلب كامل مباشر مقسم بأسطر (Direct Multi-Line Order Creation)
  const lines = rawText.split(/[\n;]/).map(l => l.trim()).filter(Boolean);
  if (lines.length >= 3) {
    const allShops = await getCachedShops();
    const allRegions = await getCachedRegions();

    let matchedShop: { id: string; name: string } | null = null;
    for (const line of lines) {
      const cleanLine = line.replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();
      const scored = allShops.map(s => {
        const cleanS = s.name.replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();
        let score = 0;
        if (cleanS === cleanLine || cleanLine.includes(cleanS) || cleanS.includes(cleanLine)) score = 0.9;
        else score = calculateSimilarity(cleanS, cleanLine);
        return { shop: s, score };
      }).sort((a, b) => b.score - a.score);

      if (scored[0] && scored[0].score >= 0.6) {
        matchedShop = scored[0].shop;
        break;
      }
    }

    if (matchedShop) {
      const initialDraft: OrderDraftState = {
        step: "waiting_region",
        shopId: matchedShop.id,
        shopName: matchedShop.name
      };

      const { parseMultiFieldInput, finalizeAndCreateOrder } = await import("./ai-order-wizard");
      const { updatedDraft, fieldsFoundCount } = await parseMultiFieldInput(rawText, initialDraft, allRegions);

      if (updatedDraft.regionId && updatedDraft.price !== undefined) {
        ctx.orderDraft = null;
        ctx.updatedAt = Date.now();
        return await finalizeAndCreateOrder(updatedDraft, ctx);
      }
    }
  }

  const cleanInit = rawText
    .replace(/[.،,؟!؟]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/سوي\s*لي/g, "سويلي")
    .replace(/سو\s*لي/g, "سويلي")
    .replace(/اريد\s*اسوي/g, "سوي")
    .replace(/اريد\s*سوي/g, "سوي");

  // 0.01 أمر مسح وتصفير الدردشة المباشر (صوتياً أو نصياً)
  if (
    cleanInit === "مسح" ||
    cleanInit === "تصفير" ||
    cleanInit === "مسح الدردشة" ||
    cleanInit === "امسح الدردشة" ||
    cleanInit === "مسح السجل" ||
    cleanInit === "تصفير السجل" ||
    cleanInit === "تصفير الدردشة" ||
    cleanInit === "ابدا من جديد" ||
    cleanInit === "ابدأ من جديد" ||
    cleanInit === "دردشة جديدة" ||
    cleanInit === "دردشه جديده" ||
    cleanInit === "reset"
  ) {
    await resetChatSessionContext(sessionKey);
    return { reply: "تم تصفير الذاكرة وسجل المحادثة والبدء بدردشة جديدة ناصعة يا أبو الأكبر! تفضل بأمرك الجديد 🚀" };
  }

  // 0.02 إطلاق عقل Google Gemini المستقل كبوابة أولى لتفسير وتنفيذ كل الأوامر والاستشارات والمحادثات
  if (!rawText.startsWith("assign_order_") && !rawText.startsWith("set_region_order_") && !ctx.waitingForCarHours) {
    try {
      const geminiBrainRes = await executeAutonomousGeminiAgent(rawText, ctx);
      if (geminiBrainRes && geminiBrainRes.reply) {
        ctx.updatedAt = Date.now();
        await savePersistentSessionContext(sessionKey, ctx);
        return geminiBrainRes;
      }
    } catch (geminiBrainErr) {
      console.warn("[Gemini Brain Orchestrator Fallback]:", geminiBrainErr);
    }
  }

  // ==========================================
  // 🚗 إدارة وضعية (لا يوجد سيارات) التفاعلية
  // ==========================================

  // 1. إذا كنا بانتظار تحديد مدة أو ساعات وضع عدم وجود سيارات
  if (ctx.waitingForCarHours) {
    if (cleanInit.includes("الغاء") || cleanInit.includes("كنسل") || cleanInit.includes("بطلت")) {
      ctx.waitingForCarHours = null;
      ctx.updatedAt = Date.now();
      return { reply: "تم إلغاء تفعيل وضع عدم وجود سيارات يا غالي 🌸" };
    }

    let hours: number | null = null;
    let mode: string = "all_day";
    let modeArabic = "لا يوجد سيارات";
    let isIndefinite = false;

    // فحص الأرقام والساعات
    const numDigits = cleanInit.replace(/[٠۰]/g, "0").replace(/[١۱]/g, "1").replace(/[٢۲]/g, "2").replace(/[٣۳]/g, "3").replace(/[٤۴]/g, "4").replace(/[٥۵]/g, "5").replace(/[٦۶]/g, "6").replace(/[٧۷]/g, "7").replace(/[٨۸]/g, "8").replace(/[٩۹]/g, "9");
    const matchNum = numDigits.match(/\b\d+\b/);

    if (cleanInit.includes("ساعتين") || cleanInit.includes("ساعتان") || cleanInit === "2" || numDigits === "2") {
      hours = 2;
    } else if (cleanInit.includes("ساعة") || cleanInit.includes("ساعه") || cleanInit === "1" || numDigits === "1") {
      if (matchNum && Number(matchNum[0]) > 0) hours = Number(matchNum[0]);
      else hours = 1;
    } else if (matchNum && Number(matchNum[0]) > 0) {
      hours = Number(matchNum[0]);
    } else if (cleanInit.includes("نصف ساعة") || cleanInit.includes("نص ساعة")) {
      hours = 0.5;
    } else if (cleanInit.includes("صباح") || cleanInit.includes("الصبح")) {
      mode = "morning";
      modeArabic = "لا يوجد سيارات صباحاً";
    } else if (cleanInit.includes("مساء") || cleanInit.includes("المساء") || cleanInit.includes("ليل") || cleanInit.includes("الليل")) {
      mode = "evening";
      modeArabic = "لا يوجد سيارات مساءً";
    } else if (cleanInit.includes("اليوم كله") || cleanInit.includes("طول اليوم") || cleanInit.includes("اليوم باكمل") || cleanInit.includes("كامل")) {
      mode = "all_day";
      modeArabic = "لا يوجد سيارات اليوم بأكمله";
    } else if (cleanInit.includes("مستمر") || cleanInit.includes("دائم") || cleanInit.includes("بدون موقت") || cleanInit.includes("بدون وقت")) {
      mode = "all_day";
      isIndefinite = true;
      modeArabic = "لا يوجد سيارات بشكل مستمر";
    }

    if (hours !== null || mode !== "off") {
      let noCarsUntil: Date | null = null;
      if (hours !== null) {
        noCarsUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
      } else if (isIndefinite) {
        noCarsUntil = null;
      }

      await prisma.globalSettings.upsert({
        where: { id: "system" },
        update: {
          noCarsMode: mode,
          noCarsUntil: noCarsUntil,
        },
        create: {
          id: "system",
          noCarsMode: mode,
          noCarsUntil: noCarsUntil,
        },
      });

      ctx.waitingForCarHours = null;
      ctx.updatedAt = Date.now();

      const formattedTime = noCarsUntil
        ? noCarsUntil.toLocaleTimeString("ar-IQ", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Baghdad",
          })
        : "";

      const timeText = hours !== null 
        ? `لمدة (${hours}) ساعة (حتى ${formattedTime})` 
        : `وضع (${modeArabic})`;

      return {
        reply: `تم يا أبو الأكبر! فعّلت وضعية عدم وجود سيارات ${timeText} بنجاح 🚗🚫`
      };
    }
  }

  // 2. فحص أوامر تفعيل (لا يوجد سيارات / ماكو سيارات)
  const isNoCarsCommand =
    cleanInit === "لا يوجد سيارات" ||
    cleanInit === "ماكو سيارات" ||
    cleanInit === "سيارات ماكو" ||
    cleanInit === "سيارات لايوجد" ||
    cleanInit === "سيارات لا يوجد" ||
    cleanInit === "ماكو سيارة" ||
    cleanInit === "ماكو سياره" ||
    cleanInit === "ما عندنا سيارات" ||
    cleanInit === "عدم وجود سيارات" ||
    cleanInit === "فعل وضع ماكو سيارات" ||
    cleanInit === "تفعيل ماكو سيارات" ||
    cleanInit.startsWith("لا يوجد سيارات") ||
    cleanInit.startsWith("ماكو سيارات") ||
    cleanInit.startsWith("سيارات ماكو") ||
    cleanInit.startsWith("سيارات لايوجد");

  if (isNoCarsCommand) {
    // فحص إذا ذكر عدد الساعات في نفس الأمر مباشرة (مثال: ماكو سيارات لمدة ساعتين)
    const numDigits = cleanInit.replace(/[٠۰]/g, "0").replace(/[١۱]/g, "1").replace(/[٢۲]/g, "2").replace(/[٣۳]/g, "3").replace(/[٤۴]/g, "4").replace(/[٥۵]/g, "5").replace(/[٦۶]/g, "6").replace(/[٧۷]/g, "7").replace(/[٨۸]/g, "8").replace(/[٩۹]/g, "9");
    const matchNum = numDigits.match(/\b\d+\b/);

    if (cleanInit.includes("ساعتين") || cleanInit.includes("ساعتان")) {
      const noCarsUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const formattedTime = noCarsUntil.toLocaleTimeString("ar-IQ", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Baghdad",
      });
      await prisma.globalSettings.upsert({
        where: { id: "system" },
        update: { noCarsMode: "all_day", noCarsUntil },
        create: { id: "system", noCarsMode: "all_day", noCarsUntil },
      });
      return { reply: `تم يا أبو الأكبر! فعّلت وضعية عدم وجود سيارات لمدة (2) ساعة (حتى ${formattedTime}) بنجاح 🚗🚫` };
    }

    if (matchNum && Number(matchNum[0]) > 0 && (cleanInit.includes("ساعة") || cleanInit.includes("ساعه") || cleanInit.includes("مدة") || cleanInit.includes("لمدة"))) {
      const h = Number(matchNum[0]);
      const noCarsUntil = new Date(Date.now() + h * 60 * 60 * 1000);
      const formattedTime = noCarsUntil.toLocaleTimeString("ar-IQ", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Baghdad",
      });
      await prisma.globalSettings.upsert({
        where: { id: "system" },
        update: { noCarsMode: "all_day", noCarsUntil },
        create: { id: "system", noCarsMode: "all_day", noCarsUntil },
      });
      return { reply: `تم يا أبو الأكبر! فعّلت وضعية عدم وجود سيارات لمدة (${h}) ساعة (حتى ${formattedTime}) بنجاح 🚗🚫` };
    }

    // إذا لم يحدد الساعات، نسأله ونعرض له الأزرار التفاعلية الفورية!
    ctx.waitingForCarHours = true;
    ctx.updatedAt = Date.now();

    const buttons = [
      { text: "⏱️ ساعة واحدة", action: "ساعة واحدة" },
      { text: "⏱️ ساعتين", action: "ساعتين" },
      { text: "⏱️ 4 ساعات", action: "4 ساعات" },
      { text: "⏱️ 8 ساعات", action: "8 ساعات" },
      { text: "🌅 لا يوجد صباحاً", action: "صباحا" },
      { text: "🌙 لا يوجد مساءً", action: "مساء" },
      { text: "🚫 اليوم بأكمله", action: "اليوم كله" },
      { text: "♾️ مستمر (بدون مؤقت)", action: "مستمر" },
    ];

    return {
      reply: `كم ساعة تريد تفعيل وضع (لا يوجد سيارات) يا أبو الأكبر؟ 🚗⏳`,
      buttons: buttons,
    };
  }

  // 3. فحص أوامر إلغاء وضع عدم وجود سيارات (السيارات متوفرة)
  const isCarsAvailableCommand =
    cleanInit === "السيارات متوفرة" ||
    cleanInit === "السيارات متوفره" ||
    cleanInit === "السيارات متوفره الان" ||
    cleanInit === "اكو سيارات" ||
    cleanInit === "السيارات رجعت" ||
    cleanInit === "رجعت السيارات" ||
    cleanInit === "توفرت سيارات" ||
    cleanInit === "توفرت السيارات" ||
    cleanInit === "الغي وضع ماكو سيارات" ||
    cleanInit === "الغاء ماكو سيارات" ||
    cleanInit === "الغاء عدم وجود سيارات" ||
    cleanInit === "السيارات طبيعي";

  if (isCarsAvailableCommand) {
    await prisma.globalSettings.upsert({
      where: { id: "system" },
      update: {
        noCarsMode: "off",
        noCarsUntil: null,
      },
      create: {
        id: "system",
        noCarsMode: "off",
        noCarsUntil: null,
      },
    });

    ctx.waitingForCarHours = null;
    ctx.updatedAt = Date.now();

    return {
      reply: `تم يا أبو الأكبر! ألغيت التفعيل وأصبحت السيارات متوفرة للزبائن بشكل طبيعي الآن 🚗✅`
    };
  }

  // 0.05 فحص الأوامر المباشرة على الطلبات بالأرقام (رفض، إلغاء، إسناد، تفاصيل، إرجاع لجديد)
  const orderNumMatch = rawText.match(/(?:طلب|اوردر|رقم)?\s*#?(\d{3,6})/i);
  const detectedOrderNum = orderNumMatch ? Number(orderNumMatch[1]) : (ctx.lastOrderNumber || null);

  // أ) أمر رفض أو إلغاء طلب
  if (
    cleanInit.includes("رفض") ||
    cleanInit.includes("الغاء") ||
    cleanInit.includes("إلغاء") ||
    cleanInit.includes("كنسل") ||
    cleanInit.includes("سوي له رفض") ||
    cleanInit.includes("سوي رفض")
  ) {
    if (detectedOrderNum) {
      const targetOrder = await prisma.order.findUnique({
        where: { orderNumber: detectedOrderNum },
        include: { shop: true }
      });
      if (targetOrder) {
        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: { status: "rejected" }
        });
        ctx.lastOrderNumber = updated.orderNumber;
        ctx.orderDraft = null;
        return {
          reply: `تم يا أبو الأكبر! غيرت حالة طلب #${updated.orderNumber} لـ (${targetOrder.shop?.name || "المحل"}) إلى (مرفوض / ملغى) ❌`
        };
      }
    }
  }

  // ب) أمر تفاصيل طلب
  if (
    cleanInit.includes("تفاصيل") ||
    cleanInit.includes("استعرض") ||
    cleanInit.includes("شوفلي طلب")
  ) {
    if (detectedOrderNum) {
      const targetOrder = await prisma.order.findUnique({
        where: { orderNumber: detectedOrderNum },
        include: { shop: true, customerRegion: true, courier: true }
      });
      if (targetOrder) {
        ctx.lastOrderNumber = targetOrder.orderNumber;
        const shopName = targetOrder.shop?.name || "المحل";
        const regionName = targetOrder.customerRegion?.name || "غير محددة";
        const phone = targetOrder.customerPhone || "بدون رقم";
        const subtotal = targetOrder.orderSubtotal ? Number(targetOrder.orderSubtotal) : 0;
        const oType = targetOrder.orderType || "مسواق";
        const nTime = targetOrder.orderNoteTime || "الان";
        
        let statusArabic = "جديد";
        if (targetOrder.status === "assigned") statusArabic = `مسند (${targetOrder.courier?.name || "مندوب"})`;
        else if (targetOrder.status === "rejected" || targetOrder.status === "cancelled") statusArabic = "مرفوض";
        else if (targetOrder.status === "delivered" || targetOrder.status === "completed") statusArabic = "واصل ومسلم";
        else if (targetOrder.status === "archived") statusArabic = "مؤرشف";

        const replyText = `تفاصيل الطلب:\n${targetOrder.orderNumber}\n${shopName}\n${regionName}\n${phone}\n${subtotal}\n${oType}\n${nTime}\n${statusArabic}`;
        const buttons: Array<{ text: string; action: string }> = [];

        if (targetOrder.customerPhone && targetOrder.customerPhone.replace(/\D/g, "").length >= 7) {
          const rawDigits = targetOrder.customerPhone.replace(/\D/g, "");
          const cleanPhone = rawDigits.startsWith("0") ? "964" + rawDigits.slice(1) : (rawDigits.startsWith("964") ? rawDigits : "964" + rawDigits);
          buttons.push({ text: `📞 اتصال بالزبون`, action: `tel:${targetOrder.customerPhone}` });
          buttons.push({ text: `💬 مراسلة واتساب`, action: `https://wa.me/${cleanPhone}` });
        }

        if (targetOrder.status === "pending") {
          buttons.push({ text: `🛵 إسناد لمندوب`, action: `إسناد طلب ${targetOrder.orderNumber}` });
          buttons.push({ text: `❌ إلغاء الطلب`, action: `طلب ${targetOrder.orderNumber} سوي له رفض` });
        } else if (targetOrder.status === "rejected" || targetOrder.status === "cancelled") {
          buttons.push({ text: `🛵 إعادة إسناد`, action: `إسناد طلب ${targetOrder.orderNumber}` });
          buttons.push({ text: `🔄 إرجاع إلى جديد`, action: `إرجاع طلب ${targetOrder.orderNumber} للجديد` });
        } else if (targetOrder.status === "assigned") {
          buttons.push({ text: `🛵 تغيير المندوب`, action: `تغيير مندوب طلب ${targetOrder.orderNumber}` });
          buttons.push({ text: `🔄 إرجاع إلى جديد`, action: `إرجاع طلب ${targetOrder.orderNumber} للجديد` });
          buttons.push({ text: `❌ إلغاء الطلب`, action: `طلب ${targetOrder.orderNumber} سوي له رفض` });
        }

        return { reply: replyText, buttons };
      }
    }
  }

  // د) أمر إسناد وتحويل وتبديل طلبات المحلات للمندوبين (للجديدة والمسندة بكافة الصيغ)
  const isAssignOrSwapIntent = /(?:اسند|إسناد|اسناد|سويله\s*اسناد|سوي\s*اسناد|حول|حوله|تحويل|وجه|وجهه|توجيه|انطيه|انطي|خليه|ذب|ذبه|حط\s*بظهره|بحصة|بحصه|يستلم|ياخذ|يروح\s*ويا|دز|دزه|بدل|بدله|تبديل|غير|تغيير|سحب|سحبه|المسند|المسنده|المعين|اللي\s*عند|الي\s*عند|يم\s*المندوب|كابتن|مندوب)/i.test(cleanInit);

  if (isAssignOrSwapIntent || cleanInit.includes("الجديد") || cleanInit.includes("جديد") || cleanInit.includes("مسند") || cleanInit.includes("المسند")) {
    const allCouriers = await getCachedCouriers();
    const allShops = await getCachedShops();

    // 1. البحث عن المندوب المستهدف المذكور بالنص
    let matchedCourier: { id: string; name: string } | null = null;
    for (const c of allCouriers) {
      const cleanC = c.name.replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();
      const firstName = cleanC.split(" ")[0];

      if (
        cleanInit.includes(cleanC) ||
        (firstName.length >= 3 && (cleanInit.includes(` ${firstName}`) || cleanInit.includes(`ل${firstName}`) || cleanInit.includes(`على ${firstName}`) || cleanInit.includes(`يم ${firstName}`) || cleanInit.startsWith(firstName)))
      ) {
        matchedCourier = c;
        break;
      }
    }

    // 2. إذا تم العثور على المندوب المستهدف
    if (matchedCourier) {
      // أ) إذا كان هناك رقم طلب صريح (مثال: طلب 2099 بدله لفارس أو حول 2099 لفارس)
      if (detectedOrderNum) {
        const targetOrder = await prisma.order.findUnique({
          where: { orderNumber: detectedOrderNum },
          include: { shop: true, customerRegion: true, courier: true }
        });

        if (targetOrder) {
          const oldCourierName = targetOrder.courier?.name;
          const updated = await prisma.order.update({
            where: { id: targetOrder.id },
            data: { assignedCourierId: matchedCourier.id, status: "assigned" },
            include: { shop: true, customerRegion: true, courier: true }
          });

          ctx.lastOrderNumber = updated.orderNumber;
          ctx.updatedAt = Date.now();

          const shopName = updated.shop?.name || "المحل";
          const regionName = updated.customerRegion?.name || "غير محددة";
          const orderType = updated.orderType || "مسواق";
          const noteTime = updated.orderNoteTime || "الان";
          const subtotalVal = updated.orderSubtotal ? Number(updated.orderSubtotal) : 0;
          const swapText = oldCourierName && oldCourierName !== matchedCourier.name 
            ? `بدلت إسناد طلب #${updated.orderNumber} لمحل (${shopName}) من الكابتن (${oldCourierName}) إلى الكابتن (${matchedCourier.name})` 
            : `أسندت طلب #${updated.orderNumber} (${shopName}) إلى الكابتن (${matchedCourier.name})`;

          return {
            reply: `تم يا أبو الأكبر! ${swapText} 🛵💨\n📍 **المنطقة:** ${regionName} | 💰 **السعر:** ${subtotalVal} ألف\n📦 **نوع الطلب:** ${orderType} | ⏰ **وقت التوصيل:** ${noteTime}`
          };
        }
      }

      // ب) البحث عن المحل المذكور بالنص (مثال: طلب شيريني غدير المسند بدله لفارس)
      let matchedShop: { id: string; name: string } | null = null;
      let highestShopScore = 0;

      for (const s of allShops) {
        const cleanS = s.name.replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();
        let score = 0;

        if (cleanInit.includes(cleanS)) {
          score = 1.0;
        } else {
          score = calculateSimilarity(cleanS, cleanInit);
        }

        if (score > highestShopScore && score >= 0.55) {
          highestShopScore = score;
          matchedShop = s;
        }
      }

      const wantsAssignedExplicitly = cleanInit.includes("مسند") || cleanInit.includes("المسند") || cleanInit.includes("بدل") || cleanInit.includes("بدله") || cleanInit.includes("غير") || cleanInit.includes("سحب");

      // إذا وُجد محل محدد
      if (matchedShop) {
        // إذا طلب تحديداً الطلب المسند أو تبديل المندوب
        if (wantsAssignedExplicitly) {
          const assignedOrders = await prisma.order.findMany({
            where: {
              shopId: matchedShop.id,
              status: "assigned"
            },
            orderBy: { createdAt: "desc" },
            include: { shop: true, customerRegion: true, courier: true }
          });

          // إذا وجدنا طلباً مسنداً واحداً فقط لمحل شيريني غدير
          if (assignedOrders.length === 1) {
            const singleOrder = assignedOrders[0];
            const oldCourierName = singleOrder.courier?.name || "المندوب السابق";
            const updated = await prisma.order.update({
              where: { id: singleOrder.id },
              data: { assignedCourierId: matchedCourier.id, status: "assigned" },
              include: { shop: true, customerRegion: true, courier: true }
            });

            ctx.lastOrderNumber = updated.orderNumber;
            ctx.updatedAt = Date.now();

            const shopName = updated.shop?.name || matchedShop.name;
            const regionName = updated.customerRegion?.name || "غير محددة";
            const orderType = updated.orderType || "مسواق";
            const noteTime = updated.orderNoteTime || "الان";
            const subtotalVal = updated.orderSubtotal ? Number(updated.orderSubtotal) : 0;

            return {
              reply: `تم يا أبو الأكبر! بدلت إسناد طلب #${updated.orderNumber} لمحل (${shopName}) من الكابتن (${oldCourierName}) إلى الكابتن (${matchedCourier.name}) 🛵💨\n📍 **المنطقة:** ${regionName} | 💰 **السعر:** ${subtotalVal} ألف\n📦 **نوع الطلب:** ${orderType} | ⏰ **وقت التوصيل:** ${noteTime}`
            };
          }

          // إذا وجدنا أكثر من طلب مسند لنفس المحل
          if (assignedOrders.length > 1) {
            const buttons = assignedOrders.map(o => ({
              text: `🛵 #${o.orderNumber} | ${o.customerRegion?.name || "غير محددة"} (${o.courier?.name || "مسند"})`,
              action: `طلب ${o.orderNumber} بدله لـ ${matchedCourier?.name}`
            }));

            let summaryText = `يا أبو الأكبر، عندك (${assignedOrders.length}) طلبات مسندة حالياً لمحل (${matchedShop.name}). أي طلب منهم تريد تحويله للكابتن (${matchedCourier.name})؟ 👇\n`;
            assignedOrders.forEach((o, i) => {
              summaryText += `\n${i + 1}. **طلب #${o.orderNumber}**: منطقة ${o.customerRegion?.name || "غير محددة"} (السعر: ${o.orderSubtotal || 0} ألف) | عند الكابتن: ${o.courier?.name || "غير محدد"}`;
            });

            return {
              reply: summaryText,
              buttons: buttons
            };
          }
        }

        // إذا لم يكن مسنداً صريحاً أو لم نجد مسنداً، نبحث أولاً عن المعلق (pending) ثم المسند (assigned)
        const pendingOrders = await prisma.order.findMany({
          where: {
            shopId: matchedShop.id,
            status: "pending"
          },
          orderBy: { createdAt: "desc" },
          include: { shop: true, customerRegion: true }
        });

        if (pendingOrders.length === 1) {
          const singleOrder = pendingOrders[0];
          const updated = await prisma.order.update({
            where: { id: singleOrder.id },
            data: { assignedCourierId: matchedCourier.id, status: "assigned" },
            include: { shop: true, customerRegion: true, courier: true }
          });

          ctx.lastOrderNumber = updated.orderNumber;
          ctx.updatedAt = Date.now();

          const shopName = updated.shop?.name || matchedShop.name;
          const regionName = updated.customerRegion?.name || "غير محددة";
          const orderType = updated.orderType || "مسواق";
          const noteTime = updated.orderNoteTime || "الان";
          const subtotalVal = updated.orderSubtotal ? Number(updated.orderSubtotal) : 0;

          return {
            reply: `تم يا أبو الأكبر! أسندت طلب #${updated.orderNumber} الجديد لمحل (${shopName}) إلى الكابتن (${matchedCourier.name}) 🛵💨\n📍 **المنطقة:** ${regionName} | 💰 **السعر:** ${subtotalVal} ألف\n📦 **نوع الطلب:** ${orderType} | ⏰ **وقت التوصيل:** ${noteTime}`
          };
        }

        // إذا كان هناك أكثر من طلب جديد معلق لنفس المحل
        if (pendingOrders.length > 1) {
          const buttons = pendingOrders.map(o => ({
            text: `🛵 #${o.orderNumber} | ${o.customerRegion?.name || "غير محددة"} (${o.orderSubtotal || 0} ألف)`,
            action: `طلب ${o.orderNumber} اسنده لـ ${matchedCourier?.name}`
          }));

          let summaryText = `يا أبو الأكبر، عندك (${pendingOrders.length}) طلبات جديدة معلقة لمحل (${matchedShop.name}). أي طلب تريد إسناده للكابتن (${matchedCourier.name})؟ 👇\n`;
          pendingOrders.forEach((o, i) => {
            summaryText += `\n${i + 1}. **طلب #${o.orderNumber}**: منطقة ${o.customerRegion?.name || "غير محددة"} | ${o.orderType || "طلب"} (السعر: ${o.orderSubtotal || 0} ألف)`;
          });

          return {
            reply: summaryText,
            buttons: buttons
          };
        }

        // إذا لم نجد طلبات معلقة، نبحث في المسندة كخيار بديل
        const fallbackAssigned = await prisma.order.findMany({
          where: {
            shopId: matchedShop.id,
            status: "assigned"
          },
          orderBy: { createdAt: "desc" },
          include: { shop: true, customerRegion: true, courier: true }
        });

        if (fallbackAssigned.length === 1) {
          const singleOrder = fallbackAssigned[0];
          const oldCourierName = singleOrder.courier?.name || "المندوب السابق";
          const updated = await prisma.order.update({
            where: { id: singleOrder.id },
            data: { assignedCourierId: matchedCourier.id, status: "assigned" },
            include: { shop: true, customerRegion: true, courier: true }
          });

          ctx.lastOrderNumber = updated.orderNumber;
          ctx.updatedAt = Date.now();

          const shopName = updated.shop?.name || matchedShop.name;
          const regionName = updated.customerRegion?.name || "غير محددة";
          const orderType = updated.orderType || "مسواق";
          const noteTime = updated.orderNoteTime || "الان";
          const subtotalVal = updated.orderSubtotal ? Number(updated.orderSubtotal) : 0;

          return {
            reply: `تم يا أبو الأكبر! بدلت إسناد طلب #${updated.orderNumber} لمحل (${shopName}) من الكابتن (${oldCourierName}) إلى الكابتن (${matchedCourier.name}) 🛵💨\n📍 **المنطقة:** ${regionName} | 💰 **السعر:** ${subtotalVal} ألف\n📦 **نوع الطلب:** ${orderType} | ⏰ **وقت التوصيل:** ${noteTime}`
          };
        } else if (fallbackAssigned.length > 1) {
          const buttons = fallbackAssigned.map(o => ({
            text: `🛵 #${o.orderNumber} | ${o.customerRegion?.name || "غير محددة"} (${o.courier?.name || "مسند"})`,
            action: `طلب ${o.orderNumber} بدله لـ ${matchedCourier?.name}`
          }));

          let summaryText = `يا أبو الأكبر، عندك (${fallbackAssigned.length}) طلبات مسندة لمحل (${matchedShop.name}). أي طلب منهم تريد تحويله للكابتن (${matchedCourier.name})؟ 👇\n`;
          fallbackAssigned.forEach((o, i) => {
            summaryText += `\n${i + 1}. **طلب #${o.orderNumber}**: منطقة ${o.customerRegion?.name || "غير محددة"} (عند الكابتن: ${o.courier?.name || "غير محدد"})`;
          });

          return {
            reply: summaryText,
            buttons: buttons
          };
        }

        return {
          reply: `يا أبو الأكبر، بحثت بالنظام وما لكيت أي طلب جديد أو مسند لمحل (${matchedShop.name}) لتحويله للكابتن (${matchedCourier.name})!`,
          buttons: [
            { text: `➕ إنشاء طلب لـ ${matchedShop.name}`, action: `سويلي طلب من ${matchedShop.name}` },
            { text: `📋 استعراض طلبات ${matchedShop.name}`, action: `طلبات ${matchedShop.name}` }
          ]
        };
      }

      // ج) إذا لم يذكر اسماً لمحل بل قال "الطلبات المسندة بدلها لفارس" أو "الطلبات المعلقة لفارس"
      if (wantsAssignedExplicitly) {
        const allAssigned = await prisma.order.findMany({
          where: { status: "assigned" },
          orderBy: { createdAt: "desc" },
          take: 6,
          include: { shop: true, customerRegion: true, courier: true }
        });

        if (allAssigned.length === 1) {
          const singleOrder = allAssigned[0];
          const oldCourierName = singleOrder.courier?.name || "المندوب السابق";
          const updated = await prisma.order.update({
            where: { id: singleOrder.id },
            data: { assignedCourierId: matchedCourier.id, status: "assigned" },
            include: { shop: true, customerRegion: true, courier: true }
          });

          ctx.lastOrderNumber = updated.orderNumber;
          ctx.updatedAt = Date.now();

          const shopName = updated.shop?.name || "المحل";
          const regionName = updated.customerRegion?.name || "غير محددة";
          const orderType = updated.orderType || "مسواق";
          const noteTime = updated.orderNoteTime || "الان";
          const subtotalVal = updated.orderSubtotal ? Number(updated.orderSubtotal) : 0;

          return {
            reply: `تم يا أبو الأكبر! بدلت إسناد طلب #${updated.orderNumber} لمحل (${shopName}) من الكابتن (${oldCourierName}) إلى الكابتن (${matchedCourier.name}) 🛵💨\n📍 **المنطقة:** ${regionName} | 💰 **السعر:** ${subtotalVal} ألف\n📦 **نوع الطلب:** ${orderType} | ⏰ **وقت التوصيل:** ${noteTime}`
          };
        } else if (allAssigned.length > 1) {
          const buttons = allAssigned.map(o => ({
            text: `🛵 #${o.orderNumber} | ${o.shop?.name} (${o.customerRegion?.name || "منطقة"})`,
            action: `طلب ${o.orderNumber} بدله لـ ${matchedCourier?.name}`
          }));

          let summaryText = `يا أبو الأكبر، عندك (${allAssigned.length}) طلبات مسندة حالياً بالنظام. أي طلب تريد تحويله للكابتن (${matchedCourier.name})؟ 👇\n`;
          allAssigned.forEach((o, i) => {
            summaryText += `\n${i + 1}. **طلب #${o.orderNumber}**: محل ${o.shop?.name || "عام"} 📍 ${o.customerRegion?.name || "غير محددة"} (عند: ${o.courier?.name || "مندوب"})`;
          });

          return {
            reply: summaryText,
            buttons: buttons
          };
        }
      }
    }
  }

  // هـ) أمر إرجاع طلب لحالة (جديد معلق)
  if ((cleanInit.includes("رجع") || cleanInit.includes("ارجاع")) && (cleanInit.includes("طلب") || cleanInit.includes("جديد"))) {
    if (detectedOrderNum) {
      const targetOrder = await prisma.order.findUnique({ where: { orderNumber: detectedOrderNum } });
      if (targetOrder) {
        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: { status: "pending", assignedCourierId: null }
        });
        ctx.lastOrderNumber = updated.orderNumber;
        return {
          reply: `تم يا أبو الأكبر! رجعت طلب #${updated.orderNumber} إلى حالة (جديد معلق) بنجاح 🔄`
        };
      }
    }
  }

  // 0.2 بدء محادثة تفاعلية إذا قال المستخدم طلب جديد فقط بدون تفاصيل
  const isPureNewOrderPrompt =
    cleanInit === "سويلي طلب" ||
    cleanInit === "سوي طلب" ||
    cleanInit === "سويلي طلب جديد" ||
    cleanInit === "سوي طلب جديد" ||
    cleanInit === "سويلي طلبيه" ||
    cleanInit === "سوي طلبية" ||
    cleanInit === "سويلي طلبيه جديده" ||
    cleanInit === "سويلي طلبية جديدة" ||
    cleanInit === "ضيف طلب" ||
    cleanInit === "ضيف طلب جديد" ||
    cleanInit === "ضيف طلبية" ||
    cleanInit === "انشاء طلب" ||
    cleanInit === "طلب جديد" ||
    cleanInit === "سويلي اوردر" ||
    cleanInit === "سوي اوردر";

  if (isPureNewOrderPrompt) {
    ctx.orderDraft = {
      step: "waiting_shop",
      shopId: undefined,
      shopName: undefined,
      regionId: undefined,
      regionName: undefined,
      phone: undefined,
      orderType: undefined,
      price: undefined,
      noteTime: undefined
    };
    ctx.updatedAt = Date.now();
    await savePersistentSessionContext(sessionKey, ctx);
    return { reply: "من أي محل يا أبو الأكبر؟ 🏪" };
  }

  // 0.25 إذا ذكر اسم المحل مباشرة مع كلمة طلب (فقط إذا لم يكن أمراً إدارياً أو يحتوي على أرقام)
  const isAdministrativeCommand = /(?:رفض|الغاء|إلغاء|اسند|إسناد|غير|تغيير|تفاصيل|رجع|ارجاع|جديد|أرشفة|ارشفة|معلق|كابتن|مندوب|\d{3,})/i.test(cleanInit);

  if (
    !isAdministrativeCommand &&
    (cleanInit.startsWith("سويلي طلب من ") ||
      cleanInit.startsWith("سوي طلب من ") ||
      cleanInit.startsWith("طلب من ") ||
      cleanInit.startsWith("طلب لـ ") ||
      cleanInit.startsWith("طلب "))
  ) {
    const extractedShopQuery = cleanInit
      .replace(/^سويلي\s*طلب\s*من\s*/g, "")
      .replace(/^سوي\s*طلب\s*من\s*/g, "")
      .replace(/^طلب\s*من\s*/g, "")
      .replace(/^طلب\s*لـ\s*/g, "")
      .replace(/^طلب\s*/g, "")
      .replace(/^محل\s*/g, "")
      .trim();

    if (extractedShopQuery.length >= 2) {
      const allShops = await getCachedShops();
      const scored = allShops.map(s => {
        const cleanS = s.name.replace(/أ|إ|آ/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();
        let score = 0;

        if (cleanS === extractedShopQuery) {
          score = 1.0;
        } else if (cleanS.includes(extractedShopQuery) || extractedShopQuery.includes(cleanS)) {
          score = 0.9;
        } else {
          score = calculateSimilarity(cleanS, extractedShopQuery);
        }
        return { shop: s, score };
      }).sort((a, b) => b.score - a.score);

      const topShops = scored.slice(0, 4).map(s => s.shop);
      const buttons = topShops.map(s => ({
        text: `🏪 ${s.name}`,
        action: `🏪 ${s.name}`
      }));

      ctx.orderDraft = { step: "waiting_shop" };
      ctx.updatedAt = Date.now();
      await savePersistentSessionContext(sessionKey, ctx);

      return {
        reply: `يا أبو الأكبر، قصدك أي محل من هذولي؟ 👇`,
        buttons: buttons
      };
    }
  }

  // 1. فحص الأزرار السريعة المباشرة (النقر على زر إسناد أو تحديد منطقة)
  if (rawText.startsWith("assign_order_") || rawText.startsWith("set_region_order_")) {
    // يتم معالجتها أدناه مباشرة
  } else {
    // 2. إطلاق محرك الذكاء الاصطناعي المستقل المباشر ليتولى فهم وتنفيذ كل شيء بالكامل!
    try {
      const autoRes = await executeAutonomousGeminiAgent(rawText, ctx);
      if (autoRes && autoRes.reply) {
        return autoRes;
      }
    } catch (autoErr) {
      console.warn("Autonomous Gemini fallback:", autoErr);
    }
  }

  // 3. التحليل الذكي المساعد إذا لزم الأمر
  let parsed = aiParsed;

  if (!parsed && !rawText.startsWith("assign_order_") && !rawText.startsWith("set_region_order_")) {
    try {
      const [allShops, allCouriers, allRegions] = await Promise.all([
        prisma.shop.findMany({ select: { name: true } }),
        prisma.courier.findMany({ select: { name: true } }),
        prisma.region.findMany({ select: { name: true } })
      ]);
      const compiled = await compileAndSaveNewIntent(rawText, {
        shops: allShops.map(s => s.name),
        couriers: allCouriers.map(c => c.name),
        regions: allRegions.map(r => r.name)
      });
      if (compiled && compiled.category && compiled.category !== "general_qa") {
        parsed = compiled;
      }
    } catch (compileErr) {
      console.warn("Dynamic intent compiler error:", compileErr);
    }
  }

  // 3. إذا لم يتم التعرف عبر الذكاء، نفحص القواعد السريعة كـ احتياط آمن
  if (!parsed || parsed.category === "general_qa" || !parsed.category) {
    parsed = parseCustomSystemIntent(rawText);
  }

  try {
    if (rawText.startsWith("assign_order_")) {
      const parts = rawText.split("_");
      const orderId = parts[2];
      const courierId = parts[3];

      const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shop: true, customerRegion: true } });
      const courier = await prisma.courier.findUnique({ where: { id: courierId } });

      if (!order || !courier) {
        return { reply: `يا أبو الأكبر، ما گدرت ألكى الطلب أو الكابتن المحدد بهذا الزر. جرب مرة ثانية.` };
      }

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { assignedCourierId: courier.id, status: "assigned" },
        include: { shop: true, customerRegion: true }
      });

      ctx.lastOrderNumber = updated.orderNumber;
      ctx.updatedAt = Date.now();

      const shopName = updated.shop ? updated.shop.name : "المحل";
      const regionName = updated.customerRegion ? updated.customerRegion.name : "غير محددة";
      const orderType = updated.orderType || "غير محدد";
      const noteTime = updated.orderNoteTime || "الان";
      const subtotalVal = updated.orderSubtotal ? Number(updated.orderSubtotal) : 0;
      const totalVal = updated.totalAmount ? Number(updated.totalAmount) : subtotalVal;

      return {
        reply: `تم يا أبو الأكبر! أسندت طلب #${updated.orderNumber} إلى الكابتن (${courier.name}) 🛵\n🏪 **المحل:** ${shopName} | 📍 **المنطقة:** ${regionName}\n📦 **نوع الطلب:** ${orderType} | ⏰ **وقت الطلب:** ${noteTime}\n💰 **سعر الطلب:** ${subtotalVal} ألف (المجموع: ${totalVal} ألف)`
      };
    }

    if (rawText.startsWith("set_region_order_")) {
      const parts = rawText.split("_");
      const orderId = parts[3];
      const regionId = parts[5];

      const region = await prisma.region.findUnique({ where: { id: regionId } });
      const order = await prisma.order.findUnique({ where: { id: orderId } });

      if (order && region) {
        const deliveryPrice = Number(region.deliveryPrice || 0);
        const subtotal = Number(order.orderSubtotal || 0);
        const total = subtotal + deliveryPrice;

        const updated = await prisma.order.update({
          where: { id: order.id },
          data: {
            customerRegionId: region.id,
            deliveryPrice: new Decimal(deliveryPrice),
            totalAmount: new Decimal(total)
          }
        });

        return {
          reply: `تم يا أبو الأكبر! حددت المنطقة لـ (${region.name}) وسعر التوصيل لـ (${deliveryPrice} ألف) لطلب #${updated.orderNumber} 🚀`
        };
      }
    }

    if (rawText.startsWith("assign_prep_")) {
      const parts = rawText.split("_");
      const draftId = parts[2];
      const preparerId = parts[3];

      const preparer = await prisma.companyPreparer.findUnique({ where: { id: preparerId } });
      const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id: draftId } });

      if (!draft || !preparer) {
        return { reply: `يا أبو الأكبر، ما گدرت ألكى طلب التجهيز أو المجهز المحدد بهذا الزر. جرب مرة ثانية.` };
      }

      const updated = await prisma.companyPreparerShoppingDraft.update({
        where: { id: draft.id },
        data: { preparerId: preparer.id }
      });

      return {
        reply: `تم يا أبو الأكبر! أسندت طلب التجهيز #${updated.draftNumber} إلى المجهز (${preparer.name})`
      };
    }

    switch (parsed?.category) {
      case "daily_summary_report": {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const todayOrders = await prisma.order.findMany({
          where: { createdAt: { gte: startOfToday } },
          include: { shop: true, customerRegion: true }
        });

        const totalCount = todayOrders.length;
        const deliveredCount = todayOrders.filter(o => o.status === "delivered" || o.status === "completed").length;
        const pendingCount = todayOrders.filter(o => o.status === "pending" || o.status === "assigned").length;
        const rejectedCount = todayOrders.filter(o => o.status === "rejected" || o.status === "cancelled").length;

        let totalSales = 0;
        let totalProfit = 0;
        todayOrders.forEach(o => {
          if (o.status !== "rejected" && o.status !== "cancelled") {
            totalSales += o.totalAmount ? Number(o.totalAmount) : 0;
            totalProfit += o.deliveryPrice ? Number(o.deliveryPrice) : 0;
          }
        });

        return {
          reply: `📊 **ملخص وتفاصيل اليوم يا أبو الأكبر:**\n📦 **إجمالي الطلبات اليوم:** ${totalCount} طلب (${deliveredCount} واصل | ${pendingCount} قيد التجهيز | ${rejectedCount} مرفوض)\n💰 **إجمالي المبيعات:** ${totalSales} ألف دينار\n💵 **صافي أرباح التوصيل اليوم:** ${totalProfit} ألف دينار 🚀`
        };
      }

      case "orders_assigned_list": {
        const allCouriers = await prisma.courier.findMany();
        let targetCourier = null;
        if (parsed?.courier_name) {
          const { match } = findBestMatch(allCouriers, parsed.courier_name);
          targetCourier = match;
        }

        const whereClause: any = {
          status: { in: ["assigned", "delivering"] }
        };
        if (targetCourier) {
          whereClause.assignedCourierId = targetCourier.id;
        }

        const assignedOrders = await prisma.order.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { shop: true, customerRegion: true, courier: true }
        });

        if (assignedOrders.length === 0) {
          if (targetCourier) {
            return { reply: `يا أبو الأكبر، ماكو أي طلبات مسندة حالياً للكابتن (${targetCourier.name}) 🛵` };
          }
          return { reply: `يا أبو الأكبر، ماكو أي طلبات مسندة للمندوبين حالياً. كل الطلبات إما جديدة معلقة أو مكتملة واصلة! 🚀` };
        }

        const title = targetCourier
          ? `🛵 **الطلبات المسندة للكابتن (${targetCourier.name}) (${assignedOrders.length} طلب):**\n`
          : `🛵 **الطلبات المسندة للمندوبين حالياً (${assignedOrders.length} طلب):**\n`;

        let summary = title;
        assignedOrders.forEach((o, i) => {
          const cName = o.courier?.name || "مندوب";
          const sName = o.shop?.name || "محل";
          const rName = o.customerRegion?.name || "غير محددة";
          const price = o.orderSubtotal ? Number(o.orderSubtotal) : 0;
          summary += `\n${i + 1}. **طلب #${o.orderNumber}** ⬅️ للكابتن (${cName}) | محل: ${sName} | منطقة: ${rName} (${price} ألف)`;
        });

        const buttons = assignedOrders.slice(0, 5).map(o => ({
          text: `🔍 تفاصيل #${o.orderNumber}`,
          action: `تفاصيل طلب ${o.orderNumber}`
        }));

        return {
          reply: summary,
          buttons: buttons
        };
      }

      case "dynamic_assign_order": {
        const { courier_name, target_status, search_query } = parsed;

        const allCouriers = await prisma.courier.findMany();
        if (allCouriers.length === 0) {
          return { reply: `يا أبو الأكبر، ما عندك أي مندوب مسجل بالنظام بعد.` };
        }

        let { match: matchedCourier } = findBestMatch(allCouriers, courier_name || rawText);
        if (!matchedCourier) {
          matchedCourier = allCouriers.find(c => {
            const cleanC = cleanArabicTextForMatch(c.name);
            const cleanT = cleanArabicTextForMatch(rawText);
            return cleanC.length >= 2 && cleanT.includes(cleanC);
          }) || null;
        }

        if (!matchedCourier && allCouriers.length > 0) {
          matchedCourier = allCouriers.find(c => c.name.includes("فارس")) || allCouriers[0];
        }

        const orderNumMatch = rawText.match(/\b\d{3,5}\b/);
        const explicitOrderNum = orderNumMatch ? Number(orderNumMatch[0]) : null;

        let targetOrder = null;
        if (explicitOrderNum) {
          targetOrder = await prisma.order.findUnique({
            where: { orderNumber: explicitOrderNum },
            include: { shop: true, customerRegion: true }
          });
        }

        if (!targetOrder && (target_status === "rejected" || rawText.includes("مرفوض") || rawText.includes("ملغي"))) {
          targetOrder = await prisma.order.findFirst({
            where: { status: { in: ["rejected", "cancelled"] } },
            orderBy: { createdAt: "desc" },
            include: { shop: true, customerRegion: true }
          });
        }

        if (!targetOrder && search_query && search_query.length > 1) {
          const allOrders = await prisma.order.findMany({
            where: { status: { in: ["pending", "assigned"] } },
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { shop: true, customerRegion: true }
          });

          const cleanSearch = cleanArabicTextForMatch(search_query);
          targetOrder = allOrders.find(o => {
            const sName = o.shop ? cleanArabicTextForMatch(o.shop.name) : "";
            const rName = o.customerRegion ? cleanArabicTextForMatch(o.customerRegion.name) : "";
            const oType = o.orderType ? cleanArabicTextForMatch(o.orderType) : "";
            return cleanSearch.includes(sName) || cleanSearch.includes(rName) || cleanSearch.includes(oType) || sName.includes(cleanSearch) || rName.includes(cleanSearch) || oType.includes(cleanSearch);
          }) || null;
        }

        if (!targetOrder) {
          const pendingOrders = await prisma.order.findMany({
            where: { status: "pending" },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { shop: true, customerRegion: true }
          });

          if (pendingOrders.length === 0) {
            return { reply: `يا أبو الأكبر، ما عندك أي طلب جديد معلق حالياً لإسناده للكابتن (${matchedCourier?.name || "المندوب"}).` };
          }

          const buttons = pendingOrders.map(o => ({
            text: `🛵 #${o.orderNumber} | ${o.shop?.name || "محل"} (${o.customerRegion?.name || "منطقة"})`,
            action: `اسند طلب ${o.orderNumber} الى ${matchedCourier?.name || "فارس"}`
          }));

          return {
            reply: `يا أبو الأكبر، أي طلب تريد إسناده للكابتن (${matchedCourier?.name || "المندوب"})؟ اختر من الطلبات المعلقة 👇`,
            buttons: buttons
          };
        }

        if (targetOrder.status === "completed" || targetOrder.status === "delivered") {
          return { reply: `يا أبو الأكبر، طلب #${targetOrder.orderNumber} مكتمل ومسلم بالفعل، فما تقدر تغير إسناده!` };
        }

        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: { assignedCourierId: matchedCourier.id, status: "assigned" },
          include: { shop: true, customerRegion: true }
        });

        ctx.lastOrderNumber = updated.orderNumber;
        ctx.updatedAt = Date.now();

        const shopName = updated.shop ? updated.shop.name : "المحل";
        const regionName = updated.customerRegion ? updated.customerRegion.name : "غير محددة";
        const orderType = updated.orderType || "غير محدد";
        const noteTime = updated.orderNoteTime || "الان";
        const subtotalVal = updated.orderSubtotal ? Number(updated.orderSubtotal) : 0;
        const totalVal = updated.totalAmount ? Number(updated.totalAmount) : subtotalVal;

        return {
          reply: `تم يا أبو الأكبر! أسندت طلب #${updated.orderNumber} إلى الكابتن (${matchedCourier.name}) 🛵\n🏪 **المحل:** ${shopName} | 📍 **المنطقة:** ${regionName}\n📦 **نوع الطلب:** ${orderType} | ⏰ **وقت الطلب:** ${noteTime}\n💰 **سعر الطلب:** ${subtotalVal} ألف (المجموع: ${totalVal} ألف)`
        };
      }

      case "courier_update_name": {
        let oldName = parsed?.old_name || parsed?.courier_name;
        let newName = parsed?.new_name;

        const allCouriers = await prisma.courier.findMany();
        if (allCouriers.length === 0) {
          return { reply: `يا أبو الأكبر، ما عندك أي مندوب مسجل بالنظام بعد.` };
        }

        let targetCourier = null;

        // البحث في كل المندوبين عن أي اسم مذكور بالرسالة
        for (const c of allCouriers) {
          const cleanC = cleanArabicTextForMatch(c.name);
          const cleanRaw = cleanArabicTextForMatch(rawText);
          if (cleanC.length >= 2 && cleanRaw.includes(cleanC)) {
            targetCourier = c;
            oldName = c.name;
            break;
          }
        }

        if (!newName && rawText) {
          const m = rawText.match(/(?:وسويه|سويه|سوي|اكتبه|غيره إلى|غيره الي|الى|الي)\s*([أ-يa-zA-Z]+)/i);
          if (m) newName = m[1].trim();
        }

        if (!targetCourier && oldName) {
          const { match } = findBestMatch(allCouriers, oldName);
          targetCourier = match;
        }

        if (!targetCourier) {
          return { reply: `يا أبو الأكبر، ما لكيت أي مندوب يطابق الاسم المذكور بالرسالة. المندوبين عندك: ${namesListForReply(allCouriers)}.` };
        }

        if (!newName || newName === targetCourier.name) {
          const words = rawText.split(/\s+/);
          const lastWord = words[words.length - 1]?.replace(/[.,؟!]/g, "");
          if (lastWord && lastWord !== targetCourier.name && lastWord.length >= 2) {
            newName = lastWord;
          }
        }

        if (!newName) {
          return { reply: `يا أبو الأكبر، اذكرلي الاسم الجديد بوضوح لأعدل بيه المندوب (${targetCourier.name}).` };
        }

        const updated = await prisma.courier.update({
          where: { id: targetCourier.id },
          data: { name: newName }
        });

        return {
          reply: `تم يا أبو الأكبر! عدلت اسم الكابتن من (${targetCourier.name}) إلى (${updated.name}) بنجاح 🚀`
        };
      }

      case "courier_hide": {
        const allCouriers = await prisma.courier.findMany();
        const { match, ambiguous } = findBestMatch(allCouriers, parsed?.clean_name);
        if (!match) {
          if (ambiguous.length > 0) {
            return { reply: `يا أبو الأكبر، فيه أكثر من مندوب يشبه هذا الاسم: ${namesListForReply(ambiguous)}. حدد الاسم بالضبط.` };
          }
          return { reply: `يا أبو الأكبر، ما گدرت ألكى مندوب بهذا الاسم. المندوبين عندك: ${namesListForReply(allCouriers)}.` };
        }

        const updated = await prisma.courier.update({
          where: { id: match.id },
          data: { hiddenFromReports: true, availableForAssignment: false }
        });

        return { reply: `تم يا أبو الأكبر! خفيت المندوب (${updated.name}) ونقلته لقائمة المخفيين` };
      }

      case "courier_unhide": {
        const allCouriers = await prisma.courier.findMany();
        const { match, ambiguous } = findBestMatch(allCouriers, parsed?.clean_name);
        if (!match) {
          if (ambiguous.length > 0) {
            return { reply: `يا أبو الأكبر، فيه أكثر من مندوب يشبه هذا الاسم: ${namesListForReply(ambiguous)}. حدد الاسم بالضبط.` };
          }
          return { reply: `يا أبو الأكبر، ما گدرت ألكى مندوب بهذا الاسم. المندوبين عندك: ${namesListForReply(allCouriers)}.` };
        }

        const updated = await prisma.courier.update({
          where: { id: match.id },
          data: { hiddenFromReports: false, availableForAssignment: true }
        });

        return { reply: `تم يا أبو الأكبر! أظهرت المندوب (${updated.name}) ورجعته لقائمة المندوبين النشطين` };
      }

      case "orders_bulk_archive": {
        const allCouriers = await prisma.courier.findMany();
        if (allCouriers.length === 0) {
          return { reply: `يا أبو الأكبر، ما عندك أي مندوب مسجل بالنظام بعد.` };
        }

        const cleanRaw = cleanArabicTextForMatch(rawText);
        const isAllCouriers = cleanRaw.includes("كل المندوبين") || cleanRaw.includes("جميع المندوبين") || cleanRaw.includes("لكل المندوبين");

        let matchedCouriers: typeof allCouriers = [];
        if (isAllCouriers) {
          matchedCouriers = allCouriers;
        } else {
          for (const c of allCouriers) {
            const cleanC = cleanArabicTextForMatch(c.name);
            if (cleanC.length >= 2 && cleanRaw.includes(cleanC)) {
              matchedCouriers.push(c);
            }
          }
        }

        // إذا لم نجد أسماء صريحة ولكن مرر parsed.courier_name
        if (matchedCouriers.length === 0 && parsed?.courier_name) {
          const { match } = findBestMatch(allCouriers, parsed.courier_name);
          if (match) matchedCouriers.push(match);
        }

        // إذا لم نجد أي مندوب في نص الرسالة
        if (matchedCouriers.length === 0) {
          const couriersWithDelivered = await prisma.order.findMany({
            where: {
              status: { in: ["delivered", "completed", "received"] },
              assignedCourierId: { not: null }
            },
            select: { courier: true }
          });

          const distinctCouriersMap = new Map();
          couriersWithDelivered.forEach(o => {
            if (o.courier) distinctCouriersMap.set(o.courier.id, o.courier);
          });
          const availableCouriers = Array.from(distinctCouriersMap.values());

          const buttons = (availableCouriers.length > 0 ? availableCouriers : allCouriers).slice(0, 6).map(c => ({
            text: `📦 أرشفة مسلمات (${c.name})`,
            action: `ارشف كل طلبيات ${c.name} المسلمة`
          }));

          return {
            reply: `يا أبو الأكبر، قصدك أرشفة الطلبات المسلمة لأي مندوب؟ اذكر اسمه أو اختر من الأزرار 👇`,
            buttons: buttons
          };
        }

        // الآن نقوم بأرشفة الطلبات المسلمة فقط لكل مندوب تم تحديده
        let results: Array<{
          courier: any;
          archivedCount: number;
          undeliveredCount: number;
        }> = [];

        let totalArchived = 0;

        for (const courier of matchedCouriers) {
          // 1. جلب الطلبات المسلمة فقط لهذا المندوب
          const deliveredOrders = await prisma.order.findMany({
            where: {
              assignedCourierId: courier.id,
              status: { in: ["delivered", "completed", "received"] }
            },
            select: { id: true, orderNumber: true }
          });

          // 2. حساب الطلبات غير المسلمة التي بقت قيد التوصيل
          const undeliveredCount = await prisma.order.count({
            where: {
              assignedCourierId: courier.id,
              status: { in: ["assigned", "delivering", "pending"] }
            }
          });

          if (deliveredOrders.length > 0) {
            const ids = deliveredOrders.map(o => o.id);
            await prisma.order.updateMany({
              where: { id: { in: ids } },
              data: {
                status: "archived",
                archivedAt: new Date()
              }
            });
            totalArchived += deliveredOrders.length;
          }

          results.push({
            courier,
            archivedCount: deliveredOrders.length,
            undeliveredCount
          });
        }

        // صياغة الرد اللبق والتأكيد على شرط المسلمة كما طلب المستخدم بالحرف
        if (results.length === 1) {
          const res = results[0];
          if (res.archivedCount > 0) {
            const undeliveredNote = res.undeliveredCount > 0
              ? `(ملاحظة: الطلبات غير المسلمة (${res.undeliveredCount} طلب) بقت قيد التوصيل).`
              : `(ملاحظة: لا توجد طلبات أخرى قيد التوصيل لهذا المندوب).`;

            return {
              reply: `تمت أرشفة (${res.archivedCount}) طلب مسلّم للمندوب ${res.courier.name} بنجاح 📦✨\n${undeliveredNote}`
            };
          } else {
            const undeliveredNote = res.undeliveredCount > 0
              ? ` (عنده حالياً ${res.undeliveredCount} طلبات قيد التوصيل لم تسلّم بعد).`
              : ``;
            return {
              reply: `ماكو طلبيات مسلمة حالياً للمندوب (${res.courier.name}) حتى تتأرشف 🌸${undeliveredNote}`
            };
          }
        } else {
          // عدة مندوبين
          if (totalArchived > 0) {
            let replyText = `تمت أرشفة الطلبات المسلمة بنجاح يا أبو الأكبر 📦✨:\n`;
            results.forEach(res => {
              if (res.archivedCount > 0) {
                const undNote = res.undeliveredCount > 0 ? `(${res.undeliveredCount} بقت قيد التوصيل)` : `(كل طلباته مسلمة)`;
                replyText += `\n• **الكابتن (${res.courier.name}):** تمت أرشفة ${res.archivedCount} طلب مسلّم ${undNote}`;
              } else {
                const undNote = res.undeliveredCount > 0 ? `(عنده ${res.undeliveredCount} طلبات قيد التوصيل)` : `(لا توجد طلبات)`;
                replyText += `\n• **الكابتن (${res.courier.name}):** لا توجد طلبات مسلمة لأرشفتها ${undNote}`;
              }
            });
            replyText += `\n\n🎯 **المجموع الكلي المؤرشف:** ${totalArchived} طلب مسلّم.`;
            return { reply: replyText };
          } else {
            return {
              reply: `ماكو أي طلبيات مسلمة حالياً للمندوبين المحددين (${results.map(r => r.courier.name).join("، ")}) حتى تتأرشف 🌸 (الطلبات الحالية بقت قيد التوصيل).`
            };
          }
        }
      }

      case "get_learned_rules_list": {
        let rules = await (prisma as any).aiLearnedRule.findMany({
          where: { isActive: true },
          orderBy: { hitCount: "desc" },
          take: 15
        }).catch(() => []);

        // إذا كانت القواعد فارغة، نزرع القواعد الأساسية فوراً في سوبابيس!
        if (!rules || rules.length === 0) {
          const defaultRules = [
            { triggerPattern: "ارشفه طلبات المندوب المسلمه", intentCategory: "orders_bulk_archive", examples: ["كل طلبات في المندوب احمد المسلمه سوي لهن ارشفه", "ارشف طلبات فارس"] },
            { triggerPattern: "الطلبات الجديده والمعلقه", intentCategory: "pending_orders_list", examples: ["الطلبات الجديده", "شكو طلبات معلقة", "اريد اعرف الطلبات الجديدة"] },
            { triggerPattern: "تفاصيل اخر طلب", intentCategory: "last_order_details", examples: ["اخر طلب", "شنو اخر طلب", "انطيني اخر طلب دخل"] },
            { triggerPattern: "انشاء طلب مبيعات جديد", intentCategory: "order_create", examples: ["سوي لي طلب جديد من محل كذا الى كذا", "ضيف طلب"] },
            { triggerPattern: "تعديل نوع او سعر الطلب", intentCategory: "focused_order_edit", examples: ["طلب رقم 2071 عدل نوع الطلب سويه مسواق", "غير السعر الى 10"] },
            { triggerPattern: "الغاء اسناد الطلب وارجاعه جديد", intentCategory: "order_unassign", examples: ["الغي الاسناد", "رجعه جديد", "سوي جديد للطلب"] },
            { triggerPattern: "رفض او الغاء الطلب", intentCategory: "order_cancel_or_reject", examples: ["ارفض الطلب", "الغي الطلب", "سوي مرفوض"] },
            { triggerPattern: "اسناد الطلب لكابتن مندوب", intentCategory: "dynamic_assign_order", examples: ["اسند طلب 2054 الى فارس", "حوله للمندوب boos"] },
            { triggerPattern: "تقرير وملخص الارباح اليومي", intentCategory: "daily_summary_report", examples: ["ملخص اليوم", "شكد ارباحنا اليوم", "انطيني ارباح اليوم"] }
          ];

          for (const dr of defaultRules) {
            await (prisma as any).aiLearnedRule.create({
              data: {
                triggerPattern: dr.triggerPattern,
                intentCategory: dr.intentCategory,
                examples: dr.examples,
                hitCount: 1,
                isActive: true
              }
            }).catch(() => {});
          }

          rules = await (prisma as any).aiLearnedRule.findMany({
            where: { isActive: true },
            orderBy: { hitCount: "desc" },
            take: 15
          }).catch(() => []);
        }

        let replyText = `📊 **القواعد والأوامر البرمجية النشطة والمخزنة في قاعدة البيانات سوبابيس (Supabase Memory):**\n\n`;
        rules.forEach((r: any, idx: number) => {
          replyText += `${idx + 1}. **النمط:** "${r.triggerPattern}" ➡️ **الفئة الإجرائية:** (${r.intentCategory}) | **الاستخدام:** ${r.hitCount} مرة\n`;
        });
        replyText += `\n✨ **ملاحظة:** أي أمر جديد تنطقه أو تكتبه يتم برمجته وتخزينه تلقائياً في سوبابيس لتنفيذه في المرات القادمة فوراً! 🚀`;

        return { reply: replyText };
      }

      case "focused_order_edit": {
        const { explicit_order_number, field, raw_text, number_val } = parsed;

        let targetOrder = null;
        if (explicit_order_number) {
          targetOrder = await prisma.order.findUnique({ where: { orderNumber: explicit_order_number }, include: { shop: true, customerRegion: true } });
        } else if (ctx.activeFocusedOrderId) {
          targetOrder = await prisma.order.findUnique({ where: { id: ctx.activeFocusedOrderId }, include: { shop: true, customerRegion: true } });
        } else if (ctx.lastOrderNumber) {
          targetOrder = await prisma.order.findUnique({ where: { orderNumber: ctx.lastOrderNumber }, include: { shop: true, customerRegion: true } });
        }

        if (!targetOrder) {
          return { reply: `يا أبو الأكبر، ما أعرف أي طلب تقصد. اذكرلي رقم الطلب صراحة (مثلاً: "رقم 231").` };
        }

        if (number_val === null && field !== "region" && field !== "phone" && field !== "order_type") {
          return { reply: `يا أبو الأكبر، ما لكيت رقم واضح بالرسالة أعدل بيه. اكتب القيمة الجديدة بوضوح.` };
        }

        let updateData: any = {};

        if (field === "order_type") {
          let newType = "مسواق";
          const cleanT = raw_text.toLowerCase();
          if (cleanT.includes("مسواق") || cleanT.includes("مسواك") || cleanT.includes("تسوق")) newType = "مسواق";
          else if (cleanT.includes("روبيان") || cleanT.includes("سمك")) newType = "روبيان";
          else if (cleanT.includes("ورد") || cleanT.includes("زهور")) newType = "ورد";
          else if (cleanT.includes("كيك") || cleanT.includes("حلويات")) newType = "حلويات";
          else if (cleanT.includes("طعام") || cleanT.includes("مطعم") || cleanT.includes("اكل")) newType = "طعام";
          else if (cleanT.includes("اقمشه") || cleanT.includes("أقمشة") || cleanT.includes("قماش") || cleanT.includes("ملابس") || cleanT.includes("ازياء")) newType = "اقمشه";
          else if (cleanT.includes("مواد") || cleanT.includes("منزلية") || cleanT.includes("منزليه")) newType = "مواد منزلية";

          updateData.orderType = newType;
        } else if (field === "phone") {
          const phoneMatch = raw_text.match(/(?:\+964|0)?7[3-9][\d\s]{7,12}\d/);
          if (!phoneMatch) {
            return { reply: `يا أبو الأكبر، ما لكيت رقم هاتف واضح بالرسالة.` };
          }
          updateData.customerPhone = phoneMatch[0].replace(/\s+/g, "");
        } else if (field === "delivery_price") {
          updateData.deliveryPrice = new Decimal(number_val);
          const currentSubtotal = targetOrder.orderSubtotal ? Number(targetOrder.orderSubtotal) : 0;
          updateData.totalAmount = new Decimal(currentSubtotal + number_val);
        } else if (field === "subtotal") {
          updateData.orderSubtotal = new Decimal(number_val);
          const currentDelivery = targetOrder.deliveryPrice ? Number(targetOrder.deliveryPrice) : 0;
          updateData.totalAmount = new Decimal(number_val + currentDelivery);
        } else if (field === "region") {
          const allRegions = await prisma.region.findMany();
          let regionNameQuery = raw_text
            .replace(/سوي|تعديل|لهذا|الطلب|عدل|غير|بدل|المنطقة|المنطقه|منطقة|منطقه|وسوي|لـ|الي|إلى/gi, "")
            .replace(/[.,؟]/g, "")
            .trim();

          let { match, ambiguous } = findBestMatch(allRegions, regionNameQuery || raw_text);
          if (!match && regionNameQuery.length >= 2) {
            match = await prisma.region.create({
              data: {
                name: regionNameQuery,
                deliveryPrice: new Decimal(5)
              }
            });
          }

          if (!match) {
            if (ambiguous.length > 0) {
              return { reply: `يا أبو الأكبر، فيه أكثر من منطقة تشبه هذا الاسم: ${namesListForReply(ambiguous)}. حدد المنطقة بالضبط.` };
            }
            return { reply: `يا أبو الأكبر، ما گدرت ألكى منطقة مطابقة بالرسالة.` };
          }
          updateData.customerRegionId = match.id;
        }

        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: updateData,
          include: { shop: true, customerRegion: true, courier: true }
        });

        ctx.lastOrderNumber = updated.orderNumber;
        ctx.updatedAt = Date.now();

        const shopName = updated.shop ? updated.shop.name : "المحل";
        const regionName = updated.customerRegion ? updated.customerRegion.name : "غير محددة";
        const courierName = updated.courier ? updated.courier.name : "غير مسند";
        const subtotalVal = updated.orderSubtotal ? Number(updated.orderSubtotal) : 0;
        const deliveryVal = updated.deliveryPrice ? Number(updated.deliveryPrice) : 0;
        const currentType = updated.orderType || "غير محدد";

        return {
          reply: `يابا الطلبية رقم #${updated.orderNumber} لـ (${shopName}) تم تعديلها وصارت (النوع: ${currentType} | المنطقة: ${regionName} | سعر الطلب: ${subtotalVal} ألف | سعر التوصيل: ${deliveryVal} ألف | المندوب: ${courierName}) 🚀`
        };
      }

      case "pending_orders_list": {
        const pendingOrders = await prisma.order.findMany({
          where: { status: "pending" },
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { shop: true, customerRegion: true }
        });

        if (pendingOrders.length === 0) {
          return { reply: `يا أبو الأكبر! لا تتوفر أي طلبات جديدة بحالة (pending) حالياً في النظام. 🎉` };
        }

        const countAll = await prisma.order.count({ where: { status: "pending" } });
        let replyText = `📋 **الطلبات الجديدة المعلقة حالياً (${countAll} طلبات):**\n\n`;
        const buttons: { text: string; action: string }[] = [];

        pendingOrders.forEach((ord, index) => {
          const sName = ord.shop ? ord.shop.name : "غير محدد";
          const rName = ord.customerRegion ? ord.customerRegion.name : "غير محددة";
          const total = ord.totalAmount ? Number(ord.totalAmount) : 0;
          replyText += `${index + 1}. **طلب #${ord.orderNumber}** | المحل: **${sName}** | المنطقة: **${rName}** | المبلغ: **${total} ألف**\n`;
          buttons.push({
            text: `🔎 تفاصيل طلب #${ord.orderNumber}`,
            action: `order_details_${ord.orderNumber}`
          });
        });

        return { reply: replyText, buttons: buttons.slice(0, 5) };
      }

      case "last_order_details": {
        const latestOrder = await prisma.order.findFirst({
          orderBy: { createdAt: "desc" },
          include: { shop: true, customerRegion: true, courier: true }
        });

        if (!latestOrder) {
          return { reply: `يا أبو الأكبر! لا تتوفر أي طلبات مسجلة في قاعدة البيانات حالياً.` };
        }

        ctx.lastOrderNumber = latestOrder.orderNumber;
        ctx.updatedAt = Date.now();

        const statusArMap: Record<string, string> = {
          pending: "جديد",
          assigned: "مسند",
          delivered: "مستلم",
          completed: "مسلم",
          rejected: "مرفوض",
          archived: "مؤرشف"
        };
        const statusAr = statusArMap[latestOrder.status] || latestOrder.status;

        const shopName = latestOrder.shop ? latestOrder.shop.name : "غير محدد";
        const regionName = latestOrder.customerRegion ? latestOrder.customerRegion.name : "غير محددة";
        const phone = latestOrder.customerPhone || "لا يوجد";
        const price = latestOrder.totalAmount ? Number(latestOrder.totalAmount) : 0;
        const courierName = latestOrder.courier ? latestOrder.courier.name : "غير مسند بعد";

        const allCouriers = await prisma.courier.findMany({ take: 5 });
        const buttons = allCouriers.map(c => ({
          text: `🛵 إسناد لـ كابتن: ${c.name}`,
          action: `assign_order_${latestOrder.id}_courier_${c.id}`
        }));

        return {
          reply: `📌 **تفاصيل أحدث / آخر طلب في النظام يا أبو الأكبر:**\n🔹 **طلب رقم:** #${latestOrder.orderNumber}\n🏪 **المحل:** ${shopName} | 📍 **المنطقة:** ${regionName}\n📞 **الهاتف:** ${phone} | 💰 **المبلغ:** ${price} ألف\n📊 **الحالة:** (${statusAr}) | 🛵 **المندوب:** ${courierName}\n\n👇 **اختر الكابتن للإسناد المباشر بالنقر أدناه:**`,
          buttons: buttons
        };
      }

      case "last_rejected_order": {
        let rejectedOrder = await prisma.order.findFirst({
          where: { OR: [{ status: "rejected" }, { status: "cancelled" }] },
          orderBy: { createdAt: "desc" },
          include: { shop: true, customerRegion: true }
        });

        if (!rejectedOrder) {
          return { reply: `يا أبو الأكبر! لا يوجد أي طلب مرفوض أو ملغي بقاعدة البيانات حالياً! 🎉` };
        }

        ctx.lastOrderNumber = rejectedOrder.orderNumber;
        ctx.updatedAt = Date.now();

        const allCouriers = await prisma.courier.findMany();
        const courierButtons = allCouriers.slice(0, 5).map(c => ({
          text: `🛵 إسناد لـ كابتن: ${c.name}`,
          action: `assign_order_${rejectedOrder!.id}_${c.id}`
        }));

        const regionName = rejectedOrder.customerRegion ? rejectedOrder.customerRegion.name : "غير محددة";
        const shopName = rejectedOrder.shop ? rejectedOrder.shop.name : "المحل";
        const phone = rejectedOrder.customerPhone || "لا يوجد";
        const total = rejectedOrder.totalAmount ? Number(rejectedOrder.totalAmount) : 0;

        return {
          reply: `📌 **تفاصيل آخر طلب مرفوض / ملغى يا أبو الأكبر:**\n🔹 **طلب رقم:** #${rejectedOrder.orderNumber}\n🏪 **المحل:** ${shopName} | 📍 **المنطقة:** ${regionName}\n📞 **الهاتف:** ${phone} | 💰 **المبلغ:** ${total} ألف\n\n👇 **اختر الكابتن (المندوب) للإسناد المباشر بالنقر أدناه:**`,
          buttons: courierButtons
        };
      }

      case "friendly_greeting": {
        return {
          reply: `هلا وغلا بيك يا أبو الأكبر، نورتني يا غالي! 🌸\nأنا بخير وبأفضل حال ما دمت بخير. آمرني وتدلل، جاهز لتنفيذ أي أمر تريده فوراً! 🚀✨`
        };
      }

      case "order_cancel_or_reject": {
        const { order_number, shop_name } = parsed;
        let targetOrder = null;

        if (order_number) {
          targetOrder = await prisma.order.findUnique({ where: { orderNumber: order_number }, include: { shop: true } });
        }

        // إذا لم يحدد رقم طلب وكان هناك طلب مفتوح بالسياق الحي
        if (!targetOrder && !order_number && ctx.lastOrderNumber) {
          targetOrder = await prisma.order.findUnique({
            where: { orderNumber: ctx.lastOrderNumber },
            include: { shop: true }
          });
        }

        if (!targetOrder && shop_name) {
          const allShops = await prisma.shop.findMany();
          const { match, ambiguous } = findBestMatch(allShops, shop_name);
          if (ambiguous.length > 0) {
            return { reply: `يا أبو الأكبر، فيه أكثر من محل يشبه هذا الاسم: ${namesListForReply(ambiguous)}. حدد المحل بالضبط.` };
          }
          if (match) {
            targetOrder = await prisma.order.findFirst({
              where: { shopId: match.id, status: { in: ["pending", "assigned"] } },
              orderBy: { createdAt: "desc" },
              include: { shop: true }
            });
          }
        }

        if (!targetOrder && !order_number && !shop_name) {
          targetOrder = await prisma.order.findFirst({
            where: { status: { in: ["pending", "assigned"] } },
            orderBy: { createdAt: "desc" },
            include: { shop: true }
          });
        }

        if (!targetOrder) {
          return { reply: `يا أبو الأكبر! لم أجد أي طلب معلق أو محدد لإلغائه أو رفضه حالياً!` };
        }

        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: { status: "rejected" }
        });

        return { reply: `تم يا أبو الأكبر! غيرت حالة طلب #${updated.orderNumber} لـ (${targetOrder.shop.name}) إلى (مرفوض / ملغى)` };
      }

      case "order_unassign": {
        const { order_number, shop_name } = parsed;
        let targetOrder = null;

        if (order_number) {
          targetOrder = await prisma.order.findUnique({ where: { orderNumber: order_number }, include: { shop: true } });
        }

        if (!targetOrder && shop_name) {
          const allShops = await prisma.shop.findMany();
          const { match } = findBestMatch(allShops, shop_name);
          if (match) {
            targetOrder = await prisma.order.findFirst({
              where: { shopId: match.id, status: { in: ["assigned", "delivered", "pending"] } },
              orderBy: { createdAt: "desc" },
              include: { shop: true }
            });
          }
        }

        if (!targetOrder) {
          targetOrder = await prisma.order.findFirst({
            where: { status: "assigned" },
            orderBy: { createdAt: "desc" },
            include: { shop: true }
          });
        }

        if (!targetOrder) {
          return { reply: `يا أبو الأكبر! ما لقيت أي طلب مسند لإلغاء إسناده حالياً.` };
        }

        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: { assignedCourierId: null, status: "pending" },
          include: { shop: true }
        });

        ctx.lastOrderNumber = updated.orderNumber;
        ctx.updatedAt = Date.now();

        const sName = updated.shop ? updated.shop.name : "المحل";
        return { reply: `تم يا أبو الأكبر! ألغيت إسناد طلب #${updated.orderNumber} لـ (${sName}) ورجعته لحالة (جديد) 🚀` };
      }

      case "order_details": {
        const { order_number } = parsed;
        const targetOrder = await prisma.order.findUnique({
          where: { orderNumber: order_number },
          include: { shop: true, customerRegion: true, courier: true }
        });

        if (!targetOrder) {
          return { reply: `يا أبو الأكبر، ما لقيت أي طلب برقم #${order_number} في قواعد البيانات.` };
        }

        ctx.lastOrderNumber = targetOrder.orderNumber;
        ctx.updatedAt = Date.now();

        const statusArMap: Record<string, string> = {
          pending: "جديد",
          assigned: "مسند",
          delivered: "مستلم",
          completed: "مسلم",
          rejected: "مرفوض",
          archived: "مؤرشف"
        };
        const statusAr = statusArMap[targetOrder.status] || targetOrder.status;

        const shopName = targetOrder.shop ? targetOrder.shop.name : "غير محدد";
        const regionName = targetOrder.customerRegion ? targetOrder.customerRegion.name : "غير محدد";
        const phone = targetOrder.customerPhone || "لا يوجد";
        const price = targetOrder.totalAmount ? Number(targetOrder.totalAmount) : 0;
        const courierName = targetOrder.courier ? targetOrder.courier.name : "غير مسند بعد";

        const allCouriers = await prisma.courier.findMany({ take: 5 });
        const buttons = allCouriers.map(c => ({
          text: `🛵 إسناد لـ كابتن: ${c.name}`,
          action: `assign_order_${targetOrder.id}_courier_${c.id}`
        }));

        return {
          reply: `📌 **تفاصيل الطلب رقم #${targetOrder.orderNumber} يا أبو الأكبر:**\n🏪 **المحل:** ${shopName} | 📍 **المنطقة:** ${regionName}\n📞 **الهاتف:** ${phone} | 💰 **المبلغ:** ${price} ألف\n🚦 **الحالة الحالية:** (${statusAr}) | 🛵 **المندوب:** (${courierName})\n\n👇 **اختر الكابتن للإسناد المباشر بالنقر أدناه:**`,
          buttons: buttons
        };
      }

      case "who_are_you": {
        return {
          reply: "أنا المساعد الذكي الخاص بنظامك يا أبو الأكبر! أتحكم بالطلبات، المندوبين، المجهزين، والديون فورياً! 🚀"
        };
      }

      case "order_single_status_change": {
        const { order_number, target_status } = parsed;
        let targetOrder = null;
        if (order_number) {
          targetOrder = await prisma.order.findUnique({ where: { orderNumber: order_number }, include: { shop: true } });
        } else if (ctx.lastOrderNumber) {
          targetOrder = await prisma.order.findUnique({ where: { orderNumber: ctx.lastOrderNumber }, include: { shop: true } });
        }

        if (!targetOrder) {
          return { reply: `يا أبو الأكبر! لم أجد الطلب رقم #${order_number} في قواعد البيانات لتعديله!` };
        }

        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: { status: target_status }
        });

        const statusArMap: Record<string, string> = {
          rejected: "مرفوض",
          completed: "مسلم",
          delivered: "مستلم",
          assigned: "مسند",
          pending: "جديد",
          archived: "مؤرشف"
        };
        const statusAr = statusArMap[target_status] || "مرفوض";

        return { reply: `تم يا أبو الأكبر! غيرت حالة طلب #${updated.orderNumber} إلى (${statusAr})` };
      }

      case "bulk_order_status_update": {
        const { target_status, courier_name, shop_name } = parsed;

        if (!courier_name && !shop_name) {
          return { reply: `يا أبو الأكبر، لازم تحدد اسم المندوب أو المحل اللي تريد تحدث طلباته جميعاً.` };
        }

        let matchedCourierId: string | null = null;
        let matchedShopId: string | null = null;
        let label = "";

        if (courier_name) {
          const allCouriers = await prisma.courier.findMany();
          const { match, ambiguous } = findBestMatch(allCouriers, courier_name);
          if (!match) {
            if (ambiguous.length > 0) {
              return { reply: `يا أبو الأكبر، فيه أكثر من مندوب يشبه هذا الاسم: ${namesListForReply(ambiguous)}. حدد الاسم بالضبط.` };
            }
            return { reply: `يا أبو الأكبر، ما گدرت ألكى مندوب بهذا الاسم. المندوبين عندك: ${namesListForReply(allCouriers)}.` };
          }
          matchedCourierId = match.id;
          label = `مندوب (${match.name})`;
        }

        if (shop_name) {
          const allShops = await prisma.shop.findMany();
          const { match, ambiguous } = findBestMatch(allShops, shop_name);
          if (!match) {
            if (ambiguous.length > 0) {
              return { reply: `يا أبو الأكبر، فيه أكثر من محل يشبه هذا الاسم: ${namesListForReply(ambiguous)}. حدد المحل بالضبط.` };
            }
            return { reply: `يا أبو الأكبر، ما گدرت ألكى محل بهذا الاسم.` };
          }
          matchedShopId = match.id;
          label = label ? `${label} ومحل (${match.name})` : `محل (${match.name})`;
        }

        const where: any = { status: { not: target_status } };
        if (matchedCourierId) where.assignedCourierId = matchedCourierId;
        if (matchedShopId) where.shopId = matchedShopId;

        const affectedOrders = await prisma.order.findMany({ where });
        if (affectedOrders.length === 0) {
          return { reply: `يا أبو الأكبر، ما لكيت أي طلبات مطابقة لتحديثها بحالة (${target_status}).` };
        }

        await prisma.order.updateMany({ where, data: { status: target_status } });

        return { reply: `تم يا أبو الأكبر! حدثت حالة ${affectedOrders.length} طلب الخاصين بـ ${label} إلى (${target_status})` };
      }

      case "prep_draft": {
        const fullText = parsed?.raw_query || rawText;
        const itemsText = extractPrepItemsFromText(fullText);
        if (!itemsText) {
          return { reply: `يا أبو الأكبر، ما گدرت ألكى قائمة مواد واضحة بالرسالة. اكتب المواد المطلوبة صراحة.` };
        }

        const allPreparers = await prisma.companyPreparer.findMany();
        const { match: assignedPreparer, ambiguous: preparerAmbiguous } = findBestMatch(
          allPreparers,
          allPreparers.find(p => fullText.toLowerCase().includes(p.name.toLowerCase()))?.name || null
        );
        if (preparerAmbiguous.length > 0) {
          return { reply: `يا أبو الأكبر، فيه أكثر من مجهز يشبه الاسم المذكور: ${namesListForReply(preparerAmbiguous)}. حدد المجهز بالضبط.` };
        }

        const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
        const matchingRegion = allRegions.find(r => fullText.includes(r.name)) || null;

        const phoneMatch = fullText.match(/(?:\+964|0)?7[3-9][\d\s]{7,12}\d/);
        const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : null;

        const draft = await prisma.companyPreparerShoppingDraft.create({
          data: {
            preparerId: assignedPreparer ? assignedPreparer.id : null,
            rawListText: itemsText,
            customerPhone: phone,
            customerRegionId: matchingRegion?.id || null,
            titleLine: `تجهيز ${matchingRegion?.name || "بدون منطقة محددة"}`,
            status: "draft"
          }
        });

        const regionTitle = matchingRegion ? matchingRegion.name : "غير محددة";
        const phoneNote = phone ? "" : "\n⚠️ ما لكيت رقم هاتف بالرسالة، رجاءً ضيفه يدوياً.";

        if (assignedPreparer) {
          return {
            reply: `تم يا أبو الأكبر! أنشأت طلب تجهيز جديد #${draft.draftNumber} لـ (${regionTitle}) | المجهز: (${assignedPreparer.name})\n📝 المواد: ${itemsText}${phoneNote}`
          };
        }

        const preparerButtons = allPreparers.slice(0, 5).map(p => ({
          text: `👨‍🍳 إسناد لـ: ${p.name}`,
          action: `assign_prep_${draft.id}_${p.id}`
        }));

        return {
          reply: `تم يا أبو الأكبر! أنشأت طلب تجهيز جديد #${draft.draftNumber} لـ (${regionTitle})\n📝 المواد: ${itemsText}${phoneNote}\n\n👇 **اختر المجهز المطلوب بالنقر المباشر أدناه:**`,
          buttons: preparerButtons
        };
      }

      case "order_create": {
        const initialDraft: OrderDraftState = {
          step: "waiting_shop",
          shopId: null,
          shopName: null,
          regionId: null,
          regionName: null,
          phone: null,
          orderType: null,
          price: undefined,
          noteTime: null
        };

        const wizardRes = await handleOrderCreationWizard(rawText, initialDraft, ctx);
        ctx.orderDraft = wizardRes.nextDraft || null;
        ctx.updatedAt = Date.now();
        await savePersistentSessionContext(sessionKey, ctx);
        return { reply: wizardRes.reply!, buttons: wizardRes.buttons };
      }

      case "debt_record": {
        const isTook = parsed?.debt_kind === "took";
        const kind = isTook ? "took" : "gave";

        if (!parsed?.amount) {
          return { reply: `يا أبو الأكبر، ما لكيت مبلغ واضح بالرسالة. اذكر المبلغ صراحة.` };
        }
        if (!parsed?.clean_name) {
          return { reply: `يا أبو الأكبر، ما لكيت اسم واضح للشريك/المحل بالرسالة. حدد الاسم.` };
        }

        const finalAmount = parsed.amount;
        const targetName = parsed.clean_name;

        const allPartners = await prisma.creditBookPartner.findMany();
        const { match: existingPartner, ambiguous } = findBestMatch(allPartners, targetName);
        if (ambiguous.length > 0) {
          return { reply: `يا أبو الأكبر، فيه أكثر من شريك يشبه هذا الاسم: ${namesListForReply(ambiguous)}. حدد الاسم بالضبط.` };
        }

        const partner = existingPartner || await prisma.creditBookPartner.create({
          data: { name: targetName, type: "external" }
        });

        await prisma.creditBookTransaction.create({
          data: {
            partnerId: partner.id,
            amount: new Decimal(finalAmount),
            kind: kind,
            note: `معاملة صريحة بواسطة محرك النظام الذكي`
          }
        });

        const allTx = await prisma.creditBookTransaction.findMany({ where: { partnerId: partner.id } });
        let totalGave = 0;
        let totalTook = 0;
        allTx.forEach(t => {
          const val = t.amount.toNumber();
          if (t.kind === "gave") totalGave += val;
          else if (t.kind === "took") totalTook += val;
        });

        const netBalance = totalGave - totalTook;
        let balanceText = "";
        if (netBalance > 0) balanceText = `وصار نطلبه (${netBalance})`;
        else if (netBalance < 0) balanceText = `وصار يطلبنا (${Math.abs(netBalance)})`;
        else balanceText = `وصار الحساب متصفر (0)`;

        const actionWord = isTook ? "نزلت" : "ضفت";

        return { reply: `تم يا أبو الأكبر! ${actionWord} ${finalAmount} بحساب (${partner.name}) ${balanceText}` };
      }

      case "order_update": {
        const orderNum = parsed?.order_number || ctx.lastOrderNumber || null;
        const courierName = parsed?.clean_name;

        let targetOrder = null;
        if (orderNum) {
          targetOrder = await prisma.order.findUnique({ where: { orderNumber: orderNum }, include: { shop: true } });
        }

        if (!targetOrder) {
          return { reply: `يا أبو الأكبر، ما أعرف أي طلب تقصد. اذكرلي رقم الطلب صراحة.` };
        }

        if (targetOrder.status === "completed") {
          return { reply: `يا أبو الأكبر، طلب #${targetOrder.orderNumber} مكتمل ومسلم بالفعل، فما تقدر تغير إسناده!` };
        }

        const allCouriers = await prisma.courier.findMany();
        let { match: matchedCourier } = findBestMatch(allCouriers, courierName || rawText);
        if (!matchedCourier) {
          matchedCourier = allCouriers.find(c => {
            const cleanC = cleanArabicTextForMatch(c.name);
            const cleanT = cleanArabicTextForMatch(rawText);
            return cleanC.length >= 2 && cleanT.includes(cleanC);
          }) || null;
        }

        if (!matchedCourier && allCouriers.length > 0) {
          matchedCourier = allCouriers.find(c => c.name.includes("فارس")) || allCouriers[0];
        }

        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: { assignedCourierId: matchedCourier.id, status: "assigned" }
        });

        ctx.lastOrderNumber = updated.orderNumber;
        ctx.updatedAt = Date.now();

        return { reply: `تم يا أبو الأكبر! أسندت طلب #${updated.orderNumber} لـ (${targetOrder.shop.name}) إلى الكابتن (${matchedCourier.name})` };
      }

      case "courier_create": {
        const courierName = parsed?.clean_name;
        const phone = parsed?.phone;

        if (!courierName) {
          return { reply: `يا أبو الأكبر، ما لكيت اسم واضح للمندوب الجديد بالرسالة.` };
        }
        if (!phone) {
          return { reply: `يا أبو الأكبر، ما لكيت رقم هاتف واضح للمندوب الجديد بالرسالة.` };
        }

        const existingCourier = await prisma.courier.findFirst({
          where: { name: { contains: courierName, mode: "insensitive" } }
        });

        if (existingCourier) {
          const updated = await prisma.courier.update({
            where: { id: existingCourier.id },
            data: { name: courierName, phone: phone, hiddenFromReports: false, availableForAssignment: true }
          });
          return { reply: `تم يا أبو الأكبر! حدثت بيانات المندوب (${updated.name}) برقم ${phone}` };
        }

        const newCourier = await prisma.courier.create({
          data: { name: courierName, phone: phone, hiddenFromReports: false, availableForAssignment: true }
        });

        return { reply: `تم يا أبو الأكبر! ضفت المندوب الجديد (${newCourier.name}) برقم ${phone}` };
      }

      case "courier_zero": {
        const allCouriers = await prisma.courier.findMany();
        if (allCouriers.length === 0) {
          return { reply: `يا أبو الأكبر، ما عندك أي مندوب مسجل بالنظام لتصفير حسابه.` };
        }

        const { match, ambiguous } = findBestMatch(allCouriers, parsed?.clean_name);
        if (!match) {
          const buttons = allCouriers.slice(0, 6).map(c => ({
            text: `🛵 ${c.name}`,
            action: `صفر حساب المندوب ${c.name}`
          }));

          if (ambiguous.length > 0) {
            return {
              reply: `يا أبو الأكبر، قصدك تصفير حساب أي مندوب من هذولي؟ 👇`,
              buttons: ambiguous.map(c => ({ text: `🛵 ${c.name}`, action: `صفر حساب المندوب ${c.name}` }))
            };
          }
          return {
            reply: `يا أبو الأكبر، قصدك تصفير حساب أي كابتن مندوب؟ 👇`,
            buttons: buttons
          };
        }

        await prisma.courier.update({
          where: { id: match.id },
          data: { mandoubTotalsResetAt: new Date() }
        });

        return { reply: `تم يا أبو الأكبر! صفرت حساب ومستحقات الكابتن المندوب (${match.name}) بنجاح 🚀` };
      }

      default: {
        try {
          const keys = await getAllActiveGeminiKeys();
          if (keys.length > 0) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keys[0].key}`;
            const gRes = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: `أنت المساعد الذكي الخاص بـ (أبو الأكبر) لإدارة متجره ومنظومة التوصيل.
رد على كلام أبو الأكبر بلهجة عراقية محترمة وذكية ومباشرة بدون تكرار كلامه أو جمل عامة فارغة:
كلام أبو الأكبر: "${rawText}"`
                      }
                    ]
                  }
                ],
                generationConfig: { temperature: 0.3 }
              })
            });
            if (gRes.ok) {
              const gData = await gRes.json();
              const ans = gData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (ans?.trim()) {
                return { reply: ans.trim() };
              }
            }
          }
        } catch (e) {}

        return { reply: `يا أبو الأكبر، استمعت لرسالتك. هل تحب أسويلك طلب جديد أو استعرضلك الطلبات أو المندوبين؟ أمرني بالخدمة! 🌸` };
      }
    }
  } catch (err: any) {
    return {
      reply: `صار خطأ يا أبو الأكبر وأنا أنفذ طلبك، ما تم تنفيذ أي تغيير. جرب مرة ثانية أو تحقق من التفاصيل.`
    };
  }
}

export async function processAdminAiMessage(
  userText: string,
  telegramUserId: string = "default",
  chatId?: string,
  botToken?: string,
  historyArray?: any[]
): Promise<{ reply: string; buttons?: Array<{ text: string; action: string }> }> {
  const sessionKey = chatId || telegramUserId || "default";
  return await executeSuperSystemAgent({ domain: "auto", operation: "auto" }, userText, sessionKey);
}
