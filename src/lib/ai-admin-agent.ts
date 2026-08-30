import { prisma } from "./prisma";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { findMatchingLearnedRule, compileAndSaveNewIntent } from "./ai-intent-compiler";

type ChatSessionContext = {
  lastOrderNumber?: number | null;
  lastOrderType?: string | null;
  activeFocusedOrderId?: string | null;
  updatedAt?: number;
};

// ذاكرة سياق منفصلة لكل محادثة/أدمن بدالة Map حازمة بدلاً من متغير عام واحد
const chatSessionContexts: Map<string, ChatSessionContext> = new Map();

function getSessionContext(sessionKey: string): ChatSessionContext {
  if (!chatSessionContexts.has(sessionKey)) {
    chatSessionContexts.set(sessionKey, {});
  }
  return chatSessionContexts.get(sessionKey)!;
}

/**
 * تصفير وإعادة ضبط ذاكرة سياق محادثة معينة بـ sessionKey
 */
export function resetChatSessionContext(sessionKey: string = "default") {
  chatSessionContexts.delete(sessionKey);
}

/**
 * تعيين وتحديث الطلب النشط المفتوح حالياً بمحادثة معينة
 */
export function setActiveFocusedOrder(sessionKeyOrOrderId: string | number, possibleOrderId?: string | number) {
  let sessionKey = "default";
  let orderIdOrNumber: string | number;

  if (possibleOrderId !== undefined) {
    sessionKey = String(sessionKeyOrOrderId);
    orderIdOrNumber = possibleOrderId;
  } else {
    orderIdOrNumber = sessionKeyOrOrderId;
  }

  const ctx = getSessionContext(sessionKey);
  if (typeof orderIdOrNumber === "number") {
    ctx.lastOrderNumber = orderIdOrNumber;
  } else {
    ctx.activeFocusedOrderId = String(orderIdOrNumber);
  }
  ctx.updatedAt = Date.now();
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

  // 0.005 أرشفة جماعية لطلبات مندوب أو محل أو حالة معينة
  if (
    cleanQ.includes("سوي لهن ارشفه") ||
    cleanQ.includes("سوي لهن أرشفة") ||
    cleanQ.includes("سوي ارشفه") ||
    cleanQ.includes("سوي أرشفة") ||
    cleanQ.includes("ارشف طلبات") ||
    cleanQ.includes("أرشف طلبات") ||
    cleanQ.includes("ارشفة الطلبات") ||
    cleanQ.includes("أرشفة الطلبات") ||
    (cleanQ.includes("ارشفه") && cleanQ.includes("المندوب"))
  ) {
    let courierMatch = text.match(/(?:المندوب|كابتن|لكابتن)\s*([أ-يa-zA-Z\s]+?)(?=\s*(?:المسلمه|المسلمة|سوي|ارشفه|أرشفة)|$)/i);
    let courierName = courierMatch ? courierMatch[1].trim() : null;

    let status = "completed";
    if (cleanQ.includes("مرفوض")) status = "rejected";
    else if (cleanQ.includes("مسلم") || cleanQ.includes("مسلمه") || cleanQ.includes("مسلمة")) status = "completed";

    return {
      category: "orders_bulk_archive",
      courier_name: courierName,
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

  // 0.1 فئة الإسناد الديناميكي المبعثر المتقدم للطلبات
  if (
    cleanQ.includes("اسناد") ||
    cleanQ.includes("إسناد") ||
    cleanQ.includes("اسند") ||
    cleanQ.includes("سوي له اسناد") ||
    cleanQ.includes("سوي اسناد") ||
    cleanQ.includes("سوي لي اسناد") ||
    cleanQ.includes("للمندوب") ||
    cleanQ.includes("للمنجوب") ||
    cleanQ.includes("الي المندوب") ||
    cleanQ.includes("الى المندوب") ||
    cleanQ.includes("الى فارس") ||
    cleanQ.includes("الي فارس")
  ) {
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

  // 0.4 تعديل تفاصيل الطلب النشط المفتوح حالياً
  const hasEditFieldWord = cleanQ.includes("سعر") || cleanQ.includes("رقم") || cleanQ.includes("منطقه") || cleanQ.includes("منطقة") || cleanQ.includes("توصيل") || cleanQ.includes("تعديل") || cleanQ.includes("نوع") || cleanQ.includes("النوع");
  if (
    cleanQ.includes("عدل") ||
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
    cleanQ.includes("غير المنطقة")
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
      .replace(/صفر لي|صفرلي|صفر|تصفير|حساب|حسابات|مستحقات|مستحقاته|مستحقاتهم|المندوب|كابتن|مندوب|لـ|ل/gi, "")
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
  const ctx = getSessionContext(sessionKey);

  // 1. فحص الأزرار السريعة المباشرة (النقر على زر إسناد أو تحديد منطقة)
  if (rawText.startsWith("assign_order_") || rawText.startsWith("set_region_order_")) {
    // يتم معالجتها أدناه مباشرة
  }

  // 2. التحليل الذكي المباشر عبر عقل الذكاء الاصطناعي (Gemini First Engine)
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

        if (!targetOrder) {
          const allOrders = await prisma.order.findMany({
            orderBy: { createdAt: "desc" },
            include: { shop: true, customerRegion: true }
          });

          if (search_query && search_query.length > 1) {
            const cleanSearch = cleanArabicTextForMatch(search_query);
            targetOrder = allOrders.find(o => {
              const sName = o.shop ? cleanArabicTextForMatch(o.shop.name) : "";
              const rName = o.customerRegion ? cleanArabicTextForMatch(o.customerRegion.name) : "";
              const oType = o.orderType ? cleanArabicTextForMatch(o.orderType) : "";
              return cleanSearch.includes(sName) || cleanSearch.includes(rName) || cleanSearch.includes(oType) || sName.includes(cleanSearch) || rName.includes(cleanSearch) || oType.includes(cleanSearch);
            }) || null;
          }

          if (!targetOrder) {
            targetOrder = allOrders.find(o => o.status !== "delivered" && o.status !== "completed") || allOrders[0] || null;
          }
        }

        if (!targetOrder) {
          return { reply: `يا أبو الأكبر، ما لكيت أي طلب مطابق لإسناده.` };
        }

        if (targetOrder.status === "completed") {
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
        const oldName = parsed?.old_name || parsed?.courier_name;
        const newName = parsed?.new_name;

        if (!oldName || !newName) {
          return { reply: `يا أبو الأكبر، اذكرلي الاسم الحالي والاسم الجديد بوضوح لأعدله.` };
        }

        const allCouriers = await prisma.courier.findMany();
        let targetCourier = null;
        const cleanOld = cleanArabicTextForMatch(oldName);
        for (const c of allCouriers) {
          const cleanC = cleanArabicTextForMatch(c.name);
          if (cleanC.includes(cleanOld) || cleanOld.includes(cleanC)) {
            targetCourier = c;
            break;
          }
        }
        if (!targetCourier) {
          const { match } = findBestMatch(allCouriers, oldName);
          targetCourier = match;
        }

        if (!targetCourier) {
          return { reply: `يا أبو الأكبر، ما لكيت أي مندوب باسم (${oldName}) مسجل بالنظام. المندوبين عندك: ${namesListForReply(allCouriers)}.` };
        }

        const updated = await prisma.courier.update({
          where: { id: targetCourier.id },
          data: { name: newName }
        });

        return {
          reply: `تم يا أبو الأكبر! الذكاء الاصطناعي عدل اسم الكابتن من (${targetCourier.name}) إلى (${updated.name}) بنجاح 🚀`
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
        const courierName = parsed?.courier_name;
        const shopName = parsed?.shop_name;
        const rawStatus = parsed?.status || "delivered";

        let statusFilter: any = { in: ["delivered", "completed", "received"] };
        let statusLabel = "المسلمة";

        if (rawStatus === "rejected" || rawText.includes("مرفوض")) {
          statusFilter = { in: ["rejected", "cancelled"] };
          statusLabel = "المرفوضة";
        } else if (rawStatus === "pending" || rawText.includes("جديد") || rawText.includes("معلق")) {
          statusFilter = "pending";
          statusLabel = "المعلقة";
        }

        let where: any = {
          status: statusFilter
        };

        let label = statusLabel;
        let matchedCourierObj = null;

        if (courierName) {
          const allCouriers = await prisma.courier.findMany();
          const cleanQuery = cleanArabicTextForMatch(courierName);
          for (const c of allCouriers) {
            const cleanC = cleanArabicTextForMatch(c.name);
            if (cleanC.length >= 2 && (cleanC.includes(cleanQuery) || cleanQuery.includes(cleanC))) {
              matchedCourierObj = c;
              break;
            }
          }
          if (!matchedCourierObj) {
            const { match } = findBestMatch(allCouriers, courierName);
            matchedCourierObj = match;
          }
          if (matchedCourierObj) {
            where.assignedCourierId = matchedCourierObj.id;
            label += ` للمندوب (${matchedCourierObj.name})`;
          }
        }

        if (shopName) {
          const allShops = await prisma.shop.findMany();
          const { match } = findBestMatch(allShops, shopName);
          if (match) {
            where.shopId = match.id;
            label += ` لمحل (${match.name})`;
          }
        }

        const countToArchive = await prisma.order.count({ where });
        if (countToArchive === 0) {
          const targetName = matchedCourierObj ? matchedCourierObj.name : (courierName || "المحدد");
          return { reply: `يا أبو الأكبر، ما لكيت أي طلبات ${statusLabel} حالياً للكابتن (${targetName}) لأرشفتها.` };
        }

        await prisma.order.updateMany({
          where,
          data: { status: "archived" }
        });

        return {
          reply: `تم يا أبو الأكبر! أرشفت (${countToArchive}) طلبات ${label} بنجاح وخزنت الأمر بقاعدة البيانات 🚀`
        };
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
        const fullText = parsed?.raw_query || rawText;
        const phone = parsed?.phone || null;

        const allShops = await prisma.shop.findMany({ select: { id: true, name: true } });
        if (allShops.length === 0) {
          return { reply: `يا أبو الأكبر، ما عندك أي محل مسجل بالنظام بعد.` };
        }

        let matchedShop: { id: string; name: string } | null = null;
        for (const shop of allShops) {
          const cleanS = cleanArabicTextForMatch(shop.name);
          const cleanT = cleanArabicTextForMatch(fullText);
          if (cleanS.length >= 3 && cleanT.includes(cleanS)) {
            matchedShop = shop;
            break;
          }
        }

        if (!matchedShop) {
          const { match, ambiguous } = findBestMatch(allShops, fullText);
          if (ambiguous.length > 0) {
            return { reply: `يا أبو الأكبر، فيه أكثر من محل يشبه المذكور بالرسالة: ${namesListForReply(ambiguous)}. حدد اسم المحل بوضوح.` };
          }
          matchedShop = match;
        }

        if (!matchedShop) {
          return { reply: `يا أبو الأكبر، ما گدرت أحدد أي محل قصدك من الرسالة. المحلات عندك: ${namesListForReply(allShops)}. اذكر اسم المحل بوضوح.` };
        }

        const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
        let matchedRegion: { id: string; name: string; deliveryPrice: any } | null = null;

        // تنظيف صريح للمرادفات الصوتية مثل (جاي كور / جي كور -> جيكور)
        const textForRegion = fullText.replace(/جاي\s*كور/gi, "جيكور").replace(/جي\s*كور/gi, "جيكور");

        for (const reg of allRegions) {
          const cleanR = cleanArabicTextForMatch(reg.name);
          const cleanT = cleanArabicTextForMatch(textForRegion);
          if (cleanR.length >= 2 && (cleanT.includes(cleanR) || cleanR.includes(cleanT))) {
            matchedRegion = reg;
            break;
          }
        }

        if (!matchedRegion) {
          const ranked = rankRegionsByQuery(textForRegion, allRegions as any);
          if (ranked.length > 0) {
            matchedRegion = ranked[0];
          }
        }

        let orderType = "اقمشه";
        const cleanType = fullText.toLowerCase();
        if (cleanType.includes("مسواق") || cleanType.includes("مسواك") || cleanType.includes("تسوق")) orderType = "مسواق";
        else if (cleanType.includes("روبيان") || cleanType.includes("سمك") || cleanType.includes("اسماك")) orderType = "روبيان";
        else if (cleanType.includes("ورد") || cleanType.includes("زهور")) orderType = "ورد";
        else if (cleanType.includes("كيك") || cleanType.includes("حلويات") || cleanType.includes("معجنات")) orderType = "حلويات";
        else if (cleanType.includes("طعام") || cleanType.includes("وجبة") || cleanType.includes("مطعم") || cleanType.includes("اكل")) orderType = "طعام";
        else if (cleanType.includes("اقمشه") || cleanType.includes("أقمشة") || cleanType.includes("قماش") || cleanType.includes("ملابس") || cleanType.includes("ازياء") || cleanType.includes("فستان")) orderType = "اقمشه";
        else if (cleanType.includes("مواد") || cleanType.includes("منزليه") || cleanType.includes("منزلية")) orderType = "مواد منزلية";

        let noteTime = "غير محدد";
        if (fullText.includes("الان") || fullText.includes("الآن")) noteTime = "الان";
        else if (fullText.includes("ب4 العصر") || fullText.includes("العصر") || fullText.includes("عصر")) noteTime = "ب4 العصر";
        else if (fullText.includes("مغرب")) noteTime = "مغرباً";
        else if (fullText.includes("فوري")) noteTime = "فوري";

        const deliveryPriceNum = matchedRegion?.deliveryPrice ? Number(matchedRegion.deliveryPrice) : 0;
        const detectedAmount = extractOrderAmountFromText(fullText, phone);
        const subtotalNum = detectedAmount ?? 0;
        const totalNum = subtotalNum + deliveryPriceNum;

        const order = await prisma.order.create({
          data: {
            shopId: matchedShop.id,
            status: "pending",
            orderType: orderType,
            orderNoteTime: noteTime,
            customerRegionId: matchedRegion?.id || null,
            customerPhone: phone,
            orderSubtotal: new Decimal(subtotalNum),
            deliveryPrice: new Decimal(deliveryPriceNum),
            totalAmount: new Decimal(totalNum),
            submissionSource: "admin_ai_assistant",
          }
        });

        notifyTelegramNewOrder(order.id).catch(() => {});
        pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => {});

        ctx.lastOrderNumber = order.orderNumber;
        ctx.updatedAt = Date.now();

        const regionName = matchedRegion ? matchedRegion.name : "غير محددة";
        const warnings: string[] = [];
        let regionButtons: Array<{ text: string; action: string }> = [];

        if (!matchedRegion) {
          warnings.push("⚠️ اختر خيار المنطقة المناسبة أدناه للتعيين المباشر وتحديث السعر بالنقر:");
          const ranked = rankRegionsByQuery(fullText, allRegions as any);
          const topRanked = ranked.slice(0, 4);
          regionButtons = topRanked.map(r => ({
            text: `📍 تحديد منطقة: ${r.name}`,
            action: `set_region_order_${order.id}_region_${r.id}`
          }));
        }

        if (!phone) warnings.push("⚠️ ما لكيت رقم هاتف بالرسالة، ضيفه يدوياً.");
        if (detectedAmount === null) warnings.push("⚠️ ما لكيت سعر واضح بالرسالة، سعر الطلب انحط 0 — عدله يدوياً.");

        return {
          reply: `تم يا أبو الأكبر! أنشأت طلب مبيعات جديد #${order.orderNumber} لـ (${matchedShop.name}) إلى (${regionName}) | نوع: ${orderType} | وقت: ${noteTime} | السعر: ${subtotalNum} ألف${warnings.length ? "\n" + warnings.join("\n") : ""}`,
          buttons: regionButtons
        };
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
        const { match, ambiguous } = findBestMatch(allCouriers, parsed?.clean_name);
        if (!match) {
          if (ambiguous.length > 0) {
            return { reply: `يا أبو الأكبر، فيه أكثر من مندوب يشبه هذا الاسم: ${namesListForReply(ambiguous)}. حدد الاسم بالضبط.` };
          }
          return { reply: `يا أبو الأكبر، ما گدرت ألكى مندوب بهذا الاسم. المندوبين عندك: ${namesListForReply(allCouriers)}.` };
        }

        await prisma.courier.update({
          where: { id: match.id },
          data: { mandoubTotalsResetAt: new Date() }
        });

        return { reply: `تم يا أبو الأكبر! صفرت حساب ومستحقات الكابتن المندوب (${match.name})` };
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
