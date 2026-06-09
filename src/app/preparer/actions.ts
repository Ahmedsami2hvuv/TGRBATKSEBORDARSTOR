"use server";
// v4-bulletproof-fix: ضمان الحفظ الفوري ومنع التضارب بين المجهزين + توزيع الفواتير + حماية الملكية التامة

import { CourierWalletMiscDirection, Prisma, PreparerShoppingDraftStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { ALF_PER_DINAR, formatDinarAsAlfWithUnit, parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import {
  buildCustomerInvoiceText,
  buildPreparerPurchaseSummaryText,
  resolveDynamicOrderType,
} from "@/lib/preparation-invoice";
import { calculateAutoSellPrice, isMeatProduct } from "@/lib/auto-pricing";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import { prisma } from "@/lib/prisma";
import { transferOrderToCourierInternal } from "@/lib/order-assign-courier";
import { MAX_ORDER_IMAGE_BYTES, saveOrderImageUploaded, saveShopDoorPhotoUploaded } from "@/lib/order-image";
import { deleteFromR2 } from "@/lib/upload-storage";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { notifyTelegramNewOrder, notifyTelegramOrderPrepared, notifyTelegramUnavailableProducts, notifyTelegramNewPreparerShoppingOrder } from "@/lib/telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "@/lib/web-push-server";
import { ADMIN_OFFICE_LABEL, ADMIN_SHOP_NAMES } from "@/lib/admin-order-from-admin-constants";
import { getBotTokenByPurpose } from "@/lib/telegram-bots";
import { escapeTelegramHtml, sendTelegramHtmlToChat, sendTelegramMessage } from "@/lib/telegram";
import { getPreparerMoneyTotals } from "@/lib/preparer-combined-wallet-totals";
import { ensurePreparerSalaryConfigColumnsIfMissing } from "@/lib/db-self-heal-employee-location";

export type PreparerActionState = { error?: string; ok?: boolean; orderNumber?: number; draftId?: string };

const PREPARER_PORTAL_LABEL = "بوابة المجهز";

function formatBorderedSummarySection(title: string, raw: string): string {
  const CUSTOMER_NOTE_BORDER = "═══════════════";
  const t = raw.trim();
  if (!t) return "";
  return[
    CUSTOMER_NOTE_BORDER,
    title,
    CUSTOMER_NOTE_BORDER,
    t,
    CUSTOMER_NOTE_BORDER,
  ].join("\n");
}

function readPortal(formData: FormData) {
  const p = String(formData.get("p") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const s = String(formData.get("s") ?? "").trim();
  return verifyCompanyPreparerPortalQuery(p, exp, s);
}

function preparerImageSaveErrorMessage(e: unknown): string {
  const code = e instanceof Error ? e.message : "";
  if (code === "IMAGE_TOO_LARGE") return "حجم الصورة كبير جداً (الحد ٢٠ ميجابايت).";
  if (code === "IMAGE_BAD_TYPE") return "استخدم صورة بصيغة JPG أو PNG أو Webp.";
  if (code === "IMAGE_STORAGE_FAILED") {
    return "تعذّر حفظ الصورة على الخادم. جرّب صورة أصغر أو أعد المحاولة.";
  }
  return "تعذّر حفظ الصورة.";
}

async function assertPreparerLinkedToOrderShop(
  preparerId: string,
  orderId: string,
): Promise<
  | { ok: true; order: { id: string; imageUrl: string | null; shopDoorPhotoUrl: string | null } }
  | { ok: false; error: string }
> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, shopId: true, imageUrl: true, shopDoorPhotoUrl: true },
  });
  if (!order) return { ok: false, error: "الطلب غير موجود." };

  const link = await prisma.preparerShop.findUnique({
    where: { preparerId_shopId: { preparerId, shopId: order.shopId } },
    select: { preparerId: true },
  });
  if (!link) return { ok: false, error: "ليس لديك صلاحية على طلبات هذا المحل." };

  return { ok: true, order: { id: order.id, imageUrl: order.imageUrl, shopDoorPhotoUrl: order.shopDoorPhotoUrl } };
}

async function upsertCustomerByPhone(opts: {
    shopId: string;
    phone: string;
    regionId: string | null;
    locationUrl?: string;
    landmark?: string;
    doorPhotoUrl?: string | null;
  }): Promise<{ id: string }> {
    const { shopId, phone, regionId, locationUrl, landmark, doorPhotoUrl } = opts;

    const existing = await prisma.customer.findFirst({
      where: { shopId, phone },
    });

    const data = {
      customerRegionId: regionId,
      customerLocationUrl: locationUrl ?? "",
      customerLandmark: landmark ?? "",
      customerDoorPhotoUrl: doorPhotoUrl ?? null,
    };

    if (existing) {
      return prisma.customer.update({
        where: { id: existing.id },
        data,
        select: { id: true },
      });
    }

    return prisma.customer.create({
      data: {
        shopId,
        phone,
        name: "",
        ...data,
      },
      select: { id: true },
    });
}

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
        phone: "07733921568",
        locationUrl: "",
        regionId: firstRegion.id,
      },
    });
  } else {
    const data: { name?: string; phone?: string } = {};
    if (shop.name !== ADMIN_OFFICE_LABEL) data.name = ADMIN_OFFICE_LABEL;
    if (shop.phone !== "07733921568") data.phone = "07733921568";
    if (Object.keys(data).length > 0) {
      shop = await prisma.shop.update({
        where: { id: shop.id },
        data,
      });
    }
  }

  return { id: shop.id, regionId: shop.regionId, photoUrl: shop.photoUrl ?? null };
}

/**
 * تحديث مسودة التجهيز - مع حماية الملكية للمنتجات (المنع التام للتداخل)
 */
export async function updatePreparerShoppingDraft(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const draftId = String(formData.get("draftId") ?? "").trim();
    if (!draftId) return { error: "المعرف ناقص." };

    const currentPreparer = await prisma.companyPreparer.findFirst({
      where: { id: v.preparerId, active: true },
      select: { id: true, name: true }
    });
    if (!currentPreparer) return { error: "الحساب غير متاح." };

    const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id: draftId } });
    if (!draft) return { error: "المسودة غير موجودة." };

    const isDraftOwner = draft.preparerId === currentPreparer.id;
    const productsJsonRaw = String(formData.get("productsJson") ?? "[]");
    let uiProducts: any[] =[];
    try { uiProducts = JSON.parse(productsJsonRaw); } catch { return { error: "بيانات غير صالحة." }; }

    const dbData = (draft.data as any) || { products:[] };
    const groupId = dbData.groupId;
    const preparerNameClean = currentPreparer.name.trim();

    // جلب جميع المسودات المرتبطة لضمان المزامنة
    let relatedDrafts = [draft];
    if (groupId) {
        const draftsWithGroup = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "CompanyPreparerShoppingDraft" WHERE data->>'groupId' = ${groupId}`;
        const ids = draftsWithGroup.map(d => d.id);
        if (ids.length > 0) {
            relatedDrafts = await prisma.companyPreparerShoppingDraft.findMany({
                where: { id: { in: ids } }
            });
        }
    } else {
        relatedDrafts = await prisma.companyPreparerShoppingDraft.findMany({
            where: {
                customerPhone: draft.customerPhone,
                titleLine: draft.titleLine,
                status: { in: ["draft", "priced"] }
            }
        });
    }

    // الدمج الذكي: نستخدم الترتيب في المصفوفة بدلاً من الاسم لمنع التداخل (flipping)
    const mergedProducts = uiProducts.map((uiProd, index) => {
        const dbProd = (dbData.products && dbData.products[index]) || {};

        const uiHasPrice = uiProd.buyAlf != null && uiProd.buyAlf !== "" && uiProd.buyAlf !== 0;
        const dbHasPrice = dbProd?.buyAlf != null && dbProd?.buyAlf !== "" && dbProd?.buyAlf !== 0;
        const dbAssignedToOther = typeof dbProd?.assignedPreparerId === "string" && dbProd.assignedPreparerId.trim() !== "" && dbProd.assignedPreparerId !== currentPreparer.id;

        if (dbAssignedToOther) {
            // لا نسمح للمجهز غير المخصص بتعديل المنتج؛ نحتفظ ببيانات المالك الأصلي
            return {
              ...dbProd,
              line: String(dbProd.line ?? uiProd.line ?? "").trim(),
              buyAlf: dbProd.buyAlf,
              sellAlf: dbProd.sellAlf,
              pricedBy: dbProd.pricedBy || uiProd.pricedBy || null,
              pricedById: dbProd.pricedById || uiProd.pricedById || null,
              assignedPreparerId: dbProd.assignedPreparerId,
              assignedPreparerName: dbProd.assignedPreparerName,
            };
        }

        const uiAssignedPreparerId = typeof uiProd?.assignedPreparerId === "string" && uiProd.assignedPreparerId.trim() ? uiProd.assignedPreparerId : null;
        const uiAssignedPreparerName = typeof uiProd?.assignedPreparerName === "string" ? uiProd.assignedPreparerName : null;
        const finalAssignedPreparerId = isDraftOwner ? uiAssignedPreparerId : dbProd.assignedPreparerId;
        const finalAssignedPreparerName = isDraftOwner ? uiAssignedPreparerName : dbProd.assignedPreparerName;

        if (uiHasPrice) {
            // إذا كان السعر لم يتغير عن المخزون، نحتفظ بالمنسوب الأصلي
            return {
              ...uiProd,
              pricedBy: dbHasPrice ? (dbProd.pricedBy || uiProd.pricedBy) : (uiProd.pricedBy || preparerNameClean),
              pricedById: dbHasPrice ? (dbProd.pricedById || uiProd.pricedById) : (uiProd.pricedById || currentPreparer.id),
              assignedPreparerId: finalAssignedPreparerId,
              assignedPreparerName: finalAssignedPreparerName,
            };
        }

        return {
          ...uiProd,
          pricedBy: dbProd.pricedBy || null,
          pricedById: dbProd.pricedById || null,
          assignedPreparerId: finalAssignedPreparerId,
          assignedPreparerName: finalAssignedPreparerName,
        };
    });

    const placesRaw = String(formData.get("placesCount") ?? "");
    const placesCount = placesRaw === "" ? (draft.placesCount ?? null) : Number(placesRaw);

    const deliveryPriceRaw = formData.get("deliveryPrice");
    const customDeliveryAlf = deliveryPriceRaw !== null ? (String(deliveryPriceRaw) === "" ? null : Number(deliveryPriceRaw)) : (dbData.customDeliveryAlf ?? null);

    const orderType = String(formData.get("orderType") ?? dbData.orderType ?? "تجهيز تسوق");
    const orderSubtotalRaw = formData.get("orderSubtotal");
    const orderSubtotalAlf = orderSubtotalRaw !== null ? (String(orderSubtotalRaw) === "" ? null : Number(orderSubtotalRaw)) : (dbData.orderSubtotalAlf ?? null);

    const newStatus = mergedProducts.every((p: any) => p.buyAlf != null && p.buyAlf !== "") ? "priced" : "draft";

    const noProfitRaw = formData.get("noProfit");
    const noProfit = noProfitRaw !== null ? noProfitRaw === "true" : !!dbData.noProfit;

    const titleLineRaw = String(formData.get("titleLine") ?? "").trim();
    const titleLine = titleLineRaw ? titleLineRaw : draft.titleLine;

    const customerPhoneRaw = String(formData.get("customerPhone") ?? "").trim();
    const customerPhone = customerPhoneRaw ? customerPhoneRaw : draft.customerPhone;

    const customerNameRaw = String(formData.get("customerName") ?? "").trim();
    const customerName = customerNameRaw ? customerNameRaw : draft.customerName;

    const customerLandmarkRaw = String(formData.get("customerLandmark") ?? "").trim();
    const customerLandmark = customerLandmarkRaw ? customerLandmarkRaw : draft.customerLandmark;

    const orderTimeRaw = String(formData.get("orderTime") ?? "").trim();
    const orderTime = orderTimeRaw ? orderTimeRaw : draft.orderTime;


    // تحديث جميع المسودات المرتبطة دفعة واحدة
    const updatePromises = relatedDrafts.map(rd => {
        return prisma.companyPreparerShoppingDraft.update({
            where: { id: rd.id },
            data: {
                titleLine,
                customerPhone,
                customerName,
                customerLandmark,
                orderTime,
                placesCount,
                data: {
                    ...(rd.data as any),
                    noProfit,
                    products: mergedProducts,
                    customDeliveryAlf,
                    orderType,
                    orderSubtotalAlf,
                    lastActivityAt: new Date().toISOString()
                },
                status: newStatus as any
            }
        });
    });

    await Promise.all(updatePromises);

    revalidatePath(`/preparer/preparation/draft/${draftId}`);
    return { ok: true };
  } catch (e) {
    console.error("Update Draft Error:", e);
    return { error: "فشل الحفظ بسبب خطأ تقني." };
  }
}

export async function submitPreparerShoppingDraft(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const draftId = String(formData.get("draftId") ?? "").trim();
    const draft = await prisma.companyPreparerShoppingDraft.findUnique({
      where: { id: draftId },
      include: { preparer: true }
    });
    if (!draft) return { error: "المسودة غير موجودة." };

    // منع الإرسال المزدوج
    if (draft.status === "sent" || draft.status === "archived") {
        return { error: "لقد تم إرسال هذا الطلب مسبقاً إلى النظام." };
    }

    const currentPreparer = await prisma.companyPreparer.findFirst({
        where: { id: v.preparerId, active: true },
        select: { id: true, name: true }
    });

    const data = draft.data as any;
    let products = data.products as any[];
    const productsJsonRaw = formData.get("productsJson");
    if (productsJsonRaw && String(productsJsonRaw).trim() !== "") {
      try {
        const parsed = JSON.parse(String(productsJsonRaw));
        if (Array.isArray(parsed) && parsed.length > 0) {
          products = parsed;
        }
      } catch (e) {
        console.error("Failed to parse productsJson from formData:", e);
      }
    }
    if (!products || products.some(p => p.buyAlf == null || p.buyAlf === "")) return { error: "أكمل تسعير جميع المواد." };

    const systemShopInfo = await getOrCreateSystemAdminShop();
    const shop = await prisma.shop.findUnique({ where: { id: systemShopInfo.id }, include: { region: true } });
    const custRegion = await prisma.region.findUnique({ where: { id: draft.customerRegionId! } });
    if (!shop || !custRegion) return { error: "خطأ في بيانات المحل أو المنطقة." };

    const placesCountRaw = formData.get("placesCount");
    const placesCount = (placesCountRaw && !isNaN(Number(placesCountRaw)))
      ? Number(placesCountRaw)
      : (draft.placesCount || 1);
    const draftData = draft.data as any;
    const customDeliveryAlf = draftData?.customDeliveryAlf;

    const defaultDelivery = Decimal.max(shop.region.deliveryPrice, custRegion.deliveryPrice);
    const delivery = (customDeliveryAlf != null && Number.isFinite(Number(customDeliveryAlf)))
        ? new Decimal(customDeliveryAlf).mul(ALF_PER_DINAR)
        : defaultDelivery;

    const sumSellAlf = products.reduce((acc, p) => acc + Number(p.sellAlf), 0);
    const extraAlf = calculateExtraAlfFromPlacesCount(placesCount);

    let subtotalValueAlf = sumSellAlf + extraAlf;
    // إذا كانت هناك قيمة يدوية لسعر الطلب ولا توجد منتجات مسعرة، نستخدم القيمة اليدوية
    if (products.length === 0 && draftData?.orderSubtotalAlf != null && Number(draftData.orderSubtotalAlf) > 0) {
        subtotalValueAlf = Number(draftData.orderSubtotalAlf);
    }

    const subtotal = new Decimal(subtotalValueAlf).mul(ALF_PER_DINAR);
    const total = subtotal.plus(delivery);

    // --- توليد فواتير الشراء المنفصلة وتوزيعها ---
    // نستخدم pricedById للتجميع لضمان الدقة، مع استخدامpricedBy كاسم عرض
    const preparerIds = Array.from(new Set(products.map(p => p.pricedById || currentPreparer?.id).filter(Boolean)));
    const preparerInvoices = preparerIds.map(id => {
        const myProducts = products.filter(p => (p.pricedById || currentPreparer?.id) === id);
        const myTotalBuy = myProducts.reduce((acc, p) => acc + Number(p.buyAlf || 0), 0);
        const myTotalSell = myProducts.reduce((acc, p) => acc + Number(p.sellAlf || 0), 0);
        const myChargeBuy = myProducts.reduce(
          (acc, p) => acc + (isMeatProduct(p.line) ? 0 : Number(p.buyAlf || 0)),
          0,
        );
        const myName = myProducts[0]?.pricedBy || currentPreparer?.name || "مجهز";
        return {
            preparerId: String(id),
            preparerName: String(myName),
            products: myProducts,
            totalBuyAlf: myTotalBuy,
            totalSellAlf: myTotalSell,
            chargeBuyAlf: myChargeBuy,
            invoiceText: buildPreparerPurchaseSummaryText(myProducts)
        };
    });

    // --- بناء وصف الطلب المقسم حسب المجهزين ---
    const summaryParts = preparerInvoices.map(inv => {
        return `[ تجهيز: ${inv.preparerName} ]\n${inv.invoiceText}`;
    });

    let resolvedOrderType = draftData?.orderType || "تجهيز تسوق";
    if (resolvedOrderType === "تجهيز تسوق" || !resolvedOrderType.trim()) {
      resolvedOrderType = resolveDynamicOrderType(products, resolvedOrderType);
    }

    let order: any;
    if (draft.sentOrderId) {
      const existingOrder = await prisma.order.findUnique({
        where: { id: draft.sentOrderId }
      });
      if (existingOrder) {
        order = await prisma.order.update({
          where: { id: draft.sentOrderId },
          data: {
            orderType: resolvedOrderType,
            orderSubtotal: subtotal,
            deliveryPrice: delivery,
            totalAmount: total,
            submissionSource: "company_preparer",
            summary: formatBorderedSummarySection("المنتجات حسب المجهز", summaryParts.join("\n\n═══════════════\n\n")),
            preparerShoppingJson: {
              version: 1,
              products,
              placesCount,
              sumSellAlf,
              extraAlf,
              deliveryAlf: Number(delivery) / ALF_PER_DINAR,
              preparerInvoices,
              noProfit: !!draftData?.noProfit,
              customerInvoiceText: buildCustomerInvoiceText({
                brandLabel: "أبو الأكبر للتوصيل",
                orderNumberLabel: `#${existingOrder.orderNumber}`,
                regionTitle: draft.titleLine,
                phone: draft.customerPhone,
                lines: products,
                placesCount,
                deliveryAlf: Number(delivery) / ALF_PER_DINAR
              })
            }
          }
        });
      } else {
        order = await prisma.order.create({
          data: {
            shopId: shop.id,
            status: "pending",
            orderType: resolvedOrderType,
            customerPhone: draft.customerPhone,
            customerRegionId: draft.customerRegionId,
            customerLandmark: draft.customerLandmark,
            orderNoteTime: draft.orderTime,
            deliveryPrice: delivery,
            orderSubtotal: subtotal,
            totalAmount: total,
            submissionSource: "company_preparer",
            submittedByCompanyPreparerId: null,
            summary: formatBorderedSummarySection("المنتجات حسب المجهز", summaryParts.join("\n\n═══════════════\n\n")),
            preparerShoppingJson: {
              version: 1,
              products,
              placesCount,
              sumSellAlf,
              extraAlf,
              deliveryAlf: Number(delivery) / ALF_PER_DINAR,
              preparerInvoices,
              noProfit: !!draftData?.noProfit,
              customerInvoiceText: buildCustomerInvoiceText({
                brandLabel: "أبو الأكبر للتوصيل",
                orderNumberLabel: "...",
                regionTitle: draft.titleLine,
                phone: draft.customerPhone,
                lines: products,
                placesCount,
                deliveryAlf: Number(delivery) / ALF_PER_DINAR
              })
            }
          }
        });
      }
    } else {
      order = await prisma.order.create({
        data: {
          shopId: shop.id,
          status: "pending",
          orderType: resolvedOrderType,
          customerPhone: draft.customerPhone,
          customerRegionId: draft.customerRegionId,
          customerLandmark: draft.customerLandmark,
          orderNoteTime: draft.orderTime,
          deliveryPrice: delivery,
          orderSubtotal: subtotal,
          totalAmount: total,
          submissionSource: "company_preparer",
          submittedByCompanyPreparerId: null,
          summary: formatBorderedSummarySection("المنتجات حسب المجهز", summaryParts.join("\n\n═══════════════\n\n")),
          preparerShoppingJson: {
            version: 1,
            products,
            placesCount,
            sumSellAlf,
            extraAlf,
            deliveryAlf: Number(delivery) / ALF_PER_DINAR,
            preparerInvoices,
            noProfit: !!draftData?.noProfit,
            customerInvoiceText: buildCustomerInvoiceText({
              brandLabel: "أبو الأكبر للتوصيل",
              orderNumberLabel: "...",
              regionTitle: draft.titleLine,
              phone: draft.customerPhone,
              lines: products,
              placesCount,
              deliveryAlf: Number(delivery) / ALF_PER_DINAR
            })
          }
        }
      });
    }

    // --- توزيع المبالغ على المحافظ وإرسال إشعارات منفصلة لكل مجهز ---
    const allPreps = await prisma.companyPreparer.findMany({
        where: { active: true },
        select: { id: true, name: true, walletEmployeeId: true }
    });

    for (const inv of preparerInvoices) {
        // البحث عن المجهز بالـ id أولاً ثم الاسم كاحتياط
        const prep = allPreps.find(p => p.id === inv.preparerId) || allPreps.find(p => p.name.trim() === inv.preparerName.trim());
        if (prep) {
            const chargeBuyAlf = Number(inv.chargeBuyAlf ?? 0);
            if (prep.walletEmployeeId && chargeBuyAlf > 0) {
                // تسجيل قيد "أعطيت" في محفظة المجهز (صادر)
                await prisma.employeeWalletMiscEntry.create({
                    data: {
                        employeeId: prep.walletEmployeeId,
                        direction: CourierWalletMiscDirection.give,
                        amountDinar: new Decimal(chargeBuyAlf).mul(ALF_PER_DINAR),
                        label: `فاتورة تجهيز طلب #${order.orderNumber} (${draft.titleLine})`,
                    },
                });
            }

            await prisma.companyPreparerPrepNotice.create({
                data: {
                    preparerId: prep.id,
                    title: `قائمة تجهيز الطلب #${order.orderNumber}`,
                    body:[
                        `المنطقة: ${draft.titleLine}`,
                        `الزبون: ${draft.customerPhone}`,
                        `═══════════════`,
                        `المواد التي جهزتها أنت:`,
                        inv.invoiceText,
                        `═══════════════`,
                        `إجمالي البيع: ${inv.totalSellAlf}`
                    ].join("\n")
                }
            });
        }
    }

    // تحديث مسودة التجهيز بالبيانات النهائية والمنتجات المسعرة قبل إغلاقها
    await prisma.companyPreparerShoppingDraft.update({
      where: { id: draftId },
      data: {
        placesCount,
        data: {
          ...(draft.data as any || {}),
          products
        }
      }
    });

    // غلق وتأشير المسودة كمرسلة
    const groupId = (draft.data as any)?.groupId;
    if (groupId) {
        const draftsWithGroup = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "CompanyPreparerShoppingDraft" WHERE data->>'groupId' = ${groupId}`;
        const ids = draftsWithGroup.map(d => d.id);
        if (ids.length > 0) {
            await prisma.companyPreparerShoppingDraft.updateMany({
                where: { id: { in: ids } },
                data: { status: PreparerShoppingDraftStatus.sent, sentOrderId: order.id }
            });
        }
    } else {
        await prisma.companyPreparerShoppingDraft.update({
            where: { id: draftId },
            data: { status: PreparerShoppingDraftStatus.sent, sentOrderId: order.id }
        });
    }

    revalidatePath("/preparer");
    void notifyTelegramNewPreparerShoppingOrder(order.id);
    return { ok: true, orderNumber: order.orderNumber };
  } catch (e) {
    console.error(e);
    return { error: "فشل إرسال الطلب." };
  }
}

export async function createPreparerShoppingDraftFromAnalysis(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
    try {
        const p = String(formData.get("p") ?? "").trim();
        const exp = String(formData.get("exp") ?? "").trim();
        const s = String(formData.get("s") ?? "").trim();
        const v = verifyCompanyPreparerPortalQuery(p, exp, s);
        if (!v.ok) return { error: "الرابط غير صالح." };

        const productsCsv = String(formData.get("productsCsv") ?? "");
        const productLines = productsCsv.split("\n").map(l => l.trim()).filter(Boolean);
        if (productLines.length === 0) return { error: "لا توجد منتجات." };

        const customerRegionId = String(formData.get("customerRegionId") ?? "").trim() || null;
        const deliveryAlfRaw = formData.get("deliveryPrice");
        const customDeliveryAlf = (deliveryAlfRaw && String(deliveryAlfRaw).trim() !== "") ? Number(deliveryAlfRaw) : null;
        const orderType = String(formData.get("orderType") ?? "تجهيز تسوق");
        const orderSubtotalRaw = formData.get("orderSubtotal");
        const orderSubtotalAlf = (orderSubtotalRaw && String(orderSubtotalRaw).trim() !== "") ? Number(orderSubtotalRaw) : null;

        const customerPhoneRaw = String(formData.get("customerPhone") ?? "").trim();
        const phoneLocal = normalizeIraqMobileLocal11(customerPhoneRaw) || customerPhoneRaw;

        // Global block check
        const isGlobalBlocked = await prisma.globalBlockedPhone.findUnique({
          where: { phone: phoneLocal },
        });
        if (isGlobalBlocked) {
          return { error: `عذراً، الرقم (${phoneLocal}) محظور عالمياً ولا يمكن إنشاء طلب تجهيز له.` };
        }

        const draft = await prisma.companyPreparerShoppingDraft.create({
            data: {
                preparerId: v.preparerId,
                titleLine: String(formData.get("titleLine") ?? ""),
                customerPhone: phoneLocal,
                customerName: String(formData.get("customerName") ?? ""),
                customerLandmark: String(formData.get("customerLandmark") ?? ""),
                orderTime: String(formData.get("orderTime") ?? "فوري"),
                customerRegionId,
                rawListText: String(formData.get("rawListText") ?? ""),
                data: {
                    products: productLines.map(line => ({ line, buyAlf: null, sellAlf: null, pricedBy: null, pricedById: null })),
                    customDeliveryAlf: (customDeliveryAlf !== null && !isNaN(customDeliveryAlf)) ? customDeliveryAlf : null,
                    orderType,
                    orderSubtotalAlf: (orderSubtotalAlf !== null && !isNaN(orderSubtotalAlf)) ? orderSubtotalAlf : null,
                    noProfit: formData.get("noProfit") === "true",
                }
            }
        });
        return { ok: true, draftId: draft.id };
    } catch (e) {
        console.error(e);
        return { error: "فشل إنشاء المسودة." };
    }
}

export async function submitPreparerOrder(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: v.preparerId, active: true },
    });
    if (!preparer) return { error: "حساب المجهز غير موجود." };

    const shopId = String(formData.get("shopId") ?? "").trim();
    if (!shopId) return { error: "المحل مطلوب." };

    const orderType = String(formData.get("orderType") ?? "").trim();
    const orderNoteTime = String(formData.get("orderTime") ?? "").trim();
    const customerPhoneRaw = String(formData.get("customerPhone") ?? "").trim();
    const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
    const customerName = String(formData.get("customerName") ?? "").trim();
    const alternatePhone = String(formData.get("alternatePhone") ?? "").trim();
    const summary = String(formData.get("notes") ?? "").trim();
    const customerLocationUrl = String(formData.get("customerLocationUrl") ?? "").trim();
    const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
    const prepaidAll = formData.get("prepaidAll") === "on";

    const customerPhone = normalizeIraqMobileLocal11(customerPhoneRaw);
    if (!customerPhone) return { error: "رقم هاتف الزبون غير صالح." };

    // Global block check
    const isGlobalBlocked = await prisma.globalBlockedPhone.findUnique({
      where: { phone: customerPhone },
    });
    if (isGlobalBlocked) {
      return { error: `عذراً، الرقم (${customerPhone}) محظور عالمياً من الطلب.` };
    }

    if (!customerRegionId) return { error: "منطقة الزبون مطلوبة." };

    const subtotalParsed = parseAlfInputToDinarDecimalRequired(
      String(formData.get("orderSubtotal") ?? "0"),
    );
    if (!subtotalParsed.ok) return { error: "سعر الطلب غير صالح." };

    const [shop, region] = await Promise.all([
      prisma.shop.findUnique({ where: { id: shopId }, include: { region: true } }),
      prisma.region.findUnique({ where: { id: customerRegionId } }),
    ]);

    if (!shop || !region) return { error: "بيانات المحل أو المنطقة غير موجودة." };

    const orderImg = formData.get("orderImage");
    const shopDoorImg = formData.get("shopDoorPhoto");

    let imageUrl: string | null = null;
    let shopDoorPhotoUrl: string | null = null;

    try {
      if (orderImg instanceof File && orderImg.size > 0) {
        imageUrl = await saveOrderImageUploaded(orderImg, MAX_ORDER_IMAGE_BYTES);
      }
      if (shopDoorImg instanceof File && shopDoorImg.size > 0) {
        shopDoorPhotoUrl = await saveShopDoorPhotoUploaded(shopDoorImg, MAX_ORDER_IMAGE_BYTES);
      }
    } catch (e) {
      return { error: "تعذّر حفظ الصور المرفقة." };
    }

    const customerRow = await upsertCustomerByPhone({
      shopId,
      phone: customerPhone,
      regionId: customerRegionId,
      locationUrl: customerLocationUrl,
      landmark: customerLandmark,
    });

    const defaultDelivery = Decimal.max(shop.region.deliveryPrice, region.deliveryPrice);
    const deliveryPriceRaw = formData.get("deliveryPrice");
    let delivery = defaultDelivery;
    if (deliveryPriceRaw) {
      const manualAlf = parseFloat(String(deliveryPriceRaw).replace(/,/g, "."));
      if (!isNaN(manualAlf) && manualAlf >= 0) {
        delivery = new Decimal(manualAlf).mul(ALF_PER_DINAR);
      }
    }

    const total = new Decimal(subtotalParsed.value).plus(delivery);

    const preparerLabel = preparer?.name?.trim() ? `المجهز ${preparer.name.trim()}` : "المجهز";

    const order = await prisma.order.create({
      data: {
        shopId,
        customerId: customerRow.id,
        status: "pending",
        submissionSource: "company_preparer",
        submittedByCompanyPreparerId: v.preparerId,
        orderType,
        orderNoteTime,
        customerPhone,
        alternatePhone,
        customerRegionId,
        customerLocationUrl,
        customerLandmark,
        summary,
        orderSubtotal: subtotalParsed.value,
        deliveryPrice: delivery,
        totalAmount: total,
        prepaidAll,
        imageUrl,
        vehiclePreference: String(formData.get("vehiclePreference") ?? "").trim() || null,
        orderImageUploadedByName: imageUrl ? preparerLabel : null,
        shopDoorPhotoUrl,
        shopDoorPhotoUploadedByName: shopDoorPhotoUrl ? preparerLabel : null,
      },
    });

    await syncPhoneProfileFromOrder(order.id);
    void notifyTelegramNewOrder(order.id);
    void pushNotifyAdminsNewPendingOrder(order.orderNumber);

    revalidatePath("/preparer");
    void notifyTelegramNewPreparerShoppingOrder(order.id);
    return { ok: true, orderNumber: order.orderNumber };
  } catch (e) {
    console.error("Submit Order Error:", e);
    return { error: "فشل إرسال الطلب بسبب خطأ تقني." };
  }
}

// الوظائف المتبقية للطلبات العادية
export async function submitPreparerShoppingOrder(_prev: PreparerActionState, formData: FormData): Promise<PreparerActionState> { return { ok: true }; }
export async function updatePreparerShoppingOrder(_prev: PreparerActionState, formData: FormData): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const currentPreparer = await prisma.companyPreparer.findFirst({
      where: { id: v.preparerId, active: true },
      select: { id: true, name: true }
    });
    if (!currentPreparer) return { error: "الحساب غير متاح." };

    const orderId = String(formData.get("orderId") ?? "").trim();
    if (!orderId) return { error: "معرّف الطلب ناقص." };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customerRegion: true,
        shop: { include: { region: true } },
      },
    });
    if (!order) return { error: "الطلب غير موجود." };
    if (order.status === "delivered") return { error: "لا يمكن تعديل الطلب بعد التسليم." };

    const orderPrepJson = order.preparerShoppingJson as any;
    const gate = await assertPreparerLinkedToOrderShop(v.preparerId, orderId);
    if (!gate.ok) {
      return { error: gate.error };
    }

    const shopId = String(formData.get("shopId") ?? "").trim();
    const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();

    const customerPhoneRaw = String(formData.get("customerPhone") ?? "").trim();
    const customerPhone = customerPhoneRaw ? customerPhoneRaw : order.customerPhone;

    const orderTimeRaw = String(formData.get("orderTime") ?? "").trim();
    const orderTime = orderTimeRaw ? orderTimeRaw : order.orderNoteTime;

    const customerLandmarkRaw = String(formData.get("customerLandmark") ?? "").trim();
    const customerLandmark = customerLandmarkRaw ? customerLandmarkRaw : order.customerLandmark;

    const titleLineRaw = String(formData.get("titleLine") ?? "").trim();
    const titleLine = titleLineRaw ? titleLineRaw : ((order.preparerShoppingJson as any)?.titleLine || order.customerRegion?.name || "");


    const vehiclePreference = String(formData.get("vehiclePreference") ?? "").trim() || null;
    const deliveryPriceOverrideRaw = String(formData.get("deliveryPriceOverride") ?? "").trim();
    const deliveryPriceOverrideAlf = deliveryPriceOverrideRaw ? parseFloat(deliveryPriceOverrideRaw.replace(/,/g, ".")) : null;

    const shoppingPayloadRaw = String(formData.get("shoppingPayload") ?? "");
    let payload: any;
    try {
      payload = JSON.parse(shoppingPayloadRaw);
    } catch {
      return { error: "بيانات التسعير غير صالحة." };
    }

    if (!payload || payload.version !== 1 || !Array.isArray(payload.products) || payload.products.length === 0) {
      return { error: "صيغة بيانات الطلب غير صالحة." };
    }

    const products: { line: string; buyAlf: number; sellAlf: number; pricedBy: string; pricedById: string }[] = payload.products
      .map((p: any): { line: string; buyAlf: number; sellAlf: number; pricedBy: string; pricedById: string } | null => {
        if (!p || typeof p !== "object") return null;
        const line = String(p.line ?? "").trim();
        const buyAlf = Number(p.buyAlf);
        if (!line || !Number.isFinite(buyAlf) || buyAlf < 0) return null;
        const isOrderNoProfit = !!(order.preparerShoppingJson as any)?.noProfit;
        const sellAlf = calculateAutoSellPrice(line, buyAlf, isOrderNoProfit);
        return {
          line,
          buyAlf,
          sellAlf,
          pricedBy: typeof p.pricedBy === "string" && p.pricedBy.trim() ? p.pricedBy.trim() : currentPreparer.name,
          pricedById: typeof p.pricedById === "string" && p.pricedById.trim() ? p.pricedById.trim() : currentPreparer.id,
        };
      })
      .filter((x: { line: string; buyAlf: number; sellAlf: number; pricedBy: string; pricedById: string } | null): x is { line: string; buyAlf: number; sellAlf: number; pricedBy: string; pricedById: string } => x !== null);

    if (products.length === 0) {
      return { error: "يجب أن يتضمن الطلب منتجاً واحداً على الأقل بسعر الشراء الصحيح." };
    }

    const originalProducts = Array.isArray(orderPrepJson?.products) ? orderPrepJson.products : [];
    const otherPreparersProducts = originalProducts.filter((p: any) => {
      const pId = p.assignedPreparerId || p.pricedById;
      return pId && pId !== v.preparerId;
    });

    const finalMergedProducts = [...otherPreparersProducts, ...products];

    const placesCount = Number(payload.placesCount);
    if (!Number.isFinite(placesCount) || placesCount <= 0) {
      return { error: "يجب تحديد عدد المحلات." };
    }

    const shop = shopId === order.shopId
      ? order.shop
      : await prisma.shop.findUnique({ where: { id: shopId }, include: { region: true } });
    if (!shop) return { error: "المحل المحدد غير موجود." };

    const customerRegion = customerRegionId === order.customerRegionId
      ? order.customerRegion
      : await prisma.region.findUnique({ where: { id: customerRegionId } });
    if (!customerRegion) return { error: "المنطقة غير موجودة." };

    const isWebStoreOrder = order.submissionSource === "web_store";

    const extraAlf = calculateExtraAlfFromPlacesCount(placesCount);
    const sumSellAlf = finalMergedProducts.reduce((acc, p) => acc + p.sellAlf, 0);
    const subtotalDinar = new Decimal(sumSellAlf + extraAlf).mul(ALF_PER_DINAR);

    const baseRegionDeliveryDinar = (deliveryPriceOverrideAlf != null && Number.isFinite(deliveryPriceOverrideAlf))
      ? new Decimal(deliveryPriceOverrideAlf).mul(ALF_PER_DINAR)
      : customerRegion.deliveryPrice;

    const deliveryDinar = Decimal.max(shop.region.deliveryPrice, baseRegionDeliveryDinar);
    const totalDinar = subtotalDinar.plus(deliveryDinar);
    const deliveryAlf = Number(deliveryDinar.toString()) / ALF_PER_DINAR;

    const preparerMap = new Map<string, { preparerId: string; preparerName: string; products: any[]; totalBuyAlf: number; totalSellAlf: number }>();
    for (const p of finalMergedProducts) {
      const key = p.pricedById || currentPreparer.id;
      const existing = preparerMap.get(key);
      const name = p.pricedBy || currentPreparer.name;
      if (!existing) {
        preparerMap.set(key, {
          preparerId: key,
          preparerName: name,
          products: [p],
          totalBuyAlf: p.buyAlf,
          totalSellAlf: p.sellAlf,
        });
      } else {
        existing.products.push(p);
        existing.totalBuyAlf += p.buyAlf;
        existing.totalSellAlf += p.sellAlf;
      }
    }

    const preparerInvoices = Array.from(preparerMap.values()).map((entry) => ({
      preparerId: entry.preparerId,
      preparerName: entry.preparerName,
      products: entry.products,
      totalBuyAlf: entry.totalBuyAlf,
      totalSellAlf: entry.totalSellAlf,
      invoiceText: buildPreparerPurchaseSummaryText(entry.products),
    }));

    const summaryParts = preparerInvoices.map((inv) => {
      return `[ تجهيز: ${inv.preparerName} ]\n${inv.invoiceText}`;
    });
    const summary = formatBorderedSummarySection("المنتجات حسب المجهز", summaryParts.join("\n\n═══════════════\n\n"));
    const oldProducts = (orderPrepJson?.products as any[]) || [];
    const oldDynamicOrderType = resolveDynamicOrderType(oldProducts, "تجهيز تسوق");
    let resolvedOrderType = order.orderType;
    if (
      resolvedOrderType === "تجهيز تسوق" ||
      !resolvedOrderType.trim() ||
      resolvedOrderType === oldDynamicOrderType
    ) {
      resolvedOrderType = resolveDynamicOrderType(finalMergedProducts, resolvedOrderType);
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          shopId: shop.id,
          orderType: resolvedOrderType,
          customerPhone,
          customerRegionId: customerRegion.id,
          customerLandmark,
          orderNoteTime: orderTime,
          orderSubtotal: subtotalDinar,
          deliveryPrice: deliveryDinar,
          totalAmount: totalDinar,
          summary,
          vehiclePreference,
          submittedByCompanyPreparerId: order.submittedByCompanyPreparerId || v.preparerId,
          submissionSource: isWebStoreOrder ? "company_preparer" : order.submissionSource,
          preparerShoppingJson: {
            ...(order.preparerShoppingJson as any || {}),
            version: 1,
            titleLine,
            products: finalMergedProducts,
            placesCount,
            sumSellAlf,
            extraAlf,
            deliveryAlf,
            preparerInvoices,
            customerInvoiceText: buildCustomerInvoiceText({
              brandLabel: "أبو الأكبر للتوصيل",
              orderNumberLabel: `#${order.orderNumber}`,
              regionTitle: titleLine,
              phone: customerPhone || "—",
              lines: finalMergedProducts,
              placesCount,
              deliveryAlf,
            }),
          },
        },
      });

      // إذا كان هناك مسودة مرتبطة، نقوم بتحديث حالتها
      await tx.companyPreparerShoppingDraft.updateMany({
        where: { sentOrderId: orderId, status: { in: ["draft", "priced"] } },
        data: { status: "sent" },
      });
    });

    await prisma.companyPreparerWorkLog.create({
      data: {
        preparerId: v.preparerId,
        actionType: "price_product",
      },
    });

    revalidatePath("/preparer");
    return { ok: true };
  } catch (e) {
    console.error("Update Preparer Order Error:", e);
    return { error: "فشل تحديث الطلب بسبب خطأ تقني." };
  }
}

/**
 * تحديث سعر منتج من قبل المجهز
 */
export async function updateStoreProductPrice(
  _prev: any,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const productId = String(formData.get("productId") ?? "").trim();
    const variantId = String(formData.get("variantId") ?? "").trim();
    const purchasePriceRaw = String(formData.get("purchasePrice") ?? "").trim();
    const branchId = String(formData.get("branchId") ?? "").trim();

    if (!productId || !purchasePriceRaw || !branchId) return { error: "بيانات ناقصة." };

    const purchasePriceValue = Number(purchasePriceRaw);

    const branch = await prisma.storeBranch.findFirst({
      where: {
        id: branchId,
        active: true,
        OR: [
          { authorizedPreparerId: v.preparerId },
          { authorizedPreparer: { id: v.vId || v.preparerId } }
        ]
      },
    });

    if (!branch) {
      console.error(`[UpdatePrice] Unauthorized. Prep: ${v.preparerId}, Branch: ${branchId}`);
      return { error: "الفرع غير موجود أو ليس لديك صلاحية تسعير عليه." };
    }

    const { getEffectiveProfitMargin } = await import("@/lib/store-profit-sync");

    // جلب المنتج لمعرفة المورد (Supplier)
    const product = await prisma.storeProduct.findUnique({
      where: { id: productId },
      select: { supplierId: true }
    });

    const profitMargin = await getEffectiveProfitMargin(branchId, product?.supplierId);

    // حساب سعر البيع بناءً على نسبة الربح (النسبة المئوية)
    // السعر الجديد = سعر الشراء * (1 + نسبة الربح)
    const salePriceValue = purchasePriceValue * (1 + profitMargin);

    if (variantId) {
      await prisma.storeProductVariant.update({
        where: { id: variantId },
        data: {
          purchasePrice: purchasePriceValue,
          salePrice: salePriceValue
        }
      });
    } else {
      await prisma.storeProduct.update({
        where: { id: productId },
        data: {
          purchasePrice: purchasePriceValue,
          salePrice: salePriceValue
        }
      });
    }

    const { revalidateTag } = await import("next/cache");
    revalidateTag("products");

    await prisma.companyPreparerWorkLog.create({
      data: {
        preparerId: v.preparerId,
        actionType: "price_product",
      },
    });

    revalidatePath(`/preparer/store-pricing/${branchId}`);
    return { ok: true };
  } catch (e) {
    console.error("Update Price Error:", e);
    return { error: "فشل تحديث السعر." };
  }
}

/** أرشفة (رفض) مسودة التجهيز */
export async function archivePreparerShoppingDraftAction(
  _prev: any,
  formData: FormData
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const draftId = String(formData.get("draftId") ?? "").trim();
    if (!draftId) return { error: "المعرف ناقص." };

    const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id: draftId } });
    if (!draft) return { error: "المسودة غير موجودة." };

    // إذا كانت المسودة جزء من مجموعة، نؤرشف الجميع
    const groupId = (draft.data as any)?.groupId;
    if (groupId) {
      const draftsWithGroup = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "CompanyPreparerShoppingDraft" WHERE data->>'groupId' = ${groupId}`;
      const ids = draftsWithGroup.map(d => d.id);
      if (ids.length > 0) {
        await prisma.companyPreparerShoppingDraft.updateMany({
          where: { id: { in: ids } },
          data: { status: "archived" }
        });
      }
    } else {
      await prisma.companyPreparerShoppingDraft.update({
        where: { id: draftId },
        data: { status: "archived" }
      });
    }

    // إذا كانت المسودة مرتبطة بطلب (مثل طلب المتجر)، نقوم بإلغاء الطلب أيضاً
    const sentOrderId = draft.sentOrderId;
    if (sentOrderId) {
      await prisma.order.update({
        where: { id: sentOrderId },
        data: { status: "cancelled" }
      });
      // أرشفة بقية المسودات المرتبطة بنفس الطلب إذا وجدت
      await prisma.companyPreparerShoppingDraft.updateMany({
        where: { sentOrderId, status: { not: "archived" } },
        data: { status: "archived" }
      });
    }

    revalidatePath("/preparer/preparation");
    return { ok: true };
  } catch (e) {
    console.error("Archive Draft Error:", e);
    return { error: "فشل أرشفة المسودة." };
  }
}

/** رفض طلب المتجر الإلكتروني من قبل المجهز */
export async function rejectOrderFromPreparerAction(
  _prev: any,
  formData: FormData
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const orderId = String(formData.get("orderId") ?? "").trim();
    if (!orderId) return { error: "معرف الطلب ناقص." };

    const gate = await assertPreparerLinkedToOrderShop(v.preparerId, orderId);
    if (!gate.ok) return { error: gate.error };

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "cancelled" }
    });

    const { notifyTelegramOrderCanceled } = await import("@/lib/telegram-notify");
    void notifyTelegramOrderCanceled(orderId).catch(() => null);

    // أرشفة كافة المسودات المرتبطة بهذا الطلب
    await prisma.companyPreparerShoppingDraft.updateMany({
      where: { sentOrderId: orderId },
      data: { status: "archived" }
    });

    revalidatePath("/preparer/preparation");
    return { ok: true };
  } catch (e) {
    console.error("Reject Order Error:", e);
    return { error: "فشل رفض الطلب." };
  }
}

export async function dismissCompanyPreparerPrepNotice(_prev: PreparerActionState, formData: FormData): Promise<PreparerActionState> { return { ok: true }; }
export async function assignOrderByPreparer(_prev: PreparerActionState, formData: FormData): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) {
    return { error: "جلسة المجهز غير صالحة." };
  }

  const preparer = await prisma.companyPreparer.findUnique({ where: { id: v.preparerId } });
  if (!preparer) {
    return { error: "المجهز غير موجود." };
  }

  const orderId = String(formData.get("orderId") ?? "").trim();
  const courierId = String(formData.get("courierId") ?? "").trim();
  if (!orderId || !courierId) {
    return { error: "الطلب أو المندوب غير محدد." };
  }

  const result = await transferOrderToCourierInternal(orderId, courierId, {
    bypassCourierAvailability: true,
  });
  if (!result.ok) {
    return { error: result.error ?? "فشل الإسناد." };
  }

  // المجهز يسند للمندوب بعد إكمال التسعير والدفع
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "delivering",
      customerPaymentReceivedAt: new Date(),
    },
  });

  void notifyTelegramOrderPrepared({ orderId });

  await prisma.companyPreparerWorkLog.create({
    data: {
      preparerId: v.preparerId,
      actionType: "assign_order",
    },
  });

  revalidatePath("/preparer");
  revalidatePath(`/preparer/order/${orderId}`);
  return { ok: true };
}

/** رفع أو استبدال صورة الطلبية من صفحة تفاصيل الطلب (المجهز). */
export async function uploadPreparerPortalOrderImage(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "جلسة المجهز غير صالحة." };

    const orderId = String(formData.get("orderId") ?? "").trim();
    const file = formData.get("orderImage");
    if (!(file instanceof File) || file.size <= 0) return { error: "اختر صورة أو التقطها أولاً." };

    const gate = await assertPreparerLinkedToOrderShop(v.preparerId, orderId);
    if (!gate.ok) return { error: gate.error };

    let url: string;
    try {
      if (gate.order.imageUrl) {
        try {
          await deleteFromR2(gate.order.imageUrl);
        } catch {
          /* تجاهل فشل حذف النسخة القديمة */
        }
      }
      url = await saveOrderImageUploaded(file, MAX_ORDER_IMAGE_BYTES);
    } catch (e) {
      return { error: preparerImageSaveErrorMessage(e) };
    }

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: v.preparerId },
      select: { name: true },
    });
    const preparerLabel = preparer?.name?.trim() ? `المجهز ${preparer.name.trim()}` : "المجهز";

    await prisma.order.update({
      where: { id: orderId },
      data: {
        imageUrl: url,
        orderImageUploadedByName: preparerLabel,
      },
    });

    revalidatePath("/preparer");
    revalidatePath(`/preparer/order/${orderId}`);
    return { ok: true };
  } catch (e) {
    console.error("uploadPreparerPortalOrderImage", e);
    return { error: "فشل رفع الصورة." };
  }
}

/** رفع أو استبدال صورة باب المحل المرتبطة بالطلب (المجهز). */
export async function uploadPreparerPortalShopDoorPhoto(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "جلسة المجهز غير صالحة." };

    const orderId = String(formData.get("orderId") ?? "").trim();
    const file = formData.get("shopDoorPhoto");
    if (!(file instanceof File) || file.size <= 0) return { error: "اختر صورة أو التقطها أولاً." };

    const gate = await assertPreparerLinkedToOrderShop(v.preparerId, orderId);
    if (!gate.ok) return { error: gate.error };

    let url: string;
    try {
      if (gate.order.shopDoorPhotoUrl) {
        try {
          await deleteFromR2(gate.order.shopDoorPhotoUrl);
        } catch {
          /* ignore */
        }
      }
      url = await saveShopDoorPhotoUploaded(file, MAX_ORDER_IMAGE_BYTES);
    } catch (e) {
      return { error: preparerImageSaveErrorMessage(e) };
    }

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: v.preparerId },
      select: { name: true },
    });
    const preparerLabel = preparer?.name?.trim() ? `المجهز ${preparer.name.trim()}` : "المجهز";

    await prisma.order.update({
      where: { id: orderId },
      data: {
        shopDoorPhotoUrl: url,
        shopDoorPhotoUploadedByName: preparerLabel,
      },
    });

    revalidatePath("/preparer");
    revalidatePath(`/preparer/order/${orderId}`);
    return { ok: true };
  } catch (e) {
    console.error("uploadPreparerPortalShopDoorPhoto", e);
    return { error: "فشل رفع الصورة." };
  }
}

export async function updatePreparerOrderFields(_prev: PreparerActionState, formData: FormData): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const orderId = String(formData.get("orderId") ?? "").trim();
    if (!orderId) return { error: "معرف الطلب ناقص." };

    const gate = await assertPreparerLinkedToOrderShop(v.preparerId, orderId);
    if (!gate.ok) return { error: gate.error };

    const orderType = String(formData.get("orderType") ?? "").trim();
    const customerPhoneRaw = String(formData.get("customerPhone") ?? "").trim();
    const orderSubtotalRaw = String(formData.get("orderSubtotal") ?? "").trim();
    const vehiclePreference = String(formData.get("vehiclePreference") ?? "").trim() || null;
    const deliveryPriceOverrideRaw = String(formData.get("deliveryPriceOverride") ?? "").trim();

    const data: Prisma.OrderUpdateInput = {};

    if (orderType) data.orderType = orderType;
    if (customerPhoneRaw) {
      const p = normalizeIraqMobileLocal11(customerPhoneRaw);
      if (p) {
        // Global block check
        const isGlobalBlocked = await prisma.globalBlockedPhone.findUnique({
          where: { phone: p },
        });
        if (isGlobalBlocked) {
          return { error: `عذراً، الرقم (${p}) محظور عالمياً من الطلب.` };
        }
        data.customerPhone = p;
      }
    }
    if (orderSubtotalRaw) {
      const p = parseAlfInputToDinarDecimalRequired(orderSubtotalRaw);
      if (p.ok) data.orderSubtotal = p.value;
    }

    data.vehiclePreference = vehiclePreference;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shop: { include: { region: true } }, customerRegion: true },
    });

    if (order) {
      const subtotal = data.orderSubtotal ? new Decimal(data.orderSubtotal as any) : order.orderSubtotal;

      let baseRegionDeliveryDinar = order.customerRegion?.deliveryPrice || new Decimal(0);
      if (deliveryPriceOverrideRaw) {
        const overrideAlf = parseFloat(deliveryPriceOverrideRaw.replace(/,/g, "."));
        if (Number.isFinite(overrideAlf)) {
          baseRegionDeliveryDinar = new Decimal(overrideAlf).mul(ALF_PER_DINAR);
        }
      }

      const delivery = Decimal.max(order.shop.region.deliveryPrice, baseRegionDeliveryDinar);
      data.deliveryPrice = delivery;
      data.totalAmount = subtotal.plus(delivery);
    }

    const orderImg = formData.get("orderImage");
    const shopDoorImg = formData.get("shopDoorPhoto");

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: v.preparerId },
      select: { name: true },
    });
    const preparerLabel = preparer?.name?.trim() ? `المجهز ${preparer.name.trim()}` : "المجهز";

    if (orderImg instanceof File && orderImg.size > 0) {
      data.imageUrl = await saveOrderImageUploaded(orderImg, MAX_ORDER_IMAGE_BYTES);
      data.orderImageUploadedByName = preparerLabel;
    }
    if (shopDoorImg instanceof File && shopDoorImg.size > 0) {
      data.shopDoorPhotoUrl = await saveShopDoorPhotoUploaded(shopDoorImg, MAX_ORDER_IMAGE_BYTES);
      data.shopDoorPhotoUploadedByName = preparerLabel;
    }

    await prisma.order.update({
      where: { id: orderId },
      data,
    });

    revalidatePath("/preparer");
    revalidatePath(`/preparer/order/${orderId}`);
    return { ok: true };
  } catch (e) {
    console.error("updatePreparerOrderFields error:", e);
    return { error: "فشل تحديث البيانات." };
  }
}

export async function reportUnavailableProductsAction(
  _prev: PreparerActionState,
  formData: FormData,
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const preparerName = String(formData.get("preparerName") ?? "مجهز");
    const customerRegion = String(formData.get("customerRegion") ?? "—");
    const customerPhone = String(formData.get("customerPhone") ?? "—");
    const itemsJson = String(formData.get("itemsJson") ?? "[]");

    let unavailableItems: { line: string; substitute?: string }[] = [];
    try {
      unavailableItems = JSON.parse(itemsJson);
    } catch {
      return { error: "بيانات غير صالحة." };
    }

    if (unavailableItems.length === 0) return { error: "لم يتم اختيار أي مواد." };

    await notifyTelegramUnavailableProducts({
      preparerName,
      customerRegion,
      customerPhone,
      unavailableItems,
    });

    return { ok: true };
  } catch (e) {
    console.error("reportUnavailableProductsAction error:", e);
    return { error: "فشل إرسال الإشعار." };
  }
}

export async function setPreparerPresenceFromForm(_prev: PreparerActionState, formData: FormData): Promise<PreparerActionState> { return { ok: true }; }

/** إخفاء الطلبية من قائمة الديون الخاصة بالمجهز */
export async function hideOrderFromPreparerDebtsAction(
  _prev: any,
  formData: FormData
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    const isAdmin = formData.get("isAdmin") === "true";

    let preparerId = "";
    if (v.ok) {
      preparerId = v.preparerId;
    } else if (!isAdmin) {
      return { error: "الرابط غير صالح." };
    }

    const orderIdStr = String(formData.get("orderId") ?? formData.get("orderIds") ?? "").trim();
    if (!orderIdStr) return { error: "معرف الطلب ناقص." };

    const orderIds = orderIdStr.split(",").filter(Boolean);
    if (orderIds.length === 0) return { error: "لا توجد طلبات صالحة." };

    for (const orderId of orderIds) {
      if (isAdmin) {
        // إذا كان مديراً، يخفيها عن الكل (قاعدة البيانات الأصلية)
        await prisma.order.update({
          where: { id: orderId },
          data: { preparerDebtHidden: true }
        });

        // إرسال إشعار محمي
        try {
          const order = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
          const notificationBotToken = await getBotTokenByPurpose("notification");
          if (notificationBotToken) {
            await sendTelegramMessage(`🚫 <b>المدير قام بإخفاء دين الطلب #${order?.orderNumber} عن جميع المجهزين.</b>`, { botToken: notificationBotToken });
          }
        } catch (e) {
          console.error("Telegram hide notify error:", e);
        }

      } else {
        // إذا كان مجهزاً، يخفيها عن نفسه فقط
        await prisma.preparerHiddenDebt.upsert({
          where: { orderId_preparerId: { orderId, preparerId } },
          create: { orderId, preparerId },
          update: {}
        });
      }
    }

    revalidatePath("/preparer/debts");
    revalidatePath("/abo1stor3hlaa2kbr8-47/preparers");
    return { ok: true };
  } catch (e) {
    console.error("hideOrderFromPreparerDebtsAction error:", e);
    return { error: "فشل إخفاء الطلبية." };
  }
}

/** تسجيل تسديد دين (كامل أو جزئي) للمحل */
export async function payOrderDebtAction(
  _prev: any,
  formData: FormData
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    const isAdmin = formData.get("isAdmin") === "true";
    const adminName = String(formData.get("adminName") ?? "المدير").trim();

    let preparerId: string | null = null;
    let displayName = "";

    if (v.ok) {
      preparerId = v.preparerId;
      const preparer = await prisma.companyPreparer.findUnique({
        where: { id: preparerId },
        select: { name: true }
      });
      displayName = preparer?.name || "مجهز";
    } else if (isAdmin) {
      displayName = adminName;
    } else {
      return { error: "الرابط غير صالح." };
    }

    const orderId = String(formData.get("orderId") ?? "").trim();
    const amountAlf = String(formData.get("amountAlf") ?? "").trim();
    const mismatchNote = String(formData.get("mismatchNote") ?? "").trim();
    const expectedAlf = String(formData.get("expectedAlf") ?? "").trim();

    if (!orderId || !amountAlf) return { error: "بيانات ناقصة." };

    const amountDinar = new Decimal(amountAlf).mul(ALF_PER_DINAR);
    if (amountDinar.lte(0)) return { error: "المبلغ يجب أن يكون أكبر من صفر." };

    const expectedDinar = expectedAlf ? new Decimal(expectedAlf).mul(ALF_PER_DINAR) : null;
    const matchesExpected = expectedDinar ? amountDinar.equals(expectedDinar) : true;

    if (!matchesExpected && !mismatchNote) {
      return { error: "يرجى كتابة سبب تسديد مبلغ أقل من المطلوب." };
    }

    await prisma.orderCourierMoneyEvent.create({
      data: {
        orderId,
        amountDinar,
        kind: "pickup_out",
        recordedByCompanyPreparerId: preparerId,
        courierId: null,
        expectedDinar,
        matchesExpected,
        mismatchNote: mismatchNote || "",
        mismatchReason: !matchesExpected ? "تسديد جزئي" : "",
      }
    });

    // إشعارات تيليجرام - معزولة لضمان عدم تأثر التسديد بفشل الإشعار
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { shop: true, customer: true }
      });

      if (order) {
        const escapedShopName = escapeTelegramHtml(order.shop.name);
        const escapedPreparerName = escapeTelegramHtml(displayName);
        const escapedNote = escapeTelegramHtml(mismatchNote || "");
        const escapedCustomerName = escapeTelegramHtml(order.customer?.name || order.customerPhone || "—");

        let balanceText = "";
        if (preparerId) {
          const totals = await getPreparerMoneyTotals(preparerId);
          if (totals) {
            balanceText = `\u200F<b>المتبقي في المحفظة:</b> ${formatDinarAsAlfWithUnit(totals.remain)}`;
          }
        }

        const msg = [
          `\u200F💸 <b>تسديد دين للمحل</b>`,
          `\u200F<b>المحل:</b> ${escapedShopName}`,
          `\u200F<b>المسدد:</b> ${escapedPreparerName}`,
          `\u200F<b>المبلغ:</b> ${formatDinarAsAlfWithUnit(amountDinar)}`,
          mismatchNote ? `\u200F<b>السبب:</b> ${escapedNote}` : "",
          `\u200F<b>رقم الطلب:</b> #${order.orderNumber}`,
          `\u200F<b>العميل:</b> ${escapedCustomerName}`,
          balanceText,
          `\u200F<b>التاريخ:</b> \u200E${new Date().toLocaleString("ar-IQ")}\u200E`,
        ].filter(Boolean).join("\n");

        const notificationBotToken = await getBotTokenByPurpose("notification");
        const managementBotToken = await getBotTokenByPurpose("management");
        const preparerBotToken = await getBotTokenByPurpose("preparer");

        // 1. الإرسال لبوت الإشعارات (الجروب العام)
        if (notificationBotToken) {
          await sendTelegramMessage(msg, { botToken: notificationBotToken });
        }

        // 2. الإرسال لبوت الإدارة (إذا كان مختلفاً أو مخصصاً)
        if (managementBotToken && managementBotToken !== notificationBotToken) {
          await sendTelegramMessage(msg, { botToken: managementBotToken });
        }

        // 3. إشعار خاص للمجهز الذي قام بالتسديد (وصل استلام)
        const currentPreparer = await prisma.companyPreparer.findUnique({
          where: { id: preparerId || "" },
          select: { telegramUserId: true }
        });

        if (preparerBotToken && currentPreparer?.telegramUserId) {
          try {
            await sendTelegramHtmlToChat(currentPreparer.telegramUserId, `\u200F✅ <b>تأكيد استلام تسديدك</b>\n\n${msg}`, preparerBotToken);
          } catch (e) { console.error("Failed to send receipt to current preparer", e); }
        }

        // 4. إشعار للمجهزين الآخرين المرتبطين بهذا المحل
        const relatedPreparers = await prisma.companyPreparer.findMany({
          where: {
            active: true,
            telegramUserId: { not: "" },
            id: { not: preparerId || "" },
            shopLinks: { some: { shopId: order.shopId } }
          }
        });

        if (preparerBotToken) {
          for (const p of relatedPreparers) {
            try {
              if (p.telegramUserId) {
                await sendTelegramHtmlToChat(p.telegramUserId, `\u200F📢 <b>تنبيه تسديد (زميل):</b>\n\n${msg}`, preparerBotToken);
              }
            } catch (err) {
              console.error(`Failed to notify preparer ${p.name}:`, err);
            }
          }
        }
      }
    } catch (notifError) {
      console.error("Notification failed but debt was recorded:", notifError);
    }

    revalidatePath("/preparer/debts");
    revalidatePath("/preparer/wallet");
    revalidatePath("/abo1stor3hlaa2kbr8-47/preparers");
    return { ok: true };
  } catch (e) {
    console.error("payOrderDebtAction error:", e);
    return { error: "فشل تسجيل التسديد." };
  }
}

export async function bulkAssignOrdersByPreparer(_prev: PreparerActionState, formData: FormData): Promise<PreparerActionState> {
  const v = readPortal(formData);
  if (!v.ok) return { error: "جلسة المجهز غير صالحة." };

  const courierId = String(formData.get("courierId") ?? "").trim();
  const orderIdsStr = String(formData.get("orderIds") ?? "").trim();
  const directReceipt = formData.get("directReceipt") === "on";

  if (!courierId || !orderIdsStr) return { error: "بيانات ناقصة." };

  const orderIds = orderIdsStr.split(",").filter(Boolean);

  try {
    for (const orderId of orderIds) {
      const res = await transferOrderToCourierInternal(orderId, courierId, {
        bypassCourierAvailability: true,
      });

      if (!res.ok) {
        return { error: res.error || "فشل الإسناد." };
      }

      // دائماً نحول الحالة إلى delivering لأن المجهز أكمل التسعير والدفع
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "delivering",
          customerPaymentReceivedAt: new Date(), // بما أن المجهز استلمها ودافع حسابها
        },
      });

      void notifyTelegramOrderPrepared({ orderId });
    }

    await prisma.companyPreparerWorkLog.create({
      data: {
        preparerId: v.preparerId,
        actionType: "assign_order",
      },
    });

    revalidatePath("/preparer");
    return { ok: true };
  } catch (e: any) {
    console.error("bulkAssignOrdersByPreparer error:", e);
    return { error: `فشل الإسناد: ${e?.message || "خطأ تقني"}` };
  }
}

export async function createPreparerDebtAction(
  _prev: any,
  formData: FormData
): Promise<PreparerActionState> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const shopName = String(formData.get("shopName") ?? "").trim();
    const amountAlf = String(formData.get("amountAlf") ?? "").trim();

    if (!shopName || !amountAlf) return { error: "يرجى ملء كافة الحقول." };

    const amountDinar = new Decimal(amountAlf).mul(ALF_PER_DINAR);
    if (amountDinar.lte(0)) return { error: "المبلغ يجب أن يكون أكبر من صفر." };

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: v.preparerId },
      select: { id: true, name: true, walletEmployeeId: true }
    });

    if (!preparer) return { error: "المجهز غير موجود." };
    if (!preparer.walletEmployeeId) {
      return { error: "المحفظة غير مفعلة لحسابك حالياً. يرجى مراجعة الإدارة." };
    }

    // البحث عن المحل بالاسم
    let shop = await prisma.shop.findFirst({
      where: { name: { equals: shopName, mode: "insensitive" } }
    });

    // إذا لم يكن موجوداً، نقوم بإنشائه
    if (!shop) {
      const firstRegion = await prisma.region.findFirst();
      if (!firstRegion) return { error: "يجب إضافة منطقة واحدة على الأقل في النظام." };

      shop = await prisma.shop.create({
        data: {
          name: shopName,
          locationUrl: "",
          regionId: firstRegion.id,
        }
      });
    }

    // ربط المجهز بالمحل إذا لم يكن مرتبطاً
    await prisma.preparerShop.upsert({
      where: { preparerId_shopId: { preparerId: preparer.id, shopId: shop.id } },
      create: { preparerId: preparer.id, shopId: shop.id, canSubmitOrders: true },
      update: {}
    });

    // إنشاء طلبية الدين
    const order = await prisma.order.create({
      data: {
        shopId: shop.id,
        status: "pending",
        orderType: "دين",
        orderSubtotal: amountDinar,
        deliveryPrice: new Decimal(0),
        totalAmount: amountDinar,
        submissionSource: "company_preparer",
        submittedByCompanyPreparerId: preparer.id,
        summary: `دين تم تسجيله بواسطة المجهز ${preparer.name}`,
      }
    });

    // إنشاء قيد "أخذت" (take) في محفظة المجهز
    await prisma.employeeWalletMiscEntry.create({
      data: {
        employeeId: preparer.walletEmployeeId,
        direction: "take",
        amountDinar: amountDinar,
        label: `دين مستقطع من محل ${shop.name} (طلب #${order.orderNumber})`,
      }
    });

    // إرسال إشعارات تيليجرام
    try {
      const escapedShopName = escapeTelegramHtml(shop.name);
      const escapedPreparerName = escapeTelegramHtml(preparer.name);

      const msg = [
        `🚨 <b>تسجيل دين جديد (ذمم مجهز)</b>`,
        `<b>المحل:</b> ${escapedShopName}`,
        `<b>المجهز:</b> ${escapedPreparerName}`,
        `<b>المبلغ:</b> ${formatDinarAsAlfWithUnit(amountDinar)}`,
        `<b>رقم الطلب:</b> #${order.orderNumber}`,
        `<b>التاريخ:</b> \u200E${new Date().toLocaleString("ar-IQ")}\u200E`,
      ].join("\n");

      const notificationBotToken = await getBotTokenByPurpose("notification");
      const managementBotToken = await getBotTokenByPurpose("management");

      if (notificationBotToken) {
        await sendTelegramMessage(msg, { botToken: notificationBotToken });
      }
      if (managementBotToken && managementBotToken !== notificationBotToken) {
        await sendTelegramMessage(msg, { botToken: managementBotToken });
      }
    } catch (notifError) {
      console.error("Failed to send telegram notification for new debt:", notifError);
    }

    revalidatePath("/preparer/debts");
    revalidatePath("/preparer/wallet");
    return { ok: true };
  } catch (e: any) {
    console.error("createPreparerDebtAction error:", e);
    return { error: `فشل تسجيل الدين: ${e?.message || "خطأ تقني"}` };
  }
}

// دالة تحويل التوقيت إلى توقيت العراق
function getIraqTime(date: Date): { year: number; month: number; day: number; hours: number; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0");
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hours: getPart("hour"),
    minutes: getPart("minute")
  };
}

// دالة احتساب الشفتات المستحقة
async function calculateAccumulatedSalaryInternal(preparerId: string) {
  await ensurePreparerSalaryConfigColumnsIfMissing();

  const preparer = await prisma.companyPreparer.findUnique({
    where: { id: preparerId },
    select: { 
      dailySalary: true, 
      lastSalaryWithdrawalAt: true, 
      createdAt: true,
      shift1Start: true,
      shift1End: true,
      shift2Start: true,
      shift2End: true,
      salaryWithdrawalTime: true,
      bypassWithdrawalTime: true
    }
  });

  if (!preparer) return { dailySalary: 0, todaySalary: 0, accumulatedSalary: 0 };

  const dailySalary = Number(preparer.dailySalary || 0);
  if (dailySalary <= 0) return { dailySalary, todaySalary: 0, accumulatedSalary: 0 };

  const lastWithdrawal = preparer.lastSalaryWithdrawalAt || preparer.createdAt || new Date();

  // جلب حركات العمل بعد تاريخ آخر سحب
  const workLogs = await prisma.companyPreparerWorkLog.findMany({
    where: {
      preparerId,
      createdAt: { gte: lastWithdrawal }
    },
    orderBy: { createdAt: "asc" }
  });

  const iraqNow = getIraqTime(new Date());
  const todayKey = `${iraqNow.year}-${iraqNow.month}-${iraqNow.day}`;

  const shiftHalfValue = dailySalary / 2;
  const uniqueShifts = new Set<string>();
  let todaySalary = 0;

  const timeToMinutes = (h: number, m: number) => h * 60 + m;
  const parseTimeToMinutes = (timeStr: string) => {
    const [h, m] = (timeStr || "00:00").split(":").map(Number);
    return h * 60 + m;
  };

  const s1Start = parseTimeToMinutes(preparer.shift1Start || "08:00");
  const s1End = parseTimeToMinutes(preparer.shift1End || "13:00");
  const s2Start = parseTimeToMinutes(preparer.shift2Start || "15:30");
  const s2End = parseTimeToMinutes(preparer.shift2End || "21:00");

  workLogs.forEach(log => {
    const logTime = getIraqTime(log.createdAt);
    const dayKey = `${logTime.year}-${logTime.month}-${logTime.day}`;
    const logMinutes = timeToMinutes(logTime.hours, logTime.minutes);

    // التحقق من الشفتات الصباحية والمسائية بناءً على الإعدادات المخزنة للمجهز
    let isMorning = logMinutes >= s1Start && logMinutes <= s1End;
    let isEvening = logMinutes >= s2Start && logMinutes <= s2End;

    if (isMorning) {
      const shiftKey = `${dayKey}_morning`;
      uniqueShifts.add(shiftKey);
      if (dayKey === todayKey) {
        todaySalary += shiftHalfValue;
      }
    }
    if (isEvening) {
      const shiftKey = `${dayKey}_evening`;
      uniqueShifts.add(shiftKey);
      if (dayKey === todayKey) {
        todaySalary += shiftHalfValue;
      }
    }
  });

  // التأكد من عدم تجاوز راتب اليوم القيمة الكلية لليوم
  if (todaySalary > dailySalary) {
    todaySalary = dailySalary;
  }

  const accumulatedSalary = uniqueShifts.size * shiftHalfValue;

  return {
    dailySalary,
    todaySalary,
    accumulatedSalary
  };
}

// أكشن جلب إحصائيات راتب المجهز
export async function getPreparerSalaryStats(_prev: any, formData: FormData): Promise<{
  ok?: boolean;
  error?: string;
  dailySalary?: number;
  todaySalary?: number;
  accumulatedSalary?: number;
  withdrawableSalary?: number;
  isBeforeEightPM?: boolean;
  hasPinCode?: boolean;
  pinDisabled?: boolean;
}> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    await ensurePreparerSalaryConfigColumnsIfMissing();

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: v.preparerId },
      select: { 
        salaryPinCode: true, 
        salaryPinDisabled: true,
        salaryWithdrawalTime: true,
        bypassWithdrawalTime: true
      }
    });

    if (!preparer) return { error: "المجهز غير موجود." };

    const stats = await calculateAccumulatedSalaryInternal(v.preparerId);
    const iraqNow = getIraqTime(new Date());
    
    const nowMinutes = iraqNow.hours * 60 + iraqNow.minutes;
    const withdrawalStr = preparer.salaryWithdrawalTime || "20:00";
    const [wH, wM] = withdrawalStr.split(":").map(Number);
    const withdrawalMinutes = wH * 60 + wM;

    const isBeforeEightPM = preparer.bypassWithdrawalTime ? false : nowMinutes < withdrawalMinutes;
    const withdrawableSalary = isBeforeEightPM ? Math.max(0, stats.accumulatedSalary - stats.todaySalary) : stats.accumulatedSalary;

    return {
      ok: true,
      dailySalary: stats.dailySalary,
      todaySalary: stats.todaySalary,
      accumulatedSalary: stats.accumulatedSalary,
      withdrawableSalary,
      isBeforeEightPM,
      hasPinCode: !!preparer.salaryPinCode && !preparer.salaryPinDisabled,
      pinDisabled: preparer.salaryPinDisabled
    };
  } catch (e) {
    console.error("getPreparerSalaryStats error:", e);
    return { error: "فشل تحميل بيانات الراتب." };
  }
}

// أكشن تعيين الرمز السري للمجهز لأول مرة
export async function setPreparerSalaryPinCode(_prev: any, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const pinCode = String(formData.get("pinCode") ?? "").trim();
    if (!pinCode) return { error: "الرمز السري لا يمكن أن يكون فارغاً." };

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: v.preparerId }
    });

    if (!preparer) return { error: "المجهز غير موجود." };
    if (preparer.salaryPinCode && !preparer.salaryPinDisabled) return { error: "لقد قمت بتعيين الرمز السري مسبقاً." };

    await prisma.companyPreparer.update({
      where: { id: v.preparerId },
      data: { salaryPinCode: pinCode, salaryPinDisabled: false }
    });

    return { ok: true };
  } catch (e) {
    console.error("setPreparerSalaryPinCode error:", e);
    return { error: "فشل تعيين الرمز السري." };
  }
}

// أكشن إيقاف تفعيل الرمز السري للمجهز
export async function disablePreparerSalaryPinCode(_prev: any, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const pinCode = String(formData.get("pinCode") ?? "").trim();
    if (!pinCode) return { error: "الرمز السري الحالي مطلوب." };

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: v.preparerId }
    });

    if (!preparer) return { error: "المجهز غير موجود." };
    if (!preparer.salaryPinCode) return { error: "لا يوجد رمز سري معين حالياً." };
    if (preparer.salaryPinCode !== pinCode) return { error: "الرمز السري غير صحيح." };

    await prisma.companyPreparer.update({
      where: { id: v.preparerId },
      data: { salaryPinDisabled: true }
    });

    return { ok: true };
  } catch (e) {
    console.error("disablePreparerSalaryPinCode error:", e);
    return { error: "فشل إيقاف الرمز السري." };
  }
}

// أكشن إعادة تفعيل/تعديل الرمز السري للمجهز
export async function enablePreparerSalaryPinCode(_prev: any, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const pinCode = String(formData.get("pinCode") ?? "").trim();
    if (!pinCode) return { error: "الرمز السري لا يمكن أن يكون فارغاً." };

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: v.preparerId }
    });

    if (!preparer) return { error: "المجهز غير موجود." };

    await prisma.companyPreparer.update({
      where: { id: v.preparerId },
      data: { salaryPinCode: pinCode, salaryPinDisabled: false }
    });

    return { ok: true };
  } catch (e) {
    console.error("enablePreparerSalaryPinCode error:", e);
    return { error: "فشل تفعيل الرمز السري." };
  }
}

// أكشن سحب واستلام الراتب
export async function withdrawPreparerSalary(_prev: any, formData: FormData): Promise<{ ok?: boolean; error?: string; withdrawnAmount?: number }> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const pinCode = String(formData.get("pinCode") ?? "").trim();

    await ensurePreparerSalaryConfigColumnsIfMissing();

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: v.preparerId },
      select: { 
        name: true,
        salaryPinCode: true,
        salaryPinDisabled: true,
        walletEmployeeId: true,
        telegramUserId: true,
        salaryWithdrawalTime: true,
        bypassWithdrawalTime: true
      }
    });

    if (!preparer) return { error: "المجهز غير موجود." };

    // نتحقق من الرمز فقط إذا لم يكن قد أوقفه المجهز
    if (!preparer.salaryPinDisabled) {
      if (!pinCode) return { error: "الرمز السري مطلوب." };
      if (!preparer.salaryPinCode) return { error: "يرجى تعيين رمز سري أولاً." };
      if (preparer.salaryPinCode !== pinCode) return { error: "الرمز السري غير صحيح." };
    }

    if (!preparer.walletEmployeeId) {
      return { error: "المحفظة غير مفعلة لحسابك. يرجى مراجعة الإدارة." };
    }

    const stats = await calculateAccumulatedSalaryInternal(v.preparerId);
    const iraqNow = getIraqTime(new Date());
    
    const nowMinutes = iraqNow.hours * 60 + iraqNow.minutes;
    const withdrawalStr = preparer.salaryWithdrawalTime || "20:00";
    const [wH, wM] = withdrawalStr.split(":").map(Number);
    const withdrawalMinutes = wH * 60 + wM;

    const isBeforeWithdrawalTime = preparer.bypassWithdrawalTime ? false : nowMinutes < withdrawalMinutes;

    let withdrawableSalary = stats.accumulatedSalary;
    if (isBeforeWithdrawalTime) {
      withdrawableSalary = Math.max(0, stats.accumulatedSalary - stats.todaySalary);
    }

    const amountDinar = new Decimal(withdrawableSalary);

    if (amountDinar.lte(0)) {
      if (isBeforeWithdrawalTime && stats.todaySalary > 0) {
        return {
          error: `راتبك اليوم ${stats.todaySalary} الف وراتبك التراكمي ${stats.accumulatedSalary} الف. الراتب المتاح للسحب حالياً هو ${withdrawableSalary} الف. انتظر لتصبح الساعة ${withdrawalStr} لكي تستلم التراكمي بأكمله.`
        };
      }
      return { error: "لا يوجد راتب متراكم متاح للاستلام حالياً." };
    }

    // إجراء العملية في قاعدة البيانات
    await prisma.$transaction(async (tx) => {
      // 1. تسجيل العملية المالية في محفظة الموظف كخصم (راتب مستلم) ببادئة مميزة [راتب] - تم تغييرها إلى give لخصم الرصيد بشكل صحيح
      await tx.employeeWalletMiscEntry.create({
        data: {
          employeeId: preparer.walletEmployeeId!,
          direction: "give",
          amountDinar: amountDinar,
          label: `[راتب] استلام راتب المجهز للشفتات المتراكمة`,
        }
      });

      // 2. تحديث تاريخ آخر عملية استلام للوقت الحالي
      await tx.companyPreparer.update({
        where: { id: v.preparerId },
        data: { lastSalaryWithdrawalAt: new Date() }
      });
    });

    // جلب المتبقي في المحفظة للمجهز بعد الخصم
    const totals = await getPreparerMoneyTotals(v.preparerId);
    const remainStr = totals ? formatDinarAsAlfWithUnit(totals.remain) : "0";
    const amountStr = formatDinarAsAlfWithUnit(amountDinar);

    // إرسال الإشعارات لبوتات تليجرام
    try {
      const msg = [
        `💵 <b>سحب راتب مجهز</b>`,
        `👤 <b>المجهز:</b> ${escapeTelegramHtml(preparer.name)}`,
        `💰 <b>المبلغ المسحوب:</b> ${amountStr}`,
        `💼 <b>المتبقي بالمحفظة:</b> ${remainStr}`,
        `📅 <b>التاريخ:</b> \u200E${new Date().toLocaleString("ar-IQ")}\u200E`
      ].join("\n");

      const notificationBotToken = await getBotTokenByPurpose("notification");
      const managementBotToken = await getBotTokenByPurpose("management");
      const preparerBotToken = await getBotTokenByPurpose("preparer");

      // 1. إشعار جروب تليجرام (بوت الإشعارات)
      if (notificationBotToken) {
        await sendTelegramMessage(msg, { botToken: notificationBotToken });
      }

      // 2. إشعار بوت الإدارة
      if (managementBotToken && managementBotToken !== notificationBotToken) {
        await sendTelegramMessage(msg, { botToken: managementBotToken });
      }

      // 3. إشعار المجهز نفسه (بوت المجهزين)
      if (preparerBotToken && preparer.telegramUserId) {
        await sendTelegramHtmlToChat(preparer.telegramUserId, `✅ <b>تم استلام راتبك بنجاح!</b>\n\n${msg}`, preparerBotToken);
      }
    } catch (notifErr) {
      console.error("Telegram notification for salary withdrawal failed:", notifErr);
    }

    revalidatePath("/preparer");
    revalidatePath("/preparer/wallet");
    return { ok: true, withdrawnAmount: withdrawableSalary };
  } catch (e) {
    console.error("withdrawPreparerSalary error:", e);
    return { error: "فشل استلام الراتب بسبب خطأ تقني." };
  }
}

// أكشن التحقق من صحة الرمز السري للمجهز قبل فتح صفحة الراتب
export async function verifyPreparerSalaryPinCode(_prev: any, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  try {
    const v = readPortal(formData);
    if (!v.ok) return { error: "الرابط غير صالح." };

    const pinCode = String(formData.get("pinCode") ?? "").trim();
    if (!pinCode) return { error: "الرمز السري مطلوب." };

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: v.preparerId }
    });

    if (!preparer) return { error: "المجهز غير موجود." };
    if (!preparer.salaryPinCode) return { error: "لا يوجد رمز سري معين حالياً." };
    if (preparer.salaryPinCode !== pinCode) return { error: "الرمز السري غير صحيح." };

    return { ok: true };
  } catch (e) {
    console.error("verifyPreparerSalaryPinCode error:", e);
    return { error: "خطأ في التحقق من الرمز." };
  }
}


