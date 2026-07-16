"use client";

import { useRouter } from "next/navigation";
import { OrderPricingPanel, AdminPricingPanel } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/orders/pending/pending-orders-client";
import { DynamicIcon } from "@/components/dynamic-icon";
import { type GlobalIconsConfig } from "@/lib/icon-settings";
import Link from "next/link";
import { ad } from "@/lib/admin-ui";

type PriceClientProps = {
  orderId: string;
  orderNumber: string;
  isDraft: boolean;
  initialData: any;
  preparers: any[];
  couriers: any[];
  storeProducts: any[];
  icons: GlobalIconsConfig | null;
  rawDeliveryPriceDinar: number | null;
  orderSummary?: string | null;
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export function PriceClient({
  orderId,
  orderNumber,
  isDraft,
  initialData,
  preparers,
  couriers,
  storeProducts,
  icons,
  rawDeliveryPriceDinar,
  orderSummary,
}: PriceClientProps) {
  const router = useRouter();

  const handleSuccess = () => {
    // الرجوع إلى الصفحة السابقة أو التوجيه الذكي
    if (isDraft) {
      router.push(`${SECRET_ADMIN_PATH}/orders/pending?tab=preparing`);
    } else {
      router.push(`${SECRET_ADMIN_PATH}/orders/${orderId}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 pb-12" dir="rtl">
      {/* Premium Header */}
      <header className="sticky top-0 z-[50] h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between px-4 sm:px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 transition-all hover:scale-105 active:scale-95"
            title="رجوع"
          >
            ↩️
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-950 dark:text-white flex items-center gap-1.5">
              <span>💰</span>
              {isDraft ? `تجهيز وتسعير المسودة #${orderNumber}` : `تعديل تسعير الطلب #${orderNumber}`}
            </h1>
            <p className="text-[10px] sm:text-xs font-bold text-slate-500">
              {isDraft ? "قسم مسودات قيد التجهيز" : "لوحة تعديل الأسعار وتفاصيل الطلب"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`${SECRET_ADMIN_PATH}/orders/pending`}
            className="hidden sm:inline-flex h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 items-center justify-center transition-all"
          >
            لوحة الطلبات المعلقة
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 shadow-xl overflow-hidden min-h-[60vh] flex flex-col">
          <div className="p-4 sm:p-6 flex-1 flex flex-col min-h-0 overflow-y-auto">
            {isDraft ? (
              <OrderPricingPanel
                orderId={orderId}
                initialData={initialData}
                preparers={preparers}
                couriers={couriers}
                isDraft={true}
                icons={icons}
                hideContainer={true}
                storeProducts={storeProducts}
                onSuccess={handleSuccess}
              />
            ) : (
              <AdminPricingPanel
                orderId={orderId}
                initialData={initialData}
                preparers={preparers}
                couriers={couriers}
                storeProducts={storeProducts}
                icons={icons}
                onSuccess={handleSuccess}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
