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

export async function handleOrderCreationWizard(
  userText: string,
  draft: OrderDraftState,
  ctx: { lastOrderNumber?: number | null }
): Promise<{ handled: boolean; reply?: string; nextDraft?: OrderDraftState | null }> {
  const clean = userText.trim().toLowerCase();

  // 1. إلغاء إنشاء الطلب
  if (clean === "الغاء" || clean === "إلغاء" || clean === "كنسل" || clean.includes("الغاء الطلب") || clean.includes("بطلت")) {
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
      let matchedShop = allShops.find(s => clean.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(clean));
      if (!matchedShop && allShops.length > 0) {
        matchedShop = allShops.find(s => userText.includes(s.name)) || allShops[0];
      }

      if (!matchedShop) {
        return {
          handled: true,
          reply: `يا أبو الأكبر، ما لكيت محل بهذا الاسم. المحلات عندك: ${allShops.map(s => s.name).join("، ")}. من أي محل؟ 🏪`,
          nextDraft: draft
        };
      }

      return {
        handled: true,
        reply: `تمام يا غالي (${matchedShop.name})! لأي منطقة الطلب؟ 📍`,
        nextDraft: {
          ...draft,
          step: "waiting_region",
          shopId: matchedShop.id,
          shopName: matchedShop.name
        }
      };
    }

    case "waiting_region": {
      const allRegions = await prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } });
      let matchedRegion = allRegions.find(r => clean.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(clean));
      if (!matchedRegion) {
        const ranked = rankRegionsByQuery(userText, allRegions as any);
        if (ranked.length > 0) matchedRegion = ranked[0];
      }

      const regionTitle = matchedRegion ? matchedRegion.name : userText;

      return {
        handled: true,
        reply: `حلو (${regionTitle})! انطيني رقم هاتف الزبون 📞 (أو اكتب "بدون رقم")`,
        nextDraft: {
          ...draft,
          step: "waiting_phone",
          regionId: matchedRegion?.id || null,
          regionName: regionTitle
        }
      };
    }

    case "waiting_phone": {
      let phone: string | null = null;
      if (!clean.includes("بدون") && !clean.includes("ماكو") && !clean.includes("لا يوجد")) {
        const phoneMatch = userText.match(/(?:\+964|0)?7[3-9][\d\s]{7,12}\d/);
        phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : userText.replace(/\D/g, "");
        if (phone.length < 5) phone = null;
      }

      return {
        handled: true,
        reply: `تمام! شنو نوع أو محتوى الطلبية؟ (مثلاً: سمك، روبيان، مسواق، حلويات، ورد، اقمشة، طعام) 📦`,
        nextDraft: {
          ...draft,
          step: "waiting_type",
          phone: phone
        }
      };
    }

    case "waiting_type": {
      const orderType = userText.trim() || "مسواق";

      return {
        handled: true,
        reply: `عاشت إيدك (${orderType})! شكد سعر الطلب؟ (مثلاً: 10 أو 15 أو 0) 💰`,
        nextDraft: {
          ...draft,
          step: "waiting_price",
          orderType: orderType
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

      return {
        handled: true,
        reply: `ممتاز! شوكت وقت التوصيل المطلوب؟ (مثلاً: الآن، ب4 العصر، مغرباً) ⏰`,
        nextDraft: {
          ...draft,
          step: "waiting_time",
          price: price
        }
      };
    }

    case "waiting_time": {
      const noteTime = userText.trim() || "الان";

      // إنشاء الطلب فوراً في قاعدة بيانات سوبابيس!
      const shopId = draft.shopId!;
      const subtotal = draft.price || 0;

      let deliveryPriceNum = 0;
      if (draft.regionId) {
        const reg = await prisma.region.findUnique({ where: { id: draft.regionId } });
        if (reg?.deliveryPrice) deliveryPriceNum = Number(reg.deliveryPrice);
      }

      const totalNum = subtotal + deliveryPriceNum;

      const order = await prisma.order.create({
        data: {
          shopId: shopId,
          status: "pending",
          orderType: draft.orderType || "مسواق",
          orderNoteTime: noteTime,
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
        reply: `تم يا أبو الأكبر! أنشأت الطلب بنجاح #${order.orderNumber} 🎉\n🏪 **المحل:** ${draft.shopName} | 📍 **المنطقة:** ${draft.regionName || "غير محددة"}\n📞 **الهاتف:** ${draft.phone || "بدون رقم"} | 📦 **النوع:** ${draft.orderType}\n💰 **السعر:** ${subtotal} ألف (المجموع: ${totalNum} ألف) | ⏰ **الوقت:** ${noteTime} 🚀`,
        nextDraft: null
      };
    }

    default:
      return { handled: false };
  }
}
