"use server";

import { prisma } from "@/lib/prisma";
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
  const regionNameInput = (formData.get("regionName") as string) || "";
  const deliveryPriceOverriden = Number(formData.get("deliveryPrice") || 0);
  const vehiclePreference = formData.get("vehiclePreference") as string || null;
  const landmark = formData.get("landmark") as string || "";
  const cartJson = formData.get("cart") as string;
  const sharedCartId = formData.get("sharedCartId") as string || null;
  const addToOrderId = formData.get("addToOrderId") as string || null;

  if (!phone || (!regionId && !regionNameInput) || !cartJson) {
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
    const addedInfo = item.addedBy ? ` [بواسطة: ${item.addedBy}]` : "";
    summaryParts.push(`${item.name} ×${item.quantity || 1}${addedInfo}`);
  });

  let region = regionId ? await prisma.region.findUnique({ where: { id: regionId } }).catch(() => null) : null;
  
  if (!region) {
    if (regionNameInput) {
      region = await prisma.region.findFirst({
        where: { name: { contains: regionNameInput, mode: "insensitive" } }
      }).catch(() => null);
    }
    if (!region) {
      region = await prisma.region.findFirst().catch(() => null);
    }
  }

  const basePrice = region ? Number(region.deliveryPrice) : 0;
  const finalDeliveryPrice = deliveryPriceOverriden > basePrice ? deliveryPriceOverriden : basePrice;
  const effectiveRegionId = region ? region.id : (regionId || (await prisma.region.findFirst())?.id || "");
  const totalAmount = subtotal + finalDeliveryPrice;

  try {
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

    let customer = await prisma.customer.findFirst({
      where: { shopId: shop.id, phone: phoneLocal }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          shopId: shop.id,
          phone: phoneLocal,
          customerRegionId: effectiveRegionId || null,
          customerLandmark: landmark,
        }
      });
    }

    let draft: any;
    let createdOrder: any = null;
    let existingDraft: any = null;
    let targetOrderNumber: string | null = addToOrderId ? String(addToOrderId).trim() : null;

    if (addToOrderId) {
      const cleanId = String(addToOrderId).trim();
      const orderNum = parseInt(cleanId, 10);
      const isNum = !isNaN(orderNum);

      try {
        existingDraft = await prisma.companyPreparerShoppingDraft.findFirst({
          where: {
            OR: [
              ...(isNum ? [{ draftNumber: orderNum }] : []),
              { id: cleanId }
            ]
          },
          orderBy: { createdAt: "desc" }
        });
      } catch (err) {
        console.error("Failed to find existing draft:", err);
      }
    }

    if (!existingDraft && phoneLocal) {
      try {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        existingDraft = await prisma.companyPreparerShoppingDraft.findFirst({
          where: {
            customerPhone: phoneLocal,
            createdAt: { gte: twoDaysAgo }
          },
          orderBy: { createdAt: "desc" }
        });
      } catch (err) {
        console.error("Failed to find existing draft by phone:", err);
      }
    }

    if (existingDraft) {
      targetOrderNumber = String(existingDraft.draftNumber || targetOrderNumber || addToOrderId);

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

      // تنبيه الإشعار العائم والتليجرام
      void notifyTelegramStoreOrder(draft.id);
      const { notifyOneSignalAdminStoreOrder } = await import("@/lib/onesignal-server");
      void notifyOneSignalAdminStoreOrder(draft.id);
      const { pushNotifyAdminsNewStoreOrder } = await import("@/lib/web-push-server");
      void pushNotifyAdminsNewStoreOrder(draft.id);

      const addedLines = cart.map((item: any) => `- ${item.name} × ${item.quantity || 1}${item.addedBy ? ` (بواسطة ${item.addedBy})` : ""}`);
      return {
        ok: true,
        orderNumber: targetOrderNumber,
        whatsappMessage: [
          `لقد أضفت منتجات من خصيب ستور لطلبي المرقم ${targetOrderNumber}`,
          "المنتجات المضافة هي:",
          ...addedLines
        ].join("\n"),
        draftId: draft.id
      };
    }

    if (!draft && addToOrderId) {
      const cleanId = String(addToOrderId).trim();
      const orderNum = parseInt(cleanId, 10);
      const isNum = !isNaN(orderNum);
      try {
        const existingOrder = await prisma.order.findFirst({
          where: {
            OR: [
              ...(isNum ? [{ orderNumber: orderNum }] : []),
              { id: cleanId }
            ]
          }
        });

        if (existingOrder) {
          targetOrderNumber = String(existingOrder.orderNumber);
          const updatedSummary = (existingOrder.summary || "") + "\n--- إضافات جديدة ---\n" + summaryParts.join("\n");
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: {
              summary: updatedSummary,
              orderSubtotal: { increment: subtotal },
              totalAmount: { increment: subtotal }
            }
          });

          void notifyTelegramStoreOrder(existingOrder.id);

          const addedLines = cart.map((item: any) => `- ${item.name} × ${item.quantity || 1}${item.addedBy ? ` (بواسطة ${item.addedBy})` : ""}`);
          return {
            ok: true,
            orderNumber: targetOrderNumber,
            whatsappMessage: [
              `لقد أضفت منتجات من خصيب ستور لطلبي المرقم ${targetOrderNumber}`,
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
        if (sharedCartId) {
          await tx.sharedCart.update({
            where: { id: sharedCartId },
            data: { status: "ordered" }
          });
        }

        // 1. إنشاء الطلب الرسمي بجدول Order لكي ينزل فوراً في لوحة التحكم وقسم الطلبات الجديدة والتجهيز للأدمن!
        createdOrder = await tx.order.create({
          data: {
            shopId: shop.id,
            customerId: customer.id,
            customerPhone: phoneLocal,
            customerRegionId: effectiveRegionId || null,
            customerLandmark: landmark ? `${landmark} (منطقة: ${regionNameInput || "عامة"})` : `منطقة: ${regionNameInput || "عامة"}`,
            status: "pending",
            summary: summaryParts.join("\n"),
            orderType: sharedCartId ? "سلة مشتركة" : "طلب متجر 🛒",
            orderSubtotal: subtotal,
            deliveryPrice: finalDeliveryPrice,
            totalAmount: totalAmount,
            vehiclePreference: vehiclePreference,
            preparerShoppingJson: {
              isWebStore: true,
              products: cart.map((i: any) => ({
                line: i.name,
                qty: i.quantity || 1,
                buyAlf: "",
                sellAlf: "",
                isFromStore: true,
                supplierId: i.supplierId || null,
                productId: i.productId || i.id,
                addedBy: i.addedBy || null
              }))
            }
          }
        });

        // 2. إنشاء مسودة التجهيز المرافقة
        const newDraft = await tx.companyPreparerShoppingDraft.create({
          data: {
            preparerId: null,
            sentOrderId: createdOrder.id,
            customerPhone: phoneLocal,
            customerRegionId: effectiveRegionId || null,
            customerLandmark: landmark ? `${landmark} (منطقة: ${regionNameInput || "عامة"})` : `منطقة: ${regionNameInput || "عامة"}`,
            titleLine: sharedCartId ? "طلب من السلة المشتركة للعائلة" : "طلب من المتجر الالكتروني",
            rawListText: summaryParts.join("\n"),
            status: "draft",
            vehiclePreference: vehiclePreference,
            data: {
              version: 1,
              products: cart.map((i: any) => ({
                line: i.name,
                qty: i.quantity || 1,
                buyAlf: "",
                sellAlf: "",
                isFromStore: true,
                supplierId: i.supplierId || null,
                productId: i.productId || i.id,
                addedBy: i.addedBy || null
              })),
              webStoreCart: cart,
              sharedCartId: sharedCartId,
              orderId: createdOrder.id
            }
          }
        });

        return newDraft;
      });
    }

    // تنبيهات فورية (تليجرام + ون سجنل + إشعار عائم للإدارة والأدمن)
    void notifyTelegramStoreOrder(draft.id);
    const { notifyOneSignalAdminStoreOrder } = await import("@/lib/onesignal-server");
    void notifyOneSignalAdminStoreOrder(draft.id);
    const { pushNotifyAdminsNewStoreOrder } = await import("@/lib/web-push-server");
    void pushNotifyAdminsNewStoreOrder(draft.id);
    if (createdOrder?.orderNumber) {
      const { pushNotifyAdminsNewPendingOrder } = await import("@/lib/web-push-server");
      void pushNotifyAdminsNewPendingOrder(createdOrder.orderNumber).catch(() => null);
    }

    const numericOrderNumber = createdOrder?.orderNumber ? String(createdOrder.orderNumber) : (targetOrderNumber || String(draft.draftNumber));
    const productLines = cart.map((item: any) => `- ${item.name} × ${item.quantity || 1}${item.addedBy ? ` (بواسطة ${item.addedBy})` : ""}`);

    const isAddition = Boolean(addToOrderId);

    const whatsappMessage = isAddition ? [
      `لقد أضفت منتجات من خصيب ستور لطلبي المرقم ${numericOrderNumber}`,
      "المنتجات المضافة هي:",
      ...productLines,
    ].join("\n") : [
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
