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

// Keep data fresh while allowing fast back/forward navigation cache.
export const revalidate = 15;

export const metadata = {
  title: "إدارة الطلبات والتجهيز — أبو الأكبر للتوصيل",
};

function customerOrderTimeLabel(orderNoteTime: string | null): string {
  if (!orderNoteTime?.trim()) return "—";
  const t = orderNoteTime.trim();
  return t.replace(/^وقت الطلب:\s*/i, "").trim() || t;
}

type PageProps = { searchParams: Promise<{ tab?: string; assignOrder?: string; pricing?: string }> };

export default async function PendingOrdersPage({ searchParams }: PageProps) {
  try {
    const sp = await searchParams;
    const activeTab = sp.tab ?? "new";
    const assignOrder = (sp.assignOrder ?? "").trim();
    const pricingId = (sp.pricing ?? "").trim();

    // 1. جلب البيانات الثقيلة أولاً (الطلبات والمسودات)
    const [allActiveDrafts, allPendingOrders] = await Promise.all([
      prisma.companyPreparerShoppingDraft.findMany({
        where: { status: { in: ["draft", "priced"] } },
        include: {
          preparer: { select: { id: true, name: true } },
          customerRegion: { select: { id: true, name: true, deliveryPrice: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 250,
      }),
      prisma.order.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 300,
        include: {
          shop: { select: { id: true, name: true, region: { select: { id: true, name: true } } } },
          submittedBy: { select: { id: true, name: true } },
          submittedByCompanyPreparer: { select: { id: true, name: true } },
          customerRegion: { select: { id: true, name: true } },
          secondCustomerRegion: { select: { id: true, name: true } },
          customer: { select: { id: true, customerLocationUrl: true, customerLandmark: true, customerDoorPhotoUrl: true, alternatePhone: true } },
          moneyEvents: { where: { deletedAt: null }, select: { kind: true, amountDinar: true } },
        },
      }),
    ]);

    // 2. جلب البيانات المساعدة (Metadata) بعد الانتهاء من الثقيلة لتقليل الضغط على الـ Connection Pool
    const [couriers, shops, preparers, icons, waButtons] = await Promise.all([
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
    ]);

    // تقسيم الطلبات برمجياً
    const newOrders = allPendingOrders;
    const preparedOrders = allPendingOrders.filter(o => o.submissionSource === "company_preparer");

    // جلب البروفايلات لزبائن الطلبات المعلقة لضمان استرجاع الإحداثيات والباب والlandmark
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

    // تحويل البيانات إلى JSON لضمان التوافق مع Next.js 15 (Serialization safety)
    const safeAllActiveDrafts = serializePrisma(allActiveDrafts);
    const safeNewOrders = serializePrisma(newOrders);
    const safePreparedOrders = serializePrisma(preparedOrders);
    const safeCouriers = serializePrisma(couriers);
    const safeShops = serializePrisma(shops);
    const safePreparers = serializePrisma(preparers);

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
      const titleKey = draft.titleLine?.trim() ?? "";
      const groupingKey = groupId || `${phoneKey}::${titleKey}`;
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

      const customerLocationUrl = o.customerLocationUrl || o.customer?.customerLocationUrl || phoneProfile?.locationUrl || "";
      const customerLandmark = o.customerLandmark || o.customer?.customerLandmark || phoneProfile?.landmark || "";
      const customerAlternatePhone = o.secondCustomerPhone?.trim() || o.alternatePhone?.trim() || o.customer?.alternatePhone?.trim() || phoneProfile?.alternatePhone || "";

      // حساب رابط طلب الموقع الجغرافي ورابط تبليغ الزبون
      const requestLocationBtn = waButtons.find(b => b.label.includes("طلب لوكيشن") || b.label.includes("طلب الموقع"));
      const notifyCustomerBtn = waButtons.find(b => b.label.includes("تبليغ زبون") || b.label.includes("تبليغ"));
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
          ? `من ${o.customerRegion?.name ?? "غير معروف"} إلى ${o.secondCustomerRegion?.name ?? "غير معروف"}`
          : normalizeAdminShopName(o.shop?.name ?? "غير معروف"),
        secondCustomerRegionName: o.secondCustomerRegion?.name || null,
        regionName: o.customerRegion?.name ?? o.shop?.region?.name ?? "—",
        orderType: o.orderType?.trim() ? o.orderType : "—",
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
        submissionLabel: o.submissionSource === "company_preparer" ? "مكتمل التجهيز" : o.submissionSource === "web_store" ? "طلب متجر" : o.submissionSource === "admin_on_behalf_of_employee" ? "طلب موظف (بوت)" : "طلب جديد",
        customerLocationUrl: customerLocationUrl,
        customerLandmark: o.customerLandmark || o.customer?.customerLandmark || "",
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
      const fallbackGroupKey = `${d.customerPhone?.trim() ?? ""}::${d.titleLine?.trim() ?? ""}`;
      const related = draftsGroupedByKey.get(groupId || fallbackGroupKey) ?? [d];

      const assignedPreparerIds = Array.from(new Set(related.map(r => r.preparerId).filter(Boolean))) as string[];
      const preparerNames = Array.from(new Set(related.map(r => r.preparer?.name).filter(Boolean))).join(" + ") || "بانتظار مجهز";

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
                      existing.pricedBy = rd.preparer?.name || "متجر الويب";
                  }
              } else {
                  mergedProducts.push({ ...p, pricedBy: isPriced ? (rd.preparer?.name || "متجر الويب") : null });
              }
          });
      });

      return {
        id: d.id,
        orderNumber: Number((draftData as any)?.reservedOrderNumber ?? 0) || 0,
        routeMode: "single",
        shopName: "تجهيز تسوق مشترك",
        regionName: d.customerRegion?.name || "—",
        orderType: d.titleLine || "تجهيز تسوق",
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
        submissionLabel: "مسودة مشتركة",
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
      const fallbackGroupKey = `${d.customerPhone?.trim() ?? ""}::${d.titleLine?.trim() ?? ""}`;
      const related = draftsGroupedByKey.get(groupId || fallbackGroupKey) ?? [d];

      related.forEach(r => processedDraftIds.add(r.id));
      groupedDraftRows.push(mapDraftToRow(d));
    }

    const safeGroupedDraftRows = serializePrisma(groupedDraftRows);
    const safeIcons = serializePrisma(icons);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className={ad.h1}>إدارة الطلبات والتجهيز</h1>
          <div className="flex gap-2">
             <Link href={`${SECRET_ADMIN_PATH}/orders/tracking`} className={ad.btnDark}>تتبع الطلبات</Link>
             <Link href={`${SECRET_ADMIN_PATH}/preparation-orders`} className={ad.btnDark}>سجل التجهيز</Link>
             <Link href={`${SECRET_ADMIN_PATH}/orders/new`} className={ad.btnPrimary}>+ طلب إداري جديد</Link>
          </div>
        </div>

        <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
          <Link href="?tab=new" className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === 'new' ? 'border-sky-600 text-sky-700 bg-sky-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            الطلبات الجديدة ({newRows.length})
          </Link>
          <Link href="?tab=preparing" className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === 'preparing' ? 'border-amber-500 text-amber-700 bg-amber-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            قيد التجهيز ({safeGroupedDraftRows.length})
          </Link>
          <Link href="?tab=completed" className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === 'completed' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            مكتمل التجهيز ({preparedRows.length})
          </Link>
        </div>

        {activeTab === "new" && (
          <div className="space-y-4">
            <PendingOrdersClient orders={newRows} couriers={safeCouriers} shops={safeShops} preparers={safePreparers} icons={safeIcons} initialAssignOrderId={activeTab === 'new' ? assignOrder : null} initialPricingId={pricingId} />
          </div>
        )}

        {activeTab === "preparing" && (
          <div className="space-y-4">
            {safeGroupedDraftRows.length === 0 ? (
              <p className="text-center py-12 text-slate-400">لا توجد مسودات قيد التجهيز حالياً.</p>
            ) : (
              <div className="grid gap-3">
                <PendingOrdersClient orders={safeGroupedDraftRows} couriers={safeCouriers} shops={safeShops} preparers={safePreparers} icons={safeIcons} isDraftMode initialPricingId={pricingId} />
              </div>
            )}
          </div>
        )}

        {activeTab === "completed" && (
          <div className="space-y-4">
            <PendingOrdersClient orders={preparedRows} couriers={safeCouriers} shops={safeShops} preparers={safePreparers} icons={safeIcons} initialAssignOrderId={activeTab === 'completed' ? assignOrder : null} initialPricingId={pricingId} />
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

