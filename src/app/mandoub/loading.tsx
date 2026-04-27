export default function MandoubLoading() {
  return (
    <div dir="rtl" className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="w-full max-w-md text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800">جاري التحميل...</h2>
        <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-600 animate-[progress-indeterminate_2s_infinite_linear] rounded-full"
            style={{ width: '40%' }}
          ></div>
        </div>
        <p className="text-slate-500 animate-pulse">يرجى الانتظار، جاري تحضير المهام</p>
      </div>
    </div>
  );
}
