import { DeliveryLoading } from "@/components/delivery-loading";

export default function Loading() {
  return (
    <div className="p-6 space-y-4" dir="rtl">
      <DeliveryLoading message="لحظات ونعرض لك جميع التصنيفات المتاحة" />

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 opacity-20 grayscale pointer-events-none mt-12">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-[2.5rem] border border-slate-100 space-y-4">
             <div className="aspect-square bg-slate-50 animate-pulse rounded-[2rem]"></div>
             <div className="h-5 w-3/4 mx-auto bg-slate-100 animate-pulse rounded-full"></div>
             <div className="h-3 w-1/2 mx-auto bg-slate-50 animate-pulse rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
