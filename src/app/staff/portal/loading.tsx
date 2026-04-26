export default function StaffPortalLoading() {
  return (
    <div className="kse-app-bg min-h-screen flex items-center justify-center p-8 text-slate-800" dir="rtl">
      <div className="text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
          <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">جاري التحميل...</span>
        </div>
        <h2 className="mt-4 text-xl font-black text-slate-900">جاري تحميل البيانات...</h2>
        <p className="mt-2 text-sm text-slate-500 font-bold italic">يرجى الانتظار، جاري الاتصال بالخادم</p>
      </div>
    </div>
  );
}
