import { DeliveryLoading } from "@/components/delivery-loading";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 w-full py-12 px-6" dir="rtl">
      <div className="text-center space-y-4 w-full max-w-md">
        <h2 className="text-2xl font-bold text-sky-900">
          جاري جلب البيانات...
        </h2>

        <DeliveryLoading message="الرجاء الانتظار قليلاً ريثما تكتمل العملية" />
      </div>

      {/* Skeleton placeholders to hint at loading content */}
      <div className="w-full max-w-4xl space-y-4 mt-8 opacity-60">
        <div className="h-24 bg-slate-200 rounded-xl animate-pulse w-full"></div>
        <div className="h-16 bg-slate-100 rounded-xl animate-pulse w-[95%]"></div>
        <div className="h-16 bg-slate-100 rounded-xl animate-pulse w-[90%]"></div>
        <div className="h-16 bg-slate-100 rounded-xl animate-pulse w-[85%]"></div>
      </div>
    </div>
  );
}
