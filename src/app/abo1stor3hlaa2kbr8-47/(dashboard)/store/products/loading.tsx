import { DeliveryLoading } from "@/components/delivery-loading";

export default function Loading() {
  return (
    <div className="p-6 space-y-4" dir="rtl">
      <DeliveryLoading message="يتم الآن جلب جميع تفاصيل المنتجات" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 opacity-20 grayscale pointer-events-none mt-12">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-[2.5rem] border-2 border-transparent shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden">
            <div className="aspect-square bg-slate-100 animate-pulse"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 w-full bg-slate-100 animate-pulse rounded"></div>
              <div className="h-4 w-2/3 bg-slate-100 animate-pulse rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
