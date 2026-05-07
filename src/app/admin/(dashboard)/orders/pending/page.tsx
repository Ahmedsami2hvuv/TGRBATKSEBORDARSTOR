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
import { PendingOrdersClient, type PendingOrderRow } from "./pending-orders-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إدارة الطلبات والتجهيز — أبو الأكبر للتوصيل",
};

function customerOrderTimeLabel(orderNoteTime: string | null): string {
  if (!orderNoteTime?.trim()) return "—";
  const t = orderNoteTime.trim();
  return t.replace(/^وقت الطلب:\s*/i, "").trim() || t;
}

type PageProps = { searchParams: Promise<{ tab?: string; assignOrder?: string }> };

export default async function PendingOrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const activeTab = sp.tab ?? "new";
  const assignOrder = (sp.assignOrder ?? "").trim();

  // جلب كافة المسودات النشطة مع المناطق
  const [allActiveDrafts, newOrders, preparedOrders, couriers, shops, preparers, icons] = await Promise.all([
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
      where: { status: "pending", submissionSource: { not: "company_preparer" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        shop: { select: { id: true, name: true, region: { select: { id: true, name: true } } } },
        submittedBy: { select: { id: true, name: true } },
        customerRegion: { select: { id: true, name: true } },
        customer: { select: { id: true, customerLocationUrl: true, customerLandmark: true, customerDoorPhotoUrl: true, alternatePhone: true } },
        moneyEvents: { where: { deletedAt: null }, select: { kind: true, amountDinar: true } },
      },
    }),
    prisma.order.findMany({
      where: { status: "pending", submissionSource: "company_preparer" },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        shop: { select: { id: true, name: true, region: { select: { id: true, name: true } } } },
        submittedBy: { select: { id: true, name: true } },
        submittedByCompanyPreparer: { select: { id: true, name: true } },
        customerRegion: { select: { id: true, name: true } },
        customer: { select: { id: true, customerLocationUrl: true, customerLandmark: true, customerDoorPhotoUrl: true, alternatePhone: true } },
        moneyEvents: { where: { deletedAt: null }, select: { kind: true, amountDinar: true } },
      },
    }),
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
  ]);

  const draftsBySentOrderId = new Map<string, typeof allActiveDrafts>();
  const draftsByCustomerPhone = new Map<string, typeof allActiveDrafts>();
  const draftsGroupedByKey = new Map<string, typeof allActiveDrafts>();

  for (const draft of allActiveDrafts) {
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
    ]));

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      routeMode: o.routeMode === "double" ? "double" : "single",
      shopName: o.routeMode === "double" ? "وجهتين" : normalizeAdminShopName(o.shop.name),
      regionName: o.customerRegion?.name ?? "—",
      orderType: o.orderType?.trim() ? o.orderType : "—",
      customerOrderTime: customerOrderTimeLabel(o.orderNoteTime),
      createdAtLabel: formatBaghdadDateTime(o.createdAt, { dateStyle: "short", timeStyle: "short" }),
      summary: o.summary,
      customerPhone: o.customerPhone,
      customerAlternatePhone: o.secondCustomerPhone?.trim() || o.alternatePhone?.trim() || o.customer?.alternatePhone?.trim() || "",
      customerDoorPhotoUrl: resolvePublicAssetSrc(o.customer?.customerDoorPhotoUrl || o.customerDoorPhotoUrl) ?? "",
      totalAmount: o.totalAmount != null ? formatDinarAsAlfWithUnit(o.totalAmount) : null,
      deliveryPrice: o.deliveryPrice != null ? formatDinarAsAlfWithUnit(o.deliveryPrice) : null,
      rawDeliveryPriceDinar: o.deliveryPrice != null ? Number(o.deliveryPrice) : null,
      submittedByName: o.submittedByCompanyPreparer?.name || o.submittedBy?.name || null,
      submissionLabel: o.submissionSource === "company_preparer" ? "مكتمل التجهيز" : o.submissionSource === "web_store" ? "طلب متجر" : "طلب جديد",
      customerLocationUrl: o.customerLocationUrl || o.customer?.customerLocationUrl || "",
      customerLandmark: o.customerLandmark || o.customer?.customerLandmark || "",
      voiceNoteUrl: o.voiceNoteUrl || null,
      adminVoiceNoteUrl: o.adminVoiceNoteUrl || null,
      hasCustomerLocation: hasCustomerLocationUrl(o.customerLocationUrl, o.customer?.customerLocationUrl),
      hasCourierUploadedLocation: Boolean(o.customerLocationSetByCourierAt),
      reversePickup: isReversePickupOrderType(o.orderType),
      wardMismatchType: isWardMismatch(o.status, o.totalAmount, sumDeliveryInFromOrderMoneyEvents(o.moneyEvents)).type,
      saderMismatchType: isSaderMismatch(o.status, o.orderSubtotal, sumPickupOutFromOrderMoneyEvents(o.moneyEvents)).type,
      preparerShoppingJson: o.preparerShoppingJson,
      assignedPreparerIds,
    };
  };

  const newRows = newOrders.map(mapOrderToRow);
  const preparedRows = preparedOrders.map(mapOrderToRow);

  const groupedDraftRows: PendingOrderRow[] = [];
  const processedDraftIds = new Set<string>();

  for (const d of allActiveDrafts) {
    if (processedDraftIds.has(d.id)) continue;

    const draftData = (d.data as any) || {};
    const groupId = typeof draftData.groupId === "string" ? draftData.groupId.trim() : "";
    const fallbackGroupKey = `${d.customerPhone?.trim() ?? ""}::${d.titleLine?.trim() ?? ""}`;
    const related = draftsGroupedByKey.get(groupId || fallbackGroupKey) ?? [d];

    related.forEach(r => processedDraftIds.add(r.id));

    const assignedPreparerIds = Array.from(new Set(related.map(r => r.preparerId).filter(Boolean))) as string[];
    const preparerNames = Array.from(new Set(related.map(r => r.preparer?.name).filter(Boolean))).join(" + ") || "بانتظار مجهز";

    const mergedProducts: any[] = [];
    related.forEach(rd => {
        const rdData = (rd.data as any) || {};
        const products = rdData.products || [];
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

    groupedDraftRows.push({
      id: d.id,
      orderNumber: 0,
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
      assignedPreparerIds,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className={ad.h1}>إدارة الطلبات والتجهيز</h1>
        <div className="flex gap-2">
           <Link href="/admin/preparation-orders" className={ad.btnDark}>سجل التجهيز</Link>
           <Link href="/admin/orders/new" className={ad.btnPrimary}>+ طلب إداري جديد</Link>
        </div>
      </div>

      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
        <Link href="?tab=new" className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === 'new' ? 'border-sky-600 text-sky-700 bg-sky-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          الطلبات الجديدة ({newRows.length})
        </Link>
        <Link href="?tab=preparing" className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === 'preparing' ? 'border-amber-500 text-amber-700 bg-amber-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          قيد التجهيز ({groupedDraftRows.length})
        </Link>
        <Link href="?tab=completed" className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${activeTab === 'completed' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          مكتمل التجهيز ({preparedRows.length})
        </Link>
      </div>

      {activeTab === "new" && (
        <div className="space-y-4">
          <PendingOrdersClient orders={newRows} couriers={couriers} shops={shops} preparers={preparers} icons={icons} initialAssignOrderId={activeTab === 'new' ? assignOrder : null} />
        </div>
      )}

      {activeTab === "preparing" && (
        <div className="space-y-4">
          {groupedDraftRows.length === 0 ? (
            <p className="text-center py-12 text-slate-400">لا توجد مسودات قيد التجهيز حالياً.</p>
          ) : (
            <div className="grid gap-3">
              <PendingOrdersClient orders={groupedDraftRows} couriers={couriers} shops={shops} preparers={preparers} icons={icons} isDraftMode />
            </div>
          )}
        </div>
      )}

      {activeTab === "completed" && (
        <div className="space-y-4">
          <PendingOrdersClient orders={preparedRows} couriers={couriers} shops={shops} preparers={preparers} icons={icons} initialAssignOrderId={activeTab === 'completed' ? assignOrder : null} />
        </div>
      )}
    </div>
  );
}
