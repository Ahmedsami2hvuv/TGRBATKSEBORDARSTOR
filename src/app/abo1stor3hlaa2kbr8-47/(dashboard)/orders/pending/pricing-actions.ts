"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { ALF_PER_DINAR } from "@/lib/money-alf";
import {
  buildCustomerInvoiceText,
  buildPreparerPurchaseSummaryText,
} from "@/lib/preparation-invoice";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import { isMeatProduct } from "@/lib/auto-pricing";
import { CourierWalletMiscDirection, PreparerShoppingDraftStatus } from "@prisma/client";
import { ADMIN_OFFICE_LABEL, ADMIN_SHOP_NAMES } from "@/lib/admin-order-from-admin-constants";

const SYSTEM_ADMIN_PHONE = "07733921568";

async function getOrCreateSystemAdminShop(): Promise<{ id: string; regionId: string; photoUrl: string | null }> {
  let shop = await prisma.shop.findFirst({
    where: { name: { in: ADMIN_SHOP_NAMES } },
  });

  if (!shop) {
    const firstRegion = await prisma.region.findFirst();
    if (!firstRegion) throw new Error("يجب إضافة منطقة واحدة على الأقل في النظام.");

    shop = await prisma.shop.create({
      data: {
        name: ADMIN_OFFICE_LABEL,
        phone: SYSTEM_ADMIN_PHONE,
        locationUrl: "",
        regionId: firstRegion.id,
      },
    });
  } else {
    const data: { name?: string; phone?: string } = {};
    if (shop.name !== ADMIN_OFFICE_LABEL) data.name = ADMIN_OFFICE_LABEL;
    if (shop.phone !== SYSTEM_ADMIN_PHONE) data.phone = SYSTEM_ADMIN_PHONE;
    if (Object.keys(data).length > 0) {
      shop = await prisma.shop.update({
        where: { id: shop.id },
        data,
      });
    }
  }

  return { id: shop.id, regionId: shop.regionId, photoUrl: shop.photoUrl ?? null };
}

export type PricingState = { error?: string; ok?: boolean };

export async function savePricingProgress(id: string, isDraft: boolean, products: any[], placesCount: number) {
  try {
    const safeProducts = Array.isArray(products) ? products.filter(Boolean) : [];
    if (isDraft) {
      const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id } });
      if (!draft) return { error: "المسودة غير موجودة" };

      // التأكد من حفظ بيانات المجهز لكل منتج
      const productsWithPreparer = safeProducts.map(p => ({
        ...p,
        assignedPreparerId: p.assignedPreparerId || draft.preparerId,
        assignedPreparerName: p.assignedPreparerName || (draft.preparer?.name || null)
      }));

      await prisma.companyPreparerShoppingDraft.update({
        where: { id },
        data: {
          data: { ...(draft.data as any || {}), products: productsWithPreparer },
          placesCount
        }
      });
    } else {
      const order = await prisma.order.findUnique({ where: { id }, select: { preparerShoppingJson: true } });
      if (!order) return { error: "الطلب غير موجود" };
      await prisma.order.update({
        where: { id },
        data: {
          preparerShoppingJson: { ...(order.preparerShoppingJson as any || {}), products: safeProducts, placesCount }
        }
      });
    }
    return { ok: true };
  } catch (e) {
    console.error("Auto-save error:", e);
    return { error: "فشل الحفظ التلقائي" };
  }
}

export async function updateOrderPricingByAdmin(orderId: string, _prev: any, formData: FormData): Promise<PricingState> {
  try {
    const productsJson = String(formData.get("productsJson") ?? "[]");
    const placesCount = Math.max(0, Number(formData.get("placesCount") ?? 1) || 0);
    const skipWallet = formData.get("skipWallet") === "on";
    const isDraft = formData.get("isDraft") === "true";
    const shopId = String(formData.get("shopId") ?? "").trim();
    const submitType = String(formData.get("submitType") ?? "");
    const autoCourierFromForm = String(formData.get("autoCourierId") ?? "").trim();

    let uiProducts: any[] = [];
    try {
      uiProducts = JSON.parse(productsJson).filter(Boolean);
    } catch (e) {
      return { error: "بيانات المنتجات غير صالحة" };
    }

    // --- 1. جلب البيانات الأصلية من قاعدة البيانات ---
    let draftData: any = null;
    let customerRegion: any = null;
    let originalOrder: any = null;

  if (isDraft) {
    const draft = await prisma.companyPreparerShoppingDraft.findUnique({
      where: { id: orderId },
      include: { customerRegion: true }
    });
    if (!draft) return { error: "المسودة غير موجودة" };
    draftData = draft;
    customerRegion = draft.customerRegion;
  } else {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customerRegion: true, shop: { include: { region: true } } }
    });
    if (!order) return { error: "الطلب غير موجود" };
    originalOrder = order;
    customerRegion = order.customerRegion;
  }

  let autoCourierId: string | null = null;
  if (isDraft) {
    const dataCourierId = String((draftData?.data as any)?.autoCourierId ?? "").trim();
    const candidate = autoCourierFromForm || dataCourierId;
    if (candidate) {
      const courier = await prisma.courier.findUnique({ where: { id: candidate }, select: { id: true } });
      autoCourierId = courier?.id ?? null;
    }
  }

  // --- 2. معالجة المنتجات ---
  const finalProducts = uiProducts.map(uiProd => ({
    line: String(uiProd.line || "").trim(),
    buyAlf: Number(uiProd.buyAlf || 0),
    sellAlf: Number(uiProd.sellAlf || 0),
    pricedBy: uiProd.pricedBy || null,
    pricedById: uiProd.pricedById || null,
    assignedPreparerId: typeof uiProd.assignedPreparerId === "string" && uiProd.assignedPreparerId.trim() ? uiProd.assignedPreparerId.trim() : null,
    assignedPreparerName: typeof uiProd.assignedPreparerName === "string" ? uiProd.assignedPreparerName : null,
  }));

  // --- التحقق من الإرسال النهائي ---
  if (submitType === "final_send") {
    const allPriced = finalProducts.length > 0 && finalProducts.every(p => p.buyAlf > 0 && p.sellAlf > 0);
    if (!allPriced) return { error: "يجب إكمال تسعير جميع المنتجات (بسعر أكبر من صفر) قبل الإرسال النهائي." };
    if (placesCount <= 0) return { error: "يجب تحديد عدد المحلات." };
  }

  // --- 3. حساب الإجماليات العامة ---
  let sumSellAlf = 0;
  for (const p of finalProducts) {
    sumSellAlf += p.sellAlf;
  }
  const extraAlf = calculateExtraAlfFromPlacesCount(placesCount);
  const subtotalDinar = new Decimal(sumSellAlf + extraAlf).mul(ALF_PER_DINAR);

  // --- 4. جلب قائمة المجهزين النشطة لتوحيد التسمية والدعم بآي دي ---
  const allPreparers = await prisma.companyPreparer.findMany({
    where: { active: true },
    select: { id: true, name: true, walletEmployeeId: true }
  });
  const preparerNameById = new Map(allPreparers.map((p) => [p.id, p.name]));

  // --- 5. تجميع المنتجات حسب المجهز الحقيقي (assignedPreparer) أو حسب سعرها ---
  const enrichedProducts = finalProducts.map((p) => ({
    ...p,
    assignedPreparerName: p.assignedPreparerId && !p.assignedPreparerName
      ? preparerNameById.get(p.assignedPreparerId) ?? null
      : p.assignedPreparerName,
  }));

  const preparerMap = new Map<string, { preparerId: string | null; preparerName: string; products: any[]; totalBuyAlf: number }>();
  for (const p of enrichedProducts) {
    const assignedPreparerId = typeof p.assignedPreparerId === "string" && p.assignedPreparerId.trim() ? p.assignedPreparerId.trim() : null;
    const assignedPreparerName = typeof p.assignedPreparerName === "string" && p.assignedPreparerName.trim()
      ? p.assignedPreparerName.trim()
      : null;
    const pricedByName = typeof p.pricedBy === "string" && p.pricedBy.trim() ? p.pricedBy.trim() : null;
    const preparerName = assignedPreparerName || pricedByName;
    if (!preparerName) continue;

    const key = assignedPreparerId ? `id:${assignedPreparerId}` : `name:${preparerName}`;
    if (!preparerMap.has(key)) {
      preparerMap.set(key, {
        preparerId: assignedPreparerId,
        preparerName,
        products: [],
        totalBuyAlf: 0,
      });
    }

    const entry = preparerMap.get(key)!;
    entry.products.push(p);
    entry.totalBuyAlf += p.buyAlf;
  }

  // --- 6. تحضير الفواتير المنفصلة ---
  const preparerInvoices = Array.from(preparerMap.values()).map((entry) => ({
    preparerId: entry.preparerId,
    preparerName: entry.preparerName,
    products: entry.products,
    totalBuyAlf: entry.totalBuyAlf,
    invoiceText: buildPreparerPurchaseSummaryText(entry.products)
  }));

  if (!skipWallet && preparerInvoices.length === 0 && finalProducts.length > 0) {
    return { error: "لا يمكن تحديد المجهزين لهذه المنتجات. تأكد من أن كل منتج قد تم تسعيره من قبل أحد المجهزين." };
  }

  // --- 6. بناء نص الملاحظات الرئيسي للطلب ---
  const summaryParts = preparerInvoices.map(inv => {
    return `[ تجهيز: ${inv.preparerName} ]\n${inv.invoiceText}`;
  });
  const CUSTOMER_NOTE_BORDER = "═══════════════";
  const summaryCombined = [
    CUSTOMER_NOTE_BORDER,
    "المنتجات المجهزة (حسب المجهز)",
    CUSTOMER_NOTE_BORDER,
    summaryParts.join("\n\n═══════════════\n\n"),
    CUSTOMER_NOTE_BORDER
  ].join("\n");

  // --- 7. جلب بيانات المتجر والتوصيل ---
  let shop = null;
  let deliveryDinar = new Decimal(0);
  if (isDraft) {
    // استخدام المتجر من الطلب المرتبط إذا وُجد، وإلا استخدام الإدارة العامة تلقائياً
    if (draftData!.sentOrderId) {
      const existingOrder = await prisma.order.findUnique({
        where: { id: draftData!.sentOrderId },
        include: { shop: { include: { region: true } } }
      });
      if (!existingOrder || !existingOrder.shop) {
        return { error: "خطأ في طلب المسودة المرتبط. المتجر غير موجود." };
      }
      shop = existingOrder.shop;
      deliveryDinar = Decimal.max(shop.region.deliveryPrice, customerRegion?.deliveryPrice || 0);
    } else if (shopId) {
      shop = await prisma.shop.findUnique({ where: { id: shopId }, include: { region: true } });
      if (!shop) {
        return { error: "المحل المحدد غير موجود." };
      }
      deliveryDinar = Decimal.max(shop.region.deliveryPrice, customerRegion?.deliveryPrice || 0);
    } else {
      const firstSystemShop = await getOrCreateSystemAdminShop();
      shop = await prisma.shop.findUnique({ where: { id: firstSystemShop.id }, include: { region: true } });
      if (!shop) {
        return { error: "خطأ تقني في تحديد متجر الإدارة العامة." };
      }
      deliveryDinar = Decimal.max(shop.region.deliveryPrice, customerRegion?.deliveryPrice || 0);
    }
  } else {
    shop = originalOrder!.shop;
    // Attempt to recover delivery price if it's missing or zero in the main column
    const existingPrice = originalOrder!.deliveryPrice;
    const jsonDeliveryAlf = (originalOrder!.preparerShoppingJson as any)?.deliveryAlf;

    if (existingPrice && !existingPrice.isZero()) {
      deliveryDinar = existingPrice;
    } else if (jsonDeliveryAlf != null && jsonDeliveryAlf > 0) {
      deliveryDinar = new Decimal(jsonDeliveryAlf).mul(ALF_PER_DINAR);
    } else {
      // Fallback to region data
      const shopRegionPrice = shop?.region?.deliveryPrice || new Decimal(0);
      const custRegionPrice = customerRegion?.deliveryPrice || new Decimal(0);
      deliveryDinar = Decimal.max(shopRegionPrice, custRegionPrice);
    }
  }

  const totalDinar = subtotalDinar.plus(deliveryDinar);
  const deliveryAlf = Number(deliveryDinar.toString()) / ALF_PER_DINAR;

  return await prisma.$transaction(async (tx) => {
    let finalOrderId: string;
    let finalOrderNumber: number;

    // --- 8. إنشاء الطلب النهائي أو تحديثه ---
    if (isDraft) {
      // التحقق من وجود طلب مرتبط بالمسودة مسبقاً
      if (draftData!.sentOrderId) {
        // تحديث الطلب الموجود بدلاً من إنشاء جديد
        const updated = await tx.order.update({
          where: { id: draftData!.sentOrderId },
          data: {
            shopId: shop!.id,
            customerPhone: draftData!.customerPhone,
            customerRegionId: draftData!.customerRegionId,
            customerLandmark: draftData!.customerLandmark,
            orderNoteTime: draftData!.orderTime,
            orderSubtotal: subtotalDinar,
            deliveryPrice: deliveryDinar,
            totalAmount: totalDinar,
            assignedCourierId: autoCourierId,
            status: autoCourierId ? "assigned" : "pending",
            summary: summaryCombined,
            preparerShoppingJson: {
              version: 1,
              products: enrichedProducts,
              placesCount,
              sumSellAlf,
              extraAlf,
              deliveryAlf,
              preparerInvoices,
              customerInvoiceText: buildCustomerInvoiceText({
                brandLabel: "أبو الأكبر للتوصيل",
                orderNumberLabel: `#${originalOrder?.orderNumber || "(جديد)"}`,
                regionTitle: draftData!.titleLine,
                phone: draftData!.customerPhone,
                lines: enrichedProducts,
                placesCount,
                deliveryAlf,
              })
            }
          }
        });
        finalOrderId = updated.id;
        finalOrderNumber = updated.orderNumber;
      } else {
        const reservedOrderNumberRaw = Number((draftData?.data as any)?.reservedOrderNumber ?? 0);
        const reservedOrderNumber =
          Number.isInteger(reservedOrderNumberRaw) && reservedOrderNumberRaw > 0
            ? reservedOrderNumberRaw
            : undefined;

        // إنشاء طلب جديد فقط إذا لم يكن هناك طلب مرتبط
        const newOrder = await tx.order.create({
          data: {
            shopId: shop!.id,
            customerPhone: draftData!.customerPhone,
            customerRegionId: draftData!.customerRegionId,
            customerLandmark: draftData!.customerLandmark,
            orderNoteTime: draftData!.orderTime,
            status: autoCourierId ? "assigned" : "pending",
            orderType: "تجهيز تسوق",
            submissionSource: "company_preparer",
            submittedByCompanyPreparerId: null,
            assignedCourierId: autoCourierId,
            orderSubtotal: subtotalDinar,
            deliveryPrice: deliveryDinar,
            totalAmount: totalDinar,
            summary: summaryCombined,
            ...(reservedOrderNumber ? { orderNumber: reservedOrderNumber } : {}),
            preparerShoppingJson: {
              version: 1,
              products: enrichedProducts,
              placesCount,
              sumSellAlf,
              extraAlf,
              deliveryAlf,
              preparerInvoices,
              customerInvoiceText: buildCustomerInvoiceText({
                brandLabel: "أبو الأكبر للتوصيل",
                orderNumberLabel: `#(جديد)`,
                regionTitle: draftData!.titleLine,
                phone: draftData!.customerPhone,
                lines: enrichedProducts,
                placesCount,
                deliveryAlf,
              })
            }
          }
        });
        finalOrderId = newOrder.id;
        finalOrderNumber = newOrder.orderNumber;

        await tx.companyPreparerShoppingDraft.update({
          where: { id: orderId },
          data: { status: PreparerShoppingDraftStatus.sent, sentOrderId: newOrder.id }
        });
      }

      // عند الإرسال النهائي لمسودة، نؤكد أن كافة المسودات المتصلة تُعلَن مرسلة
      if (submitType === "final_send") {
        const draftGroupId = (draftData!.data as any)?.groupId;
        if (draftGroupId) {
          await tx.companyPreparerShoppingDraft.updateMany({
            where: { data: { path: ["groupId"], equals: draftGroupId } },
            data: { status: PreparerShoppingDraftStatus.sent, sentOrderId: finalOrderId }
          });
        } else {
          await tx.companyPreparerShoppingDraft.updateMany({
            where: {
              customerPhone: draftData!.customerPhone,
              titleLine: draftData!.titleLine,
              status: { in: ["draft", "priced"] }
            },
            data: { status: PreparerShoppingDraftStatus.sent, sentOrderId: finalOrderId }
          });
        }
      }
    } else {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          orderSubtotal: subtotalDinar,
          deliveryPrice: deliveryDinar,
          totalAmount: totalDinar,
          summary: summaryCombined,
          preparerShoppingJson: {
            ...((typeof originalOrder!.preparerShoppingJson === "object" && originalOrder!.preparerShoppingJson !== null) ? originalOrder!.preparerShoppingJson : {}),
            version: 1,
            products: enrichedProducts,
            placesCount,
            sumSellAlf,
            extraAlf,
            deliveryAlf,
            preparerInvoices,
            customerInvoiceText: buildCustomerInvoiceText({
              brandLabel: "أبو الأكبر للتوصيل",
              orderNumberLabel: `#${originalOrder!.orderNumber}`,
              regionTitle: customerRegion?.name || "",
              phone: originalOrder!.customerPhone,
              lines: enrichedProducts,
              placesCount,
              deliveryAlf,
            })
          }
        }
      });
      finalOrderId = orderId;
      finalOrderNumber = updated.orderNumber;
    }

    // --- 9. تسجيل القيود المالية وتصحيح التكرار ---
    if (!skipWallet) {
      const preparerWalletLabelTitle = customerRegion?.name || String(draftData?.titleLine ?? "").trim() || "المنطقة";

      await tx.employeeWalletMiscEntry.updateMany({
        where: {
          label: { contains: `طلب #${finalOrderNumber}` },
          deletedAt: null
        },
        data: {
          deletedAt: new Date(),
          deletedReason: "manual_admin",
          deletedByDisplayName: "تحديث الأسعار من الإدارة"
        }
      });

      for (const inv of preparerInvoices) {
        const preparer = inv.preparerId
          ? allPreparers.find(p => p.id === inv.preparerId)
          : allPreparers.find(p => p.name.trim() === inv.preparerName.trim());

        const chargeBuyAlf = inv.products.reduce(
          (sum: number, p: any) => sum + (isMeatProduct(p.line) ? 0 : Number(p.buyAlf || 0)),
          0,
        );
        if (preparer && preparer.walletEmployeeId && chargeBuyAlf > 0) {
          await tx.employeeWalletMiscEntry.create({
            data: {
              employeeId: preparer.walletEmployeeId,
              direction: CourierWalletMiscDirection.give,
              amountDinar: new Decimal(chargeBuyAlf).mul(ALF_PER_DINAR),
              label: `فاتورة تجهيز طلب #${finalOrderNumber} (${preparerWalletLabelTitle})`
            }
          });
        }
      }
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47/orders/pending");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/orders/${finalOrderId}`);
    return { ok: true };
  });
  } catch (error) {
    console.error("Admin pricing action error:", {
      orderId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { error: "حدث خطأ أثناء معالجة التسعير. يرجى المحاولة مرة أخرى." };
  }
}
