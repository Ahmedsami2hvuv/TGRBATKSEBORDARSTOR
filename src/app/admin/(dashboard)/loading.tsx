import { ad } from "@/lib/admin-ui";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 w-full py-12" dir="rtl">
      {/* Spinner */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-[6px] border-slate-100"></div>
        <div className="absolute inset-0 rounded-full border-[6px] border-sky-600 border-t-transparent animate-spin"></div>
        <div className="absolute inset-2 rounded-full border-[6px] border-slate-50"></div>
        <div className="absolute inset-2 rounded-full border-[6px] border-sky-400 border-b-transparent animate-[spin_1.5s_linear_infinite_reverse]"></div>
      </div>
      
      {/* Text */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-sky-900 animate-pulse">
          جاري جلب البيانات...
        </h2>
        <p className="text-base text-slate-500">
          الرجاء الانتظار قليلاً ريثما تكتمل العملية
        </p>
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
