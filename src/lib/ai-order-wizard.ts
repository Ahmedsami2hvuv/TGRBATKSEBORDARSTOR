import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { rankRegionsByQuery } from "./arabic-region-search";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";

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

function normalizeArabic(text: string): string {
  return text
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟?]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
      shopId: shopId,
      status: "pending",
      orderType: oType,
      orderNoteTime: nTime,
      customerRegionId: draft.regionId || null,
      customerPhone: draft.phone || null,
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
): Promise<{ handled: boolean; reply?: string; buttons?: Array<{ text: string; action: string }>; nextDraft?: OrderDraftState | null }> {
  const clean = normalizeArabic(userText);

  // 1. إلغاء إنشاء الطلب
  if (clean === "الغاء" || clean === "كنسل" || clean.includes("الغاء الطلب") || clean.includes("بطلت")) {
    return {
      handled: true,
      reply: "تم إلغاء إنشاء الطلب يا أبو الأكبر! تدلل وآمرني بأي شيء ثاني 🌸",
      nextDraft: null
    };
  }

  // 2. معالجة الخطوات بالتسلسل
  switch (draft.step) {
    case "waiting_shop": {
      const allShops = await prisma.shop.findMany({ select: { id: true, name: true } });
      const cleanUser = clean
        .replace(/^من\s+محل\s+/g, "")
        .replace(/^من\s+/g, "")
        .replace(/^محل\s+/g, "")
        .trim();

      const scoredShops = allShops.map(s => {
        const cleanS = normalizeArabic(s.name);
        let score = calculateSimilarity(cleanS, cleanUser);
        if (cleanS === cleanUser) score = 1.0;
        else if (cleanUser.includes(cleanS) || cleanS.includes(cleanUser)) score = 0.9;
        return { shop: s, score };
      }).sort((a, b) => b.score - a.score);

      const best = scoredShops[0];

      if (best && best.score >= 0.55) {
        const updatedDraft: OrderDraftState = {
          ...draft,
          shopId: best.shop.id,
          shopName: best.shop.name
        };

        // إذا كانت باقي بيانات الطلب محددة مسبقاً، ننشئ الطلب فوراً!
        if (updatedDraft.price !== undefined && updatedDraft.orderType) {
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

      const topSuggestions = scoredShops.slice(0, 3).map(s => s.shop);
      const buttons = topSuggestions.map(s => ({
        text: `🏪 ${s.name}`,
        action: s.name
      }));

      return {
        handled: true,
        reply: `يا أبو الأكبر، قصدك أي محل من هذولي؟ 👇`,
        buttons: buttons,
        nextDraft: draft
      };
    }

    case "waiting_region": {
      const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
      let cleanUser = clean
        .replace(/^الى\s+منطقة\s+/g, "")
        .replace(/^الي\s+منطقة\s+/g, "")
        .replace(/^الى\s+/g, "")
        .replace(/^الي\s+/g, "")
        .replace(/^منطقة\s+/g, "")
        .replace(/^منطقه\s+/g, "")
        .replace(/^لـ\s*/g, "")
        .replace(/^لاي\s*/g, "")
        .replace(/جيحور/gi, "جيكور")
        .replace(/جاي\s*كور/gi, "جيكور")
        .replace(/نار\s*خوز/gi, "نهر خوز")
        .trim();

      // حساب نسبة التشابه الحقيقية لجميع المناطق
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

      // إذا كان التشابه قوي جداً (0.65 فأعلى أو تطابق كامل):
      if (best && best.score >= 0.65) {
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

      // إذا كان الكلام غير متطابق أو خطأ بالاسم أو تشابه متوسط:
      // نعرض فوراً أفضل وأقرب 4 مناطق مشابهة كأزرار تفاعلية!
      const topRegions = scoredRegions.slice(0, 4).map(item => item.region);
      const buttons = topRegions.map(r => ({
        text: `📍 ${r.name}`,
        action: r.name
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
        const phoneMatch = userText.match(/(?:\+964|0)?7[3-9][\d\s]{7,12}\d/);
        phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : userText.replace(/\D/g, "");
        if (phone.length < 5) phone = null;
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
      const numMatch = userText.match(/\d+/);
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
