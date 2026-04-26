export default function ClientLoading() {
  return (
    <div dir="rtl" lang="ar" className="kse-app-bg flex flex-col items-center justify-center min-h-[100vh] space-y-8 w-full text-slate-800">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-[6px] border-slate-200/50"></div>
        <div className="absolute inset-0 rounded-full border-[6px] border-sky-600 border-t-transparent animate-spin"></div>
        <div className="absolute inset-2 rounded-full border-[6px] border-slate-100/50"></div>
        <div className="absolute inset-2 rounded-full border-[6px] border-sky-400 border-b-transparent animate-[spin_1.5s_linear_infinite_reverse]"></div>
      </div>
      
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-sky-900 animate-pulse">
          جاري جلب البيانات...
        </h2>
        <p className="text-base text-slate-600">
          الرجاء الانتظار قليلاً ريثما تكتمل العملية
        </p>
      </div>
    </div>
  );
}
