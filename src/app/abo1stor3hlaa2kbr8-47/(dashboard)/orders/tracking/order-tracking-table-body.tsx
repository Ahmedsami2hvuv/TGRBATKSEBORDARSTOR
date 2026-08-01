"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, Fragment } from "react";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

import { orderStatusRowClassInteractive } from "@/lib/order-status-style";
import { OrderTypeLine } from "@/components/order-type-line";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { EditPencilLink } from "./edit-pencil-link";
import { AdminPricingPanel } from "../pending/pending-orders-client";
import { isTodayBaghdad, formatBaghdadDateFriendly, getBaghdadDateString } from "@/lib/baghdad-time";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";

export type TrackingTableRow = {
  id: string;
  orderNumber: number;
  orderStatus: string;
  assignedCourierId: string | null;
  shopCustomerLabel: string;
  regionName: string;
  orderType: string;
  routeModeLabel: string;
  totalLabel: string;
  deliveryLabel: string;
  customerPhone: string;
  customerAlternatePhone: string;
  courierName: string;
  orderNoteTime: string | null;
  missingCustomerLocation: boolean;
  hasCourierUploadedLocation: boolean;
  preparerShoppingJson?: any;
  summary: string;
  /** مجموع الصادر (دفع للعميل) بالدينار — لعرضه "من الخارج" */
  pickupSumDinar?: number | null;
  preparerPickupSumDinar?: number | null;
  adminPickupSumDinar?: number | null;
  deliverySumDinar?: number | null;
  preparerDeliverySumDinar?: number | null;
  // تنبيهات مالية
  wardMismatchType?: "excess" | "deficit" | null;
  saderMismatchType?: "excess" | "deficit" | null;
  /** لم يتم تسجيل أي وارد (مهم للتسليم) */
  noWardRecorded?: boolean;
  /** لم يتم تسجيل أي صادر (مهم للاستلام) */
  noSaderRecorded?: boolean;
  createdAt?: Date | string;
  calculatedDebt?: number | null;
  hasDebt?: boolean;
  priceWithDebtLabel?: string;
  // بيانات الوصول السريع
  audioUrl?: string | null;
  adminAudioUrl?: string | null;
  shopPhone?: string | null;
  shopLocationUrl?: string | null;
  customerLocationUrl?: string | null;
  secondCustomerLocationUrl?: string | null;
  shopDoorPhotoUrl?: string | null;
  customerDoorPhotoUrl?: string | null;
  secondCustomerDoorPhotoUrl?: string | null;
  secondCustomerRegionName?: string | null;
};

function AssignCheckLink({ orderId, isAssigned }: { orderId: string; isAssigned?: boolean }) {
  return (
    <Link
      href={`${SECRET_ADMIN_PATH}/orders/pending?assignOrder=${encodeURIComponent(orderId)}`}
      title={isAssigned ? "تغيير المندوب" : "إسناد للمندوب"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition ${
        isAssigned
          ? "border-violet-500 bg-violet-600 hover:bg-violet-700 text-white"
          : "border-emerald-500 bg-emerald-600 hover:bg-emerald-700 text-white"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </Link>
  );
}

export function OrderTrackingTableBody({ rows }: { rows: TrackingTableRow[] }) {
  const router = useRouter();
  const [pricingOpenId, setPricingOpenId] = useState<string | null>(null);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
          لا توجد طلبات مطابقة.
        </td>
      </tr>
    );
  }

  let lastDateStr = "";

  return (
    <>
      {rows.map((o) => {
        const pricingOpen = pricingOpenId === o.id;

        const orderDate = o.createdAt ? new Date(o.createdAt) : null;
        const currentDateStr = orderDate ? getBaghdadDateString(orderDate) : "unknown";

        let separator = null;
        if (currentDateStr !== lastDateStr) {
          lastDateStr = currentDateStr;
          separator = (
            <tr key={`date-sep-${currentDateStr}`} className="bg-red-700 dark:bg-red-900 text-white">
              <td colSpan={11} className="px-4 py-2.5 text-right text-sm font-black uppercase tracking-widest border-y-2 border-red-800 dark:border-red-950">
                {orderDate ? formatBaghdadDateFriendly(orderDate) : "تاريخ غير معروف"}
              </td>
            </tr>
          );
        }

        return (
          <Fragment key={o.id}>
            {separator}
            <tr
              className={`cursor-pointer border-b border-sky-100 transition ${pricingOpen ? "bg-amber-50 ring-2 ring-inset ring-amber-200" : orderStatusRowClassInteractive(o.orderStatus)}`}
              onClick={() => router.push(`${SECRET_ADMIN_PATH}/orders/${o.id}`)}
            >
              <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                <EditPencilLink href={`${SECRET_ADMIN_PATH}/orders/${o.id}/edit`} />
              </td>
              <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1 justify-center">
                  {o.orderStatus !== "cancelled" && o.orderStatus !== "archived" && (
                    <AssignCheckLink
                      orderId={o.id}
                      isAssigned={o.orderStatus !== "pending" || Boolean(o.courierName && o.courierName !== "—")}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setPricingOpenId(pricingOpen ? null : o.id)}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition ${
                      pricingOpen
                        ? "border-amber-600 bg-amber-600 text-white"
                        : "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                    title="تعديل الأسعار"
                  >
                    <DynamicIcon iconKey="wallet_cash" config={icons} fallback="💰" className="w-5 h-5" />
                  </button>
                </div>
              </td>
              <td className="px-2 py-2 font-mono font-bold tabular-nums text-sky-800">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    {o.missingCustomerLocation && (
                      <span className="rounded bg-rose-600 px-1 py-0.5 text-[9px] text-white">!</span>
                    )}
                    {o.hasCourierUploadedLocation && (
                      <span className="rounded bg-violet-600 px-1 py-0.5 text-[9px] text-white">GPS</span>
                    )}
                    <span className="text-sm">#{o.orderNumber}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {o.wardMismatchType === "deficit" && (
                      <span className="whitespace-nowrap rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm ring-1 ring-rose-400 flex items-center gap-1">
                        <DynamicIcon iconKey="finance_deficit" config={icons} fallback="🔴" className="w-2.5 h-2.5" />
                        نقص بالوارد
                      </span>
                    )}
                    {o.wardMismatchType === "excess" && (
                      <span className="whitespace-nowrap rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm ring-1 ring-emerald-400 flex items-center gap-1">
                        <DynamicIcon iconKey="finance_excess" config={icons} fallback="🟢" className="w-2.5 h-2.5" />
                        زيادة بالوارد
                      </span>
                    )}
                    {o.saderMismatchType === "deficit" && (
                      <span className="whitespace-nowrap rounded bg-orange-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm ring-1 ring-orange-300 flex items-center gap-1">
                        <DynamicIcon iconKey="finance_sader_deficit" config={icons} fallback="📉" className="w-2.5 h-2.5" />
                        نقص بالصادر
                      </span>
                    )}
                    {o.saderMismatchType === "excess" && (
                      <span className="whitespace-nowrap rounded bg-sky-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm ring-1 ring-sky-300 flex items-center gap-1">
                        <DynamicIcon iconKey="finance_sader_excess" config={icons} fallback="📈" className="w-2.5 h-2.5" />
                        زيادة بالصادر
                      </span>
                    )}
                    {o.orderStatus === "delivered" && o.noWardRecorded && (
                      <span className="whitespace-nowrap rounded bg-slate-950 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm ring-1 ring-slate-600 animate-pulse flex items-center gap-1">
                        <DynamicIcon iconKey="ui_warning" config={icons} fallback="⚠️" className="w-2.5 h-2.5" />
                        بدون وارد
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-2 py-2">
                <div className="max-w-[14rem] break-words">
                  {o.courierName?.trim() && o.courierName !== "—" ? (
                    <div className="mb-0.5 text-[10px] font-black text-emerald-800">
                      {o.courierName}
                    </div>
                  ) : null}
                  <span className="text-sm text-slate-800">{o.shopCustomerLabel}</span>
                </div>
              </td>
              <td className="max-w-[6rem] px-2 py-2 text-xs text-slate-600">{o.regionName}</td>
              <td className="max-w-[10rem] px-2 py-2 text-xs text-slate-700">
                <OrderTypeLine orderType={o.orderType} className="text-xs" />
              </td>
              <td className="px-2 py-2 font-mono tabular-nums text-slate-900">{o.totalLabel}</td>
              <td className="px-2 py-2 font-mono tabular-nums text-cyan-700">{o.deliveryLabel}</td>
              <td className="px-2 py-2 font-mono text-xs tabular-nums text-slate-700">
                <div className="flex flex-col">
                  <span>{o.customerPhone}</span>
                  {o.customerAlternatePhone && o.customerAlternatePhone !== "—" && o.customerAlternatePhone !== o.customerPhone && (
                    <span className="text-[10px] text-slate-400">{o.customerAlternatePhone}</span>
                  )}
                </div>
              </td>
              <td className="px-2 py-2 text-xs text-slate-600">{o.orderNoteTime || "—"}</td>
              <td className="px-2 py-2 text-[10px] text-slate-400">
                {o.createdAt ? new Date(o.createdAt).toLocaleTimeString("ar-IQ", { hour: '2-digit', minute: '2-digit' }) : "—"}
              </td>
            </tr>
            {pricingOpen && (
              <tr onClick={(e) => e.stopPropagation()}>
                <td colSpan={11} className="p-0">
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl h-[90vh] sm:h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-amber-400 flex flex-col text-right" dir="rtl">
                      <div className="flex flex-shrink-0 items-center justify-between bg-amber-50 px-4 py-3 sm:px-6 sm:py-4 border-b border-amber-200">
                        <h3 className="text-sm sm:text-lg font-black text-amber-900 flex items-center gap-2"><span>💰</span> لوحة تسعير الطلب #{o.orderNumber}</h3>
                        <button onClick={() => setPricingOpenId(null)} className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl bg-red-600 text-white font-bold shadow-sm hover:bg-red-700 transition-colors">✕</button>
                      </div>
                      <div className="flex-1 p-2 sm:p-6 overflow-hidden flex flex-col min-h-0">
                        <AdminPricingPanel
                          orderId={o.id}
                          initialData={o.preparerShoppingJson}
                          orderSummary={o.summary}
                          icons={icons}
                          onSuccess={() => setPricingOpenId(null)}
                        />
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
