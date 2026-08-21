import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { normalizeAdminShopName } from "@/lib/admin-order-from-admin-constants";
import {
  isSaderMismatch,
  isWardMismatch,
  sumDeliveryInFromOrderMoneyEvents,
  sumPickupOutFromOrderMoneyEvents,
} from "@/lib/mandoub-money";
import { getGlobalIcons } from "@/lib/icon-settings";
import { serializePrisma } from "@/lib/serialize-prisma";
import { normalizeIraqMobileLocal11, whatsappMeUrl } from "@/lib/whatsapp";
import { applyMandoubWaTemplate, splitMandoubWaTemplateVariants } from "@/lib/mandoub-wa-button-template";
import PendingOrdersClient, { type PendingOrderRow } from "./pending-orders-client";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";
const SYSTEM_ADMIN_PHONE = "07733921568";

// Keep data fresh while allowing fast back/forward navigation cache.
export const revalidate = 15;

export const metadata = {
  title: "Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø·Ù„Ø¨Ø§Øª ÙˆØ§Ù„ØªØ¬Ù‡ÙŠØ² â€” Ø£Ø¨Ùˆ Ø§Ù„Ø£ÙƒØ¨Ø± Ù„Ù„ØªÙˆØµÙŠÙ„",
};

function customerOrderTimeLabel(orderNoteTime: string | null): string {
  if (!orderNoteTime?.trim()) return "â€”";
  const t = orderNoteTime.trim();
  return t.replace(/^ÙˆÙ‚Øª Ø§Ù„Ø·Ù„Ø¨:\s*/i, "").trim() || t;
}

type PageProps = { searchParams: Promise<{ tab?: string; assignOrder?: string; pricing?: string; fishPrices?: string }> };

export default async function PendingOrdersPage({ searchParams }: PageProps) {
  try {
    const sp = await searchParams;
    const assignOrder = (sp.assignOrder ?? "").trim();
    const pricingId = (sp.pricing ?? "").trim();
    const showFishPrices = sp.fishPrices === "true";

    // ØªØ­Ø¯ÙŠØ¯ Ø§Ù„ØªØ¨ÙˆÙŠØ¨ Ø§Ù„ÙØ¹Ù„ÙŠ Ù‚Ø¨Ù„ Ø¬Ù„Ø¨ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª
    const assignOrderExistsInPrepared = assignOrder ? await prisma.order.count({ where: { id: assignOrder, submissionSource: "company_preparer" } }) > 0 : false;
    const activeTab = sp.tab ?? (assignOrderExistsInPrepared ? "completed" : "new");

    // 1. Ø¬Ù„Ø¨ Ø§Ù„Ù…Ø³ÙˆØ¯Ø§Øª Ø¯Ø§Ø¦Ù…Ø§Ù‹ (Ù†Ø­ØªØ§Ø¬Ù‡Ø§ Ù„Ø­Ø³Ø§Ø¨ Ø¹Ø¯Ø¯ Ø§Ù„Ù…Ø³ÙˆØ¯Ø§Øª Ø§Ù„Ù…Ø¬Ù…Ø¹Ø© Ø¨Ø¯Ù‚Ø© ÙÙŠ Ø§Ù„ØªØ¨ÙˆÙŠØ¨)
    const draftsPromise = prisma.companyPreparerShoppingDraft.findMany({
      where: { status: { in: ["draft", "priced"] } },
      include: {
        preparer: { select: { id: true, name: true } },
        customerRegion: { select: { id: true, name: true, deliveryPrice: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });

    let pendingOrdersPromise: Promise<any[]> = Promise.resolve([]);
    let newCountPromise: Promise<number> = Promise.resolve(0);
    let preparedCountPromise: Promise<number> = Promise.resolve(0);

    pendingOrdersPromise = prisma.order.findMany({
      where: {
        OR: [
          { status: "pending" },
          ...(assignOrder ? [{ id: assignOrder }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        shop: { select: { id: true, name: true, region: { select: { id: true, name: true } } } },
        submittedBy: { select: { id: true, name: true } },
        submittedByCompanyPreparer: { select: { id: true, name: true } },
        customerRegion: { select: { id: true, name: true } },
        secondCustomerRegion: { select: { id: true, name: true } },
        customer: { select: { id: true, customerLocationUrl: true, customerLandmark: true, customerDoorPhotoUrl: true, alternatePhone: true } },
        moneyEvents: { where: { deletedAt: null }, select: { kind: true, amountDinar: true, courierId: true, recordedByCompanyPreparerId: true } },
      },
    });

    const [
      allActiveDrafts,
      allPendingOrders,
      newCountRaw,
      preparedCountRaw,
      couriers,
      shops,
      preparers,
      icons,
      waButtons,
      storeProducts,
      fishPricesSetting
    ] = await Promise.all([
      draftsPromise,
      pendingOrdersPromise,
      newCountPromise,
      preparedCountPromise,
      prisma.courier.findMany({
        where: courierAssignableWhere,
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.shop.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.companyPreparer.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      }),
      getGlobalIcons(),
      prisma.mandoubWaButtonSetting.findMany({
        where: { isActive: true },
      }),
      // Ø¬Ù„Ø¨ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª ÙÙ‚Ø· Ø¹Ù†Ø¯ Ø§Ù„Ø­Ø§Ø¬Ø© Ù„ØªØ®ÙÙŠÙ Ø§Ù„Ø¶ØºØ·
      activeTab === "preparing" ? prisma.storeProduct.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          salePrice: true,
          photoUrls: true,
          branch: { select: { name: true } },
          hasVariants: true,
          variants: {
            where: { active: true },
            select: { id: true, name: true, salePrice: true }
          }
        }
      }) : Promise.resolve([]),
      prisma.uISystemSetting.findUnique({
        where: {
          target_section: { target: "system", section: "fish_prices" }
        }
      })
    ]);

    const fishPricesRaw = (fishPricesSetting?.config as any)?.rawText || "";

    // ØªÙ‚Ø³ÙŠÙ… Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø¨Ø±Ù…Ø¬ÙŠØ§Ù‹
    const newOrders = allPendingOrders;
    const preparedOrders = allPendingOrders.filter(o => o.submissionSource === "company_preparer");

    // Ø¬Ù„Ø¨ Ø§Ù„Ø¨Ø±ÙˆÙØ§ÙŠÙ„Ø§Øª Ù„Ø²Ø¨Ø§Ø¦Ù† Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù…Ø¹Ù„Ù‚Ø© Ù„Ø¶Ù…Ø§Ù† Ø§Ø³ØªØ±Ø¬Ø§Ø¹ Ø§Ù„Ø¥Ø­Ø¯Ø§Ø«ÙŠØ§Øª ÙˆØ§Ù„Ø¨Ø§Ø¨ ÙˆØ§Ù„landmark
    const pendingPhones = Array.from(new Set(
      allPendingOrders
        .map(o => o.customerPhone ? normalizeIraqMobileLocal11(o.customerPhone) : null)
        .filter(Boolean)
    )) as string[];

    const profiles = pendingPhones.length > 0 ? await prisma.customerPhoneProfile.findMany({
      where: { phone: { in: pendingPhones } },
      select: {
        id: true,
        phone: true,
        regionId: true,
        photoUrl: true,
        locationUrl: true,
        landmark: true,
        alternatePhone: true,
      }
    }) : [];

    const phoneProfilesRegionMap = new Map<string, typeof profiles[number]>();
    const phoneProfilesOnlyMap = new Map<string, typeof profiles[number]>();

    for (const p of profiles) {
      if (p.regionId) {
        phoneProfilesRegionMap.set(`${p.phone}::${p.regionId}`, p);
      }
      const existing = phoneProfilesOnlyMap.get(p.phone);
      if (!existing || (p.locationUrl && !existing.locationUrl)) {
        phoneProfilesOnlyMap.set(p.phone, p);
      }
    }

    // ØªØ­ÙˆÙŠÙ„ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø¥Ù„Ù‰ JSON Ù„Ø¶Ù…Ø§Ù† Ø§Ù„ØªÙˆØ§ÙÙ‚ Ù…Ø¹ Next.js 15 (Serialization safety)
    const safeAllActiveDrafts = serializePrisma(allActiveDrafts);
    const safeNewOrders = serializePrisma(newOrders);
    const safePreparedOrders = serializePrisma(preparedOrders);
    const safeCouriers = serializePrisma(couriers);
    const safeShops = serializePrisma(shops);
    const safePreparers = serializePrisma(preparers);
    const safeStoreProducts = serializePrisma(storeProducts);

    const draftsBySentOrderId = new Map<string, typeof safeAllActiveDrafts>();
    const draftsByCustomerPhone = new Map<string, typeof safeAllActiveDrafts>();
    const draftsGroupedByKey = new Map<string, typeof safeAllActiveDrafts>();

    for (const draft of safeAllActiveDrafts) {
      if (draft.sentOrderId) {
        const list = draftsBySentOrderId.get(draft.sentOrderId) ?? [];
        list.push(draft);
        draftsBySentOrderId.set(draft.sentOrderId, list);
      }

      const phoneKey = draft.customerPhone?.trim() ?? "";
      if (phoneKey) {
        const list = draftsByCustomerPhone.get(phoneKey) ?? [];
        list.push(draft);
        draftsByCustomerPhone.set(phoneKey, list);
      }

      const draftData = (draft.data as any) || {};
      const groupId = typeof draftData.groupId === "string" ? draftData.groupId.trim() : "";
      const phoneLocal = normalizeIraqMobileLocal11(draft.customerPhone) || draft.customerPhone;
      const phoneKeyForGroup = phoneLocal?.trim() ?? "";
      const titleKey = draft.titleLine?.trim() ?? "";
      
      const isStoreOrder = titleKey.includes("Ø§Ù„Ù…ØªØ¬Ø±");
      const groupingKey = groupId || (isStoreOrder ? `store_${draft.id}` : `${phoneKeyForGroup}::${titleKey}`);
      
      if (!draftsGroupedByKey.has(groupingKey)) {
        draftsGroupedByKey.set(groupingKey, []);
      }
      const groupedList = draftsGroupedByKey.get(groupingKey) ?? [];
      groupedList.push(draft);
      draftsGroupedByKey.set(groupingKey, groupedList);
    }

    const mapOrderToRow = (o: any): PendingOrderRow => {
      const sentRelatedDrafts = draftsBySentOrderId.get(o.id) ?? [];
      const phoneRelatedDrafts = (draftsByCustomerPhone.get(o.customerPhone) ?? []).filter((d) => d.status === "draft");
      const relatedDrafts = [...sentRelatedDrafts, ...phoneRelatedDrafts];
      const assignedPreparerIds = Array.from(new Set([
          ...(o.submittedByCompanyPreparerId ? [o.submittedByCompanyPreparerId] : []),
          ...relatedDrafts.map(d => d.preparerId)
      ].filter(Boolean))) as string[];

      const normPhone = o.customerPhone ? normalizeIraqMobileLocal11(o.customerPhone) : null;
      let phoneProfile = null;
      if (normPhone) {
        if (o.customerRegionId) {
          phoneProfile = phoneProfilesRegionMap.get(`${normPhone}::${o.customerRegionId}`) || null;
        }
        if (!phoneProfile) {
          phoneProfile = phoneProfilesOnlyMap.get(normPhone) || null;
        }
      }

      const isDoubleRoute = o.routeMode === "double" || !!o.secondCustomerPhone;
      const customerLocationUrl = o.customerLocationUrl || o.customer?.customerLocationUrl || phoneProfile?.locationUrl || "";
      const customerLandmark = o.customerLandmark || o.customer?.customerLandmark || phoneProfile?.landmark || "";
      const customerAlternatePhone = isDoubleRoute
        ? (o.alternatePhone?.trim() || o.customer?.alternatePhone?.trim() || phoneProfile?.alternatePhone || "")
        : (o.secondCustomerPhone?.trim() || o.alternatePhone?.trim() || o.customer?.alternatePhone?.trim() || phoneProfile?.alternatePhone || "");

      // Ø­Ø³Ø§Ø¨ Ø±Ø§Ø¨Ø· Ø·Ù„Ø¨ Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ø§Ù„Ø¬ØºØ±Ø§ÙÙŠ ÙˆØ±Ø§Ø¨Ø· ØªØ¨Ù„ÙŠØº Ø§Ù„Ø²Ø¨ÙˆÙ†
      const requestLocationBtn = waButtons.find(b => 
        b.label.includes("Ø·Ù„Ø¨ Ù„ÙˆÙƒÙŠØ´Ù†") || 
        b.label.includes("Ø·Ù„Ø¨ Ù„ÙƒÙŠØ´Ù†") || 
        b.label.includes("Ø·Ù„Ø¨ Ø§Ù„Ù…ÙˆÙ‚Ø¹") ||
        b.label.includes("Ù„ÙˆÙƒÙŠØ´Ù†") ||
        b.label.includes("Ù„ÙƒÙŠØ´Ù†")
      );
      const notifyCustomerBtn = waButtons.find(b => 
        b.label.includes("ØªØ¨Ù„ÙŠØº Ø²Ø¨ÙˆÙ†") || 
        b.label.includes("ØªØ¨Ù„ÙŠØº") || 
        b.label.includes("Ø¥Ø´Ø¹Ø§Ø±") ||
        b.label.includes("Ø§Ø´Ø¹Ø§Ø±")
      );
      let requestLocationWaUrl = null;
      let notifyCustomerWaUrl = null;

      const submitterPhone = o.submittedByCompanyPreparer?.phone || o.submittedBy?.phone || o.shop?.phone || SYSTEM_ADMIN_PHONE;
      const vars = {
        clientshop: o.shop?.name || "",
        city: o.customerRegion?.name || "",
        total_price: o.totalAmount != null ? formatDinarAsAlfWithUnit(o.totalAmount) : "",
        location_url: customerLocationUrl,
        order_number: String(o.orderNumber),
        customer_phone: o.customerPhone,
        shop_phone: submitterPhone,
      };

      if (requestLocationBtn && o.customerPhone) {
        const message = splitMandoubWaTemplateVariants(requestLocationBtn.templateText || "")
          .map(t => applyMandoubWaTemplate(t, vars))[0] || "";
        requestLocationWaUrl = whatsappMeUrl(o.customerPhone, message);
      }

      if (notifyCustomerBtn && o.customerPhone) {
        const message = splitMandoubWaTemplateVariants(notifyCustomerBtn.templateText || "")
          .map(t => applyMandoubWaTemplate(t, vars))[0] || "";
        notifyCustomerWaUrl = whatsappMeUrl(o.customerPhone, message);
      }

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        routeMode: o.routeMode === "double" ? "double" : "single",
        shopName: o.routeMode === "double"
          ? `Ù…Ù† ${o.customerRegion?.name ?? "ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ"} Ø¥Ù„Ù‰ ${o.secondCustomerRegion?.name ?? "ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ"}`
          : normalizeAdminShopName(o.shop?.name ?? "ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ"),
        secondCustomerRegionName: o.secondCustomerRegion?.name || null,
        regionName: o.customerRegion?.name ?? o.shop?.region?.name ?? "â€”",
        orderType: o.orderType?.trim() ? o.orderType : "â€”",
        customerOrderTime: customerOrderTimeLabel(o.orderNoteTime),
        createdAtLabel: formatBaghdadDateTime(o.createdAt, { dateStyle: "short", timeStyle: "short" }),
        summary: o.summary,
        customerPhone: o.customerPhone,
        customerAlternatePhone,
        customerDoorPhotoUrl: resolvePublicAssetSrc(o.customer?.customerDoorPhotoUrl || o.customerDoorPhotoUrl || phoneProfile?.photoUrl) ?? "",
        totalAmount: o.totalAmount != null ? formatDinarAsAlfWithUnit(o.totalAmount) : null,
        deliveryPrice: o.deliveryPrice != null ? formatDinarAsAlfWithUnit(o.deliveryPrice) : null,
        orderSubtotal: o.orderSubtotal != null ? formatDinarAsAlfWithUnit(o.orderSubtotal) : null,
        rawDeliveryPriceDinar: o.deliveryPrice != null ? Number(o.deliveryPrice) : null,
        submittedByName: o.submittedByCompanyPreparer?.name || o.submittedBy?.name || null,
        submissionLabel: o.submissionSource === "company_preparer" ? "Ù…ÙƒØªÙ…Ù„ Ø§Ù„ØªØ¬Ù‡ÙŠØ²" : o.submissionSource === "web_store" ? "Ø·Ù„Ø¨ Ù…ØªØ¬Ø±" : o.submissionSource === "admin_on_behalf_of_employee" ? "Ø·Ù„Ø¨ Ù…ÙˆØ¸Ù (Ø¨ÙˆØª)" : "Ø·Ù„Ø¨ Ø¬Ø¯ÙŠØ¯",
        customerLocationUrl: customerLocationUrl,
        customerLandmark: o.customerLandmark || o.customer?.customerLandmark || phoneProfile?.landmark || "",
        secondCustomerLocationUrl: o.secondCustomerLocationUrl || "",
        secondCustomerLandmark: o.secondCustomerLandmark || "",
        secondCustomerDoorPhotoUrl: o.secondCustomerDoorPhotoUrl || "",
        voiceNoteUrl: o.voiceNoteUrl || null,
        adminVoiceNoteUrl: o.adminVoiceNoteUrl || null,
        hasCustomerLocation: hasCustomerLocationUrl(customerLocationUrl),
        hasCourierUploadedLocation: Boolean(o.customerLocationSetByCourierAt),
        reversePickup: isReversePickupOrderType(o.orderType),
        wardMismatchType: isWardMismatch(o.status, o.totalAmount, sumDeliveryInFromOrderMoneyEvents(o.moneyEvents)).type,
        saderMismatchType: isSaderMismatch(o.status, o.orderSubtotal, sumPickupOutFromOrderMoneyEvents(o.moneyEvents)).type,
        preparerShoppingJson: o.preparerShoppingJson,
        vehiclePreference: o.vehiclePreference,
        assignedPreparerIds,
        requestLocationWaUrl,
        notifyCustomerWaUrl,
      };
    };

    const mapDraftToRow = (d: any): PendingOrderRow => {
      const draftData = (d.data as any) || {};
      const groupId = typeof draftData.groupId === "string" ? draftData.groupId.trim() : "";
      const isStoreOrder = (d.titleLine?.trim() || "").includes("Ø§Ù„Ù…ØªØ¬Ø±");
      const fallbackGroupKey = isStoreOrder ? `store_${d.id}` : `${d.customerPhone?.trim() ?? ""}::${d.titleLine?.trim() ?? ""}`;
      const related = draftsGroupedByKey.get(groupId || fallbackGroupKey) ?? [d];

      const assignedPreparerIds = Array.from(new Set(related.map(r => r.preparerId).filter(Boolean))) as string[];
      const preparerNames = Array.from(new Set(related.map(r => r.preparer?.name).filter(Boolean))).join(" + ") || "Ø¨Ø§Ù†ØªØ¸Ø§Ø± Ù…Ø¬Ù‡Ø²";

      const mergedProducts: any[] = [];
      related.forEach(rd => {
          const rdData = (rd.data as any) || {};
          const products = Array.isArray(rdData.products) ? rdData.products : [];
          products.forEach((p: any) => {
              const existing = mergedProducts.find(m => m.line === p.line);
              const isPriced = p.buyAlf && p.buyAlf !== "0";
              if (existing) {
                  if ((!existing.buyAlf || existing.buyAlf === "0") && isPriced) {
                      existing.buyAlf = p.buyAlf;
                      existing.sellAlf = p.sellAlf;
                      existing.pricedBy = rd.preparer?.name || "Ù…ØªØ¬Ø± Ø§Ù„ÙˆÙŠØ¨";
                  }
              } else {
                  mergedProducts.push({ ...p, pricedBy: isPriced ? (rd.preparer?.name || "Ù…ØªØ¬Ø± Ø§Ù„ÙˆÙŠØ¨") : null });
              }
          });
      });

      return {
        id: d.id,
        orderNumber: Number((draftData as any)?.reservedOrderNumber || d.draftNumber || 0),
        routeMode: "single",
        shopName: "ØªØ¬Ù‡ÙŠØ² ØªØ³ÙˆÙ‚ Ù…Ø´ØªØ±Ùƒ",
        regionName: d.customerRegion?.name || "â€”",
        orderType: d.titleLine || "ØªØ¬Ù‡ÙŠØ² ØªØ³ÙˆÙ‚",
        customerOrderTime: d.orderTime,
        createdAtLabel: formatBaghdadDateTime(d.createdAt, { dateStyle: "short", timeStyle: "short" }),
        summary: d.rawListText,
        customerPhone: d.customerPhone,
        customerAlternatePhone: "",
        customerDoorPhotoUrl: "",
        totalAmount: null,
        deliveryPrice: d.customerRegion?.deliveryPrice ? formatDinarAsAlfWithUnit(d.customerRegion.deliveryPrice) : null,
        rawDeliveryPriceDinar: d.customerRegion?.deliveryPrice != null ? Number(d.customerRegion.deliveryPrice) : null,
        submittedByName: preparerNames,
        submissionLabel: "Ù…Ø³ÙˆØ¯Ø© Ù…Ø´ØªØ±ÙƒØ©",
        customerLocationUrl: "",
        customerLandmark: d.customerLandmark,
        hasCustomerLocation: false,
        hasCourierUploadedLocation: false,
        preparerShoppingJson: {
            ...draftData,
            products: mergedProducts,
            isMerged: true,
            relatedIds: related.map(r => r.id),
            groupId: groupId
        },
        vehiclePreference: d.vehiclePreference,
        assignedPreparerIds,
      };
    };

    const newRows = serializePrisma(newOrders.map(mapOrderToRow));
    const preparedRows = serializePrisma(preparedOrders.map(mapOrderToRow));

    const groupedDraftRows: PendingOrderRow[] = [];
    const processedDraftIds = new Set<string>();

    for (const d of allActiveDrafts) {
      if (processedDraftIds.has(d.id)) continue;

      const draftData = (d.data as any) || {};
      const groupId = typeof draftData.groupId === "string" ? draftData.groupId.trim() : "";
      const isStoreOrder = (d.titleLine?.trim() || "").includes("المتجر"); const fallbackGroupKey = isStoreOrder ? `store_${d.id}` : `${d.customerPhone?.trim() ?? ""}::${d.titleLine?.trim() ?? ""}`;
      const related = draftsGroupedByKey.get(groupId || fallbackGroupKey) ?? [d];

      related.forEach(r => processedDraftIds.add(r.id));
      groupedDraftRows.push(mapDraftToRow(d));
    }

    const safeGroupedDraftRows = serializePrisma(groupedDraftRows);
    const safeIcons = serializePrisma(icons);
    
    const finalNewCount = activeTab === "new" || activeTab === "completed" ? newRows.length : newCountRaw;
    const finalPreparedCount = activeTab === "new" || activeTab === "completed" ? preparedRows.length : preparedCountRaw;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className={ad.h1}>Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø·Ù„Ø¨Ø§Øª ÙˆØ§Ù„ØªØ¬Ù‡ÙŠØ²</h1>
          <div className="flex gap-2 flex-wrap">
             <Link href="?fishPrices=true" className="px-5 py-2.5 text-xs font-black rounded-xl bg-gradient-to-r from-sky-500 to-indigo-650 hover:from-sky-600 hover:to-indigo-700 text-white shadow-md active:scale-95 transition-all flex items-center gap-1 shrink-0">ðŸŸ Ø£Ø³Ø¹Ø§Ø± Ø§Ù„Ø³Ù…Ùƒ Ø§Ù„ÙŠÙˆÙ…ÙŠØ©</Link>
             <Link href={`${SECRET_ADMIN_PATH}/orders/tracking`} className={ad.btnDark}>ØªØªØ¨Ø¹ Ø§Ù„Ø·Ù„Ø¨Ø§Øª</Link>
             <Link href={`${SECRET_ADMIN_PATH}/preparation-orders`} className={ad.btnDark}>Ø³Ø¬Ù„ Ø§Ù„ØªØ¬Ù‡ÙŠØ²</Link>
             <Link href={`${SECRET_ADMIN_PATH}/orders/new`} className={ad.btnPrimary}>+ Ø·Ù„Ø¨ Ø¥Ø¯Ø§Ø±ÙŠ Ø¬Ø¯ÙŠØ¯</Link>
          </div>
        </div>

        <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
          <Link href="?tab=new" className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === 'new' ? 'border-sky-600 text-sky-700 bg-sky-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© ({finalNewCount})
          </Link>
          <Link href="?tab=preparing" className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === 'preparing' ? 'border-amber-500 text-amber-700 bg-amber-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            Ù‚ÙŠØ¯ Ø§Ù„ØªØ¬Ù‡ÙŠØ² ({safeGroupedDraftRows.length})
          </Link>
          <Link href="?tab=completed" className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === 'completed' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            Ù…ÙƒØªÙ…Ù„ Ø§Ù„ØªØ¬Ù‡ÙŠØ² ({finalPreparedCount})
          </Link>
        </div>

        {activeTab === "new" && (
          <div className="space-y-4">
            <PendingOrdersClient orders={newRows} couriers={safeCouriers} shops={safeShops} preparers={safePreparers} icons={safeIcons} storeProducts={safeStoreProducts} initialAssignOrderId={activeTab === 'new' ? assignOrder : null} initialPricingId={pricingId} fishPricesRaw={fishPricesRaw} initialShowFishPrices={showFishPrices} />
          </div>
        )}

        {activeTab === "preparing" && (
          <div className="space-y-4">
            {safeGroupedDraftRows.length === 0 ? (
              <p className="text-center py-12 text-slate-400">Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø³ÙˆØ¯Ø§Øª Ù‚ÙŠØ¯ Ø§Ù„ØªØ¬Ù‡ÙŠØ² Ø­Ø§Ù„ÙŠØ§Ù‹.</p>
            ) : (
              <div className="grid gap-3">
                <PendingOrdersClient orders={safeGroupedDraftRows} couriers={safeCouriers} shops={safeShops} preparers={safePreparers} icons={safeIcons} storeProducts={safeStoreProducts} isDraftMode initialPricingId={pricingId} fishPricesRaw={fishPricesRaw} initialShowFishPrices={showFishPrices} />
              </div>
            )}
          </div>
        )}

        {activeTab === "completed" && (
          <div className="space-y-4">
            <PendingOrdersClient orders={preparedRows} couriers={safeCouriers} shops={safeShops} preparers={safePreparers} icons={safeIcons} storeProducts={safeStoreProducts} initialAssignOrderId={activeTab === 'completed' ? assignOrder : null} initialPricingId={pricingId} fishPricesRaw={fishPricesRaw} initialShowFishPrices={showFishPrices} />
          </div>
        )}
      </div>
    );
  } catch (err: any) {
    return (
      <div className="p-8 space-y-4 bg-red-50 text-red-900 min-h-screen" dir="ltr">
        <h1 className="text-2xl font-bold">Runtime Error in PendingOrdersPage</h1>
        <p>Please screenshot this page and show it to the developer.</p>
        <pre className="bg-slate-900 text-red-400 p-4 rounded overflow-auto whitespace-pre-wrap text-sm">
          {err.stack || err.message || String(err)}
        </pre>
      </div>
    );
  }
}

