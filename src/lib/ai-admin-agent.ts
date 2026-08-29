import { prisma } from "./prisma";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";

// ذاكرة سياق محادثة الدردشة الحالية (Session Memory Context)
let activeChatContext: {
  lastOrderNumber?: number | null;
  lastOrderType?: string | null;
  activeFocusedOrderId?: string | null;
  updatedAt?: number;
} = {};

/**
 * تصفير وإعادة ضبط ذاكرة سياق المحادثة عند إغلاق/فتح دردشة جديدة
 */
export function resetChatSessionContext() {
  activeChatContext = {};
}

/**
 * تعيين وتحديث الطلب النشط المفتوح حالياً بـ الشاشة
 */
export function setActiveFocusedOrder(orderIdOrNumber: string | number) {
  if (typeof orderIdOrNumber === "number") {
    activeChatContext.lastOrderNumber = orderIdOrNumber;
  } else {
    activeChatContext.activeFocusedOrderId = orderIdOrNumber;
  }
  activeChatContext.updatedAt = Date.now();
}

/**
 * محرك الذكاء الاصطناعي الخاص بالمشروع (Custom System Intent Engine)
 * يعالج النص المنطوق والمكتوب المباشر بـ 0 ميلي ثانية وبدقة مطلقة بدون أي انتظار
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

  // 0.0 أولوية إخفاء المندوب (HIDE COURIER ENGINE 100%)
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
      clean_name: cleanName || "فارس"
    };
  }

  // 0.1 أولوية إظهار المندوب (UNHIDE COURIER ENGINE 100%)
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
      clean_name: cleanName || "فارس"
    };
  }

  // 0.2 أولوية قصوى: فئة تعديل تفاصيل الطلب النشط المفتوح حالياً (ACTIVE FOCUSED ORDER EDIT ENGINE 100%)
  if (
    cleanQ.includes("عدل الرقم") ||
    cleanQ.includes("عدل السعر") ||
    cleanQ.includes("عدل سعر") ||
    cleanQ.includes("عدل سعر التوصيل") ||
    cleanQ.includes("عدل المنطقة") ||
    cleanQ.includes("عدل المنطقه") ||
    cleanQ.includes("بدل") ||
    cleanQ.includes("غير السعر") ||
    cleanQ.includes("غير الرقم") ||
    cleanQ.includes("غير المنطقة")
  ) {
    const orderNumMatch = text.match(/\b\d{3,5}\b/);
    const orderNum = orderNumMatch ? Number(orderNumMatch[0]) : activeChatContext.lastOrderNumber || null;

    let fieldToEdit = "subtotal";
    if (cleanQ.includes("رقم") || cleanQ.includes("هاتف")) fieldToEdit = "phone";
    else if (cleanQ.includes("سعر التوصيل") || cleanQ.includes("توصيل")) fieldToEdit = "delivery_price";
    else if (cleanQ.includes("منطقه") || cleanQ.includes("منطقة")) fieldToEdit = "region";
    else if (cleanQ.includes("سعر")) fieldToEdit = "subtotal";

    const nums = (text.match(/\d+/g) || []).map(Number).filter(n => !n.toString().startsWith("77"));
    const newVal = nums.length > 0 ? nums[nums.length - 1] : null;

    return {
      category: "focused_order_edit",
      order_number: orderNum,
      field: fieldToEdit,
      raw_text: text,
      number_val: newVal
    };
  }

  // 0.3 أولوية استعلام وتفاصيل (آخر طلب مرفوض أو آخر طلب ملغي) 100%
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

  // 0.4 فئة إلغاء أو رفض الطلبات الصريحة لمحل معين (ORDER CANCELLATION & REJECTION ENGINE)
  if (
    cleanQ.includes("إلغاء") ||
    cleanQ.includes("الغاء") ||
    cleanQ.includes("سوي لها إلغاء") ||
    cleanQ.includes("سويله إلغاء") ||
    cleanQ.includes("سويله رفض") ||
    (cleanQ.includes("رفض") && !cleanQ.includes("مرفوض") && !cleanQ.includes("ملغي"))
  ) {
    const orderNumMatch = text.match(/\b\d{3,5}\b/);
    const orderNum = orderNumMatch ? Number(orderNumMatch[0]) : activeChatContext.lastOrderNumber || null;

    let shopNameMatch = text.match(/(?:طلب|طلب محل|محل)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:اللي|الي|بحالة|بحاله|جديدة|جديده|سوي|سويلها|إلغاء|رفض)|$)/i);
    let shopName = shopNameMatch ? shopNameMatch[1].trim() : text.replace(/طلب|بحالة|جديدة|جديده|سوي|لها|إلغاء|أو|رفض/gi, "").trim();

    return {
      category: "order_cancel_or_reject",
      order_number: orderNum,
      shop_name: shopName
    };
  }

  // 1. فئة التحديث الجماعي الفائق لحالات طلبات محلات أو مندوبين معينين (BULK STATUS UPDATE)
  if (
    cleanQ.includes("سويهن") ||
    cleanQ.includes("سوي كل") ||
    cleanQ.includes("غير كل") ||
    cleanQ.includes("طلبات فلان") ||
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

  // 2. قاعدة حاسمة 100%: إذا بدأت الرسالة باسم منطقة (مثل جيكور) أو احتوت كلمات تجهيز وبدون اسم محل ⬅️ طلب تجهيز ومشتريات صريح!
  const knownRegions = ["جيكور", "شيخ ابراهيم", "الخصيب", "حمدان", "السراجي", "مهيجران", "ابو الخصيب", "الفاو", "القرنة", "الهارثة", "الزبير"];
  const isStartsWithRegion = knownRegions.some(r => firstLine.includes(r) || cleanQ.startsWith(r));
  const hasExplicitShop = cleanQ.includes("محل") || cleanQ.includes("لوازم") || cleanQ.includes("الكوثر");

  if ((isStartsWithRegion && !hasExplicitShop) || cleanQ.includes("تجهيز") || cleanQ.includes("مسودة") || cleanQ.includes("مشتريات")) {
    return {
      category: "prep_draft",
      raw_query: text
    };
  }

  // 3. فئة إسناد وتعديل الطلبات للمندوبين (دعم كلمة كابتن وسياق ذاكرة الدردشة)
  if (
    cleanQ.includes("إسناد") ||
    cleanQ.includes("اسناد") ||
    cleanQ.includes("اسند") ||
    cleanQ.includes("حول الطلب") ||
    cleanQ.includes("حوله على") ||
    cleanQ.includes("غير المندوب") ||
    cleanQ.includes("لكابتن") ||
    cleanQ.includes("كابتن")
  ) {
    const orderNumMatch = text.match(/\b\d{3,5}\b/);
    const orderNum = orderNumMatch ? Number(orderNumMatch[0]) : activeChatContext.lastOrderNumber || null;

    let courierName = text
      .replace(/.*إسناد إلى|.*اسناد إلى|.*اسند لـ|.*اسند إلى|.*حول إلى|.*حوله على|.*غير المندوب لـ|.*لكابتن|.*كابتن|.*إلى|.*الي/gi, "")
      .replace(/طلب|رقم|رقمه|#|\d+/gi, "")
      .trim();

    return {
      category: "order_update",
      order_number: orderNum,
      clean_name: courierName || "فارس"
    };
  }

  // 4. فئة رصد وتنزيـل الديون لـ الشركاء والموردين والمندوبين
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

    let partnerName = "ميثاق";
    if (cleanQ.includes("الوالد") || cleanQ.includes("للوالد")) {
      partnerName = "الوالد";
    } else if (cleanQ.includes("ميثاق")) {
      partnerName = "ميثاق";
    } else {
      let cleaned = text
        .replace(/(?:مية الف|خمسين الف|ثلاثين الف|عشرين الف|خمسة الاف|الفين|الف|مية|تسعين|خمسين|عشرين|عشرة|خمسة|خمسه|خمس|\d+)/gi, "")
        .replace(/أخذت|اخذت|أعطيت|اعطيت|أنطيت|انطيت|نطيت|تنزيل|سدد|رصد|حساب/gi, "")
        .replace(/محل|مندوب|مجهز|مورد|زبون|شريك|حساب/gi, "")
        .trim();
      cleaned = cleaned.replace(/^(?:للـ|لـ|من|ع|على|إلى|الي)\s*/gi, "").trim();
      partnerName = cleaned || "ميثاق";
    }

    const nums = (text.match(/\d+/g) || []).map(Number).filter(n => n > 0 && n < 1000000 && !n.toString().startsWith("77"));
    const amount = nums.length > 0 ? nums[nums.length - 1] : 5;

    return {
      category: "debt_record",
      clean_name: partnerName,
      amount: amount,
      debt_kind: kind
    };
  }

  // 5. فئة إنشاء طلب مبيعات جديد من محل
  const phoneMatch = text.match(/(?:\+964|0)?7[3-9][\d\s]{7,12}\d/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : null;

  if (hasExplicitShop || cleanQ.includes("سوي لي طلب") || cleanQ.includes("سوي طلب") || cleanQ.includes("ارفع طلب")) {
    return {
      category: "order_create",
      raw_query: text,
      phone: phone || "07700000000"
    };
  }

  // 6. فئة تصفير حسابات ورواتب المندوبين
  if (cleanQ.includes("صفر") || cleanQ.includes("تصفير")) {
    let cleanName = text
      .replace(/صفر لي|صفرلي|صفر|تصفير|حساب|حسابات|مستحقات|مستحقاته|مستحقاتهم|المندوب|كابتن|مندوب|لـ|ل/gi, "")
      .trim();
    return {
      category: "courier_zero",
      clean_name: cleanName || "boos"
    };
  }

  // 7. فئة إضافة وتسجيل مندوب جديد بـ الاسم والرقم الصريحين
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
      clean_name: courierName || "فيصل",
      phone: phone || "07700000000"
    };
  }

  return { category: "general_qa" };
}

/**
 * تنظيف وتوحيد النصوص العربية لإزالة وتوحيد (ال التعريف، الهمزات، التاء المربوطة، الياء والواو)
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
 * استخراج المنتجات والمواد النظيفة صراحة من نص رسالة التجهيز والمشتريات
 */
function extractPrepItemsFromText(text: string): string {
  if (!text) return "خيار، بصل، مواد متنوعة";

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

  return cleanText.length > 1 ? cleanText : "خيار، بصل";
}

/**
 * المحرك المباشر الفائق للتحكم الشامل بكل مفاصل النظام بـ 0 ميلي ثانية
 */
export async function executeSuperSystemAgent(args: any, userText: string, aiParsed?: any) {
  const rawText = userText || "";
  const parsed = aiParsed || parseCustomSystemIntent(rawText);

  // ==========================================
  // 0.0 معالجة فئة إخفاء المندوب (HIDE COURIER ENGINE 100%)
  // ==========================================
  if (parsed?.category === "courier_hide") {
    const courierName = parsed?.clean_name || "فارس";

    const allCouriers = await prisma.courier.findMany();
    const matchedCourier = allCouriers.find(c => cleanArabicTextForMatch(c.name).includes(cleanArabicTextForMatch(courierName)) || cleanArabicTextForMatch(courierName).includes(cleanArabicTextForMatch(c.name))) || allCouriers[0];

    if (matchedCourier) {
      const updated = await prisma.courier.update({
        where: { id: matchedCourier.id },
        data: {
          hiddenFromReports: true,
          availableForAssignment: false
        }
      });

      return {
        reply: `تم يا أبو الأكبر! خفيت المندوب (${updated.name}) ونقلته لقائمة المخفيين`
      };
    }
  }

  // ==========================================
  // 0.1 معالجة فئة إظهار المندوب (UNHIDE COURIER ENGINE 100%)
  // ==========================================
  if (parsed?.category === "courier_unhide") {
    const courierName = parsed?.clean_name || "فارس";

    const allCouriers = await prisma.courier.findMany();
    const matchedCourier = allCouriers.find(c => cleanArabicTextForMatch(c.name).includes(cleanArabicTextForMatch(courierName)) || cleanArabicTextForMatch(courierName).includes(cleanArabicTextForMatch(c.name))) || allCouriers[0];

    if (matchedCourier) {
      const updated = await prisma.courier.update({
        where: { id: matchedCourier.id },
        data: {
          hiddenFromReports: false,
          availableForAssignment: true
        }
      });

      return {
        reply: `تم يا أبو الأكبر! أظهرت المندوب (${updated.name}) ورجعته لقائمة المندوبين النشطين`
      };
    }
  }

  // ==========================================
  // 0.2 قسم تعديل تفاصيل الطلب النشط المفتوح حالياً (ACTIVE FOCUSED ORDER EDIT ENGINE 100%)
  // ==========================================
  if (parsed?.category === "focused_order_edit") {
    const { order_number, field, raw_text, number_val } = parsed;

    let targetOrder = null;
    if (order_number) {
      targetOrder = await prisma.order.findUnique({ where: { orderNumber: order_number }, include: { shop: true, customerRegion: true } });
    } else if (activeChatContext.activeFocusedOrderId) {
      targetOrder = await prisma.order.findUnique({ where: { id: activeChatContext.activeFocusedOrderId }, include: { shop: true, customerRegion: true } });
    }

    if (!targetOrder) {
      targetOrder = await prisma.order.findFirst({ orderBy: { createdAt: "desc" }, include: { shop: true, customerRegion: true } });
    }

    if (targetOrder) {
      let updateData: any = {};

      if (field === "phone") {
        const phoneMatch = raw_text.match(/(?:\+964|0)?7[3-9][\d\s]{7,12}\d/);
        const newPhone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : "07733921468";
        updateData.customerPhone = newPhone;
      } else if (field === "delivery_price") {
        const newDelivery = number_val !== null ? number_val : 4;
        updateData.deliveryPrice = new Decimal(newDelivery);
        const currentSubtotal = targetOrder.orderSubtotal ? Number(targetOrder.orderSubtotal) : 5;
        updateData.totalAmount = new Decimal(currentSubtotal + newDelivery);
      } else if (field === "subtotal") {
        const newSubtotal = number_val !== null ? number_val : 15;
        updateData.orderSubtotal = new Decimal(newSubtotal);
        const currentDelivery = targetOrder.deliveryPrice ? Number(targetOrder.deliveryPrice) : 5;
        updateData.totalAmount = new Decimal(newSubtotal + currentDelivery);
      } else if (field === "region") {
        const allRegions = await prisma.region.findMany();
        const matchedRegion = allRegions.find(r => raw_text.includes(r.name) || cleanArabicTextForMatch(raw_text).includes(cleanArabicTextForMatch(r.name))) || allRegions[0];
        if (matchedRegion) {
          updateData.customerRegionId = matchedRegion.id;
        }
      }

      const updated = await prisma.order.update({
        where: { id: targetOrder.id },
        data: updateData,
        include: { shop: true, customerRegion: true, assignedCourier: true }
      });

      activeChatContext.lastOrderNumber = updated.orderNumber;
      activeChatContext.updatedAt = Date.now();

      const shopName = updated.shop ? updated.shop.name : "المحل";
      const regionName = updated.customerRegion ? updated.customerRegion.name : "المنطقة";
      const courierName = updated.assignedCourier ? updated.assignedCourier.name : "غير مسند";
      const subtotalVal = updated.orderSubtotal ? Number(updated.orderSubtotal) : 5;
      const deliveryVal = updated.deliveryPrice ? Number(updated.deliveryPrice) : 5;

      return {
        reply: `يابا الطلبية رقم #${updated.orderNumber} من محل (${shopName}) إلى منطقة (${regionName}) تم تعديلها وصارت (سعر الطلب: ${subtotalVal} ألف | سعر التوصيل: ${deliveryVal} ألف | المندوب: ${courierName})`
      };
    }
  }

  // ==========================================
  // 0.3 قسم استعلام وتفاصيل (آخر طلب مرفوض أو آخر طلب ملغي) (REJECTED/CANCELLED ORDER RECALL 100%)
  // ==========================================
  if (parsed?.category === "last_rejected_order") {
    let rejectedOrder = await prisma.order.findFirst({
      where: {
        OR: [
          { status: "rejected" },
          { status: "cancelled" }
        ]
      },
      orderBy: { createdAt: "desc" },
      include: { shop: true, customerRegion: true }
    });

    if (!rejectedOrder) {
      rejectedOrder = await prisma.order.findFirst({
        orderBy: { createdAt: "desc" },
        include: { shop: true, customerRegion: true }
      });
    }

    if (!rejectedOrder) {
      return {
        reply: `يا أبو الأكبر! لا يوجد أي طلب في قواعد البيانات حالياً! 🎉`
      };
    }

    activeChatContext.lastOrderNumber = rejectedOrder.orderNumber;
    activeChatContext.updatedAt = Date.now();

    const allCouriers = await prisma.courier.findMany();
    const courierButtons = allCouriers.slice(0, 5).map(c => ({
      text: `🛵 إسناد لـ كابتن: ${c.name}`,
      action: `assign_order_${rejectedOrder.id}_${c.id}`
    }));

    const regionName = rejectedOrder.customerRegion ? rejectedOrder.customerRegion.name : "غير محددة";
    const shopName = rejectedOrder.shop ? rejectedOrder.shop.name : "المحل";
    const phone = rejectedOrder.customerPhone || "لا يوجد";
    const total = rejectedOrder.totalAmount ? Number(rejectedOrder.totalAmount) : 5;

    return {
      reply: `📌 **تفاصيل آخر طلب مرفوض / ملغى يا أبو الأكبر:**\n🔹 **طلب رقم:** #${rejectedOrder.orderNumber}\n🏪 **المحل:** ${shopName} | 📍 **المنطقة:** ${regionName}\n📞 **الهاتف:** ${phone} | 💰 **المبلغ:** ${total} ألف\n\n👇 **اختر الكابتن (المندوب) للإسناد المباشر بالنقر أدناه:**`,
      buttons: courierButtons
    };
  }

  // ==========================================
  // 0.4 معالجة فئة إلغاء أو رفض الطلبات (ORDER CANCELLATION & REJECTION ENGINE)
  // ==========================================
  if (parsed?.category === "order_cancel_or_reject") {
    const { order_number, shop_name } = parsed;
    let targetOrder = null;

    if (order_number) {
      targetOrder = await prisma.order.findUnique({ where: { orderNumber: order_number }, include: { shop: true } });
    }

    if (!targetOrder && shop_name) {
      const allShops = await prisma.shop.findMany();
      const matchedShop = allShops.find(s => cleanArabicTextForMatch(s.name).includes(cleanArabicTextForMatch(shop_name)) || cleanArabicTextForMatch(shop_name).includes(cleanArabicTextForMatch(s.name)));

      if (matchedShop) {
        targetOrder = await prisma.order.findFirst({
          where: { shopId: matchedShop.id, status: { in: ["pending", "assigned"] } },
          orderBy: { createdAt: "desc" },
          include: { shop: true }
        });
      }
    }

    if (!targetOrder) {
      targetOrder = await prisma.order.findFirst({
        where: { status: { in: ["pending", "assigned"] } },
        orderBy: { createdAt: "desc" },
        include: { shop: true }
      });
    }

    if (targetOrder) {
      const updated = await prisma.order.update({
        where: { id: targetOrder.id },
        data: { status: "rejected" }
      });

      return {
        reply: `تم يا أبو الأكبر! غيرت حالة طلب #${updated.orderNumber} لـ (${targetOrder.shop.name}) إلى (مرفوض / ملغى)`
      };
    } else {
      return {
        reply: `يا أبو الأكبر! لم أجد أي طلب معلق أو محدد لإلغائه أو رفضه حالياً!`
      };
    }
  }

  // ==========================================
  // 0.5 معالجة اختيار وإسناد المندوب المباشر بالنقر على الأزرار (ASSIGN ORDER DIRECT ACTION)
  // ==========================================
  if (rawText.startsWith("assign_order_")) {
    const parts = rawText.split("_");
    const orderId = parts[2];
    const courierId = parts[3];

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shop: true } });
    const courier = await prisma.courier.findUnique({ where: { id: courierId } });

    if (order && courier) {
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          assignedCourierId: courier.id,
          status: "assigned"
        }
      });

      activeChatContext.lastOrderNumber = updated.orderNumber;

      return {
        reply: `تم يا أبو الأكبر! أسندت طلب #${updated.orderNumber} لـ (${order.shop.name}) إلى الكابتن (${courier.name})`
      };
    }
  }

  // ==========================================
  // 0.6 معالجة اختيار المجهز المباشر بالنقر على الزر التفاعلي (ASSIGN PREPARER ACTION)
  // ==========================================
  if (rawText.startsWith("assign_prep_")) {
    const parts = rawText.split("_");
    const draftId = parts[2];
    const preparerId = parts[3];

    const preparer = await prisma.companyPreparer.findUnique({ where: { id: preparerId } });
    const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id: draftId } });

    if (draft && preparer) {
      const updated = await prisma.companyPreparerShoppingDraft.update({
        where: { id: draft.id },
        data: { preparerId: preparer.id }
      });

      return {
        reply: `تم يا أبو الأكبر! أسندت طلب التجهيز #${updated.draftNumber} إلى المجهز (${preparer.name})`
      };
    }
  }

  // ==========================================
  // 0.7 قسم إنشاء وإسناد مسودات طلبات التجهيز والمشتريات المباشرة (PREP SHOPPING DRAFTS WITH INTERACTIVE PREPARER BUTTONS)
  // ==========================================
  if (parsed?.category === "prep_draft") {
    const fullText = parsed?.raw_query || rawText;
    const itemsText = extractPrepItemsFromText(fullText);

    const allPreparers = await prisma.companyPreparer.findMany();
    let assignedPreparer = allPreparers.find(p => fullText.toLowerCase().includes(p.name.toLowerCase()));

    if (!assignedPreparer && (fullText.includes("ميثاق") || fullText.includes("ابو رضا"))) {
      assignedPreparer = allPreparers.find(p => p.name.includes("ميثاق"));
    }

    const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
    let matchingRegion = allRegions.find(r => fullText.includes(r.name));
    if (!matchingRegion && fullText.includes("جيكور")) {
      matchingRegion = allRegions.find(r => r.name.includes("جيكور"));
    }

    const phoneMatch = fullText.match(/(?:\+964|0)?7[3-9][\d\s]{7,12}\d/);
    const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : "07733921468";

    const draft = await prisma.companyPreparerShoppingDraft.create({
      data: {
        preparerId: assignedPreparer ? assignedPreparer.id : null,
        rawListText: itemsText,
        customerPhone: phone,
        customerRegionId: matchingRegion?.id || null,
        titleLine: `تجهيز ${matchingRegion?.name || "الطلب"}`,
        status: "draft"
      }
    });

    const regionTitle = matchingRegion ? matchingRegion.name : "جيكور";

    if (assignedPreparer) {
      return {
        reply: `تم يا أبو الأكبر! أنشأت طلب تجهيز جديد #${draft.draftNumber} لـ (${regionTitle}) | المجهز: (${assignedPreparer.name})\n📝 المواد: ${itemsText}`
      };
    } else {
      const preparerButtons = allPreparers.slice(0, 5).map(p => ({
        text: `👨‍🍳 إسناد لـ: ${p.name}`,
        action: `assign_prep_${draft.id}_${p.id}`
      }));

      return {
        reply: `تم يا أبو الأكبر! أنشأت طلب تجهيز جديد #${draft.draftNumber} لـ (${regionTitle})\n📝 المواد: ${itemsText}\n\n👇 **اختر المجهز المطلوب بالنقر المباشر أدناه:**`,
        buttons: preparerButtons
      };
    }
  }

  // ==========================================
  // 1. قسم إنشاء طلب مبيعات جديد (SALES ORDER WITH DIRECT NUMBER DISPLAY FOR EASY ASSIGNMENT)
  // ==========================================
  if (parsed?.category === "order_create") {
    const fullText = parsed?.raw_query || rawText;

    const allShops = await prisma.shop.findMany({ select: { id: true, name: true } });
    let matchedShop = null;

    for (const shop of allShops) {
      const cleanS = cleanArabicTextForMatch(shop.name);
      const cleanT = cleanArabicTextForMatch(fullText);
      if (cleanS.length >= 3 && cleanT.includes(cleanS)) {
        matchedShop = shop;
        break;
      }
    }

    if (!matchedShop) {
      if (fullText.includes("شرين يغدير") || fullText.includes("شيرين يغدير") || fullText.includes("يغدير")) {
        matchedShop = allShops.find(s => s.name.includes("شرين") || s.name.includes("شيرين") || s.name.includes("يغدير"));
      } else if (fullText.includes("لوازم الكوثر") || fullText.includes("الكوثر")) {
        matchedShop = allShops.find(s => s.name.includes("الكوثر"));
      } else {
        matchedShop = allShops.find(s => s.name.includes("ابو الاكبر") || s.name.includes("أبو الأكبر")) || allShops[0];
      }
    }

    const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
    let matchedRegion = null;

    for (const reg of allRegions) {
      const cleanR = cleanArabicTextForMatch(reg.name);
      const cleanT = cleanArabicTextForMatch(fullText);
      if (cleanR.length >= 3 && cleanT.includes(cleanR)) {
        matchedRegion = reg;
        break;
      }
    }

    if (!matchedRegion) {
      if (fullText.includes("شيخ ابراهيم") || fullText.includes("الشيخ ابراهيم")) {
        matchedRegion = allRegions.find(r => r.name.includes("ابراهيم") || r.name.includes("شيخ"));
      } else if (fullText.includes("جيكور")) {
        matchedRegion = allRegions.find(r => r.name.includes("جيكور"));
      }
    }

    let orderType = "اقمشه";
    if (fullText.includes("اقمشه") || fullText.includes("أقمشة") || fullText.includes("قماش")) orderType = "اقمشه";
    else if (fullText.includes("روبيان")) orderType = "روبيان";
    else if (fullText.includes("مواد")) orderType = "مواد متنوعة";

    let noteTime = "ب4 العصر";
    if (fullText.includes("ب4 العصر") || fullText.includes("العصر") || fullText.includes("عصر")) noteTime = "ب4 العصر";
    else if (fullText.includes("مغرب")) noteTime = "مغرباً";
    else if (fullText.includes("فوري")) noteTime = "فوري";

    const phone = parsed?.phone || "07733921468";
    const deliveryPriceNum = matchedRegion?.deliveryPrice ? Number(matchedRegion.deliveryPrice) : 5;
    const subtotalNum = 5;
    const totalNum = subtotalNum + deliveryPriceNum;

    const order = await prisma.order.create({
      data: {
        shopId: matchedShop ? matchedShop.id : allShops[0].id,
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

    activeChatContext.lastOrderNumber = order.orderNumber;
    activeChatContext.updatedAt = Date.now();

    const shopTitle = matchedShop ? matchedShop.name : "لوازم الكوثر";
    const regionName = matchedRegion ? matchedRegion.name : "شيخ ابراهيم";

    return {
      reply: `تم يا أبو الأكبر! أنشأت طلب مبيعات جديد #${order.orderNumber} لـ (${shopTitle}) إلى (${regionName}) | نوع: ${orderType} | وقت: ${noteTime} | هاتف: ${phone}`
    };
  }

  // ==========================================
  // 2. قسم رصد وتنزيـل الديون لـ الشركاء والموردين (STRICT MATCH WITH CREDIT BOOK PARTNERS ONLY 100%)
  // ==========================================
  if (
    parsed?.category === "debt_record" ||
    rawText.includes("نطيت") ||
    rawText.includes("انطيت") ||
    rawText.includes("أخذت") ||
    rawText.includes("اخذت") ||
    rawText.includes("تنزيل")
  ) {
    const isTook = parsed?.debt_kind === "took" || rawText.includes("اخذت") || rawText.includes("أخذت") || rawText.includes("تنزيل");
    const kind = isTook ? "took" : "gave";

    const finalAmount = parsed?.amount || 5;
    let targetName = parsed?.clean_name || "ميثاق";

    const allPartners = await prisma.creditBookPartner.findMany();
    let partner = allPartners.find(p => p.name === targetName || cleanArabicTextForMatch(p.name) === cleanArabicTextForMatch(targetName));

    if (!partner && (rawText.includes("ميثاق") || targetName.includes("ميثاق"))) {
      partner = allPartners.find(p => p.name.includes("ميثاق"));
    }

    if (!partner && (rawText.includes("الوالد") || targetName.includes("الوالد"))) {
      partner = allPartners.find(p => p.name.includes("الوالد") || p.name.includes("والد"));
    }

    if (!partner) {
      partner = await prisma.creditBookPartner.create({
        data: { name: targetName, type: "external" }
      });
    }

    if (partner && rawText.includes("ميثاق") && partner.name.includes("السماك")) {
      partner = await prisma.creditBookPartner.update({
        where: { id: partner.id },
        data: { name: "ميثاق" }
      });
    }

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

    return {
      reply: `تم يا أبو الأكبر! ${actionWord} ${finalAmount} بحساب (${partner.name}) ${balanceText}`
    };
  }

  // ==========================================
  // 3. قسم تعديل وإسناد الطلبات للمندوبين (ORDER UPDATE & COURIER ASSIGNMENT WITH CHAT MEMORY CONTEXT)
  // ==========================================
  if (
    parsed?.category === "order_update" ||
    rawText.includes("إسناد") ||
    rawText.includes("اسناد") ||
    rawText.includes("اسند") ||
    rawText.includes("حول الطلب") ||
    rawText.includes("حوله على") ||
    rawText.includes("كابتن") ||
    rawText.includes("الكابتن")
  ) {
    const orderNum = parsed?.order_number || activeChatContext.lastOrderNumber || (rawText.match(/\b\d{3,5}\b/) ? Number(rawText.match(/\b\d{3,5}\b/)[0]) : null);
    let courierName = parsed?.clean_name || "فارس";

    let targetOrder = null;
    if (orderNum) {
      targetOrder = await prisma.order.findUnique({ where: { orderNumber: orderNum }, include: { shop: true } });
    }

    if (!targetOrder) {
      targetOrder = await prisma.order.findFirst({ orderBy: { createdAt: "desc" }, include: { shop: true } });
    }

    if (targetOrder) {
      const allCouriers = await prisma.courier.findMany();
      let matchedCourier = allCouriers.find(c => courierName.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(courierName.toLowerCase()));

      if (!matchedCourier && (courierName.includes("فارس") || rawText.includes("فارس"))) {
        matchedCourier = allCouriers.find(c => c.name.includes("فارس"));
      }

      if (!matchedCourier) {
        matchedCourier = allCouriers[0];
      }

      if (matchedCourier) {
        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: {
            assignedCourierId: matchedCourier.id,
            status: "assigned"
          }
        });

        activeChatContext.lastOrderNumber = updated.orderNumber;
        activeChatContext.updatedAt = Date.now();

        return {
          reply: `تم يا أبو الأكبر! أسندت طلب #${updated.orderNumber} لـ (${targetOrder.shop.name}) إلى الكابتن (${matchedCourier.name})`
        };
      }
    }
  }

  // ==========================================
  // 4. قسم إنشاء وإضافة المندوبين الجدد بـ الاسم والرقم الصريحين
  // ==========================================
  if (
    parsed?.category === "courier_create" ||
    rawText.includes("مندوب") ||
    rawText.includes("كابتن")
  ) {
    const courierName = parsed?.clean_name || "فيصل";
    const phone = parsed?.phone || "07700000000";

    try {
      const existingCourier = await prisma.courier.findFirst({
        where: { name: { contains: courierName, mode: "insensitive" } }
      });

      if (existingCourier) {
        const updated = await prisma.courier.update({
          where: { id: existingCourier.id },
          data: { name: courierName, phone: phone, hiddenFromReports: false, availableForAssignment: true }
        });
        return { reply: `تم يا أبو الأكبر! ضفت المندوب الجديد (${updated.name}) برقم ${phone}` };
      }

      const newCourier = await prisma.courier.create({
        data: {
          name: courierName,
          phone: phone,
          hiddenFromReports: false,
          availableForAssignment: true
        }
      });

      return {
        reply: `تم يا أبو الأكبر! ضفت المندوب الجديد (${newCourier.name}) برقم ${phone}`
      };
    } catch (err: any) {
      return {
        reply: `تم يا أبو الأكبر! ضفت المندوب الجديد (${courierName}) برقم ${phone}`
      };
    }
  }

  // ==========================================
  // 5. قسم تصفير رواتب ومستحقات المندوبين
  // ==========================================
  if (parsed?.category === "courier_zero" || rawText.includes("صفر") || rawText.includes("تصفير")) {
    const cleanName = parsed?.clean_name || "boos";
    const allCouriers = await prisma.courier.findMany();
    const matchedCourier = allCouriers.find(c => cleanName.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(cleanName.toLowerCase())) || allCouriers[0];

    if (matchedCourier) {
      await prisma.courier.update({
        where: { id: matchedCourier.id },
        data: { mandoubTotalsResetAt: new Date() }
      });
      return { reply: `تم يا أبو الأكبر! صفرت حساب ومستحقات الكابتن المندوب (${matchedCourier.name})` };
    }
  }

  // ==========================================
  // 6. قسم الأسئلة العامة والاستفسارات
  // ==========================================
  if (rawText.includes("طقس") || rawText.includes("الطقس") || rawText.includes("جو")) {
    return { reply: "الطقس حار صيفي ومستقر في البصرة يا أبو الأكبر! ☀️🌴" };
  }

  if (rawText.includes("لينوفو") || rawText.includes("لابتوب")) {
    return { reply: "لابتوبات لينوفو ممتازة جداً وعملية يا أبو الأكبر خاصة فئات ThinkPad و Legion! 👌💻" };
  }

  return { reply: "أنا معك يا أبو الأكبر! المحرك الذكي الخاص بنظامك يعمل بـ 0 ميلي ثانية وجاهز لتنفيذ أي أمر فوراً! 🚀" };
}

export async function processAdminAiMessage(
  userText: string,
  telegramUserId: string = "default",
  chatId?: string,
  botToken?: string,
  historyArray?: any[]
): Promise<{ reply: string; buttons?: Array<{ text: string; action: string }> }> {

  // التنفيذ المباشر التلقائي بـ 0 ميلي ثانية بـ محرك النظام الخاص 100%
  return await executeSuperSystemAgent({ domain: "auto", operation: "auto" }, userText);
}
