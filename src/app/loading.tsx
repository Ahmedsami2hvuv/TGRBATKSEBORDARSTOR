export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50" dir="rtl">
      <div className="text-center">
        <div className="relative inline-flex">
          <div className="h-16 w-16 rounded-full border-4 border-sky-100"></div>
          <div className="absolute left-0 top-0 h-16 w-16 animate-spin rounded-full border-4 border-sky-600 border-t-transparent"></div>
        </div>
        <p className="mt-4 text-sm font-bold text-slate-600 animate-pulse">جاري تحميل البيانات...</p>
      </div>
    </div>
  );
}
