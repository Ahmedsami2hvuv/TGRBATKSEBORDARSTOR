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
  title: "إدارة الطلبات والتجهيز — أبو الأكبر للتوصيل",
};

function customerOrderTimeLabel(orderNoteTime: string | null): string {
  if (!orderNoteTime?.trim()) return "—";
  const t = orderNoteTime.trim();
  return t.replace(/^وقت الطلب:\s*/i, "").trim() || t;
}

type PageProps = { searchParams: Promise<{ tab?: string; assignOrder?: string; pricing?: string; fishPrices?: string }> };

export default async function PendingOrdersPage({ searchParams }: PageProps) {
  try {
    const sp = await searchParams;
    const assignOrder = (sp.assignOrder ?? "").trim();
    const pricingId = (sp.pricing ?? "").trim();
    const showFishPrices = sp.fishPrices === "true";

    // تحديد التبويب الفعلي قبل جلب البيانات
    const assignOrderExistsInPrepared = assignOrder ? await prisma.order.count({ where: { id: assignOrder, submissionSource: "company_preparer" } }) > 0 : false;
    const activeTab = sp.tab ?? (assignOrderExistsInPrepared ? "completed" : "new");

    // 1. جلب المسودات دائماً (نحتاجها لحساب عدد المسودات المجمعة بدقة في التبويب)
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

    if (activeTab === "new" || activeTab === "completed") {
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
    } else {
      newCountPromise = prisma.order.count({ where: { status: "pending" } });
      preparedCountPromise = prisma.order.count({ where: { status: "pending", submissionSource: "company_preparer" } });
    }

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
      // جلب المنتجات فقط عند الحاجة لتخفيف الضغط
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

    // تصفية وتنقية المسودات التي تم إكمال طلباتها وتغيير حالتها عن pending (مثل تم التسليم أو الأرشفة)
    const sentDraftOrderIds = Array.from(new Set(allActiveDrafts.map(d => d.sentOrderId).filter(Boolean))) as string[];
    const sentOrdersStatusMap = new Map<string, { status: string; archivedAt: Date | null }>();

    if (sentDraftOrderIds.length > 0) {
      const foundOrders = await prisma.order.findMany({
        where: { id: { in: sentDraftOrderIds } },
        select: { id: true, status: true, archivedAt: true }
      });
      foundOrders.forEach(o => sentOrdersStatusMap.set(o.id, o));
    }

    const filteredActiveDrafts = allActiveDrafts.filter(draft => {
      if (draft.sentOrderId) {
        const orderInfo = sentOrdersStatusMap.get(draft.sentOrderId);
        if (orderInfo && (orderInfo.status !== "pending" || orderInfo.archivedAt != null)) {
          return false;
        }
      }
      return true;
    });

    // تحويل البيانات إلى JSON لضمان التوافق مع Next.js 15 (Serialization safety)
    const safeAllActiveDrafts = serializePrisma(filteredActiveDrafts);
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
      const phoneLocal = normalizeIraqMobileLocal11(draft.customerPhone) || draft.customerPhone;
      const phoneKeyForGroup = phoneLocal?.trim() ?? "";
      const titleKey = draft.titleLine?.trim() ?? "";
      
      const isStoreOrder = titleKey.includes("المتجر");
      const groupingKey = typeof draftData.groupId === "string" ? draftData.groupId.trim() : (isStoreOrder ? `store_${draft.id}` : `${phoneKeyForGroup}::${titleKey}`);
      
      if (!draftsGroupedByKey.has(groupingKey)) {
        draftsGroupedByKey.set(groupingKey, []);
      }
      const groupedList = draftsGroupedByKey.get(groupingKey)!;
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

      // حساب رابط طلب الموقع الجغرافي ورابط تبليغ الزبون مع فحص صلاحية الظهور للإدارة
      const requestLocationBtn = waButtons.find(b => {
        const scopes = (b.visibilityScope && b.visibilityScope.trim() ? b.visibilityScope : "all")
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        const canSeeAdmin = scopes.includes("all") || scopes.includes("admin");
        if (!canSeeAdmin) return false;

        return (
          b.label.includes("طلب لوكيشن") || 
          b.label.includes("طلب لكيشن") || 
          b.label.includes("طلب الموقع") ||
          b.label.includes("لوكيشن") ||
          b.label.includes("لكيشن")
        );
      });

      const notifyCustomerBtn = waButtons.find(b => {
        const scopes = (b.visibilityScope && b.visibilityScope.trim() ? b.visibilityScope : "all")
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        const canSeeAdmin = scopes.includes("all") || scopes.includes("admin");
        if (!canSeeAdmin) return false;

        return (
          b.label.includes("تبليغ زبون") || 
          b.label.includes("تبليغ") || 
          b.label.includes("إشعار") ||
          b.label.includes("اشعار")
        );
      });

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
        const variants = splitMandoubWaTemplateVariants(requestLocationBtn.templateText || "")
          .map(t => applyMandoubWaTemplate(t, vars));
        const message = variants.length > 0 ? variants[Math.floor(Math.random() * variants.length)] : "";
        requestLocationWaUrl = whatsappMeUrl(o.customerPhone, message);
      }

      if (notifyCustomerBtn && o.customerPhone) {
        const variants = splitMandoubWaTemplateVariants(notifyCustomerBtn.templateText || "")
          .map(t => applyMandoubWaTemplate(t, vars));
        const message = variants.length > 0 ? variants[Math.floor(Math.random() * variants.length)] : "";
        notifyCustomerWaUrl = whatsappMeUrl(o.customerPhone, message);
      }

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        routeMode: o.routeMode === "double" ? "double" : "single",
        shopName: o.routeMode === "double"
          ? `من ${o.customerRegion?.name ?? "غير معروف"} إلى ${o.secondCustomerRegion?.name ?? "غير معروف"}`
          : (o.submittedByCompanyPreparerId || o.submissionSource === "company_preparer" || (o.submittedByCompanyPreparer?.name && o.shop?.name && o.shop.name.trim() === o.submittedByCompanyPreparer.name.trim()))
            ? "الإدارة"
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
        prepaidAll: Boolean(o.prepaidAll),
        vehiclePreference: o.vehiclePreference,
        assignedPreparerIds,
        requestLocationWaUrl,
        notifyCustomerWaUrl,
      };
    };

    const mapDraftToRow = (d: any): PendingOrderRow => {
        const draftData = (d.data as any) || {};
        const groupId = typeof draftData.groupId === "string" ? draftData.groupId.trim() : "";
        const isStoreOrder = (d.titleLine?.trim() || "").includes("المتجر");
        const fallbackGroupKey = isStoreOrder ? `store_${d.id}` : `${d.customerPhone?.trim() ?? ""}::${d.titleLine?.trim() ?? ""}`;
        const related = draftsGroupedByKey.get(groupId || fallbackGroupKey) ?? [d];

      const assignedPreparerIds = Array.from(new Set(related.map(r => r.preparerId).filter(Boolean))) as string[];
      const preparerNames = Array.from(new Set(related.map(r => r.preparer?.name).filter(Boolean))).join(" + ") || "بانتظار مجهز";

      const mergedProducts: any[] = [];
      related.forEach(rd => {
          const rdData = (rd.data as any) || {};
          const products = Array.isArray(rdData.products) ? rdData.products : [];
          products.forEach((p: any) => {
              const itemQty = p.qty ?? p.quantity ?? p.count ?? 1;
              const existing = mergedProducts.find(m => m.line === p.line);
              const isPriced = p.buyAlf && p.buyAlf !== "0";
              if (existing) {
                  if ((!existing.buyAlf || existing.buyAlf === "0") && isPriced) {
                      existing.buyAlf = p.buyAlf;
                      existing.sellAlf = p.sellAlf;
                      existing.pricedBy = rd.preparer?.name || "متجر الويب";
                  }
                  if (p.qty || p.quantity) {
                    existing.qty = Math.max(Number(existing.qty || 1), Number(itemQty));
                    existing.quantity = existing.qty;
                  }
              } else {
                  mergedProducts.push({ 
                    ...p, 
                    qty: Number(itemQty),
                    quantity: Number(itemQty),
                    count: Number(itemQty),
                    pricedBy: isPriced ? (rd.preparer?.name || "متجر الويب") : null 
                  });
              }
          });
      });

      return {
        id: d.id,
        orderNumber: Number((draftData as any)?.reservedOrderNumber || d.draftNumber || 0),
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
    
    const finalNewCount = activeTab === "new" || activeTab === "completed" ? newRows.length : newCountRaw;
    const finalPreparedCount = activeTab === "new" || activeTab === "completed" ? preparedRows.length : preparedCountRaw;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          <h1 className={ad.h1}>إدارة الطلبات والتجهيز</h1>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
             <Link
               href={`${SECRET_ADMIN_PATH}/orders/new`}
               title="طلب إداري جديد"
               className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-sm active:scale-95 transition-all whitespace-nowrap shrink-0"
             >
               <span className="text-sm">➕</span>
               <span>طلب جديد</span>
             </Link>

             <Link
               href="?fishPrices=true"
               title="أسعار السمك اليومية"
               className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-95 transition-all whitespace-nowrap shrink-0"
             >
               <span className="text-sm">🐟</span>
               <span>أسعار السمك</span>
             </Link>

             <Link
               href={`${SECRET_ADMIN_PATH}/orders/tracking`}
               title="تتبع الطلبات"
               className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-sky-300 bg-white hover:bg-sky-50 text-sky-900 shadow-sm active:scale-95 transition-all whitespace-nowrap shrink-0"
             >
               <span className="text-sm">📍</span>
               <span>التتبع</span>
             </Link>

             <Link
               href={`${SECRET_ADMIN_PATH}/preparation-orders`}
               title="سجل التجهيز"
               className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-sky-300 bg-white hover:bg-sky-50 text-sky-900 shadow-sm active:scale-95 transition-all whitespace-nowrap shrink-0"
             >
               <span className="text-sm">📋</span>
               <span>السجل</span>
             </Link>
          </div>
        </div>

        <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
          <Link href="?tab=new" className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === 'new' ? 'border-sky-600 text-sky-700 bg-sky-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            الطلبات الجديدة ({finalNewCount})
          </Link>
          <Link href="?tab=preparing" className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === 'preparing' ? 'border-amber-500 text-amber-700 bg-amber-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            قيد التجهيز ({safeGroupedDraftRows.length})
          </Link>
          <Link href="?tab=completed" className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === 'completed' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            مكتمل التجهيز ({finalPreparedCount})
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
              <p className="text-center py-12 text-slate-400">لا توجد مسودات قيد التجهيز حالياً.</p>
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

