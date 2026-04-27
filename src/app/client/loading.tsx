export default function ClientLoading() {
  return (
    <div dir="rtl" lang="ar" className="kse-app-bg flex flex-col items-center justify-center min-h-[100vh] space-y-8 w-full text-slate-800 p-6">
      <div className="text-center space-y-4 w-full max-w-md">
        <h2 className="text-2xl font-bold text-sky-900">
          جاري جلب البيانات...
        </h2>

        {/* Beautiful Gradient Progress Bar */}
        <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-sky-400 via-blue-500 to-sky-600 animate-[progress-indeterminate_2s_infinite_linear] rounded-full"
            style={{ width: '40%' }}
          ></div>
        </div>

        <p className="text-base text-slate-600 animate-pulse">
          الرجاء الانتظار قليلاً ريثما تكتمل العملية
        </p>
      </div>
    </div>
  );
}
