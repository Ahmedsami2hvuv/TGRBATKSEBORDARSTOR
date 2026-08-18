"use server";

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { notifyTelegramStoreOrder } from "@/lib/telegram-notify";

export type OrderFormState = {
  error?: string;
  ok?: boolean;
  orderNumber?: string;
  whatsappMessage?: string;
  draftId?: string;
};

export async function submitStoreOrder(_prev: any, formData: FormData): Promise<OrderFormState> {
  const phone = formData.get("phone") as string;
  const regionId = formData.get("regionId") as string;
  const deliveryPriceOverriden = Number(formData.get("deliveryPrice") || 0);
  const vehiclePreference = formData.get("vehiclePreference") as string || null;
  const landmark = formData.get("landmark") as string || "";
  const cartJson = formData.get("cart") as string;
  const sharedCartId = formData.get("sharedCartId") as string || null;
  const addToOrderId = formData.get("addToOrderId") as string || null;

  if (!phone || !regionId || !cartJson) {
    return { error: "يرجى ملء جميع الحقول المطلوبة" };
  }

  const phoneLocal = normalizeIraqMobileLocal11(phone) || phone;

  // Global block check
  const isGlobalBlocked = await prisma.globalBlockedPhone.findUnique({
    where: { phone: phoneLocal },
  });
  if (isGlobalBlocked) {
    return { error: "عذراً، هذا الرقم محظور من الطلب حالياً." };
  }

  const cart = JSON.parse(cartJson);
  if (!Array.isArray(cart) || cart.length === 0) {
    return { error: "السلة فارغة" };
  }

  // Calculate totals and build summary
  let subtotal = 0;
  let summaryParts: string[] = [];

  cart.forEach((item: any) => {
    subtotal += Number(item.price || 0) * (item.quantity || 1);
    // إذا كان هناك حقل addedBy نضيفه في تفاصيل الطلب ليرى الأدمن من طلب المنتج!
    const addedInfo = item.addedBy ? ` [بواسطة: ${item.addedBy}]` : "";
    summaryParts.push(`${item.name} (${item.quantity || 1})${addedInfo}`);
  });

  const region = await prisma.region.findUnique({ where: { id: regionId } });
  if (!region) return { error: "المنطقة غير صالحة" };

  const basePrice = Number(region.deliveryPrice);
  const finalDeliveryPrice = deliveryPriceOverriden > basePrice ? deliveryPriceOverriden : basePrice;

  const totalAmount = subtotal + finalDeliveryPrice;

  try {
    // الحصول على محل "خصيب ستور" أو إنشاؤه إذا لم يكن موجوداً
    let shop = await prisma.shop.findFirst({
      where: { name: { contains: "خصيب", mode: "insensitive" } }
    });

    if (!shop) {
      shop = await prisma.shop.findFirst({
        where: { name: { contains: "متجر", mode: "insensitive" } }
      });
    }

    if (!shop) {
      shop = await prisma.shop.findFirst();
    }

    if (!shop) {
      return { error: "لا يوجد محل مفعل لاستقبال الطلبات حالياً" };
    }

    // البحث عن عميل أو إنشاؤه لهذا المحل
    let customer = await prisma.customer.findFirst({
      where: { shopId: shop.id, phone: phoneLocal }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          shopId: shop.id,
          phone: phoneLocal,
          customerRegionId: regionId,
          customerLandmark: landmark,
        }
      });
    }

    let draft: any;
    
    // محاولة دمج المنتجات مع طلب أو مسودة سابقة قيد التجهيز
    let existingDraft: any = null;
    
    if (addToOrderId) {
      const isNum = /^\d+$/.test(String(addToOrderId).trim());
      const orderNum = parseInt(String(addToOrderId).trim(), 10);

      try {
        if (isNum && !isNaN(orderNum)) {
          existingDraft = await prisma.companyPreparerShoppingDraft.findFirst({
            where: { draftNumber: orderNum, status: { in: ["draft", "assigned"] } }
          });
        } else {
          existingDraft = await prisma.companyPreparerShoppingDraft.findFirst({
            where: { id: addToOrderId, status: { in: ["draft", "assigned"] } }
          });
        }
      } catch (err) {
        console.error("Failed to find existing draft:", err);
      }
    }

    // إذا لم يجد بـ addToOrderId المباشر، نتحقق من وجود مسودة مفتوحة قيد التجهيز لنفس رقم هاتف العميل
    if (!existingDraft && phoneLocal) {
      try {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        existingDraft = await prisma.companyPreparerShoppingDraft.findFirst({
          where: {
            customerPhone: phoneLocal,
            status: { in: ["draft", "assigned"] },
            createdAt: { gte: twoDaysAgo }
          },
          orderBy: { createdAt: "desc" }
        });
      } catch (err) {
        console.error("Failed to find existing draft by phone:", err);
      }
    }

    if (existingDraft) {
      const existingData = typeof existingDraft.data === 'object' && existingDraft.data !== null ? existingDraft.data : {};
      const existingProducts = Array.isArray((existingData as any).products) ? (existingData as any).products : [];
      const existingCart = Array.isArray((existingData as any).webStoreCart) ? (existingData as any).webStoreCart : [];
      
      const newProducts = cart.map((i: any) => ({
        line: i.name,
        qty: i.quantity || 1,
        buyAlf: "",
        sellAlf: "",
        isFromStore: true,
        supplierId: i.supplierId || null,
        productId: i.productId || i.id,
        addedBy: i.addedBy || null
      }));
      
      draft = await prisma.companyPreparerShoppingDraft.update({
        where: { id: existingDraft.id },
        data: {
          rawListText: (existingDraft.rawListText || "") + "\n--- إضافات جديدة للطلب ---\n" + summaryParts.join("\n"),
          data: {
            ...(existingData as any),
            products: [...existingProducts, ...newProducts],
            webStoreCart: [...existingCart, ...cart]
          }
        }
      });

      // إرسال تنبيه تليجرام للتحديث
      void notifyTelegramStoreOrder(draft.id);

      const addedLines = cart.map((item: any) => `- ${item.name} × ${item.quantity || 1}${item.addedBy ? ` (بواسطة ${item.addedBy})` : ""}`);
      const customWhatsappMessage = [
        `لقد قمت بإضافة منتجات إلى طلبيتي من خصيب ستور، رقم طلبي هو: ${draft.draftNumber}`,
        "المنتجات المضافة هي:",
        ...addedLines
      ].join("\n");

      return {
        ok: true,
        orderNumber: String(draft.draftNumber),
        whatsappMessage: customWhatsappMessage,
        draftId: draft.id
      };
    }

    // إذا لم تكن هناك مسودة مفتوحة، نتحقق مما إذا كانت طلبية معتمدة قائمة في جدول Order
    if (!draft && addToOrderId) {
      const isNum = /^\d+$/.test(String(addToOrderId).trim());
      const orderNum = parseInt(String(addToOrderId).trim(), 10);
      try {
        const existingOrder = await prisma.order.findFirst({
          where: {
            ...(isNum && !isNaN(orderNum) ? { orderNumber: orderNum } : { id: addToOrderId }),
            status: { in: ["pending", "assigned"] }
          }
        });

        if (existingOrder) {
          const updatedSummary = (existingOrder.summary || "") + "\n--- إضافات جديدة ---\n" + summaryParts.join("\n");
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: {
              summary: updatedSummary,
              orderSubtotal: { increment: subtotal },
              totalAmount: { increment: subtotal }
            }
          });

          // إرسال تنبيه تليجرام بالإضافة
          void notifyTelegramStoreOrder(existingOrder.id);

          const addedLines = cart.map((item: any) => `- ${item.name} × ${item.quantity || 1}${item.addedBy ? ` (بواسطة ${item.addedBy})` : ""}`);
          return {
            ok: true,
            orderNumber: String(existingOrder.orderNumber),
            whatsappMessage: [
              `لقد قمت بإضافة منتجات إلى طلبيتي من خصيب ستور، رقم طلبي هو: ${existingOrder.orderNumber}`,
              "المنتجات المضافة هي:",
              ...addedLines
            ].join("\n"),
            draftId: existingOrder.id
          };
        }
      } catch (err) {
        console.error("Failed to update existing order:", err);
      }
    }
    
    if (!draft) {
      draft = await prisma.$transaction(async (tx) => {
        // إذا كانت السلة مشتركة، نحدث حالتها إلى ordered
        if (sharedCartId) {
          await tx.sharedCart.update({
            where: { id: sharedCartId },
            data: { status: "ordered" }
          });
        }

        // إنشاء مسودة تجهيز فقط لكي تظهر في تبويب "قيد التجهيز" للإدارة للتسعير والإسناد
        return tx.companyPreparerShoppingDraft.create({
          data: {
            preparerId: null, // سيبقى فارغاً حتى يسنده الأدمن لمجهز معين
            customerPhone: phoneLocal,
            customerRegionId: regionId,
            customerLandmark: landmark,
            titleLine: sharedCartId ? "طلب من السلة المشتركة للعائلة" : "طلب من المتجر الالكتروني",
            rawListText: summaryParts.join("\n"),
            status: "draft",
            vehiclePreference: vehiclePreference,
            data: {
              version: 1,
              products: cart.map((i: any) => ({
                line: i.name,
                qty: i.quantity || 1,
                buyAlf: "", // نتركها فارغة لكي يضطر المجهز لتسعيرها وتجهيزها
                sellAlf: "", // نتركها فارغة لضمان ظهورها كغير مجهزة
                isFromStore: true,
                supplierId: i.supplierId || null,
                productId: i.productId || i.id,
                addedBy: i.addedBy || null // لحفظ اسم من أضاف المنتج
              })),
              webStoreCart: cart,
              sharedCartId: sharedCartId
            }
          }
        });
      });
    }

    // Notify via Telegram
    void notifyTelegramStoreOrder(draft.id);

    const numericOrderNumber = String(draft.draftNumber);
    const productLines = cart.map((item: any) => `- ${item.name} × ${item.quantity || 1}${item.addedBy ? ` (بواسطة ${item.addedBy})` : ""}`);
    const whatsappMessage = [
      sharedCartId ? "لقد قمنا بالطلب من السلة المشتركة للعائلة في خصيب ستور ارجو تجهيز طلبي" : "لقد قمت بالطلب من خصيب ستور ارجو تجهيز طلبي",
      `رقم طلبي هو: ${numericOrderNumber}`,
      "المنتجات:",
      ...productLines,
    ].join("\n");

    return {
      ok: true,
      orderNumber: numericOrderNumber,
      whatsappMessage,
      draftId: draft.id,
    };
  } catch (e: any) {
    console.error("Order creation failed error details:", e);
    return { error: `فشل في إرسال الطلب: ${e?.message || "يرجى المحاولة لاحقاً"}` };
  }
}

