import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { rankRegionsByQuery } from "./arabic-region-search";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { getCachedShops, getCachedRegions } from "./ai-data-cache";

export type OrderDraftState = {
  step?: "waiting_shop" | "waiting_region" | "waiting_phone" | "waiting_type" | "waiting_price" | "waiting_time" | null;
  shopId?: string | null;
  shopName?: string | null;
  regionId?: string | null;
  regionName?: string | null;
  phone?: string | null;
  orderType?: string | null;
  price?: number | null;
  noteTime?: string | null;
};

export function normalizeArabic(text: string): string {
  return text
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟?]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function cleanAndNormalizePhone(raw: string): string | null {
  if (!raw) return null;
  let cleaned = raw
    .replace(/[٠۰]/g, "0")
    .replace(/[١۱]/g, "1")
    .replace(/[٢۲]/g, "2")
    .replace(/[٣۳]/g, "3")
    .replace(/[٤۴]/g, "4")
    .replace(/[٥۵]/g, "5")
    .replace(/[٦۶]/g, "6")
    .replace(/[٧۷]/g, "7")
    .replace(/[٨۸]/g, "8")
    .replace(/[٩۹]/g, "9")
    .replace(/[\s\-_+]/g, "");

  const match = cleaned.match(/(?:964|0)?7[3-9]\d{8}/);
  if (match) return match[0];
  const digits = cleaned.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

export function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length >= s2.length ? s1 : s2;
  const shorter = s1.length < s2.length ? s1 : s2;
  if (longer.length === 0) return 1.0;

  if (longer.includes(shorter)) return 0.85;

  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return (longer.length - costs[shorter.length]) / longer.length;
}

export async function parseMultiFieldInput(
  rawText: string,
  existingDraft: OrderDraftState,
  allRegions: Array<{ id: string; name: string; deliveryPrice: any }>
): Promise<{ updatedDraft: OrderDraftState; fieldsFoundCount: number }> {
  const draft: OrderDraftState = { ...existingDraft };
  let fieldsFoundCount = 0;

  const lines = rawText.split(/[\n;]/).map(l => l.trim()).filter(Boolean);

  if (lines.length >= 2) {
    for (const line of lines) {
      const cleanLine = normalizeArabic(line);

      // أ) فحص رقم الهاتف
      const phone = cleanAndNormalizePhone(line);
      if (phone && !draft.phone) {
        draft.phone = phone;
        fieldsFoundCount++;
        continue;
      }

      // ب) فحص السعر (إذا كان رقماً مفرداً أو يحتوي على ألف/دينار/k)
      const isPrice = /^(?:\d+|[٠-٩]+)\s*(?:الف|ألف|k|دينار)?$/i.test(cleanLine);
      if (isPrice && (draft.price === undefined || draft.price === null)) {
        const num = line.replace(/[٠۰]/g, "0").replace(/[١۱]/g, "1").replace(/[٢۲]/g, "2").replace(/[٣۳]/g, "3").replace(/[٤۴]/g, "4").replace(/[٥۵]/g, "5").replace(/[٦۶]/g, "6").replace(/[٧۷]/g, "7").replace(/[٨۸]/g, "8").replace(/[٩۹]/g, "9").replace(/\D/g, "");
        if (num) {
          draft.price = Number(num);
          fieldsFoundCount++;
          continue;
        }
      }

      // ج) فحص وقت الطلب
      if (
        (cleanLine.includes("العصر") || cleanLine.includes("الظهر") || cleanLine.includes("مغرب") || cleanLine.includes("صبح") || cleanLine.includes("الان") || cleanLine.includes("باجر") || cleanLine.includes("ساعه") || cleanLine.includes("ساعة") || /^ب?\d+\s*(?:العصر|الظهر|مغرب|الصبح|مساء|صباحا|ليلا)?$/i.test(cleanLine)) &&
        !draft.noteTime
      ) {
        draft.noteTime = line;
        fieldsFoundCount++;
        continue;
      }

      // د) فحص المنطقة
      if (!draft.regionId) {
        let cleanRegSearch = cleanLine
          .replace(/جيحور/gi, "جيكور")
          .replace(/جاي\s*كور/gi, "جيكور")
          .replace(/نار\s*خوز/gi, "نهر خوز")
          .trim();

        const scored = allRegions.map(r => {
          const cleanR = normalizeArabic(r.name);
          let score = 0;
          if (cleanR === cleanRegSearch) score = 1.0;
          else if (cleanR.includes(cleanRegSearch) || cleanRegSearch.includes(cleanR)) score = 0.85;
          else score = calculateSimilarity(cleanR, cleanRegSearch);
          return { region: r, score };
        }).sort((a, b) => b.score - a.score);

        if (scored[0] && scored[0].score >= 0.6) {
          draft.regionId = scored[0].region.id;
          draft.regionName = scored[0].region.name;
          fieldsFoundCount++;
          continue;
        }
      }

      // هـ) نوع الطلب (إذا لم يكن هاتف ولا سعر ولا منطقة ولا وقت)
      if (!draft.orderType && cleanLine.length >= 2 && !/^\d+$/.test(cleanLine)) {
        draft.orderType = line;
        fieldsFoundCount++;
      }
    }
  } else {
    // معالجة السطر الواحد إذا احتوى على هاتف وسعر ومنطقة
    const phone = cleanAndNormalizePhone(rawText);
    if (phone && !draft.phone) {
      draft.phone = phone;
      fieldsFoundCount++;
    }

    const priceMatch = rawText.match(/(?:سعر|سعره|بـ|مبلغ)?\s*(\d+|[٠-٩]+)\s*(?:الف|ألف|k|دينار)?(?:\s|$)/i);
    if (priceMatch && (draft.price === undefined || draft.price === null)) {
      const num = priceMatch[1].replace(/[٠۰]/g, "0").replace(/[١۱]/g, "1").replace(/[٢۲]/g, "2").replace(/[٣۳]/g, "3").replace(/[٤۴]/g, "4").replace(/[٥۵]/g, "5").replace(/[٦۶]/g, "6").replace(/[٧۷]/g, "7").replace(/[٨۸]/g, "8").replace(/[٩۹]/g, "9");
      draft.price = Number(num);
      fieldsFoundCount++;
    }

    const timeMatch = rawText.match(/(?:ب?\d+\s*(?:العصر|الظهر|مغرب|الصبح|مساء|صباحا|ليلا)|العصر|المغرب|الظهر|الصبح|الان|باجر)/i);
    if (timeMatch && !draft.noteTime) {
      draft.noteTime = timeMatch[0].trim();
      fieldsFoundCount++;
    }

    if (!draft.regionId) {
      for (const reg of allRegions) {
        const cleanR = normalizeArabic(reg.name);
        if (cleanR.length >= 3 && normalizeArabic(rawText).includes(cleanR)) {
          draft.regionId = reg.id;
          draft.regionName = reg.name;
          fieldsFoundCount++;
          break;
        }
      }
    }

    // هـ) نوع الطلب في السطر الواحد إذا لم يكن هاتفاً ولا سعراً ولا منطقة ولا وقتاً
    const cleanOne = normalizeArabic(rawText);
    if (
      !draft.orderType &&
      !phone &&
      !priceMatch &&
      !timeMatch &&
      cleanOne.length >= 2 &&
      !/^\d+$/.test(cleanOne)
    ) {
      draft.orderType = rawText.trim();
      fieldsFoundCount++;
    }
  }

  return { updatedDraft: draft, fieldsFoundCount };
}

export async function finalizeAndCreateOrder(
  draft: OrderDraftState,
  ctx: { lastOrderNumber?: number | null }
): Promise<{ handled: boolean; reply: string; nextDraft: null }> {
  const shopId = draft.shopId!;
  const subtotal = draft.price || 0;

  let deliveryPriceNum = 0;
  if (draft.regionId) {
    const reg = await prisma.region.findUnique({ where: { id: draft.regionId } });
    if (reg?.deliveryPrice) deliveryPriceNum = Number(reg.deliveryPrice);
  }

  const totalNum = subtotal + deliveryPriceNum;
  const oType = draft.orderType || "مسواق";
  const nTime = draft.noteTime || "الان";

  const order = await prisma.order.create({
    data: {
      shop: { connect: { id: shopId } },
      status: "pending",
      orderType: oType,
      orderNoteTime: nTime,
      ...(draft.regionId ? { customerRegion: { connect: { id: draft.regionId } } } : {}),
      customerPhone: draft.phone || "",
      orderSubtotal: new Decimal(subtotal),
      deliveryPrice: new Decimal(deliveryPriceNum),
      totalAmount: new Decimal(totalNum),
      submissionSource: "admin_ai_assistant"
    }
  });

  notifyTelegramNewOrder(order.id).catch(() => {});
  pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => {});

  ctx.lastOrderNumber = order.orderNumber;

  return {
    handled: true,
    reply: `تم يا أبو الأكبر! أنشأت الطلب بنجاح #${order.orderNumber} 🎉\n🏪 **المحل:** ${draft.shopName} | 📍 **المنطقة:** ${draft.regionName || "غير محددة"}\n📞 **الهاتف:** ${draft.phone || "بدون رقم"} | 📦 **النوع:** ${oType}\n💰 **السعر:** ${subtotal} ألف (المجموع: ${totalNum} ألف) | ⏰ **الوقت:** ${nTime} 🚀`,
    nextDraft: null
  };
}

export async function handleOrderCreationWizard(
  userText: string,
  draft: OrderDraftState,
  ctx: { lastOrderNumber?: number | null }
): Promise<{ handled: boolean; reply?: string; nextDraft?: OrderDraftState | null; buttons?: Array<{ text: string; action: string }> }> {
  const clean = userText.replace(/[.،,؟!؟]/g, "").trim().toLowerCase();

  // 1. إلغاء العملية
  if (clean.includes("الغاء") || clean.includes("إلغاء") || clean.includes("كنسل") || clean.includes("بطلت") || clean.includes("مسح")) {
    return {
      handled: true,
      reply: "تم إلغاء إنشاء الطلب ومسح المسودة بنجاح يا غالي 🌸",
      nextDraft: null
    };
  }

  // 2. إذا كنا في أي خطوة بعد اختيار المحل وتم إرسال تفاصيل متعددة مجمعة في رسالة واحدة (أكثر من معلومتين)
  if (draft.step && draft.step !== "waiting_shop") {
    const allRegions = await getCachedRegions();
    const { updatedDraft, fieldsFoundCount } = await parseMultiFieldInput(userText, draft, allRegions);

    if (fieldsFoundCount >= 2) {
      // إذا اكتملت الحقول الأساسية (محل + منطقة + سعر + نوع)
      if (updatedDraft.shopId && updatedDraft.regionId && updatedDraft.price !== undefined && updatedDraft.orderType) {
        return await finalizeAndCreateOrder(updatedDraft, ctx);
      }

      // إذا كانت هناك حقول ناقصة، نسأله فقط عن الحقل الناقص!
      if (!updatedDraft.regionId) {
        return {
          handled: true,
          reply: `حلو يا غالي! لأي منطقة الطلب؟ 📍`,
          nextDraft: { ...updatedDraft, step: "waiting_region" }
        };
      }
      if (!updatedDraft.phone) {
        return {
          handled: true,
          reply: `حلو (${updatedDraft.regionName})! انطيني رقم هاتف الزبون 📞 (أو اكتب "بدون رقم")`,
          nextDraft: { ...updatedDraft, step: "waiting_phone" }
        };
      }
      if (!updatedDraft.orderType) {
        return {
          handled: true,
          reply: `تمام! شنو نوع أو محتوى الطلبية؟ (مثلاً: ورد، ماء، طعام) 📦`,
          nextDraft: { ...updatedDraft, step: "waiting_type" }
        };
      }
      if (updatedDraft.price === undefined || updatedDraft.price === null) {
        return {
          handled: true,
          reply: `عاشت إيدك! شكد سعر الطلب؟ (مثلاً: 10 أو 15 أو 0) 💰`,
          nextDraft: { ...updatedDraft, step: "waiting_price" }
        };
      }
      if (!updatedDraft.noteTime) {
        return {
          handled: true,
          reply: `ممتاز! شوكت وقت التوصيل المطلوب؟ ⏰`,
          nextDraft: { ...updatedDraft, step: "waiting_time" }
        };
      }
    }
  }

  // 3. معالجة الخطوات المفردة بالتسلسل
  switch (draft.step) {
    case "waiting_shop": {
      const allShops = await getCachedShops();
      const isDirectButtonClick = userText.startsWith("🏪 ") || userText.startsWith("محل ");
      const cleanUser = clean
        .replace(/^من\s+محل\s+/g, "")
        .replace(/^من\s+/g, "")
        .replace(/^محل\s+/g, "")
        .replace(/^🏪\s*/g, "")
        .trim();

      const scoredShops = allShops.map(s => {
        const cleanS = normalizeArabic(s.name);
        let score = calculateSimilarity(cleanS, cleanUser);
        if (cleanS === cleanUser) score = 1.0;
        else if (cleanUser.includes(cleanS) || cleanS.includes(cleanUser)) score = 0.9;
        return { shop: s, score };
      }).sort((a, b) => b.score - a.score);

      const best = scoredShops[0];

      // إذا نقر المستخدم على الزر مباشرة (🏪 ...) يتم اعتماد المحل فوراً والانتقال للمنطقة
      if (isDirectButtonClick && best && best.score >= 0.7) {
        const updatedDraft: OrderDraftState = {
          ...draft,
          shopId: best.shop.id,
          shopName: best.shop.name
        };

        if (updatedDraft.price !== undefined && updatedDraft.orderType && updatedDraft.regionId) {
          return await finalizeAndCreateOrder(updatedDraft, ctx);
        }

        return {
          handled: true,
          reply: `تمام يا غالي (${best.shop.name})! لأي منطقة الطلب؟ 📍`,
          nextDraft: {
            ...updatedDraft,
            step: "waiting_region"
          }
        };
      }

      // دائماً نعرض للمستخدم خيارات المحلات الأقرب حتى لو كتب الاسم صحيحاً لتأكيده بنقرة واحدة وتجنب الخطأ
      const topSuggestions = scoredShops.slice(0, 4).map(s => s.shop);
      const buttons = topSuggestions.map(s => ({
        text: `🏪 ${s.name}`,
        action: `🏪 ${s.name}`
      }));

      return {
        handled: true,
        reply: `يا أبو الأكبر، قصدك أي محل من هذولي؟ 👇`,
        buttons: buttons,
        nextDraft: draft
      };
    }

    case "waiting_region": {
      const allRegions = await getCachedRegions();
      const isDirectButtonClick = userText.startsWith("📍 ") || userText.startsWith("منطقة ") || userText.startsWith("منطقه ");
      let cleanUser = clean
        .replace(/^الى\s+منطقة\s+/g, "")
        .replace(/^الي\s+منطقة\s+/g, "")
        .replace(/^الى\s+/g, "")
        .replace(/^الي\s+/g, "")
        .replace(/^منطقة\s+/g, "")
        .replace(/^منطقه\s+/g, "")
        .replace(/^📍\s*/g, "")
        .replace(/^لـ\s*/g, "")
        .replace(/^لاي\s*/g, "")
        .replace(/جيحور/gi, "جيكور")
        .replace(/جاي\s*كور/gi, "جيكور")
        .replace(/نار\s*خوز/gi, "نهر خوز")
        .trim();

      const scoredRegions = allRegions.map(r => {
        const cleanR = normalizeArabic(r.name);
        let score = 0;
        if (cleanR === cleanUser) {
          score = 1.0;
        } else if (cleanR.includes(cleanUser) || cleanUser.includes(cleanR)) {
          score = 0.85;
        } else {
          score = calculateSimilarity(cleanR, cleanUser);
        }
        return { region: r, score };
      }).sort((a, b) => b.score - a.score);

      const best = scoredRegions[0];

      // إذا نقر المستخدم على زر المنطقة مباشرة (📍 ...) يتم اعتماد المنطقة فوراً والانتقال للهاتف
      if (isDirectButtonClick && best && best.score >= 0.7) {
        const matchedRegion = best.region;
        const updatedDraft: OrderDraftState = {
          ...draft,
          regionId: matchedRegion.id,
          regionName: matchedRegion.name
        };

        if (updatedDraft.shopId && updatedDraft.price !== undefined && updatedDraft.orderType) {
          return await finalizeAndCreateOrder(updatedDraft, ctx);
        }

        return {
          handled: true,
          reply: `حلو (${matchedRegion.name})! انطيني رقم هاتف الزبون 📞 (أو اكتب "بدون رقم")`,
          nextDraft: {
            ...updatedDraft,
            step: "waiting_phone"
          }
        };
      }

      // دائماً نعرض للمستخدم خيارات المناطق الأقرب حتى لو كتب الاسم لتأكيده بنقرة واحدة وتجنب أي خطأ في المنطقة
      const topRegions = scoredRegions.slice(0, 4).map(item => item.region);
      const buttons = topRegions.map(r => ({
        text: `📍 ${r.name}`,
        action: `📍 ${r.name}`
      }));

      return {
        handled: true,
        reply: `يا أبو الأكبر، قصدك أي منطقة من هذولي؟ 👇`,
        buttons: buttons,
        nextDraft: draft
      };
    }

    case "waiting_phone": {
      let phone: string | null = null;
      if (!clean.includes("بدون") && !clean.includes("ماكو") && !clean.includes("لا يوجد") && !clean.includes("ما عنده")) {
        phone = cleanAndNormalizePhone(userText);
      }

      const updatedDraft: OrderDraftState = {
        ...draft,
        phone: phone
      };

      if (updatedDraft.shopId && updatedDraft.price !== undefined && updatedDraft.orderType) {
        return await finalizeAndCreateOrder(updatedDraft, ctx);
      }

      return {
        handled: true,
        reply: `تمام! شنو نوع أو محتوى الطلبية؟ (مثلاً: سمك، روبيان، مسواق، حلويات، ورد، اقمشة، طعام) 📦`,
        nextDraft: {
          ...updatedDraft,
          step: "waiting_type"
        }
      };
    }

    case "waiting_type": {
      const orderType = userText.replace(/[.،,؟!؟]/g, "").trim() || "مسواق";
      const updatedDraft: OrderDraftState = {
        ...draft,
        orderType: orderType
      };

      if (updatedDraft.shopId && updatedDraft.price !== undefined) {
        return await finalizeAndCreateOrder(updatedDraft, ctx);
      }

      return {
        handled: true,
        reply: `عاشت إيدك (${orderType})! شكد سعر الطلب؟ (مثلاً: 10 أو 15 أو 0) 💰`,
        nextDraft: {
          ...updatedDraft,
          step: "waiting_price"
        }
      };
    }

    case "waiting_price": {
      let price = 0;
      const numMatch = userText.replace(/[٠۰]/g, "0").replace(/[١۱]/g, "1").replace(/[٢۲]/g, "2").replace(/[٣۳]/g, "3").replace(/[٤۴]/g, "4").replace(/[٥۵]/g, "5").replace(/[٦۶]/g, "6").replace(/[٧۷]/g, "7").replace(/[٨۸]/g, "8").replace(/[٩۹]/g, "9").match(/\d+/);
      if (numMatch) {
        price = Number(numMatch[0]);
      } else if (clean.includes("صفر") || clean.includes("بلاش") || clean.includes("مجاني")) {
        price = 0;
      }

      const updatedDraft: OrderDraftState = {
        ...draft,
        price: price
      };

      if (updatedDraft.shopId && updatedDraft.orderType && updatedDraft.noteTime) {
        return await finalizeAndCreateOrder(updatedDraft, ctx);
      }

      return {
        handled: true,
        reply: `ممتاز! شوكت وقت التوصيل المطلوب؟ (مثلاً: الآن، ب4 العصر، مغرباً) ⏰`,
        nextDraft: {
          ...updatedDraft,
          step: "waiting_time"
        }
      };
    }

    case "waiting_time": {
      const noteTime = userText.replace(/[.،,؟!؟]/g, "").trim() || "الان";
      const updatedDraft: OrderDraftState = {
        ...draft,
        noteTime: noteTime
      };

      return await finalizeAndCreateOrder(updatedDraft, ctx);
    }

    default:
      return { handled: false };
  }
}
