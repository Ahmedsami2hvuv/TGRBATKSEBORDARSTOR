import { DeliveryLoading } from "@/components/delivery-loading";

export default function Loading() {
  return (
    <div className="space-y-12 py-10" dir="rtl">
      {/* Centered Loading Animation */}
      <div className="flex flex-col items-center justify-center">
        <h2 className="text-3xl font-black text-sky-900 mb-6">جاري تحميل التصنيف...</h2>
        <div className="w-full max-w-2xl px-6">
          <DeliveryLoading message="نبحث لك عن أفضل المنتجات في هذا التصنيف" />
        </div>
      </div>

      <div className="space-y-6 md:space-y-8 animate-pulse px-2 opacity-30 grayscale pointer-events-none">
        {/* Breadcrumbs Skeleton */}
        <div className="flex gap-2 h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded-full" />

        {/* Category Header Skeleton */}
        <div className="h-32 md:h-48 bg-white dark:bg-slate-900 rounded-[2rem] md:rounded-[3rem] border border-slate-100 dark:border-slate-800 flex items-center p-4 md:p-8 gap-4 md:gap-8">
          <div className="w-16 h-16 md:w-32 md:h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl md:rounded-[2rem]" />
          <div className="flex-1 space-y-3">
            <div className="h-6 md:h-10 w-1/2 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            <div className="h-3 md:h-4 w-3/4 bg-slate-100 dark:bg-slate-800 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
