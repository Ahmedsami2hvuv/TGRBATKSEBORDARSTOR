"use server";
// v4-bulletproof-fix: ضمان الحفظ الفوري ومنع التضارب بين المجهزين + توزيع الفواتير + حماية الملكية التامة

import { CourierWalletMiscDirection, Prisma, PreparerShoppingDraftStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { ALF_PER_DINAR, parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import {
  buildCustomerInvoiceText,
  buildPreparerPurchaseSummaryText,
} from "@/lib/preparation-invoice";
import { calculateAutoSellPrice, isMeatProduct } from "@/lib/auto-pricing";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import { prisma } from "@/lib/prisma";
import { transferOrderToCourierInternal } from "@/lib/order-assign-courier";
import { MAX_ORDER_IMAGE_BYTES, saveOrderImageUploaded, saveShopDoorPhotoUploaded } from "@/lib/order-image";
import { deleteFromR2 } from "@/lib/upload-storage";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { notifyTelegramNewOrder } from "@/lib/telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "@/lib/web-push-server";
import { ADMIN_OFFICE_LABEL, ADMIN_SHOP_NAMES } from "@/lib/admin-order-from-admin-constants";

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
        relatedDrafts = await prisma.companyPreparerShoppingDraft.findMany({
            where: { data: { path:["groupId"], equals: groupId } }
        });
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

    const newStatus = mergedProducts.every((p: any) => p.buyAlf != null && p.buyAlf !== "") ? "priced" : "draft";

    const titleLine = String(formData.get("titleLine") ?? draft.titleLine);
    const customerPhone = String(formData.get("customerPhone") ?? draft.customerPhone);
    const customerName = String(formData.get("customerName") ?? draft.customerName);
    const customerLandmark = String(formData.get("customerLandmark") ?? draft.customerLandmark);
    const orderTime = String(formData.get("orderTime") ?? draft.orderTime);

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
                    products: mergedProducts,
                    customDeliveryAlf,
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
    const products = data.products as any[];
    if (!products || products.some(p => p.buyAlf == null || p.buyAlf === "")) return { error: "أكمل تسعير جميع المواد." };

    const systemShopInfo = await getOrCreateSystemAdminShop();
    const shop = await prisma.shop.findUnique({ where: { id: systemShopInfo.id }, include: { region: true } });
    const custRegion = await prisma.region.findUnique({ where: { id: draft.customerRegionId! } });
    if (!shop || !custRegion) return { error: "خطأ في بيانات المحل أو المنطقة." };

    const placesCount = draft.placesCount || 1;
    const draftData = draft.data as any;
    const customDeliveryAlf = draftData?.customDeliveryAlf;

    const defaultDelivery = Decimal.max(shop.region.deliveryPrice, custRegion.deliveryPrice);
    const delivery = (customDeliveryAlf != null && Number.isFinite(Number(customDeliveryAlf)))
        ? new Decimal(customDeliveryAlf).mul(ALF_PER_DINAR)
        : defaultDelivery;

    const sumSellAlf = products.reduce((acc, p) => acc + Number(p.sellAlf), 0);
    const extraAlf = calculateExtraAlfFromPlacesCount(placesCount);
    const subtotal = new Decimal(sumSellAlf + extraAlf).mul(ALF_PER_DINAR);
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

    const order = await prisma.order.create({
      data: {
        shopId: shop.id,
        status: "pending",
        orderType: "تجهيز تسوق",
        customerPhone: draft.customerPhone,
        customerRegionId: draft.customerRegionId,
        customerLandmark: draft.customerLandmark,
        orderNoteTime: draft.orderTime,
        deliveryPrice: delivery,
        orderSubtotal: subtotal,
        totalAmount: total,
        submissionSource: "company_preparer",
        submittedByCompanyPreparerId: null, // طلب إداري (ليس لمجهز معين)
        summary: formatBorderedSummarySection("المنتجات حسب المجهز", summaryParts.join("\n\n═══════════════\n\n")),
        preparerShoppingJson: {
          version: 1,
          products,
          placesCount,
          sumSellAlf,
          extraAlf,
          deliveryAlf: Number(delivery) / ALF_PER_DINAR,
          preparerInvoices,
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

    // غلق وتأشير جميع مسودات المجموعة كمرسلة لتجنب الدبلرة
    const groupId = (draft.data as any)?.groupId;
    if (groupId) {
        await prisma.companyPreparerShoppingDraft.updateMany({
            where: { data: { path: ["groupId"], equals: groupId } },
            data: { status: PreparerShoppingDraftStatus.sent, sentOrderId: order.id }
        });
    } else {
        await prisma.companyPreparerShoppingDraft.updateMany({
            where: {
                customerPhone: draft.customerPhone,
                titleLine: draft.titleLine,
                status: { in: ["draft", "priced"] }
            },
            data: { status: PreparerShoppingDraftStatus.sent, sentOrderId: order.id }
        });
    }

    revalidatePath("/preparer");
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
        const customDeliveryAlf = deliveryAlfRaw ? Number(deliveryAlfRaw) : null;

        const draft = await prisma.companyPreparerShoppingDraft.create({
            data: {
                preparerId: v.preparerId,
                titleLine: String(formData.get("titleLine") ?? ""),
                customerPhone: String(formData.get("customerPhone") ?? ""),
                customerName: String(formData.get("customerName") ?? ""),
                customerLandmark: String(formData.get("customerLandmark") ?? ""),
                orderTime: String(formData.get("orderTime") ?? "فوري"),
                customerRegionId,
                rawListText: String(formData.get("rawListText") ?? ""),
                data: {
                    products: productLines.map(line => ({ line, buyAlf: null, sellAlf: null, pricedBy: null, pricedById: null })),
                    customDeliveryAlf: (customDeliveryAlf !== null && !isNaN(customDeliveryAlf)) ? customDeliveryAlf : null
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
    const delivery = defaultDelivery;

    const total = new Decimal(subtotalParsed.value).plus(delivery);

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
        orderImageUploadedByName: imageUrl ? PREPARER_PORTAL_LABEL : null,
        shopDoorPhotoUrl,
        shopDoorPhotoUploadedByName: shopDoorPhotoUrl ? PREPARER_PORTAL_LABEL : null,
      },
    });

    await syncPhoneProfileFromOrder(order.id);
    void notifyTelegramNewOrder(order.id);
    void pushNotifyAdminsNewPendingOrder(order.orderNumber);

    revalidatePath("/preparer");
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
    const preparerInvoiceIds = Array.isArray(orderPrepJson?.preparerInvoices)
      ? orderPrepJson.preparerInvoices
          .map((inv: any) => String(inv?.preparerId ?? ""))
          .filter((id: string) => id !== "")
      : [];

    if (
      order.submittedByCompanyPreparerId !== v.preparerId &&
      !preparerInvoiceIds.includes(v.preparerId)
    ) {
      return { error: "ليس لديك صلاحية تعديل هذا الطلب." };
    }

    const shopId = String(formData.get("shopId") ?? "").trim();
    const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
    const customerPhone = String(formData.get("customerPhone") ?? "").trim();
    const orderTime = String(formData.get("orderTime") ?? "").trim();
    const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
    const titleLine = String(formData.get("titleLine") ?? "").trim() || order.customerRegion?.name || "";

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
        const sellAlf = calculateAutoSellPrice(line, buyAlf);
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
    const sumSellAlf = products.reduce((acc, p) => acc + p.sellAlf, 0);
    const subtotalDinar = new Decimal(sumSellAlf + extraAlf).mul(ALF_PER_DINAR);

    const baseRegionDeliveryDinar = (deliveryPriceOverrideAlf != null && Number.isFinite(deliveryPriceOverrideAlf))
      ? new Decimal(deliveryPriceOverrideAlf).mul(ALF_PER_DINAR)
      : customerRegion.deliveryPrice;

    const deliveryDinar = Decimal.max(shop.region.deliveryPrice, baseRegionDeliveryDinar);
    const totalDinar = subtotalDinar.plus(deliveryDinar);
    const deliveryAlf = Number(deliveryDinar.toString()) / ALF_PER_DINAR;

    const preparerMap = new Map<string, { preparerId: string; preparerName: string; products: any[]; totalBuyAlf: number; totalSellAlf: number }>();
    for (const p of products) {
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

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          shopId: shop.id,
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
            products,
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
              lines: products,
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
    const purchasePriceRaw = String(formData.get("purchasePrice") ?? "").trim();
    const branchId = String(formData.get("branchId") ?? "").trim();

    if (!productId || !purchasePriceRaw || !branchId) return { error: "بيانات ناقصة." };

    const purchasePriceValue = Number(purchasePriceRaw);

    const branch = await prisma.storeBranch.findFirst({
      where: { id: branchId, active: true, authorizedPreparerId: v.preparerId },
    });

    if (!branch) return { error: "الفرع غير موجود أو ليس لديك صلاحية تسعير عليه." };

    const profitMargin = (branch as any).profitMargin ? Number((branch as any).profitMargin) : 0.5;
    const salePriceValue = purchasePriceValue + profitMargin;

    // استخدام SQL مباشر لتجنب أي تداخل مع حقول مفقودة في بريزما
    await prisma.$executeRaw`
      UPDATE "StoreProduct"
      SET "purchasePrice" = ${purchasePriceValue}, "salePrice" = ${salePriceValue}
      WHERE "id" = ${productId} AND "branchId" = ${branchId}
    `;

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
      await prisma.companyPreparerShoppingDraft.updateMany({
        where: { data: { path: ["groupId"], equals: groupId } },
        data: { status: "archived" }
      });
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

    await prisma.order.update({
      where: { id: orderId },
      data: {
        imageUrl: url,
        orderImageUploadedByName: PREPARER_PORTAL_LABEL,
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

    await prisma.order.update({
      where: { id: orderId },
      data: {
        shopDoorPhotoUrl: url,
        shopDoorPhotoUploadedByName: PREPARER_PORTAL_LABEL,
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
      if (p) data.customerPhone = p;
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

    if (orderImg instanceof File && orderImg.size > 0) {
      data.imageUrl = await saveOrderImageUploaded(orderImg, MAX_ORDER_IMAGE_BYTES);
      data.orderImageUploadedByName = PREPARER_PORTAL_LABEL;
    }
    if (shopDoorImg instanceof File && shopDoorImg.size > 0) {
      data.shopDoorPhotoUrl = await saveShopDoorPhotoUploaded(shopDoorImg, MAX_ORDER_IMAGE_BYTES);
      data.shopDoorPhotoUploadedByName = PREPARER_PORTAL_LABEL;
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
export async function setPreparerPresenceFromForm(_prev: PreparerActionState, formData: FormData): Promise<PreparerActionState> { return { ok: true }; }
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
    }

    revalidatePath("/preparer");
    return { ok: true };
  } catch (e: any) {
    console.error("bulkAssignOrdersByPreparer error:", e);
    return { error: `فشل الإسناد: ${e?.message || "خطأ تقني"}` };
  }
}
