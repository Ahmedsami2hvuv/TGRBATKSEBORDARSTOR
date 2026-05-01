import { DeliveryLoading } from "@/components/delivery-loading";

export default function Loading() {
  return (
    <div className="space-y-12 py-10" dir="rtl">
      {/* Centered Loading Animation */}
      <div className="flex flex-col items-center justify-center">
        <h2 className="text-3xl font-black text-sky-900 mb-6">جاري تحميل الفرع...</h2>
        <div className="w-full max-w-2xl px-6">
          <DeliveryLoading message="نجهز لك قائمة المنتجات المتوفرة حالياً" />
        </div>
      </div>

      <div className="space-y-6 md:space-y-10 animate-pulse px-2 opacity-30 grayscale pointer-events-none">
        {/* Breadcrumbs Skeleton */}
        <div className="flex gap-2 h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded-full" />

        {/* Header Skeleton */}
        <div className="h-48 md:h-64 bg-white dark:bg-slate-900 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-100 dark:border-slate-800 flex items-center p-6 md:p-10 gap-6">
          <div className="w-20 h-20 md:w-36 md:h-36 bg-slate-100 dark:bg-slate-800 rounded-3xl md:rounded-[2.5rem]" />
          <div className="flex-1 space-y-4">
            <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded-full" />
            <div className="h-8 md:h-12 w-1/2 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
            <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
