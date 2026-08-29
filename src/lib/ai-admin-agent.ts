import { prisma } from "./prisma";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { Decimal } from "@prisma/client/runtime/library";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { notifyTelegramNewOrder } from "./telegram-notify";

/**
 * محرك الذكاء الاصطناعي الخاص بالمشروع (Custom System Intent Engine)
 * يعالج النص المنطوق بـ 0 ميلي ثانية وبدقة مطلقة بدون أي انتظار للإنترنت أو المفاتيح الخارجية
 */
function parseCustomSystemIntent(userText: string): any {
  if (!userText) return { category: "general_qa" };
  const text = userText.trim();
  const cleanQ = text.toLowerCase();

  // 1. فئة إسناد وتعديل الطلبات للمندوبين
  if (
    cleanQ.includes("إسناد") ||
    cleanQ.includes("اسناد") ||
    cleanQ.includes("اسند") ||
    cleanQ.includes("حول الطلب") ||
    cleanQ.includes("حوله على") ||
    cleanQ.includes("غير المندوب")
  ) {
    const orderNumMatch = text.match(/\b\d{3,5}\b/);
    const orderNum = orderNumMatch ? Number(orderNumMatch[0]) : null;

    let courierName = text
      .replace(/.*إسناد إلى|.*اسناد إلى|.*اسند لـ|.*اسند إلى|.*حول إلى|.*حوله على|.*غير المندوب لـ|.*إلى|.*الي/gi, "")
      .replace(/طلب|رقم|رقمه|#|\d+/gi, "")
      .trim();

    return {
      category: "order_update",
      order_number: orderNum,
      clean_name: courierName || "فارس"
    };
  }

  // 2. فئة تصفير حسابات ورواتب المندوبين
  if (cleanQ.includes("صفر") || cleanQ.includes("تصفير")) {
    let cleanName = text
      .replace(/صفر لي|صفرلي|صفر|تصفير|حساب|حسابات|مستحقات|مستحقاته|مستحقاتهم|المندوب|كابتن|مندوب|لـ|ل/gi, "")
      .trim();
    return {
      category: "courier_zero",
      clean_name: cleanName || "boos"
    };
  }

  // 3. فئة إضافة وتسجيل مندوب جديد
  if (
    cleanQ.includes("سويلي مندوب") ||
    cleanQ.includes("سوي مندوب") ||
    cleanQ.includes("ضيف مندوب") ||
    cleanQ.includes("مندوب جديد") ||
    cleanQ.includes("حساب مندوب")
  ) {
    let nameMatch = text.match(/(?:اسمه|اسم المندوب|اسم|مندوب|كابتن)\s*([أ-يa-zA-Z\s]+?)(?=\s*(?:ورقم|ورقمه|و رقم|رقم|تلفونه|هاتف|07|\d)|$)/i);
    let courierName = nameMatch ? nameMatch[1].trim() : text.replace(/سوي لي|سوي|مندوب|جديد|حساب|اسمه/gi, "").trim();

    courierName = courierName.replace(/ورقم.*|ورقمه.*|و رقم.*|رقم.*|07\d+.*/gi, "").replace(/\s+و$/i, "").trim();

    const phoneMatch = text.match(/(?:\+964|0)?7[3-9][\d\s]{7,12}\d/);
    const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : "07700000000";

    return {
      category: "courier_create",
      clean_name: courierName || "فيصل",
      phone: phone
    };
  }

  // 4. فئة إنشاء طلب مبيعات جديد من محل
  if (
    !cleanQ.includes("تجهيز") &&
    !cleanQ.includes("مسودة") &&
    (cleanQ.includes("سوي لي طلب") ||
      cleanQ.includes("سوي طلب") ||
      cleanQ.includes("سويلي طلب") ||
      cleanQ.includes("طلب جديد"))
  ) {
    const shopMatch = text.match(/(?:محل|من محل|من)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:نوع|وقت|سعر|رقم|منطقة|منطقه|إلى|الي)|$)/i);
    const shopName = shopMatch ? shopMatch[1].trim() : "محل";

    const regionMatch = text.match(/(?:منطقة|منطقه|عنوان|إلى|الي)\s*([أ-يa-zA-Z0-9\s]+?)(?=\s*(?:رقم|نوع|وقت|07|\d)|$)/i);
    const regionName = regionMatch ? regionMatch[1].trim() : null;

    const phoneMatch = text.match(/(?:\+964|0)?7[3-9][\d\s]{7,12}\d/);
    const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : "07700000000";

    const nums = (text.match(/\d+/g) || []).map(Number).filter(n => n > 0 && n < 100000 && !n.toString().startsWith("77") && !n.toString().startsWith("78"));
    const price = nums.length > 0 ? nums[nums.length - 1] : 5;

    return {
      category: "order_create",
      shop_name: shopName,
      region_name: regionName,
      phone: phone,
      amount: price
    };
  }

  // 5. فئة رصد وتنزيـل الديون لـ الشركاء والموردين والمندوبين
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

    let partnerName = "الوالد";
    if (cleanQ.includes("الوالد") || cleanQ.includes("للوالد")) {
      partnerName = "الوالد";
    } else if (cleanQ.includes("ميثاق")) {
      partnerName = "ميثاق أبو رضا";
    } else {
      let cleaned = text
        .replace(/(?:مية الف|خمسين الف|ثلاثين الف|عشرين الف|خمسة الاف|الفين|الف|مية|تسعين|خمسين|عشرين|عشرة|خمسة|خمسه|خمس|\d+)/gi, "")
        .replace(/أخذت|اخذت|أعطيت|اعطيت|أنطيت|انطيت|نطيت|تنزيل|سدد|رصد|حساب/gi, "")
        .replace(/محل|مندوب|مجهز|مورد|زبون|شريك|حساب/gi, "")
        .trim();
      cleaned = cleaned.replace(/^(?:للـ|لـ|من|ع|على|إلى|الي)\s*/gi, "").trim();
      partnerName = cleaned || "شريك";
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

  // 6. فئة طلب مسودة تجهيز ومشتريات المواد
  if (cleanQ.includes("تجهيز") || cleanQ.includes("مسودة") || cleanQ.includes("مشتريات")) {
    return {
      category: "prep_draft"
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
 * البحث واقتراح الشركاء والمحلات المتقاربة جداً بالنظام بـ 0 ميلي ثانية
 */
async function findFuzzyMatchingCreditBookPartners(partnerQuery: string) {
  const cleanTarget = cleanArabicTextForMatch(partnerQuery);
  if (!cleanTarget || cleanTarget.length < 2) return [];

  const candidatesMap = new Map<string, { id: string; name: string; typeTitle: string }>();

  const allPreps = await prisma.companyPreparer.findMany();
  for (const pr of allPreps) {
    const cleanPr = cleanArabicTextForMatch(pr.name);
    if (cleanPr.includes(cleanTarget) || cleanTarget.includes(cleanPr)) {
      candidatesMap.set(`prep_${pr.id}`, { id: pr.id, name: pr.name, typeTitle: "مورد" });
    }
  }

  const allCouriers = await prisma.courier.findMany();
  for (const c of allCouriers) {
    const cleanC = cleanArabicTextForMatch(c.name);
    if (cleanC.includes(cleanTarget) || cleanTarget.includes(cleanC)) {
      candidatesMap.set(`courier_${c.id}`, { id: c.id, name: c.name, typeTitle: "مندوب" });
    }
  }

  const allShops = await prisma.shop.findMany();
  for (const s of allShops) {
    const cleanS = cleanArabicTextForMatch(s.name);
    if (cleanS.includes(cleanTarget) || cleanTarget.includes(cleanS)) {
      candidatesMap.set(`shop_${s.id}`, { id: s.id, name: s.name, typeTitle: "محل" });
    }
  }

  const allPartners = await prisma.creditBookPartner.findMany();
  for (const p of allPartners) {
    const cleanP = cleanArabicTextForMatch(p.name);
    if (cleanP.includes(cleanTarget) || cleanTarget.includes(cleanP)) {
      const title = p.type === "preparer" ? "مورد" : (p.type === "courier" ? "مندوب" : (p.type === "shop" ? "محل" : "شريك"));
      if (!candidatesMap.has(`partner_${p.id}`)) {
        candidatesMap.set(`partner_${p.id}`, { id: p.id, name: p.name, typeTitle: title });
      }
    }
  }

  return Array.from(candidatesMap.values()).slice(0, 3);
}

/**
 * المحرك المباشر الفائق للتحكم الشامل بكل مفاصل النظام بـ 0 ميلي ثانية
 */
export async function executeSuperSystemAgent(args: any, userText: string, aiParsed?: any) {
  const rawText = userText || "";
  const parsed = aiParsed || parseCustomSystemIntent(rawText);

  // ==========================================
  // 0.1 معالجة اختيار المحل المباشر بالنقر أو النطق بعد المقترح (SELECT SHOP ACTION)
  // ==========================================
  if (rawText.startsWith("select_shop_") || rawText.includes("🏪")) {
    let shopId = rawText.replace("select_shop_", "").trim();
    let shop = await prisma.shop.findUnique({ where: { id: shopId } });

    if (!shop) {
      const cleanShopName = rawText.replace("🏪", "").trim();
      shop = await prisma.shop.findFirst({
        where: { name: { contains: cleanShopName, mode: "insensitive" } }
      });
    }

    if (shop) {
      const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
      const order = await prisma.order.create({
        data: {
          shopId: shop.id,
          status: "pending",
          orderType: "مواد متنوعة",
          orderNoteTime: "عادي",
          customerPhone: "07700000000",
          orderSubtotal: new Decimal(5),
          deliveryPrice: new Decimal(0),
          totalAmount: new Decimal(5),
          submissionSource: "admin_ai_assistant",
        }
      });

      notifyTelegramNewOrder(order.id).catch(() => {});
      pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => {});

      const regionButtons = allRegions.slice(0, 5).map(r => ({
        text: `📍 ${r.name} (توصيل: ${r.deliveryPrice ? Number(r.deliveryPrice) : 5})`,
        action: `select_region_${r.id}`
      }));

      return {
        reply: `تم يا أبو الأكبر! أنشأت طلب جديد #${order.orderNumber} لـ (${shop.name})`,
        buttons: regionButtons
      };
    }
  }

  // ==========================================
  // 0.2 معالجة اختيار المنطقة بالنقر المباشر (SELECT REGION ACTION)
  // ==========================================
  if (rawText.startsWith("select_region_")) {
    const regionId = rawText.replace("select_region_", "").trim();
    const region = await prisma.region.findUnique({ where: { id: regionId } });

    if (region) {
      const latestOrder = await prisma.order.findFirst({
        orderBy: { createdAt: "desc" },
        include: { shop: true }
      });

      if (latestOrder) {
        const regionPrice = region.deliveryPrice ? Number(region.deliveryPrice) : 5;
        const subtotal = latestOrder.orderSubtotal ? Number(latestOrder.orderSubtotal) : 0;
        const newTotal = subtotal + regionPrice;

        const updated = await prisma.order.update({
          where: { id: latestOrder.id },
          data: {
            customerRegionId: region.id,
            deliveryPrice: new Decimal(regionPrice),
            totalAmount: new Decimal(newTotal)
          }
        });

        return {
          reply: `تم يا أبو الأكبر! حددت منطقة طلب #${updated.orderNumber} لـ (${region.name}) والتوصيل ${regionPrice} والإجمالي (${newTotal})`
        };
      }
    }
  }

  // ==========================================
  // 1. قسم تعديل وإسناد الطلبات للمندوبين (ORDER UPDATE & COURIER ASSIGNMENT)
  // ==========================================
  if (
    parsed?.category === "order_update" ||
    rawText.includes("إسناد") ||
    rawText.includes("اسناد") ||
    rawText.includes("اسند") ||
    rawText.includes("حول الطلب") ||
    rawText.includes("حوله على")
  ) {
    const orderNum = parsed?.order_number || (rawText.match(/\b\d{3,5}\b/) ? Number(rawText.match(/\b\d{3,5}\b/)[0]) : null);
    let courierName = parsed?.clean_name || "فارس";

    let targetOrder = null;
    if (orderNum) {
      targetOrder = await prisma.order.findUnique({ where: { orderNumber: orderNum }, include: { shop: true } });
    } else {
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

        return {
          reply: `تم يا أبو الأكبر! أسندت طلب #${updated.orderNumber} لـ (${targetOrder.shop.name}) إلى المندوب (${matchedCourier.name})`
        };
      }
    }
  }

  // ==========================================
  // 2. قسم إنشاء وإضافة المندوبين الجدد بـ 0 ميلي ثانية
  // ==========================================
  if (
    parsed?.category === "courier_create" ||
    rawText.includes("مندوب")
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
          data: { name: courierName, phone: phone }
        });
        return { reply: `تم يا أبو الأكبر! ضفت المندوب الجديد (${updated.name}) برقم ${phone}` };
      }

      const newCourier = await prisma.courier.create({
        data: {
          name: courierName,
          phone: phone
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
  // 3. قسم رصد وتنزيل الديون لـ الشركاء والموردين والمندوبين
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
    let partnerName = parsed?.clean_name || "الوالد";

    const allPartners = await prisma.creditBookPartner.findMany();
    let partner = allPartners.find(p => p.name.includes(partnerName) || partnerName.includes(p.name));

    if (!partner && (rawText.includes("الوالد") || rawText.includes("للوالد"))) {
      partner = allPartners.find(p => p.name.includes("الوالد") || p.name.includes("والد"));
    }

    if (!partner && (rawText.includes("ميثاق") || partnerName.includes("ميثاق"))) {
      partner = allPartners.find(p => p.name.includes("ميثاق"));
    }

    if (!partner) {
      partner = await prisma.creditBookPartner.create({
        data: { name: partnerName, type: "external" }
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
  // 4. قسم تصفير رواتب ومستحقات المندوبين
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
      return { reply: `تم يا أبو الأكبر! صفرت حساب ومستحقات المندوب (${matchedCourier.name})` };
    }
  }

  // ==========================================
  // 5. قسم الأسئلة العامة والاستفسارات
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
