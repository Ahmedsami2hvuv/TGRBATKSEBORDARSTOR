export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6" dir="rtl">
      <div className="text-center space-y-4 w-full max-w-md">
        <h2 className="text-2xl font-bold text-sky-900">
          جاري تحميل البيانات...
        </h2>

        {/* Beautiful Gradient Progress Bar */}
        <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-sky-400 via-blue-500 to-sky-600 animate-[progress-indeterminate_2s_infinite_linear] rounded-full"
            style={{ width: '40%' }}
          ></div>
        </div>

        <p className="text-sm font-medium text-slate-500 animate-pulse">
          يرجى الانتظار، نحن نجهز لك التجربة الأفضل
        </p>
      </div>
    </div>
  );
}
