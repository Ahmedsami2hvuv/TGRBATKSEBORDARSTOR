import { DeliveryLoading } from "@/components/delivery-loading";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full py-12 px-6" dir="rtl">
      <div className="text-center w-full max-w-4xl">
        <DeliveryLoading message="جاري جلب بيانات لوحة التحكم..." />
      </div>

      {/* Skeletons placeholders more aligned with dashboard rows */}
      <div className="w-full max-w-5xl space-y-4 mt-4 opacity-40 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
           <div className="h-32 bg-slate-200 rounded-2xl animate-pulse"></div>
           <div className="h-32 bg-slate-200 rounded-2xl animate-pulse"></div>
           <div className="h-32 bg-slate-200 rounded-2xl animate-pulse"></div>
        </div>
        <div className="h-16 bg-slate-100 rounded-xl animate-pulse w-full"></div>
        <div className="h-16 bg-slate-100 rounded-xl animate-pulse w-[98%]"></div>
        <div className="h-16 bg-slate-100 rounded-xl animate-pulse w-[95%]"></div>
      </div>
    </div>
  );
}
