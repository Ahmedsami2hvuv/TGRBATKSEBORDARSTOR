"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { ALF_PER_DINAR } from "@/lib/money-alf";
import {
  buildCustomerInvoiceText,
  buildPreparerPurchaseSummaryText,
  resolveDynamicOrderType,
} from "@/lib/preparation-invoice";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import { isMeatProduct } from "@/lib/auto-pricing";
import { CourierWalletMiscDirection, PreparerShoppingDraftStatus } from "@prisma/client";
import { ADMIN_OFFICE_LABEL, ADMIN_SHOP_NAMES } from "@/lib/admin-order-from-admin-constants";

const SYSTEM_ADMIN_PHONE = "07733921568";

export async function getOrCreateSystemAdminShop(): Promise<{ id: string; regionId: string; photoUrl: string | null }> {
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
        region: { connect: { id: firstRegion.id } },
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

export async function savePricingProgress(id: string, isDraft: boolean, products: any[], placesCount: number, noProfit?: boolean) {
  try {
    const safeProducts = Array.isArray(products) ? products.filter(Boolean) : [];
    if (isDraft) {
      const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id } });
      if (!draft) return { error: "المسودة غير موجودة" };

      // الحفاظ على التخصيص الدقيق لكل منتج دون فرض preparerId افتراضي إذا لم يكن مسنداً
      const productsWithPreparer = safeProducts.map(p => ({
        ...p,
        line: String(p.line || "").trim(),
        assignedPreparerId: typeof p.assignedPreparerId === "string" && p.assignedPreparerId.trim() ? p.assignedPreparerId.trim() : null,
        assignedPreparerName: typeof p.assignedPreparerName === "string" && p.assignedPreparerName.trim() ? p.assignedPreparerName.trim() : null
      }));

      // البحث عن كل المسودات التابعة للمجموعة لضمان المزامنة الشاملة لجميع المجهزين
      const groupId = (draft.data as any)?.groupId;
      let relatedIds = [id];
      if (groupId) {
        const draftsWithGroup = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "CompanyPreparerShoppingDraft" WHERE data->>'groupId' = ${groupId}`;
        const ids = draftsWithGroup.map(d => d.id);
        if (ids.length > 0) relatedIds = ids;
      } else if (draft.customerPhone && draft.titleLine) {
        const relatedDrafts = await prisma.companyPreparerShoppingDraft.findMany({
          where: {
            customerPhone: draft.customerPhone,
            titleLine: draft.titleLine,
            status: { in: ["draft", "priced"] }
          },
          select: { id: true }
        });
        if (relatedDrafts.length > 0) {
          relatedIds = relatedDrafts.map(d => d.id);
        }
      }

      for (const rId of relatedIds) {
        const rDraft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id: rId } });
        if (!rDraft) continue;

        const nextData = { ...(rDraft.data as any || {}), products: productsWithPreparer };
        if (noProfit !== undefined) {
          nextData.noProfit = noProfit;
        }

        const newRawListText = productsWithPreparer.map(p => p.line).filter(Boolean).join("\n");
        await prisma.companyPreparerShoppingDraft.update({
          where: { id: rId },
          data: {
            data: nextData,
            placesCount,
            ...(newRawListText ? { rawListText: newRawListText } : {})
          }
        });
      }
    } else {
      const order = await prisma.order.findUnique({
        where: { id },
        select: { status: true, preparerShoppingJson: true }
      });
      if (!order) return { error: "الطلب غير موجود" };

      const oldProducts = (order.preparerShoppingJson as any)?.products || [];
      const nextJson = { ...(order.preparerShoppingJson as any || {}), products: safeProducts, placesCount };
      if (noProfit !== undefined) {
        nextJson.noProfit = noProfit;
      }

      await prisma.order.update({
        where: { id },
        data: {
          preparerShoppingJson: nextJson
        }
      });

      // مزامنة معاملات الموردين في الدفتر لتحديث الأرصدة تلقائياً إذا كان الطلب مسلّماً أو نشطاً
      if (order.status !== "draft" && order.status !== "priced" && order.status !== "cancelled") {
        try {
          const oldSuppIds = Array.from(new Set(
            oldProducts
              .map((p: any) => typeof p.assignedPreparerId === "string" ? p.assignedPreparerId.trim() : null)
              .filter(Boolean)
          )) as string[];

          const newSuppIds = Array.from(new Set(
            safeProducts
              .map((p: any) => typeof p.assignedPreparerId === "string" ? p.assignedPreparerId.trim() : null)
              .filter(Boolean)
          )) as string[];

          const uniqueSuppIdsToSync = Array.from(new Set([...oldSuppIds, ...newSuppIds]));

          const { syncSupplierTransactions } = await import("@/lib/order-delivery-hook");
          for (const suppId of uniqueSuppIdsToSync) {
            await syncSupplierTransactions(suppId);
          }
        } catch (syncErr) {
          console.error("Failed to sync supplier transactions after auto-save pricing:", syncErr);
        }
      }
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

  const noProfitRaw = formData.get("noProfit");
  const noProfit = noProfitRaw !== null
    ? noProfitRaw === "true"
    : isDraft
      ? !!(draftData?.data as any)?.noProfit
      : !!(originalOrder?.preparerShoppingJson as any)?.noProfit;

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
    isFulfilledByAdmin: !!uiProd.isFulfilledByAdmin,
  }));

  // --- التحقق من الإرسال النهائي ---
  if (submitType === "final_send") {
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
  const preparerIdByName = new Map(allPreparers.map((p) => [p.name.trim(), p.id]));

  const fallbackPreparerId = isDraft ? draftData?.preparerId : originalOrder?.submittedByCompanyPreparerId;
  const fallbackPreparerName = fallbackPreparerId ? preparerNameById.get(fallbackPreparerId) ?? null : null;

  // --- 5. تجميع المنتجات حسب المجهز الحقيقي (assignedPreparer) أو حسب سعرها ---
  const enrichedProducts = finalProducts.map((p) => {
    if (p.isFulfilledByAdmin) {
      return {
        ...p,
        assignedPreparerId: null,
        assignedPreparerName: "تجهيز الإدارة 🏛️",
        pricedBy: "تجهيز الإدارة 🏛️",
        pricedById: null,
      };
    }

    let prepId = (typeof p.assignedPreparerId === "string" && p.assignedPreparerId.trim() && p.assignedPreparerId !== "all")
      ? p.assignedPreparerId.trim()
      : ((typeof p.pricedById === "string" && p.pricedById.trim() && p.pricedById !== "all") ? p.pricedById.trim() : null);
    let prepName = typeof p.assignedPreparerName === "string" && p.assignedPreparerName.trim() && p.assignedPreparerName !== "تجهيز الإدارة 🏛️" && p.assignedPreparerName !== "الإدارة"
      ? p.assignedPreparerName.trim()
      : null;

    if (!prepId && prepName) {
      prepId = preparerIdByName.get(prepName) || null;
    }
    if (!prepId && p.pricedBy && p.pricedBy !== "الإدارة" && p.pricedBy !== "تجهيز الإدارة 🏛️") {
      prepId = preparerIdByName.get(p.pricedBy.trim()) || null;
    }

    if (!prepId && fallbackPreparerId) {
      prepId = fallbackPreparerId;
    }

    if (prepId && (!prepName || prepName === "تجهيز الإدارة 🏛️")) {
      prepName = preparerNameById.get(prepId) ?? fallbackPreparerName ?? null;
    }

    const finalName = prepName || fallbackPreparerName || "تجهيز الإدارة 🏛️";

    return {
      ...p,
      assignedPreparerId: prepId,
      assignedPreparerName: finalName,
      pricedBy: p.pricedBy && p.pricedBy !== "تجهيز الإدارة 🏛️" && p.pricedBy !== "الإدارة" ? p.pricedBy : finalName,
      pricedById: prepId || p.pricedById || null,
    };
  });

  const preparerMap = new Map<string, { preparerId: string | null; preparerName: string; products: any[]; totalBuyAlf: number }>();
  for (const p of enrichedProducts) {
    if (p.isFulfilledByAdmin) {
      const key = "admin:fulfillment";
      if (!preparerMap.has(key)) {
        preparerMap.set(key, {
          preparerId: null,
          preparerName: "تجهيز الإدارة 🏛️",
          products: [],
          totalBuyAlf: 0,
        });
      }
      const entry = preparerMap.get(key)!;
      entry.products.push(p);
      entry.totalBuyAlf += p.buyAlf;
      continue;
    }

    const assignedPreparerId = p.assignedPreparerId || null;
    const assignedPreparerName = p.assignedPreparerName || (assignedPreparerId ? preparerNameById.get(assignedPreparerId) : null);
    const pricedByName = typeof p.pricedBy === "string" && p.pricedBy.trim() && p.pricedBy !== "الإدارة" && p.pricedBy !== "تجهيز الإدارة 🏛️" ? p.pricedBy.trim() : null;
    
    let preparerName = assignedPreparerName || pricedByName || (assignedPreparerId ? preparerNameById.get(assignedPreparerId) : null) || "تجهيز الإدارة 🏛️";

    const key = assignedPreparerId ? `id:${assignedPreparerId}` : (preparerName !== "تجهيز الإدارة 🏛️" ? `name:${preparerName}` : "admin:fulfillment");
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

  // جلب الدين القديم للزبون تلقائياً
  const { getCustomerOldDebt } = await import("@/lib/customer-debt-helper");
  let customerId = originalOrder?.customerId || null;
  let phone = originalOrder?.customerPhone || draftData?.customerPhone || null;

  if (!customerId && phone && shop?.id) {
    const cust = await prisma.customer.findFirst({
      where: {
        shopId: shop.id,
        phone: phone.trim()
      }
    });
    if (cust) {
      customerId = cust.id;
    }
  }

  const oldDebt = await getCustomerOldDebt({ customerId, phone });
  const totalDinar = subtotalDinar.plus(deliveryDinar).plus(oldDebt);
  const deliveryAlf = Number(deliveryDinar.toString()) / ALF_PER_DINAR;

  let existingOrderType = "تجهيز تسوق";
  let oldProducts: any[] = [];
  if (originalOrder) {
    existingOrderType = originalOrder.orderType;
    oldProducts = (originalOrder.preparerShoppingJson as any)?.products || [];
  } else if (draftData?.sentOrderId) {
    const order = await prisma.order.findUnique({
      where: { id: draftData.sentOrderId },
      select: { orderType: true, preparerShoppingJson: true }
    });
    if (order) {
      existingOrderType = order.orderType;
      oldProducts = (order.preparerShoppingJson as any)?.products || [];
    }
  }

  const oldDynamicOrderType = resolveDynamicOrderType(oldProducts, "تجهيز تسوق");
  let resolvedOrderType = existingOrderType;
  if (
    resolvedOrderType === "تجهيز تسوق" ||
    !resolvedOrderType.trim() ||
    resolvedOrderType === oldDynamicOrderType
  ) {
    resolvedOrderType = resolveDynamicOrderType(enrichedProducts, resolvedOrderType);
  }

  const result = await prisma.$transaction(async (tx) => {
    let finalOrderId: string;
    let finalOrderNumber: number;

    // --- 8. إنشاء الطلب النهائي أو تحديثه ---
    if (isDraft) {
      // البحث عن أي طلب مرتبط بهذه المسودة أو بأي مسودة شقيقة ضمن نفس المجموعة
      let existingSentOrderId = draftData!.sentOrderId || null;
      const draftGroupId = (draftData!.data as any)?.groupId;
      if (!existingSentOrderId && draftGroupId) {
        const siblings = await tx.$queryRaw<{ sentOrderId: string }[]>`
          SELECT "sentOrderId" FROM "CompanyPreparerShoppingDraft" 
          WHERE data->>'groupId' = ${draftGroupId} AND "sentOrderId" IS NOT NULL LIMIT 1
        `;
        if (siblings.length > 0 && siblings[0]?.sentOrderId) {
          existingSentOrderId = siblings[0].sentOrderId;
        }
      }

      if (existingSentOrderId) {
        // تحديث الطلب الموجود بدلاً من إنشاء طلب مكرر جديد
        const updated = await tx.order.update({
          where: { id: existingSentOrderId },
          data: {
            shop: { connect: { id: shop!.id } },
            orderType: resolvedOrderType,
            customerPhone: draftData!.customerPhone,
            customerRegion: draftData!.customerRegionId ? { connect: { id: draftData!.customerRegionId } } : undefined,
            customerLandmark: draftData!.customerLandmark,
            orderNoteTime: draftData!.orderTime,
            orderSubtotal: subtotalDinar,
            deliveryPrice: deliveryDinar,
            customerOldDebt: oldDebt,
            totalAmount: totalDinar,
            customer: customerId ? { connect: { id: customerId } } : undefined,
            courier: autoCourierId ? { connect: { id: autoCourierId } } : { disconnect: true },
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
              noProfit,
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
            shop: { connect: { id: shop!.id } },
            customerPhone: draftData!.customerPhone,
            customerRegion: draftData!.customerRegionId ? { connect: { id: draftData!.customerRegionId } } : undefined,
            customerLandmark: draftData!.customerLandmark,
            orderNoteTime: draftData!.orderNoteTime || draftData!.orderTime, // Ensuring fallback if needed
            status: autoCourierId ? "assigned" : "pending",
            orderType: resolvedOrderType,
            submissionSource: "company_preparer",
            submittedByCompanyPreparer: undefined,
            courier: autoCourierId ? { connect: { id: autoCourierId } } : undefined,
            orderSubtotal: subtotalDinar,
            deliveryPrice: deliveryDinar,
            customerOldDebt: oldDebt,
            totalAmount: totalDinar,
            customer: customerId ? { connect: { id: customerId } } : undefined,
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
              noProfit,
              staffId: draftData?.data && typeof draftData.data === "object" ? (draftData.data as any).fromStaffEmployeeId || null : null,
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
        // تحديث مؤكد للمسودة الحالية بالمعرف الفردي
        await tx.companyPreparerShoppingDraft.update({
          where: { id: orderId },
          data: { status: PreparerShoppingDraftStatus.sent, sentOrderId: finalOrderId }
        });

        const draftGroupId = (draftData!.data as any)?.groupId;
        if (draftGroupId) {
          const draftsWithGroup = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "CompanyPreparerShoppingDraft" WHERE data->>'groupId' = ${draftGroupId}`;
          const ids = draftsWithGroup.map(d => d.id);
          if (ids.length > 0) {
            await tx.companyPreparerShoppingDraft.updateMany({
              where: { id: { in: ids } },
              data: { status: PreparerShoppingDraftStatus.sent, sentOrderId: finalOrderId }
            });
          }
        } else {
          await tx.companyPreparerShoppingDraft.updateMany({
            where: {
              OR: [
                { sentOrderId: finalOrderId },
                {
                  customerPhone: draftData!.customerPhone,
                  titleLine: draftData!.titleLine,
                }
              ],
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
          orderType: resolvedOrderType,
          orderSubtotal: subtotalDinar,
          deliveryPrice: deliveryDinar,
          customerOldDebt: oldDebt,
          totalAmount: totalDinar,
          customer: customerId ? { connect: { id: customerId } } : undefined,
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
            noProfit,
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

    // --- 9. تسجيل القيود المالية وتصحيح التكرار الذكي للمجهزين ---
    if (!skipWallet) {
      const preparerWalletLabelTitle = customerRegion?.name || String(draftData?.titleLine ?? "").trim() || "المنطقة";

      // 1. جلب كافة القيود الحالية غير المحذوفة المنسوبة لطلب المجهز
      const existingEntries = await tx.employeeWalletMiscEntry.findMany({
        where: {
          label: { contains: `طلب #${finalOrderNumber}` },
          deletedAt: null
        }
      });

      // 2. تجميع استحقاقات المجهزين الجدد من preparerInvoices
      const targetEntriesByEmployee = new Map<string, {
        preparerName: string;
        amountDinar: Decimal;
        label: string;
      }>();

      for (const inv of preparerInvoices) {
        if (inv.preparerName === "تجهيز الإدارة 🏛️") continue;

        const preparer = inv.preparerId
          ? allPreparers.find(p => p.id === inv.preparerId)
          : allPreparers.find(p => p.name.trim() === inv.preparerName.trim());

        const chargeBuyAlf = inv.products.reduce(
          (sum: number, p: any) => sum + (isMeatProduct(p.line) || p.isFulfilledByAdmin ? 0 : Number(p.buyAlf || 0)),
          0,
        );

        if (preparer && preparer.walletEmployeeId && chargeBuyAlf > 0) {
          const empId = preparer.walletEmployeeId;
          const amountDinar = new Decimal(chargeBuyAlf).mul(ALF_PER_DINAR);
          const label = `فاتورة تجهيز طلب #${finalOrderNumber} (${preparerWalletLabelTitle})`;

          targetEntriesByEmployee.set(empId, {
            preparerName: inv.preparerName,
            amountDinar,
            label,
          });
        }
      }

      // 3. مقارنة القيود القديمة للتأكد هل تغير سعر الشراء أو المجهز المنسوب له
      const processedEmployeeIds = new Set<string>();

      for (const entry of existingEntries) {
        const empId = entry.employeeId;
        const target = targetEntriesByEmployee.get(empId);

        if (!target) {
          // المجهز لم يعد مسنداً إليه أي منتج بسعر شراء -> نقوم بالحذف المنطقي للقيد القديم
          await tx.employeeWalletMiscEntry.update({
            where: { id: entry.id },
            data: {
              deletedAt: new Date(),
              deletedReason: "manual_admin",
              deletedByDisplayName: "تحديث الأسعار من الإدارة (إزالة المجهز)"
            }
          });
        } else {
          processedEmployeeIds.add(empId);

          // التحقق مما إذا كان مبلغ سعر الشراء الإجمالي للمجهز متساوياً تماماً مع المبلغ السابق
          const isSameAmount = entry.amountDinar.equals(target.amountDinar);

          if (isSameAmount) {
            // سعر الشراء لم يتغير (التعديل كان على سعر البيع فقط أو لا تغيير بسعر الشراء)!
            // نحتفظ بالقيد القديم كما هو دون مسحه أو إنشاء قيد جديد بآيدي وتاريخ جديدين
            if (entry.label !== target.label) {
              await tx.employeeWalletMiscEntry.update({
                where: { id: entry.id },
                data: { label: target.label }
              });
            }
          } else {
            // سعر الشراء للمجهز تغير بالفعل، يلغى القيد القديم وينزل قيد جديد بالسعر التعديلي الجديد
            await tx.employeeWalletMiscEntry.update({
              where: { id: entry.id },
              data: {
                deletedAt: new Date(),
                deletedReason: "manual_admin",
                deletedByDisplayName: "تحديث الأسعار من الإدارة (تغيير سعر الشراء)"
              }
            });

            await tx.employeeWalletMiscEntry.create({
              data: {
                employee: { connect: { id: empId } },
                direction: CourierWalletMiscDirection.give,
                amountDinar: target.amountDinar,
                label: target.label
              }
            });
          }
        }
      }

      // 4. إنشاء قيود للمجهزين الجدد الذين لم يكن لديهم قيد سابق في هذا الطلب
      for (const [empId, target] of targetEntriesByEmployee.entries()) {
        if (!processedEmployeeIds.has(empId)) {
          await tx.employeeWalletMiscEntry.create({
            data: {
              employee: { connect: { id: empId } },
              direction: CourierWalletMiscDirection.give,
              amountDinar: target.amountDinar,
              label: target.label
            }
          });
        }
      }
    }

    return { ok: true, finalOrderId };
  });

  if (result.ok && result.finalOrderId) {
    // مزامنة معاملات الموردين في الدفتر لتحديث الأرصدة تلقائياً
    try {
      const oldSuppIds = Array.from(new Set(
        oldProducts
          .map(p => typeof p.assignedPreparerId === "string" ? p.assignedPreparerId.trim() : null)
          .filter(Boolean)
      )) as string[];

      const newSuppIds = Array.from(new Set(
        enrichedProducts
          .map(p => typeof p.assignedPreparerId === "string" ? p.assignedPreparerId.trim() : null)
          .filter(Boolean)
      )) as string[];

      const uniqueSuppIdsToSync = Array.from(new Set([...oldSuppIds, ...newSuppIds]));

      const { syncSupplierTransactions } = await import("@/lib/order-delivery-hook");
      for (const suppId of uniqueSuppIdsToSync) {
        await syncSupplierTransactions(suppId);
      }
    } catch (syncErr) {
      console.error("Failed to sync supplier transactions after admin pricing update:", syncErr);
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47/orders/pending");
    revalidatePath(`/abo1stor3hlaa2kbr8-47/orders/${result.finalOrderId}`);
    return { ok: true };
  }
  } catch (error) {
    console.error("Admin pricing action error:", {
      orderId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      
    });
    return { error: "حدث خطأ أثناء معالجة التسعير. يرجى المحاولة مرة أخرى." };
  }
}

/** تكرار ونسخ الطلب أو المسودة الإدارية برقم ومنطقة جديدة */
export async function duplicateOrderOrDraft(
  originalId: string,
  isDraft: boolean,
  newPhone: string,
  newRegionId: string
): Promise<{ ok?: boolean; error?: string; newOrderId?: string }> {
  try {
    const cleanPhone = newPhone.trim();
    if (!cleanPhone) return { error: "يرجى إدخال رقم الهاتف." };
    if (!newRegionId) return { error: "يرجى تحديد المنطقة." };

    let newId = "";
    
    // جلب اسم المنطقة وسعر التوصيل
    const region = await prisma.region.findUnique({ where: { id: newRegionId } });
    if (!region) return { error: "المنطقة المحددة غير موجودة." };

    if (isDraft) {
      const originalDraft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id: originalId } });
      if (!originalDraft) return { error: "المسودة الأصلية غير موجودة." };

      const originalData = (originalDraft.data as any) || {};
      const originalProducts = originalData.products || [];

      // توليد معرف مجموعة جديد للمسودة الجديدة لكي لا تتداخل مع القديمة
      const newGroupId = `GRP-${Date.now()}`;
      const nextData = {
        ...originalData,
        groupId: newGroupId,
        products: originalProducts
      };

      const newDraft = await prisma.companyPreparerShoppingDraft.create({
        data: {
          preparerId: originalDraft.preparerId,
          titleLine: `${originalDraft.titleLine || "مسودة"} (نسخة مكررة)`,
          rawListText: originalDraft.rawListText,
          customerPhone: cleanPhone,
          customerName: cleanPhone,
          customerRegionId: newRegionId,
          customerLandmark: originalDraft.customerLandmark,
          orderTime: originalDraft.orderTime,
          sentOrderId: null,
          placesCount: originalDraft.placesCount,
          status: originalDraft.status,
          data: nextData
        }
      });
      newId = newDraft.id;

    } else {
      const originalOrder = await prisma.order.findUnique({ where: { id: originalId } });
      if (!originalOrder) return { error: "الطلب الأصلي غير موجود." };

      const originalProducts = (originalOrder.preparerShoppingJson as any)?.products || [];
      const newOrderNumber = (await prisma.order.count()) + 1001;

      const newOrder = await prisma.order.create({
        data: {
          orderNumber: newOrderNumber,
          customerPhone: cleanPhone,
          customerRegionId: newRegionId,
          customerLandmark: originalOrder.customerLandmark,
          orderNoteTime: originalOrder.orderNoteTime || "فوري",
          orderType: originalOrder.orderType,
          summary: originalOrder.summary,
          submissionSource: "admin_copy",
          submittedByCompanyPreparerId: originalOrder.submittedByCompanyPreparerId,
          deliveryPrice: region.deliveryPrice,
          preparerShoppingJson: {
            version: 1,
            products: originalProducts,
            placesCount: (originalOrder.preparerShoppingJson as any)?.placesCount || 1,
            noProfit: (originalOrder.preparerShoppingJson as any)?.noProfit || false
          }
        }
      });
      newId = newOrder.id;

      // نسخ مسودات المجهزين المرتبطة بالطلب الحقيقي
      const relatedDrafts = await prisma.companyPreparerShoppingDraft.findMany({
        where: { sentOrderId: originalId }
      });

      for (const d of relatedDrafts) {
        const dData = (d.data as any) || {};
        await prisma.companyPreparerShoppingDraft.create({
          data: {
            preparerId: d.preparerId,
            titleLine: `طلب #${newOrderNumber} - ${newOrder.orderType}`,
            rawListText: d.rawListText,
            customerPhone: cleanPhone,
            customerName: cleanPhone,
            customerRegionId: newRegionId,
            customerLandmark: d.customerLandmark,
            orderTime: d.orderTime,
            sentOrderId: newOrder.id,
            placesCount: d.placesCount,
            status: d.status,
            data: {
              ...dData,
              groupId: `GRP-${Date.now()}`,
              products: dData.products || []
            }
          }
        });
      }
    }

    revalidatePath("/abo1stor3hlaa2kbr8-47/orders/pending");
    return { ok: true, newOrderId: newId };
  } catch (error: any) {
    console.error("Duplicate Order Error:", error);
    return { error: `فشل النسخ: ${error.message || "حدث خطأ غير متوقع"}` };
  }
}

export async function getFishPrices(): Promise<string> {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target: "system", section: "fish_prices" }
      }
    });
    return (setting?.config as any)?.rawText || "";
  } catch (error) {
    console.error("Error getting fish prices:", error);
    return "";
  }
}

export async function saveFishPrices(rawText: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.uISystemSetting.upsert({
      where: {
        target_section: { target: "system", section: "fish_prices" }
      },
      update: { config: { rawText } },
      create: { target: "system", section: "fish_prices", config: { rawText } }
    });
    revalidatePath("/abo1stor3hlaa2kbr8-47/orders/pending");
    return { ok: true };
  } catch (error: any) {
    console.error("Error saving fish prices:", error);
    return { error: error.message || "فشل حفظ أسعار السمك اليومية" };
  }
}

